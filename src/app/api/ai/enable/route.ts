// POST /api/ai/enable — legacy opt-in toggle for AI help. AI is now on for
// everyone by default, so this route only exists to keep older clients and
// the Settings toggle working: signed-in accounts can still record their
// preference, guests get an honest no-op success (nothing to store).
import 'server-only';
import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { aiFail, aiOk } from '@/lib/ai/route';
import { db } from '@/lib/db';

const BodySchema = z.object({ enabled: z.boolean() });

export async function POST(req: Request) {
  const raw = await req.text();
  let json: unknown;
  try {
    json = JSON.parse(raw || '{}');
  } catch {
    return aiFail('BAD_REQUEST');
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return aiFail('BAD_REQUEST');

  const user = await currentUser();
  if (!user) return aiOk({ enabled: true });

  await db.user.update({
    where: { id: user.id },
    data: { aiEnabled: parsed.data.enabled },
  });

  return aiOk({ enabled: parsed.data.enabled });
}
