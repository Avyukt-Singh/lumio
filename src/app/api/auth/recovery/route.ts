// POST /api/auth/recovery — sign in (and optionally reset the password) with a
// one-time recovery code; reports how many codes remain.
import 'server-only';
import { db } from '@/lib/db';
import { z } from 'zod';
import { fail, normEmail, ok, originAllowed, parseBody, emailSchema, passwordSchema } from '@/lib/auth/http';
import { recoveryCodeHash, hashPassword } from '@/lib/auth/crypto';
import { authSecret } from '@/lib/auth/env';
import { createSession, destroyAllSessions } from '@/lib/auth/session';
import { timingSafeEqual } from 'node:crypto';

const bodySchema = z.strictObject({
  email: emailSchema,
  recoveryCode: z.string().trim().min(9).max(12),
  newPassword: passwordSchema.optional(),
});

export async function POST(req: Request) {
  if (!originAllowed(req)) return fail('BAD_REQUEST', 403);
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.res;
  const { email: rawEmail, recoveryCode, newPassword } = parsed.body;
  const email = normEmail(rawEmail);

  const user = await db.user.findUnique({
    where: { email },
    include: { recoveryCodes: { where: { usedAt: null } } },
  });

  const supplied = Buffer.from(recoveryCodeHash(authSecret(), recoveryCode), 'hex');
  let matchedId: string | null = null;
  if (user) {
    for (const rc of user.recoveryCodes) {
      const stored = Buffer.from(rc.codeHash, 'hex');
      if (stored.length === supplied.length && timingSafeEqual(stored, supplied)) {
        matchedId = rc.id;
        break;
      }
    }
  }
  if (!user || !matchedId) return fail('RECOVERY_INVALID', 401);

  await db.recoveryCode.update({ where: { id: matchedId }, data: { usedAt: new Date() } });

  if (newPassword) {
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword), failedAttempts: 0, lockedUntil: null },
    });
    await destroyAllSessions(user.id);
  }

  const remaining = await db.recoveryCode.count({ where: { userId: user.id, usedAt: null } });
  await createSession(user.id, req.headers.get('user-agent'));
  return ok({ remaining });
}
