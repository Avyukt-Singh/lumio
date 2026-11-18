// Capabilities (chunk 5B update) — the honest, boot-time table of what is
// on, what is off and why. The UI reads this to show/hide features without
// pretending. No secrets, no emails, no counts.
import 'server-only';
import { NextResponse } from 'next/server';
import { emailCapability } from '@/lib/email';
import { devOutboxAllowed } from '@/lib/auth/env';
import { aiCapability } from '@/lib/ai/env';

export async function GET() {
  const ai = aiCapability();
  return NextResponse.json({
    ok: true,
    email: emailCapability(),
    ai: {
      mode: ai.mode,
      effective: ai.effective,
      reason: ai.reason,
      // Features are open to everyone — sign-in is optional, the only limit
      // is the fair-use budget enforced at the route level.
      features: ai.mode === 'off'
        ? []
        : ['studybuddy', 'mistake', 'notes', 'practice', 'plancoach', 'codelab', 'coachline', 'syllabus-day-coach'],
    },
    devOutbox: devOutboxAllowed(),
  });
}
