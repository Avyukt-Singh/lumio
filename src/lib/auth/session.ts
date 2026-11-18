// Session management (chunk 5A). Tokens are 32 random bytes (base64url) in
// the cookie; the database stores only their SHA-256 hash. 30-day sliding
// expiry: lastSeenAt and expiresAt refresh at most once per hour. Next 16
// exposes an async `cookies()` — awaited everywhere.
import 'server-only';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { SESSION } from './constants';
import { newSessionToken, sha256 } from './crypto';

const SESSION_DB_SELECT = {
  id: true,
  userId: true,
  expiresAt: true,
  lastSeenAt: true,
  user: { select: { id: true, email: true, name: true, ageBand: true, aiEnabled: true, emailOwner: true, guardianConsentAt: true } },
} as const;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  ageBand: string | null;
  aiEnabled: boolean;
  emailOwner: string;
  guardianConsentAt: Date | null;
};

export async function createSession(userId: string, userAgent: string | null): Promise<string> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION.ttlMs);
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      lastSeenAt: new Date(),
      userAgent: userAgent ? userAgent.slice(0, 120) : null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION.cookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
  });
  return token;
}

/** Resolve the current session; refreshes the slide window at most hourly. */
export async function currentSession(): Promise<{ user: SessionUser; sessionId: string } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION.cookie)?.value;
  if (!token) return null;
  const row = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: SESSION_DB_SELECT,
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: row.id } }).catch(() => undefined);
    return null;
  }
  if (Date.now() - row.lastSeenAt.getTime() > SESSION.touchGapMs) {
    const nextExpiry = new Date(Date.now() + SESSION.ttlMs);
    await db.session
      .update({ where: { id: row.id }, data: { lastSeenAt: new Date(), expiresAt: nextExpiry } })
      .catch(() => undefined);
  }
  return { user: row.user as SessionUser, sessionId: row.id };
}

/** Delete one session (logout) and clear the cookie. */
export async function destroySession(sessionId: string): Promise<void> {
  await db.session.delete({ where: { id: sessionId } }).catch(() => undefined);
  const jar = await cookies();
  jar.set(SESSION.cookie, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
}

/** Delete every session of a user (reset password / sign out everywhere). */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

/** The signed-in user or null — never throws; used by /api/auth/me. */
export async function currentUser(): Promise<SessionUser | null> {
  try {
    const s = await currentSession();
    return s?.user ?? null;
  } catch {
    return null;
  }
}
