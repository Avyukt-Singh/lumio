// POST /api/ai/practice — Practice generator (beta): "more questions like
// this". Automated checks before anything is displayed: schema validation,
// a second independent solve that must agree with the key, and per-item
// sanity checks; failing items are dropped. Labelled Beta, practice-only,
// never XP.
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail, normLang } from '@/lib/ai/route';
import { recordUsage } from '@/lib/ai/budget';
import { checkOutput, outputHash, preFilter, scrubText } from '@/lib/ai/safety';
import { completeJson } from '@/lib/ai/gateway';
import { PracticeOutputSchema, practicePrompt } from '@/lib/ai/prompts/practice.v1';

const BodySchema = z.object({
  chapterId: z.string().min(1).max(40),
  chapterTitle: z.string().min(1).max(200),
  subject: z.string().max(40),
  summary: z.string().max(2000),
  keyPoints: z.array(z.string().max(400)).max(6),
  sample: z
    .object({
      text: z.string().max(600),
      options: z.array(z.string().max(300)).max(6),
      answer: z.number().int().min(0).max(5),
      explanation: z.string().max(1200),
    })
    .nullable(),
  count: z.number().int().min(1).max(5),
  band: z.enum(['young', 'middle', 'sec', 'senior', 'dropper', 'above']),
  lang: z.enum(['en', 'hi', 'hinglish']),
});

const SolveSchema = z.object({ answerIndex: z.number().int().min(0).max(5) });

export async function POST(req: Request) {
  const gate = await aiGate(req);
  if ('res' in gate) return gate.res;

  const parsed = await aiParseBody(req, BodySchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.body;
  const lang = normLang(body.lang);

  if (preFilter(body.summary).crisis) {
    return aiOk({ data: null, crisis: true });
  }

  const prompt = practicePrompt;
  const gen = async () =>
    completeJson(
      {
        feature: 'practice',
        messages: [
          { role: 'system', content: prompt.system({ band: body.band, lang }) },
          {
            role: 'user',
            content: prompt.buildUser({
              chapterId: body.chapterId,
              chapterTitle: scrubText(body.chapterTitle).text,
              subject: body.subject,
              summary: scrubText(body.summary).text,
              keyPoints: body.keyPoints.map((k) => scrubText(k).text),
              sample: body.sample
                ? {
                    text: scrubText(body.sample.text).text,
                    options: body.sample.options.map((o) => scrubText(o).text),
                    answer: body.sample.answer,
                    explanation: scrubText(body.sample.explanation).text,
                  }
                : null,
              band: body.band,
              lang,
              count: body.count,
            }),
          },
        ],
        maxTokens: 1200,
        meta: { lang, topic: body.chapterTitle },
      },
      PracticeOutputSchema
    );

  const res = await gen();
  if (!res.ok || !res.value) {
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }

  // Second independent solve: each item is solved alone (fresh request) and
  // only kept when the solver agrees with the key. This is the STEM-accuracy
  // check — it costs a couple of small calls and drops bad items.
  const solverPrompt = SOLVER_SYSTEM(lang);
  const kept: Array<{ text: string; options: string[]; answer: number; explanation: string }> = [];
  let tokensIn = res.value.tokensIn;
  let tokensOut = res.value.tokensOut;
  for (const item of res.value.value.items) {
    if (item.answer >= item.options.length) continue; // key out of range
    const solve = await completeJson(
      {
        feature: 'practice-solve',
        messages: [
          { role: 'system', content: solverPrompt },
          {
            role: 'user',
            content: `${fenceItem(item)}\nSolve using only the item above. Reply ONLY with JSON {"answerIndex": <number>}.`,
          },
        ],
        maxTokens: 60,
        meta: { lang, answer: item.answer },
      },
      SolveSchema
    );
    if (!solve.ok || !solve.value) continue;
    tokensIn += solve.value.tokensIn;
    tokensOut += solve.value.tokensOut;
    if (solve.value.value.answerIndex !== item.answer) continue; // disagreement → drop
    const check = checkOutput(item.text + item.explanation);
    if (!check.ok) continue;
    kept.push(item);
  }

  if (kept.length === 0) {
    return aiFail('INVALID_RESPONSE', 502);
  }

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'practice',
    ip: gate.gate.ip,
    tokensIn,
    tokensOut,
    now: new Date(),
  });

  return aiOk({
    data: { items: kept },
    label: 'ai_generated_unreviewed',
    dropped: res.value.value.items.length - kept.length,
    outputHash: outputHash(JSON.stringify(kept)),
  });
}

function SOLVER_SYSTEM(lang: string): string {
  const language =
    lang === 'hi' ? 'Solve silently; reply only with JSON.' : 'Reply only with JSON.';
  return [
    'You solve multiple-choice questions.',
    'Work out the answer carefully, watching arithmetic and units; if the question cannot be answered from the item alone, still pick the best-supported option.',
    language,
  ].join(' ');
}

function fenceItem(item: { text: string; options: string[] }): string {
  return `<DATA>\n${JSON.stringify({ question: item.text, options: item.options })}\n</DATA>`;
}
