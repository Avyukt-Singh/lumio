// POST /api/auth/recovery/regenerate — replace all recovery codes for the
// signed-in user. Re-auth required: password, or a fresh login OTP when the
// account has no password.
import 'server-only';
import { db } from '@/lib/db';
import { z } from 'zod';
import { fail, ok, originAllowed, parseBody, passwordSchema, codeSchema } from '@/lib/auth/http';
import { verifyPassword, newRecoveryCodes, recoveryCodeHash } from '@/lib/auth/crypto';
import { authSecret } from '@/lib/auth/env';
import { currentSession } from '@/lib/auth/session';
import { verifyOtp } from '@/lib/auth/otp';
import { RECOVERY } from '@/lib/auth/constants';

const bodySchema = z.strictObject({
  password: passwordSchema.optional(),
  otpCode: codeSchema.optional(),
});

export async function POST(req: Request) {
  if (!originAllowed(req)) return fail('BAD_REQUEST', 403);
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.res;
  const { password, otpCode } = parsed.body;

  const session = await currentSession();
  if (!session) return fail('UNAUTHENTICATED', 401);
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return fail('UNAUTHENTICATED', 401);

  let reauthed = false;
  if (password && verifyPassword(password, user.passwordHash)) {
    reauthed = true;
  } else if (otpCode) {
    // Fresh OTP re-auth (purpose 'login') for passwordless-only accounts.
    const outcome = await verifyOtp(user.email, 'login', otpCode);
    reauthed = outcome.ok;
  }
  if (!reauthed) return fail('REAUTH_REQUIRED', 401);

  await db.recoveryCode.deleteMany({ where: { userId: user.id } });
  const codes = newRecoveryCodes(RECOVERY.count);
  await db.recoveryCode.createMany({
    data: codes.map((c) => ({ userId: user.id, codeHash: recoveryCodeHash(authSecret(), c) })),
  });
  return ok({ recoveryCodes: codes });
}
