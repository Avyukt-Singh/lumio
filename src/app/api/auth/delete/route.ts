// POST /api/auth/delete — re-auth (password or fresh 'delete' OTP), typed
// confirmation, then remove the user and every server-side record. Local
// learner data intentionally stays on the device; the UI says so.
import 'server-only';
import { db } from '@/lib/db';
import { z } from 'zod';
import { fail, normEmail, ok, originAllowed, parseBody, passwordSchema, codeSchema } from '@/lib/auth/http';
import { verifyPassword } from '@/lib/auth/crypto';
import { currentSession } from '@/lib/auth/session';
import { verifyOtp, sendOtp } from '@/lib/auth/otp';
import type { OtpPurpose } from '@/lib/auth/constants';

const bodySchema = z.strictObject({
  confirmation: z.string().trim().max(20),
  password: passwordSchema.optional(),
  otpCode: codeSchema.optional(),
});

/** GET helper: ask for the 'delete' OTP (used by passwordless-only accounts). */
export async function GET(req: Request) {
  if (!originAllowed(req)) return fail('BAD_REQUEST', 403);
  const session = await currentSession();
  if (!session) return fail('UNAUTHENTICATED', 401);
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return fail('UNAUTHENTICATED', 401);
  const sent = await sendOtp(user.email, 'delete' as OtpPurpose, req);
  if (!sent.ok) return fail(sent.code, 429, sent.retryAfterSec ? { retryAfterSec: sent.retryAfterSec } : {});
  return ok(sent.devCode ? { devCode: sent.devCode } : {});
}

export async function POST(req: Request) {
  if (!originAllowed(req)) return fail('BAD_REQUEST', 403);
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.res;
  const { confirmation, password, otpCode } = parsed.body;
  if (confirmation !== 'DELETE') return fail('CONFIRMATION_MISMATCH', 400);

  const session = await currentSession();
  if (!session) return fail('UNAUTHENTICATED', 401);
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return fail('UNAUTHENTICATED', 401);

  let reauthed = false;
  if (password && verifyPassword(password, user.passwordHash)) {
    reauthed = true;
  } else if (otpCode) {
    const outcome = await verifyOtp(normEmail(user.email), 'delete', otpCode);
    reauthed = outcome.ok;
  }
  if (!reauthed) return fail('REAUTH_REQUIRED', 401);

  // Cascades remove sessions and recovery codes (schema onDelete: Cascade).
  await db.user.delete({ where: { id: user.id } });
  return ok();
}
