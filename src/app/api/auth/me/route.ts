// GET /api/auth/me — signed-in probe for the app shell. Never errors the app:
// the SPA boots from local data first and calls this afterwards.
import 'server-only';
import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/session';
import { maskEmail } from '@/lib/auth/http';

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ ok: true, signedIn: false });
    return NextResponse.json({
      ok: true,
      signedIn: true,
      user: {
        id: user.id,
        name: user.name,
        email: maskEmail(user.email),
        ageBand: user.ageBand,
        aiEnabled: user.aiEnabled,
        guardianConsent: !!user.guardianConsentAt,
      },
    });
  } catch {
    // Server-side trouble still answers honestly and calmly.
    return NextResponse.json({ ok: true, signedIn: false, unavailable: true });
  }
}
