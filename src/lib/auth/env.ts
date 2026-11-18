// Server-side env resolution (chunk 5A). The app must boot with ZERO env vars
// configured: DATABASE_URL gets a dev fallback, AUTH_SECRET gets a per-process
// random value in development (with a one-time warning) and is REQUIRED in
// production — a production start without it must fail loudly, not silently.
import 'server-only';
import { createHash } from 'node:crypto';

let warnedNoSecret = false;

// Next dev bundles each route handler separately, so module-level state is
// NOT shared across routes. Cache the dev secret on globalThis (same pattern
// as the Prisma singleton) so every bundle in the process sees one value.
const g = globalThis as unknown as { __lumioDevSecret?: string };

/** Resolve AUTH_SECRET (HMAC key for OTP hashes and reset tickets). */
export function authSecret(): string {
  const fromEnv = process.env.AUTH_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    // The spec requires a loud refusal rather than a silently weak secret.
    throw new Error(
      'AUTH_SECRET is required in production. Set it to a long random value (e.g. `openssl rand -base64 32`).'
    );
  }
  if (!g.__lumioDevSecret) {
    g.__lumioDevSecret = createHash('sha256')
      .update(`lumio-dev-${process.pid}-${Date.now()}-${Math.random()}`)
      .digest('hex');
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      console.warn(
        '[auth] AUTH_SECRET is not set — using a per-process random dev secret. OTPs and sessions reset on restart.'
      );
    }
  }
  return g.__lumioDevSecret;
}

/** SQLite file location when DATABASE_URL is absent (dev convenience only). */
export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? 'file:./db/dev.db';
}

/** Email provider selection: 'console' (fake) | 'smtp' | 'off'. */
export function emailProviderMode(): 'console' | 'smtp' | 'off' {
  const raw = (process.env.EMAIL_PROVIDER ?? '').trim().toLowerCase();
  if (raw === 'off' || raw === 'none') return 'off';
  if (raw === 'smtp') {
    const host = (process.env.SMTP_HOST ?? '').trim();
    if (!host) return 'console'; // misconfigured: fall back to the fake, say so in capabilities
    return 'smtp';
  }
  return 'console'; // default fake — always works, sends nothing real
}

/** Whether the dev outbox may be exposed (fake adapter, non-production only). */
export function devOutboxAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && emailProviderMode() === 'console';
}

/** Stable, salted hash of an IP for rate limiting — never stored raw. */
export function ipHash(ip: string): string {
  return createHash('sha256').update(`${authSecret()}:ip:${ip}`).digest('hex').slice(0, 32);
}

/** Best-effort client IP from proxy headers (this deployment sits behind Caddy). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
