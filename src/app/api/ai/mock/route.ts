// POST /api/ai/mock — chunk 5-AI feature 5. Practice paper generator:
// sectioned, marked, chapter-tagged, with the independent re-solve accuracy
// check on every question. Labelled "practice paper, not official" in the UI;
// auto-graded in-app; the learner records the result via the existing
// self-reported mock flow (weak chapters feed weakTopics as before).
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail, normLang } from '@/lib/ai/route';
import { recordUsage } from '@/lib/ai/budget';
import { checkOutput, outputHash, preFilter, scrubText } from '@/lib/ai/safety';
import { completeJson } from '@/lib/ai/gateway';
import { MockPaperOutputSchema, mockPaperPrompt } from '@/lib/ai/prompts/mockpaper.v1';

const BodySchema = z.object({
  exam: z.enum(['school', 'jee', 'neet', 'cuet']),
  subject: z.string().min(1).max(40),
  chapters: z.array(z.string().min(1).max(120)).min(1).max(8),
  count: z.number().int().min(4).max(12),
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

  if (preFilter(body.chapters.join(' ')).crisis) {
    return aiOk({ data: null, crisis: true });
  }

  const res = await completeJson(
    {
      feature: 'mockpaper',
      messages: [
        { role: 'system', content: mockPaperPrompt.system({ band: body.band, lang, exam: body.exam }) },
        {
          role: 'user',
          content: mockPaperPrompt.buildUser({
            exam: body.exam,
            subject: scrubText(body.subject).text,
            chapters: body.chapters.map((c) => scrubText(c).text),
            count: body.count,
            band: body.band,
            lang,
          }),
        },
      ],
      maxTokens: 3200,
      meta: { lang, topic: body.subject, exam: body.exam },
    },
    MockPaperOutputSchema,
    { timeoutMs: 60_000, retries: 1 }
  );
  if (!res.ok || !res.value) {
    console.error('[mock] gen failed:', res.code, res.detail);
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }

  const data = res.value.value;
  let tokensIn = res.value.tokensIn;
  let tokensOut = res.value.tokensOut;
  let dropped = 0;

  // Every MCQ passes: schema shape (already), unique options, key in range,
  // output check, and an independent re-solve agreement.
  type PaperQ = z.infer<typeof MockPaperOutputSchema>['sections'][number]['questions'][number];
  type PaperSection = z.infer<typeof MockPaperOutputSchema>['sections'][number];
  const keptSections: PaperSection[] = [];
  for (const section of data.sections) {
    const keptQs: PaperQ[] = [];
    for (const q of section.questions) {
      const lower = q.options.map((o) => o.trim().toLowerCase());
      if (q.answer >= q.options.length || new Set(lower).size !== lower.length) {
        dropped += 1;
        continue;
      }
      const check = checkOutput(q.text + q.explanation);
      if (!check.ok) {
        dropped += 1;
        continue;
      }
      const solve = await completeJson(
        {
          feature: 'mock-solve',
          messages: [
            {
              role: 'system',
              content:
                'You solve multiple-choice questions. Work carefully, watch arithmetic and units. Reply only with JSON {"answerIndex": <number>}.',
            },
            {
              role: 'user',
              content: `<DATA>\n${JSON.stringify({ question: q.text, options: q.options })}\n</DATA>\nSolve using only the item above. Reply ONLY with JSON {"answerIndex": <number>}.`,
            },
          ],
          maxTokens: 60,
          meta: { lang, answer: q.answer },
        },
        SolveSchema
      );
      if (!solve.ok || !solve.value) {
        dropped += 1;
        continue;
      }
      tokensIn += solve.value.tokensIn;
      tokensOut += solve.value.tokensOut;
      if (solve.value.value.answerIndex !== q.answer) {
        dropped += 1;
        continue;
      }
      keptQs.push(q);
    }
    if (keptQs.length > 0) keptSections.push({ ...section, questions: keptQs });
  }

  const total = keptSections.reduce((n, s) => n + s.questions.length, 0);
  if (total < 4) {
    return aiFail('INVALID_RESPONSE', 502);
  }

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'mockpaper',
    ip: gate.gate.ip,
    tokensIn,
    tokensOut,
    now: new Date(),
  });

  return aiOk({
    data: { title: data.title, sections: keptSections, total, dropped },
    label: 'ai_practice_paper_not_official',
    outputHash: outputHash(JSON.stringify(keptSections)),
  });
}
