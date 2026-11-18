// POST /api/auth/verify — validate an OTP by purpose.
//   signup -> verify email (guardian email = recorded consent), create a
//             session, return recovery codes once
//   login  -> create a session
//   reset  -> return a short-lived single-use reset ticket
import 'server-only';
import { db } from '@/lib/db';
import { z } from 'zod';
import { fail, normEmail, ok, originAllowed, parseBody, codeSchema, purposeSchema } from '@/lib/auth/http';
import { verifyOtp } from '@/lib/auth/otp';
import { authSecret } from '@/lib/auth/env';
import { createSession } from '@/lib/auth/session';
import { newRecoveryCodes, recoveryCodeHash, newResetTicket } from '@/lib/auth/crypto';
import { RECOVERY } from '@/lib/auth/constants';

const bodySchema = z.strictObject({
  email: z.string().trim().min(3).max(254),
  purpose: purposeSchema,
  code: codeSchema,
});

const TICKET_TTL_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  if (!originAllowed(req)) return fail('BAD_REQUEST', 403);
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.res;
  const { email: rawEmail, purpose, code } = parsed.body;
  const email = normEmail(rawEmail);

  const outcome = await verifyOtp(email, purpose, code);
  if (!outcome.ok) {
    // All three failure shapes read the same to a learner; the code tells the
    // client which calm copy to show without leaking account existence.
    return fail(outcome.code, 400);
  }

  if (purpose === 'reset') {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return fail('OTP_INVALID', 400);
    const ticket = newResetTicket(authSecret(), email, TICKET_TTL_MS);
    return ok({ ticket });
  }

  if (purpose === 'login') {
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.emailVerifiedAt) return fail('OTP_INVALID', 400);
    // A successful email-code sign-in clears any password lockout (the
    // code route is the always-available alternative per the spec).
    if (user.lockedUntil || user.failedAttempts > 0) {
      await db.user.update({
        where: { id: user.id },
        data: { lockedUntil: null, failedAttempts: 0 },
      });
    }
    await createSession(user.id, req.headers.get('user-agent'));
    return ok();
  }

  // purpose === 'signup' (and the internal 'delete' purpose never verifies here)
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return fail('OTP_INVALID', 400);
  const now = new Date();
  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: user.emailVerifiedAt ?? now,
      // Verifying a guardian-owned email IS the recorded consent.
      guardianConsentAt:
        user.emailOwner === 'guardian' && !user.guardianConsentAt ? now : user.guardianConsentAt,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
  await db.recoveryCode.deleteMany({ where: { userId: user.id } });
  const codes = newRecoveryCodes(RECOVERY.count);
  await db.recoveryCode.createMany({
    data: codes.map((c) => ({ userId: user.id, codeHash: recoveryCodeHash(authSecret(), c) })),
  });
  await createSession(user.id, req.headers.get('user-agent'));
  return ok({ recoveryCodes: codes });
}
