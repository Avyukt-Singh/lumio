// POST /api/ai/mistake — Explain my mistake: schema-validated JSON with the
// explanation, likely misconception and ONE remedial practice question.
// Practice-only: the response carries ai_generated_unreviewed and the client
// must not grant XP for it. Authored explanation fallback is client-side.
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail, normLang } from '@/lib/ai/route';
import { recordUsage } from '@/lib/ai/budget';
import { checkOutput, outputHash, preFilter, scrubText } from '@/lib/ai/safety';
import { completeJson } from '@/lib/ai/gateway';
import { MistakeOutputSchema, mistakePrompt } from '@/lib/ai/prompts/mistake.v1';

const BodySchema = z.object({
  chapterTitle: z.string().min(1).max(200),
  subject: z.string().max(40),
  question: z.object({
    text: z.string().min(1).max(600),
    options: z.array(z.string().max(300)).min(2).max(6),
    answer: z.number().int().min(0).max(5),
    explanation: z.string().max(1200),
  }),
  chosen: z.number().int().min(0).max(5).nullable(),
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

  if (preFilter(body.question.text).crisis) {
    // A crisis disclosure inside a quiz question still gets the supportive path.
    return aiOk({ data: null, crisis: true });
  }

  const prompt = mistakePrompt;
  const res = await completeJson(
    {
      feature: 'mistake',
      messages: [
        { role: 'system', content: prompt.system({ band: body.band, lang }) },
        {
          role: 'user',
          content: prompt.buildUser({
            chapterTitle: scrubText(body.chapterTitle).text,
            subject: body.subject,
            question: {
              text: scrubText(body.question.text).text,
              options: body.question.options.map((o) => scrubText(o).text),
              answer: body.question.answer,
              explanation: scrubText(body.question.explanation).text,
            },
            chosen: body.chosen,
            band: body.band,
            lang,
          }),
        },
      ],
      maxTokens: 700,
      meta: { lang, topic: body.chapterTitle, questionText: body.question.text },
    },
    MistakeOutputSchema
  );

  if (!res.ok || !res.value) {
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }

  // Automated sanity checks: answer index in range; option count matches.
  const out = res.value.value;
  if (out.practice.answer >= out.practice.options.length) {
    return aiFail('INVALID_RESPONSE', 502);
  }
  const check = checkOutput(out.explanation);
  if (!check.ok) return aiFail('BLOCKED_BY_POLICY', 502);

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'mistake',
    ip: gate.gate.ip,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    now: new Date(),
  });

  return aiOk({
    data: out,
    label: 'ai_generated_unreviewed',
    outputHash: outputHash(JSON.stringify(out)),
  });
}
