// Shared /api/ai/* route helpers. Every AI feature is open to everyone —
// no sign-in, no opt-in toggle, no consent gate. The budget ledger still
// needs an owner: signed-in learners use their account id, everyone else
// gets a stable per-IP guest identity so anonymous traffic still has fair
// daily caps. Responses use the same stable { ok, code } shape as the auth
// routes so one client wrapper serves both.
import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { clientIp, ipHash } from '@/lib/auth/env';
import { originAllowed } from '@/lib/auth/http';
import { checkBudget } from './budget';

export type AiErrorCode =
  | 'BAD_REQUEST'
  | 'SIGN_IN_REQUIRED'
  | 'AI_DISABLED'
  | 'CONSENT_REQUIRED'
  | 'OVER_BUDGET'
  | 'UNCONFIGURED'
  | 'UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'INVALID_RESPONSE'
  | 'BLOCKED_BY_POLICY'
  | 'SERVER_ERROR';

export function aiOk(extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ ok: true, ...extra });
}

export function aiFail(
  code: AiErrorCode,
  status = 400,
  extra: Record<string, unknown> = {}
): NextResponse {
  return NextResponse.json({ ok: false, code, ...extra }, { status });
}

const MINOR_BANDS = new Set(['young', 'middle', 'sec']);

export interface AiGate {
  userId: string;
  band: string;
  minor: boolean;
  lang: 'en' | 'hi' | 'hinglish';
  ip: string;
}

/** Parse the learner language once, at the boundary. */
export function normLang(raw: unknown): 'en' | 'hi' | 'hinglish' {
  return raw === 'hi' || raw === 'hinglish' ? raw : 'en';
}

/**
 * Stable budget owner for learners without an account. Keyed on the hashed
 * IP so the same device keeps one fair daily allowance without any personal
 * data (the ledger only ever stores this opaque guest id).
 */
export function guestUserId(ip: string): string {
  return `guest:${ipHash(ip)}`;
}

/**
 * Full pre-call gate. Returns either the gate context or a ready error
 * response. Sign-in is optional: signed-in learners get their account id,
 * guests get the per-IP guest id. Budget is the only remaining gate.
 */
export async function aiGate(req: Request): Promise<{ gate: AiGate } | { res: NextResponse }> {
  const origin = originAllowed(req);
  if (!origin) return { res: aiFail('BAD_REQUEST', 403) };

  const ip = clientIp(req);
  const user = await currentUser();
  const userId = user?.id ?? guestUserId(ip);

  const budget = await checkBudget(userId, ip, new Date());
  if (!budget.ok) {
    return { res: aiFail('OVER_BUDGET', 429, { usage: budget.usage, caps: budget.caps }) };
  }
  return {
    gate: { userId, band: user?.ageBand ?? 'sec', minor: MINOR_BANDS.has(user?.ageBand ?? 'sec'), lang: 'en', ip },
  };
}

/** Parse and validate a JSON body (shared with auth but with AI codes). */
export async function aiParseBody<S extends z.ZodType>(
  req: Request,
  schema: S,
  maxBytes = 300_000
): Promise<{ ok: true; body: z.infer<S> } | { ok: false; res: NextResponse }> {
  const raw = await req.text();
  if (raw.length > maxBytes) return { ok: false, res: aiFail('BAD_REQUEST', 413) };
  let json: unknown;
  try {
    json = JSON.parse(raw || '{}');
  } catch {
    return { ok: false, res: aiFail('BAD_REQUEST') };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { ok: false, res: aiFail('BAD_REQUEST') };
  return { ok: true, body: parsed.data };
}
