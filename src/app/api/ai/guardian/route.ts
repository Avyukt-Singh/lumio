// POST /api/ai/guardian — chunk 5-AI feature 9. Optional kind weekly summary
// for the Guardian screen, generated ONLY from the aggregates already shown
// there. The route enforces the same consent gate as the screen: guardian
// summary consent is checked client-side; the AI gate still requires a
// verified account + aiEnabled. No raw answers or notes ever reach this route.
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail, normLang } from '@/lib/ai/route';
import { recordUsage, cacheKey, cacheGet, cachePut } from '@/lib/ai/budget';
import { checkOutput, outputHash, preFilter } from '@/lib/ai/safety';
import { completeJson } from '@/lib/ai/gateway';
import { GuardianOutputSchema, guardianPrompt } from '@/lib/ai/prompts/guardian.v1';

const BodySchema = z.object({
  daysActive7: z.number().int().min(0).max(7),
  xp7: z.number().int().min(0).max(100000),
  focusMins7: z.number().int().min(0).max(10000),
  chaptersCompleted: z.number().int().min(0).max(500),
  chaptersMastered: z.number().int().min(0).max(500),
  mocks7: z.number().int().min(0).max(100),
  streak: z.number().int().min(0).max(4000),
  lang: z.enum(['en', 'hi', 'hinglish']),
});

export async function POST(req: Request) {
  const gate = await aiGate(req);
  if ('res' in gate) return gate.res;

  const parsed = await aiParseBody(req, BodySchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.body;
  const lang = normLang(body.lang);

  const hash = outputHash(JSON.stringify([body.lang, body.daysActive7, body.xp7, body.focusMins7, body.chaptersCompleted, body.chaptersMastered, body.mocks7, body.streak]));
  const cached = cacheGet(cacheKey('guardian', 'v1', hash));
  if (cached) {
    try {
      const data = GuardianOutputSchema.parse(JSON.parse(cached.text));
      return aiOk({ data, label: 'ai_generated_unreviewed', cached: true, outputHash: hash });
    } catch {
      /* stale cache — regenerate */
    }
  }

  const res = await completeJson(
    {
      feature: 'guardian',
      messages: [
        { role: 'system', content: guardianPrompt.system({ lang }) },
        {
          role: 'user',
          content: guardianPrompt.buildUser({
            daysActive7: body.daysActive7,
            xp7: body.xp7,
            focusMins7: body.focusMins7,
            chaptersCompleted: body.chaptersCompleted,
            chaptersMastered: body.chaptersMastered,
            mocks7: body.mocks7,
            streak: body.streak,
          }),
        },
      ],
      maxTokens: 500,
      meta: { lang },
    },
    GuardianOutputSchema,
    { timeoutMs: 30_000, retries: 1 }
  );
  if (!res.ok || !res.value) {
    console.error('[guardian] failed:', res.code, res.detail);
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }

  const data = res.value.value;
  if (!checkOutput(`${data.headline} ${data.text}`).ok) return aiFail('BLOCKED_BY_POLICY', 422);

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'guardian',
    ip: gate.gate.ip,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    now: new Date(),
  });

  cachePut(cacheKey('guardian', 'v1', hash), {
    text: JSON.stringify(data),
    adapter: res.value.adapter,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
  });
  return aiOk({ data, label: 'ai_generated_unreviewed', outputHash: hash });
}
