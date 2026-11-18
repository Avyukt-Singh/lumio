// POST /api/auth/logout — delete this session (?all=1 deletes every session).
import 'server-only';
import { fail, ok, originAllowed } from '@/lib/auth/http';
import { currentSession, destroyAllSessions, destroySession } from '@/lib/auth/session';

export async function POST(req: Request) {
  if (!originAllowed(req)) return fail('BAD_REQUEST', 403);
  const url = new URL(req.url);
  const all = url.searchParams.get('all') === '1';
  const session = await currentSession();
  if (session) {
    if (all) {
      await destroyAllSessions(session.user.id);
    } else {
      await destroySession(session.sessionId);
    }
  }
  // Logging out with no session still succeeds — idempotent by design.
  return ok();
}
