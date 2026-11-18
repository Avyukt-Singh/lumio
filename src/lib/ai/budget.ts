// Budget ledger + abuse protection (chunk 5B). Free-tier quotas are finite,
// so every AI call needs a verified signed-in owner (never an anonymous
// caller), per-user/day and per-IP/hour caps from env, and a global daily
// cap. Non-personal generations are cached by a hash of the request so the
// same input never burns the quota twice. All failures return OVER_BUDGET,
// which the UI renders as the calm "AI help is resting" message.
import 'server-only';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { authSecret, ipHash as hashIp } from '@/lib/auth/env';
import { aiCaps } from './env';

/** ISO yyyy-mm-dd in a fixed offset (quota days align with the app's day key). */
export function aiDayKey(now: Date): string {
  const iso = new Date(now.getTime() - 0).toISOString(); // UTC day; quotas are per deployment, UTC is honest and stable
  return iso.slice(0, 10);
}

// ---------- per-IP hourly limiter (in-memory, cross-bundle via globalThis) ----------

interface IpBucket {
  hour: string;
  count: number;
}
const g = globalThis as unknown as { __lumioAiIpBuckets?: Map<string, IpBucket> };
const ipBuckets = (g.__lumioAiIpBuckets ??= new Map());

function hourKey(now: Date): string {
  return `${aiDayKey(now)}T${String(now.getUTCHours()).padStart(2, '0')}`;
}

export function ipCallsLeft(ip: string, now: Date): number {
  const key = hashIp(ip);
  const bucket = ipBuckets.get(key);
  const hour = hourKey(now);
  if (!bucket || bucket.hour !== hour) return aiCaps.ipHourlyCalls();
  return Math.max(0, aiCaps.ipHourlyCalls() - bucket.count);
}

function recordIpCall(ip: string, now: Date): void {
  const key = hashIp(ip);
  const hour = hourKey(now);
  const bucket = ipBuckets.get(key);
  if (!bucket || bucket.hour !== hour) {
    ipBuckets.set(key, { hour, count: 1 });
    if (ipBuckets.size > 5000) {
      // opportunistic prune of stale buckets
      for (const [k, b] of ipBuckets) if (b.hour !== hour) ipBuckets.delete(k);
    }
    return;
  }
  bucket.count += 1;
}

// ---------- budget check (all caps must pass before any provider call) ----------

export interface BudgetUsage {
  userCalls: number;
  userTokens: number;
  globalCalls: number;
  ipCalls: number;
}

export interface BudgetVerdict {
  ok: boolean;
  usage: BudgetUsage;
  caps: { userDailyCalls: number; userDailyTokens: number; ipHourlyCalls: number; globalDailyCalls: number };
}

export async function checkBudget(
  userId: string,
  ip: string,
  now: Date
): Promise<BudgetVerdict> {
  const day = aiDayKey(now);
  const [userAgg, globalAgg] = await Promise.all([
    db.aiUsage.aggregate({
      _sum: { calls: true, tokensIn: true, tokensOut: true },
      where: { day, userId },
    }),
    db.aiUsage.aggregate({ _sum: { calls: true }, where: { day } }),
  ]);
  const usage: BudgetUsage = {
    userCalls: userAgg._sum.calls ?? 0,
    userTokens: (userAgg._sum.tokensIn ?? 0) + (userAgg._sum.tokensOut ?? 0),
    globalCalls: globalAgg._sum.calls ?? 0,
    ipCalls: aiCaps.ipHourlyCalls() - ipCallsLeft(ip, now),
  };
  const caps = {
    userDailyCalls: aiCaps.userDailyCalls(),
    userDailyTokens: aiCaps.userDailyTokens(),
    ipHourlyCalls: aiCaps.ipHourlyCalls(),
    globalDailyCalls: aiCaps.globalDailyCalls(),
  };
  const ok =
    usage.userCalls < caps.userDailyCalls &&
    usage.userTokens < caps.userDailyTokens &&
    usage.globalCalls < caps.globalDailyCalls &&
    usage.ipCalls < caps.ipHourlyCalls;
  return { ok, usage, caps };
}

/** Remaining per-user budget for the honest UI display. */
export async function budgetRemaining(userId: string, now: Date) {
  const day = aiDayKey(now);
  const agg = await db.aiUsage.aggregate({
    _sum: { calls: true, tokensIn: true, tokensOut: true },
    where: { day, userId },
  });
  const calls = agg._sum.calls ?? 0;
  const tokens = (agg._sum.tokensIn ?? 0) + (agg._sum.tokensOut ?? 0);
  return {
    day,
    calls,
    callsLeft: Math.max(0, aiCaps.userDailyCalls() - calls),
    callsCap: aiCaps.userDailyCalls(),
    tokensLeft: Math.max(0, aiCaps.userDailyTokens() - tokens),
  };
}

/** Record one completed call (or a failed one — failures also cost attempts). */
export async function recordUsage(opts: {
  userId: string;
  feature: string;
  ip: string;
  tokensIn: number;
  tokensOut: number;
  now: Date;
}): Promise<void> {
  const day = aiDayKey(opts.now);
  recordIpCall(opts.ip, opts.now);
  await db.aiUsage.upsert({
    where: { day_userId_feature: { day, userId: opts.userId, feature: opts.feature } },
    create: {
      day,
      userId: opts.userId,
      feature: opts.feature,
      calls: 1,
      tokensIn: opts.tokensIn,
      tokensOut: opts.tokensOut,
    },
    update: {
      calls: { increment: 1 },
      tokensIn: { increment: opts.tokensIn },
      tokensOut: { increment: opts.tokensOut },
    },
  });
}

// ---------- response cache for non-personal generations ----------

interface CacheEntry {
  at: number;
  text: string;
  adapter: string;
  tokensIn: number;
  tokensOut: number;
}
const gCache = globalThis as unknown as { __lumioAiCache?: Map<string, CacheEntry> };
const cache = (gCache.__lumioAiCache ??= new Map());
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 200;

export function cacheKey(promptVersion: string, contentVersion: string, input: unknown): string {
  return createHash('sha256')
    .update(`${authSecret()}:ai:${promptVersion}:${contentVersion}:${stableStringify(input)}`)
    .digest('hex');
}

function stableStringify(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val instanceof Object && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as object).sort(([a], [b]) => (a < b ? -1 : 1)))
      : val
  );
}

export function cacheGet(key: string): CacheEntry | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit;
}

export function cachePut(key: string, entry: Omit<CacheEntry, 'at'>): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { ...entry, at: Date.now() });
}
