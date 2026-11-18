// POST /api/ai/nudge — Code Lab nudge: after the authored three-level hint
// ladder is exhausted. Explains the failing test and gives ONE next step;
// never the full solution. The learner's code is scrubbed before sending.
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail, normLang } from '@/lib/ai/route';
import { recordUsage } from '@/lib/ai/budget';
import { checkOutput, crisisReply, outputHash, preFilter, scrubText } from '@/lib/ai/safety';
import { complete } from '@/lib/ai/gateway';
import { codeLabPrompt } from '@/lib/ai/prompts/codelab.v1';

const BodySchema = z.object({
  exerciseTitle: z.string().min(1).max(200),
  statement: z.string().max(2000),
  code: z.string().min(1).max(8000),
  failingTests: z
    .array(
      z.object({
        expected: z.string().max(200),
        got: z.string().max(200),
        error: z.string().max(300).optional(),
      })
    )
    .min(0)
    .max(6),
  lang: z.enum(['en', 'hi', 'hinglish']),
});

export async function POST(req: Request) {
  const gate = await aiGate(req);
  if ('res' in gate) return gate.res;

  const parsed = await aiParseBody(req, BodySchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.body;
  const lang = normLang(body.lang);

  if (preFilter(body.statement).crisis) {
    return aiOk({ data: crisisReply(lang), crisis: true, label: 'ai' });
  }

  const prompt = codeLabPrompt;
  const res = await complete({
    feature: 'codelab',
    messages: [
      { role: 'system', content: prompt.system({ lang }) },
      {
        role: 'user',
        content: prompt.buildUser({
          exerciseTitle: scrubText(body.exerciseTitle).text,
          statement: scrubText(body.statement).text,
          code: body.code,
          failingTests: body.failingTests,
          lang,
        }),
      },
    ],
    maxTokens: 400,
    meta: { lang, exerciseTitle: body.exerciseTitle, failingTest: body.failingTests[0]?.error ?? body.failingTests[0]?.expected ?? 'no test run yet' },
  });

  if (!res.ok || !res.value) {
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }
  const check = checkOutput(res.value.text);
  if (!check.ok) return aiFail('BLOCKED_BY_POLICY', 502);

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'codelab',
    ip: gate.gate.ip,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    now: new Date(),
  });

  return aiOk({ data: check.text, label: 'ai', outputHash: outputHash(res.value.text) });
}
