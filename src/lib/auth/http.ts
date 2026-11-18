// Shared route-handler helpers (chunk 5A). Every auth route returns the same
// stable JSON shape `{ ok, code?, message?, ... }`, validates its body with
// Zod (unknown fields rejected), caps body size, and runs a cheap Origin
// check on state-changing requests. Error codes come from a closed list and
// map to calm learner-facing strings in i18n.
import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { LIMITS } from '@/lib/auth/constants';

export type AuthErrorCode =
  | 'BAD_REQUEST'
  | 'RATE_LIMITED'
  | 'NEEDS_VERIFICATION'
  | 'BAD_CREDENTIALS'
  | 'LOCKED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_TOO_MANY_ATTEMPTS'
  | 'OTP_RESEND_COOLDOWN'
  | 'TICKET_INVALID'
  | 'RECOVERY_INVALID'
  | 'UNAUTHENTICATED'
  | 'REAUTH_REQUIRED'
  | 'CONFIRMATION_MISMATCH'
  | 'EMAIL_DISABLED'
  | 'SERVER_ERROR';

export function ok(extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ ok: true, ...extra });
}

export function fail(
  code: AuthErrorCode,
  status = 400,
  extra: Record<string, unknown> = {}
): NextResponse {
  // The client maps `code` to calm copy; no provider or DB internals pass here.
  return NextResponse.json({ ok: false, code, ...extra }, { status });
}

/** Same shape for both "exists" and "doesn't exist" paths (anti-enumeration). */
export function indistinguishable(extra: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ ok: true, ...extra });
}

/** Strip the port from a host value ("example.com:443" -> "example.com"). */
function hostSansPort(host: string): string {
  return host.replace(/:\d+$/, '').trim();
}

/**
 * Reject a mismatched Origin on state-changing requests (cheap CSRF cut).
 *
 * This deployment is previewed through gateways/proxies/frames that rewrite
 * Host or give the document an opaque origin, so header-sniffing alone is
 * unreliable. Strategy, in order:
 *  1. No Origin header (curl, server-to-server) -> allowed.
 *  2. `Origin: null` — browsers send this from sandboxed preview iframes;
 *     it can never be matched against a host, so allow it outside production.
 *  3. Fetch Metadata (`sec-fetch-site: same-origin|none`) — the browser
 *     itself asserts the request came from our own page; this survives any
 *     proxy header rewriting and is the strongest signal.
 *  4. Host comparisons against `Host` / `X-Forwarded-Host`, exact or by
 *     registrable domain, for non-browser clients that still send Origin.
 * Anything else is rejected, with the decisive headers logged for diagnosis.
 */
export function originAllowed(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // curl / same-origin fetches without Origin header
  if (origin === 'null') return process.env.NODE_ENV !== 'production';
  const site = req.headers.get('sec-fetch-site');
  if (site === 'same-origin' || site === 'none') return true;
  try {
    const o = new URL(origin);
    const hosts = new Set<string>();
    const host = req.headers.get('host');
    const fwdHost = req.headers.get('x-forwarded-host');
    if (host) hosts.add(host);
    if (fwdHost) hosts.add(fwdHost.split(',')[0].trim());
    for (const h of hosts) {
      const bare = hostSansPort(h);
      // Exact host:port match (direct same-origin fetch).
      if (o.host === h) return true;
      // Gateway case: Origin host equals the forwarded host (port-insensitive).
      if (o.host === bare) return true;
      // Same registrable domain (e.g. sub.preview.example.com ≈ example.com).
      const hostReg = bare.split('.').slice(-2).join('.');
      const originReg = o.hostname.split('.').slice(-2).join('.');
      if (hostReg && hostReg === originReg) return true;
    }
  } catch {
    // fall through to rejection
  }
  console.warn(
    '[auth] origin rejected:',
    JSON.stringify({ origin, host: req.headers.get('host'), fwdHost: req.headers.get('x-forwarded-host'), site })
  );
  return false;
}

/** Parse and Zod-validate a JSON body, capping its size; unknown keys rejected. */
export async function parseBody<S extends z.ZodType>(
  req: Request,
  schema: S
): Promise<{ ok: true; body: z.infer<S> } | { ok: false; res: NextResponse }> {
  const raw = await req.text();
  if (raw.length > LIMITS.bodyBytes) {
    return { ok: false, res: fail('BAD_REQUEST', 413) };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw || '{}');
  } catch {
    return { ok: false, res: fail('BAD_REQUEST') };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { ok: false, res: fail('BAD_REQUEST') };
  return { ok: true, body: parsed.data };
}

/** Trim + lowercase emails once, at the boundary. */
export function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** JSON error responses must never echo the offending input. */
export const emailSchema = z.string().trim().min(3).max(254).email();
export const passwordSchema = z.string().min(8).max(128);
export const codeSchema = z.string().trim().regex(/^\d{6}$/);
export const purposeSchema = z.enum(['signup', 'login', 'reset', 'delete']);

/** Mask an email for display back to the learner: s•••@gmail.com. */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '•••';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  return `${local[0]}•••${local.length > 1 ? local[local.length - 1] : ''}${domain}`;
}
