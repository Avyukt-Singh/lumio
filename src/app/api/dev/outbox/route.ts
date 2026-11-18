// GET /api/dev/outbox — development-only reader for the console email
// adapter. Exposed ONLY when NODE_ENV !== 'production' AND the console
// adapter is active, so demos and the browser agent can read OTP codes.
import 'server-only';
import { NextResponse } from 'next/server';
import { readDevOutbox } from '@/lib/email';
import { devOutboxAllowed } from '@/lib/auth/env';

export async function GET() {
  if (!devOutboxAllowed()) {
    return NextResponse.json({ ok: false, code: 'NOT_AVAILABLE' }, { status: 404 });
  }
  // Newest first so the agent and humans see the latest code on top.
  const messages = readDevOutbox().reverse();
  return NextResponse.json({ ok: true, messages });
}
