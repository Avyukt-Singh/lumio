// POST /api/auth/otp/request — passwordless sign-in and forgot-password.
// Always returns the same response whether or not the account exists.
import 'server-only';
import { z } from 'zod';
import { fail, indistinguishable, normEmail, originAllowed, parseBody, emailSchema } from '@/lib/auth/http';
import { resendBlocked, sendOtp } from '@/lib/auth/otp';
import { OTP } from '@/lib/auth/constants';

const bodySchema = z.strictObject({
  email: emailSchema,
  purpose: z.enum(['login', 'reset']),
});

export async function POST(req: Request) {
  if (!originAllowed(req)) return fail('BAD_REQUEST', 403);
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.res;
  const { email: rawEmail, purpose } = parsed.body;
  const email = normEmail(rawEmail);

  if (await resendBlocked(email)) {
    return fail('OTP_RESEND_COOLDOWN', 429, { retryAfterSec: Math.ceil(OTP.resendCooldownMs / 1000) });
  }

  const sent = await sendOtp(email, purpose, req);
  if (!sent.ok) return fail(sent.code, 429, sent.retryAfterSec ? { retryAfterSec: sent.retryAfterSec } : {});
  return indistinguishable(sent.devCode ? { devCode: sent.devCode } : {});
}
