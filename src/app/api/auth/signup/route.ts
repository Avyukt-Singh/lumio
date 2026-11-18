// POST /api/auth/signup — create an unverified user and send a signup OTP.
// Anti-enumeration: an existing verified email produces an identical response
// but the email it receives says "you already have a Lumio account — sign in
// instead" (a login code is sent so the flow still completes honestly).
import 'server-only';
import { db } from '@/lib/db';
import { z } from 'zod';
import { fail, indistinguishable, normEmail, originAllowed, parseBody, emailSchema, passwordSchema } from '@/lib/auth/http';
import { sendOtp } from '@/lib/auth/otp';
import { hashPassword } from '@/lib/auth/crypto';
import type { OtpPurpose } from '@/lib/auth/constants';

const bodySchema = z.strictObject({
  name: z.string().trim().min(1).max(40),
  email: emailSchema,
  password: passwordSchema,
  ageBand: z.string().trim().min(1).max(20),
  emailOwner: z.enum(['self', 'guardian']),
});

export async function POST(req: Request) {
  if (!originAllowed(req)) return fail('BAD_REQUEST', 403);
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.res;
  const { name, email: rawEmail, password, ageBand, emailOwner } = parsed.body;
  const email = normEmail(rawEmail);

  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.emailVerifiedAt) {
    // Quietly send "you already have an account" — a login code, so the
    // verify screen the learner lands on still works end to end.
    const sent = await sendOtp(
      email,
      'login' as OtpPurpose,
      req,
      'You already have a Lumio account on this email — you can sign in with this code instead of creating a new account.'
    );
    if (!sent.ok) return fail(sent.code, 429, sent.retryAfterSec ? { retryAfterSec: sent.retryAfterSec } : {});
    return indistinguishable(sent.devCode ? { devCode: sent.devCode } : {});
  }

  if (!existing) {
    await db.user.create({
      data: {
        email,
        name,
        passwordHash: hashPassword(password),
        emailOwner,
        ageBand,
      },
    });
  }
  // Existing-but-unverified: same response, fresh signup OTP (sendOtp
  // invalidates the previous code per the single-active-code rule).

  const sent = await sendOtp(email, 'signup', req);
  if (!sent.ok) return fail(sent.code, 429, sent.retryAfterSec ? { retryAfterSec: sent.retryAfterSec } : {});
  return indistinguishable(sent.devCode ? { devCode: sent.devCode } : {});
}
