// POST /api/ai/plan — Plan Coach. Reads AGGREGATES ONLY (topics, counts,
// minutes — never personal text) and returns move suggestions. The
// deterministic scheduler is the source of truth: the client sends each
// session's validStarts (computed by rescheduleOptions) and this route drops
// any suggestion that violates them, or that moves more than one session per
// day. The learner previews every accepted move before dispatching it.
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail, normLang } from '@/lib/ai/route';
import { recordUsage } from '@/lib/ai/budget';
import { outputHash } from '@/lib/ai/safety';
import { completeJson } from '@/lib/ai/gateway';
import { PlanOutputSchema, planCoachPrompt } from '@/lib/ai/prompts/plancoach.v1';

const BodySchema = z.object({
  weakTopics: z.array(z.string().max(80)).max(12),
  mockSummary: z.string().max(400),
  examDate: z.string().max(10),
  freeWindows: z.string().max(400),
  commitments: z.string().max(400),
  sessions: z
    .array(
      z.object({
        date: z.string().min(8).max(10),
        index: z.number().int().min(0).max(20),
        subject: z.string().max(40),
        startMin: z.number().int().min(0).max(1440),
        endMin: z.number().int().min(0).max(1440),
        validStarts: z.array(z.number().int().min(0).max(1440)).max(96),
        done: z.boolean(),
      })
    )
    .max(40),
  lang: z.enum(['en', 'hi', 'hinglish']),
});

export async function POST(req: Request) {
  const gate = await aiGate(req);
  if ('res' in gate) return gate.res;

  const parsed = await aiParseBody(req, BodySchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.body;
  const lang = normLang(body.lang);

  const prompt = planCoachPrompt;
  // Deterministic candidate moves derived from scheduler-valid starts — the
  // fake adapter picks among these; the real model proposes its own, which
  // the validator below re-checks against the same rules.
  const candidates = body.sessions
    .filter((s) => !s.done)
    .flatMap((s) => {
      const alt = s.validStarts.find((v) => v !== s.startMin);
      return alt === undefined ? [] : [`${s.date}#${s.index}#${alt}`];
    });
  const res = await completeJson(
    {
      feature: 'plancoach',
      messages: [
        { role: 'system', content: prompt.system({ lang }) },
        {
          role: 'user',
          content: prompt.buildUser({
            weakTopics: body.weakTopics,
            mockSummary: body.mockSummary,
            examDate: body.examDate,
            freeWindows: body.freeWindows,
            commitments: body.commitments,
            sessions: body.sessions,
            lang,
          }),
        },
      ],
      maxTokens: 700,
      meta: { lang, moves: candidates.slice(0, 2) },
    },
    PlanOutputSchema
  );

  if (!res.ok || !res.value) {
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }

  // Deterministic validation: scheduler rules beat model suggestions.
  const movesPerDay = new Map<string, number>();
  const valid = res.value.value.suggestions.filter((s) => {
    const session = body.sessions.find((x) => x.date === s.date && x.index === s.sessionIndex);
    if (!session) return false;
    if (session.done) return false;
    if (!session.validStarts.includes(s.newStartMin)) return false;
    const moved = movesPerDay.get(s.date) ?? 0;
    if (moved >= 1) return false; // at most one move per day
    if (s.newStartMin === session.startMin) return false; // no-op move
    movesPerDay.set(s.date, moved + 1);
    return true;
  });

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'plancoach',
    ip: gate.gate.ip,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    now: new Date(),
  });

  return aiOk({
    data: { suggestions: valid, note: res.value.value.note ?? undefined },
    dropped: res.value.value.suggestions.length - valid.length,
    outputHash: outputHash(JSON.stringify(valid)),
  });
}
