// POST /api/ai/report — the "Report a problem" control on every AI surface.
// Stores the minimum: feature, a hash of the offending output, and the
// learner's optional note. The raw output text is NOT stored. Reports work
// for guests too — userId is simply null when there is no account.
import 'server-only';
import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { aiFail, aiOk } from '@/lib/ai/route';
import { db } from '@/lib/db';
import { outputHash } from '@/lib/ai/safety';

const BodySchema = z.object({
  feature: z.enum(['studybuddy', 'mistake', 'notes', 'practice', 'plancoach', 'codelab', 'coachline']),
  output: z.string().min(1).max(8000),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const user = await currentUser();

  const raw = await req.text();
  if (raw.length > 20_000) return aiFail('BAD_REQUEST', 413);
  let json: unknown;
  try {
    json = JSON.parse(raw || '{}');
  } catch {
    return aiFail('BAD_REQUEST');
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return aiFail('BAD_REQUEST');

  await db.aiReport.create({
    data: {
      userId: user?.id ?? null,
      feature: parsed.data.feature,
      outputHash: outputHash(parsed.data.output),
      note: parsed.data.note?.trim() || null,
    },
  });

  return aiOk({ recorded: true });
}
