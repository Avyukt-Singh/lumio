// POST /api/auth/login — password sign-in with lockout and generic errors.
import 'server-only';
import { db } from '@/lib/db';
import { z } from 'zod';
import { fail, normEmail, ok, originAllowed, parseBody, emailSchema, passwordSchema } from '@/lib/auth/http';
import { sendOtp } from '@/lib/auth/otp';
import { verifyPassword } from '@/lib/auth/crypto';
import { createSession } from '@/lib/auth/session';
import { LOCKOUT } from '@/lib/auth/constants';
import type { OtpPurpose } from '@/lib/auth/constants';

const bodySchema = z.strictObject({ email: emailSchema, password: passwordSchema });

export async function POST(req: Request) {
  if (!originAllowed(req)) return fail('BAD_REQUEST', 403);
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.res;
  const { email: rawEmail, password } = parsed.body;
  const email = normEmail(rawEmail);

  const user = await db.user.findUnique({ where: { email } });

  if (user && user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    // Locked: same generic text plus a calm wait hint; email-code route always works.
    return fail('LOCKED', 401);
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    if (user) {
      const attempts = user.failedAttempts + 1;
      const locked = attempts >= LOCKOUT.maxFailedAttempts;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: locked ? 0 : attempts,
          lockedUntil: locked ? new Date(Date.now() + LOCKOUT.durationMs) : user.lockedUntil,
        },
      });
    }
    // Identical response whether the email exists or the password is wrong.
    return fail('BAD_CREDENTIALS', 401);
  }

  if (!user.emailVerifiedAt) {
    // Unverified: send a fresh signup code and tell the client to show verify.
    const sent = await sendOtp(email, 'signup' as OtpPurpose, req);
    if (!sent.ok) return fail(sent.code, 429, sent.retryAfterSec ? { retryAfterSec: sent.retryAfterSec } : {});
    return fail('NEEDS_VERIFICATION', 403, sent.devCode ? { devCode: sent.devCode } : {});
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });
  await createSession(user.id, req.headers.get('user-agent'));
  return ok();
}
