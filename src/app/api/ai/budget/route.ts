// GET /api/ai/budget — honest remaining-quota display (shown in Settings and
// on AI panels; never gamified, just true). Works for everyone: signed-in
// learners see their account budget, guests see their per-IP guest budget.
import 'server-only';
import { currentUser } from '@/lib/auth/session';
import { aiOk, guestUserId } from '@/lib/ai/route';
import { clientIp } from '@/lib/auth/env';
import { budgetRemaining } from '@/lib/ai/budget';

export async function GET(req: Request) {
  const user = await currentUser();
  const userId = user?.id ?? guestUserId(clientIp(req));
  const remaining = await budgetRemaining(userId, new Date());
  return aiOk({ enabled: true, ...remaining });
}
