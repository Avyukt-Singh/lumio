// POST /api/ai/coach — chunk 5-AI feature 8. Display-only study coach:
// "why this plan" explanation, weekly reflection, question of the day.
// Aggregates in, one text out; nothing here can move sessions, grant XP or
// touch the deterministic scheduler.
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail, normLang } from '@/lib/ai/route';
import { recordUsage, cacheKey, cacheGet, cachePut } from '@/lib/ai/budget';
import { checkOutput, outputHash, preFilter } from '@/lib/ai/safety';
import { completeJson } from '@/lib/ai/gateway';
import { CoachOutputSchema, coachPrompt } from '@/lib/ai/prompts/coach.v1';

const BodySchema = z.object({
  mode: z.enum(['why', 'reflect', 'qotd']),
  planSummary: z.string().max(600).default(''),
  weakTopics: z.array(z.string().max(120)).max(8).default([]),
  streak: z.number().int().min(0).max(4000).default(0),
  xpLast7: z.number().int().min(0).max(100000).default(0),
  focusMins7: z.number().int().min(0).max(10000).default(0),
  mocksSummary: z.string().max(400).default(''),
  band: z.enum(['young', 'middle', 'sec', 'senior', 'dropper', 'above']),
  lang: z.enum(['en', 'hi', 'hinglish']),
});

export async function POST(req: Request) {
  const gate = await aiGate(req);
  if ('res' in gate) return gate.res;

  const parsed = await aiParseBody(req, BodySchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.body;
  const lang = normLang(body.lang);

  const hash = outputHash(JSON.stringify([body.mode, body.lang, body.band, body.planSummary, body.weakTopics, body.streak, body.xpLast7, body.focusMins7, body.mocksSummary]));
  const cached = cacheGet(cacheKey('coach', 'v1', hash));
  if (cached) {
    try {
      const data = CoachOutputSchema.parse(JSON.parse(cached.text));
      return aiOk({ data, label: 'ai_generated_unreviewed', cached: true, outputHash: hash });
    } catch {
      /* stale cache — regenerate */
    }
  }

  const res = await completeJson(
    {
      feature: 'coach',
      messages: [
        { role: 'system', content: coachPrompt.system({ band: body.band, lang, mode: body.mode }) },
        {
          role: 'user',
          content: coachPrompt.buildUser({
            mode: body.mode,
            band: body.band,
            lang,
            planSummary: body.planSummary,
            weakTopics: body.weakTopics,
            streak: body.streak,
            xpLast7: body.xpLast7,
            focusMins7: body.focusMins7,
            mocksSummary: body.mocksSummary,
          }),
        },
      ],
      maxTokens: 500,
      meta: { lang, mode: body.mode },
    },
    CoachOutputSchema,
    { timeoutMs: 30_000, retries: 1 }
  );
  if (!res.ok || !res.value) {
    console.error('[coach] failed:', res.code, res.detail);
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }

  const data = res.value.value;
  if (!checkOutput(data.text).ok) return aiFail('BLOCKED_BY_POLICY', 422);

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'coach',
    ip: gate.gate.ip,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    now: new Date(),
  });

  cachePut(cacheKey('coach', 'v1', hash), {
    text: JSON.stringify(data),
    adapter: res.value.adapter,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
  });
  return aiOk({ data, label: 'ai_generated_unreviewed', outputHash: hash });
}
