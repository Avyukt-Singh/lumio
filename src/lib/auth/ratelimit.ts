// In-memory rate limiter (chunk 5A). The platform stack specifies local
// memory caching only — no Redis — so buckets live in a module-level Map and
// reset per process. Good enough for the single-instance sandbox deployment;
// documented as such in docs/KNOWN_LIMITS.md.
import 'server-only';
import { LIMITS } from './constants';

interface Bucket {
  count: number;
  windowStart: number;
}

// Route bundles re-evaluate this module per route in dev, so state MUST live
// on globalThis to be shared across route handlers in one process.
const g = globalThis as unknown as { __lumioBuckets?: Map<string, Bucket> };
const buckets = (g.__lumioBuckets ??= new Map<string, Bucket>());

/** Consume one unit from `key`'s hourly window. Returns false when over cap. */
export function consume(key: string, cap: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.windowStart >= LIMITS.hourMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return 1 <= cap;
  }
  b.count += 1;
  if (b.count > cap) return false;
  return true;
}

/** Current usage inside the open window (for calm "try later" copy). */
export function peek(key: string): { count: number; retryAfterMs: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.windowStart >= LIMITS.hourMs) return { count: 0, retryAfterMs: 0 };
  return {
    count: b.count,
    retryAfterMs: Math.max(0, LIMITS.hourMs - (now - b.windowStart)),
  };
}

/** Opportunistic prune so the Map cannot grow unbounded. */
export function prune(): void {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now - b.windowStart >= LIMITS.hourMs) buckets.delete(k);
  }
}
