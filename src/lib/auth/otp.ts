// OTP service (chunk 5A, ADR 0004). Rules: HMAC-hashed 6-digit codes, 10-min
// expiry, 5 attempts then the code is dead, one active code per
// (email, purpose), 60-second resend cooldown, hourly send caps per email and
// per ip-hash, constant-time hash compare, a consumed code can never be
// reused. Expired OTPs and sessions are pruned opportunistically on send.
import 'server-only';
import { db } from '@/lib/db';
import { authSecret } from './env';
import { ipHash as hashIp, clientIp } from './env';
import { OTP, type OtpPurpose } from './constants';
import { newOtpCode, otpHash } from './crypto';
import { consume, peek, prune } from './ratelimit';
import { emailProvider } from '@/lib/email';
import { otpEmail } from '@/lib/email/templates';
import { callExternal } from '@/lib/email/callExternal';

export type SendOutcome =
  | { ok: true; devCode?: string }
  | { ok: false; code: 'RATE_LIMITED' | 'EMAIL_DISABLED' | 'SERVER_ERROR'; retryAfterSec?: number };

/**
 * Create a fresh OTP for (email, purpose) and send it. Anti-enumeration is
 * the caller's job: it must answer with an identical response either way.
 * `devCode` is returned ONLY when the console adapter is active outside
 * production, so the browser agent (and dev outbox UI) can complete flows.
 */
export async function sendOtp(
  email: string,
  purpose: OtpPurpose,
  req: Request,
  /** Optional honest notice embedded in the email (anti-enumeration path). */
  notice?: string
): Promise<SendOutcome> {
  prune();

  const ipKey = `otp-ip-${hashIp(clientIp(req))}`;
  if (!consume(ipKey, OTP.sendsPerIpPerHour)) {
    const p = peek(ipKey);
    return { ok: false, code: 'RATE_LIMITED', retryAfterSec: Math.ceil(p.retryAfterMs / 1000) };
  }
  const emailKey = `otp-email-${email}`;
  if (!consume(emailKey, OTP.sendsPerEmailPerHour)) {
    const p = peek(emailKey);
    return { ok: false, code: 'RATE_LIMITED', retryAfterSec: Math.ceil(p.retryAfterMs / 1000) };
  }

  // Single active code per (email, purpose): kill any previous one.
  await db.emailOtp.updateMany({
    where: { email, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = newOtpCode(OTP.digits);
  const ttlMs = Number(process.env.OTP_TTL_MS ?? '') || OTP.ttlMs;
  await db.emailOtp.create({
    data: {
      email,
      purpose,
      codeHash: otpHash(authSecret(), email, purpose, code),
      expiresAt: new Date(Date.now() + ttlMs),
      ipHash: hashIp(clientIp(req)),
    },
  });

  const provider = emailProvider();
  const tpl = otpEmail(email, purpose, code, notice);
  if (provider.mode === 'smtp') {
    const res = await callExternal(
      () => provider.send({ to: email, ...tpl, idempotencyKey: `otp-${email}-${purpose}-${Date.now()}` }),
      { timeoutMs: 8000, retries: 0 } // the adapter already retries internally
    );
    if (!res.ok) {
      // Calm failure; never leak provider errors. The OTP row exists — the
      // learner can retry within the hourly caps.
      return { ok: false, code: 'SERVER_ERROR' };
    }
    return { ok: true };
  }

  // Console adapter: the adapter prints the full message to the server
  // console; outside production the code also returns for the dev outbox UI.
  await provider.send({ to: email, ...tpl, idempotencyKey: `otp-${email}-${purpose}-${Date.now()}` });
  const devCode = process.env.NODE_ENV !== 'production' ? code : undefined;
  return { ok: true, devCode };
}

export type VerifyOutcome =
  | { ok: true; otpId: string }
  | { ok: false; code: 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_TOO_MANY_ATTEMPTS' };

/** Verify a submitted code; consumes it exactly once on success. */
export async function verifyOtp(
  email: string,
  purpose: OtpPurpose,
  code: string
): Promise<VerifyOutcome> {
  const row = await db.emailOtp.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) return { ok: false, code: 'OTP_INVALID' };
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.emailOtp.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    return { ok: false, code: 'OTP_EXPIRED' };
  }
  if (row.attempts >= OTP.maxAttempts) {
    await db.emailOtp.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    return { ok: false, code: 'OTP_TOO_MANY_ATTEMPTS' };
  }

  const expected = Buffer.from(row.codeHash, 'hex');
  const supplied = Buffer.from(otpHash(authSecret(), email, purpose, code), 'hex');
  const matches = expected.length === supplied.length && expected.equals(supplied);
  if (!matches) {
    const attempts = row.attempts + 1;
    await db.emailOtp.update({ where: { id: row.id }, data: { attempts } });
    if (attempts >= OTP.maxAttempts) {
      await db.emailOtp.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
      return { ok: false, code: 'OTP_TOO_MANY_ATTEMPTS' };
    }
    return { ok: false, code: 'OTP_INVALID' };
  }

  await db.emailOtp.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return { ok: true, otpId: row.id };
}

/** Cooldown check used by resend paths (60 s between sends). */
export async function resendBlocked(email: string): Promise<boolean> {
  const last = await db.emailOtp.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  if (!last) return false;
  return Date.now() - last.createdAt.getTime() < OTP.resendCooldownMs;
}
