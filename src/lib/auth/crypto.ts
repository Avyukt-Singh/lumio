// Auth crypto primitives (chunk 5A, ADR 0004). Everything here is Node
// `crypto` only — no external dependency — and every secret leaves this module
// in hashed form. Password hashing is scrypt with a self-describing parameter
// string so parameters can migrate later without invalidating old hashes.
import 'server-only';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { RECOVERY } from './constants';

// ---------- passwords ----------

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64 } as const;

/** Hash a password into `scrypt$N$r$p$salt$hash` (all hex). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize('NFKC'), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 64 * 1024 * 1024, // 128·N·r = 32 MiB exceeds Node's 32 MiB default
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${key.toString('hex')}`;
}

/** Constant-time password verify; false on any malformed input. */
export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, saltHex, keyHex] = parts;
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(keyHex, 'hex');
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || salt.length === 0)
    return false;
  try {
    const actual = scryptSync(password.normalize('NFKC'), salt, expected.length, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ---------- hashes and tokens ----------

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** HMAC-SHA256 keyed by AUTH_SECRET — used for OTP hashes and reset tickets. */
export function hmac(secret: string, input: string): string {
  return createHmac('sha256', secret).update(input).digest('hex');
}

/** 32 random bytes as base64url — the session token (cookie value). */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** 6-digit OTP from a CSPRNG, zero-padded. */
export function newOtpCode(digits: number): string {
  const max = 10 ** digits;
  return String(randomInt(0, max)).padStart(digits, '0');
}

/** HMAC of the OTP binding (email, purpose, code) — the stored form. */
export function otpHash(secret: string, email: string, purpose: string, code: string): string {
  return hmac(secret, `${email}:${purpose}:${code}`);
}

// ---------- reset tickets ----------

/**
 * Short-lived single-use reset ticket: HMAC-signed
 * `email:expiry:nonce` so it needs no database row; single-use is enforced by
 * remembering consumed nonces in memory for the ticket lifetime.
 */
// Cross-bundle state (Next dev compiles routes separately): track consumed
// ticket nonces on globalThis for the process.
const g = globalThis as unknown as { __lumioUsedTickets?: Set<string> };
const consumedTickets = (g.__lumioUsedTickets ??= new Set<string>());

export function newResetTicket(secret: string, email: string, ttlMs: number): string {
  const expiry = Date.now() + ttlMs;
  const nonce = randomBytes(16).toString('hex');
  const payload = `${email}:${expiry}:${nonce}`;
  const sig = hmac(secret, `ticket:${payload}`).slice(0, 32);
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

export function readResetTicket(
  secret: string,
  ticket: string
): { email: string } | { error: 'INVALID' | 'EXPIRED' } {
  let decoded: string;
  try {
    decoded = Buffer.from(ticket, 'base64url').toString('utf8');
  } catch {
    return { error: 'INVALID' };
  }
  const idx = decoded.lastIndexOf(':');
  if (idx < 0) return { error: 'INVALID' };
  const payload = decoded.slice(0, idx);
  const sig = decoded.slice(idx + 1);
  const expected = hmac(secret, `ticket:${payload}`).slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { error: 'INVALID' };
  const [email, expiryStr, nonce] = payload.split(':');
  const expiry = Number(expiryStr);
  if (!email || !Number.isFinite(expiry) || !nonce) return { error: 'INVALID' };
  if (Date.now() > expiry) return { error: 'EXPIRED' };
  const usedKey = `${payload}`;
  if (consumedTickets.has(usedKey)) return { error: 'INVALID' };
  consumedTickets.add(usedKey);
  if (consumedTickets.size > 500) {
    // Opportunistic prune: keys cannot be dated individually, so a bounded set
    // is acceptable; entries age out of relevance in 10 minutes anyway.
    const first = consumedTickets.values().next().value;
    if (first) consumedTickets.delete(first);
  }
  return { email };
}

// ---------- recovery codes ----------

/** Generate `count` codes shaped `XXXX-XXXX` from the unambiguous alphabet. */
export function newRecoveryCodes(count: number): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    let half = '';
    for (let i = 0; i < 8; i++) {
      half += RECOVERY.alphabet[randomInt(0, RECOVERY.alphabet.length)];
      if (i === 3) half += '-';
    }
    codes.add(half);
  }
  return [...codes];
}

export function recoveryCodeHash(secret: string, code: string): string {
  return hmac(secret, `recovery:${code.trim().toUpperCase()}`);
}
