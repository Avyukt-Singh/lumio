// POST /api/auth/reset — consume a reset ticket, set the new password and
// revoke every session of the account.
import 'server-only';
import { db } from '@/lib/db';
import { z } from 'zod';
import { fail, normEmail, ok, originAllowed, parseBody, passwordSchema } from '@/lib/auth/http';
import { readResetTicket, hashPassword } from '@/lib/auth/crypto';
import { authSecret } from '@/lib/auth/env';
import { destroyAllSessions } from '@/lib/auth/session';

const bodySchema = z.strictObject({ ticket: z.string().min(20).max(500), newPassword: passwordSchema });

export async function POST(req: Request) {
  if (!originAllowed(req)) return fail('BAD_REQUEST', 403);
  const parsed = await parseBody(req, bodySchema);
  if (!parsed.ok) return parsed.res;
  const { ticket, newPassword } = parsed.body;

  const read = readResetTicket(authSecret(), ticket);
  if ('error' in read) return fail('TICKET_INVALID', 400);
  const email = normEmail(read.email);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return fail('TICKET_INVALID', 400);

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashPassword(newPassword),
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
  // A password change revokes every session everywhere.
  await destroyAllSessions(user.id);
  return ok();
}
