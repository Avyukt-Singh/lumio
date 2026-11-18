// POST /api/ai/quiz — chunk 5-AI feature 2 ("Generate fresh quiz"). Same
// pipeline as the practice generator: schema validation, MCQ sanity checks
// (unique options, exactly one key, index in range), an independent re-solve
// agreement check, then honest reporting of dropped items. Items get stable
// ids client-side: `ai:<outputHash>#<index>`, so wrong answers, the mistake
// notebook and adaptive practice keep working unchanged.
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail, normLang } from '@/lib/ai/route';
import { recordUsage } from '@/lib/ai/budget';
import { checkOutput, outputHash, preFilter, scrubText } from '@/lib/ai/safety';
import { completeJson } from '@/lib/ai/gateway';
import { QuizGenOutputSchema, quizGenPrompt } from '@/lib/ai/prompts/quiz-gen.v1';

const BodySchema = z.object({
  chapterId: z.string().min(1).max(40),
  chapterTitle: z.string().min(1).max(200),
  subject: z.string().max(40),
  summary: z.string().max(2000),
  keyPoints: z.array(z.string().max(400)).max(6),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  count: z.number().int().min(3).max(8),
  wrongTexts: z.array(z.string().max(400)).max(6).optional(),
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

  const gen = () =>
    completeJson(
      {
        feature: 'quizgen',
        messages: [
          { role: 'system', content: quizGenPrompt.system({ band: body.band, lang, difficulty: body.difficulty }) },
          {
            role: 'user',
            content: quizGenPrompt.buildUser({
              chapterId: body.chapterId,
              chapterTitle: scrubText(body.chapterTitle).text,
              subject: body.subject,
              summary: scrubText(body.summary).text,
              keyPoints: body.keyPoints.map((k) => scrubText(k).text),
              difficulty: body.difficulty,
              count: body.count,
              wrongTexts: (body.wrongTexts ?? []).map((w) => scrubText(w).text),
            }),
          },
        ],
        maxTokens: 1800,
        meta: { lang, topic: body.chapterTitle, difficulty: body.difficulty },
      },
      QuizGenOutputSchema,
      { timeoutMs: 45_000, retries: 1 }
    );

  const res = await gen();
  if (!res.ok || !res.value) {
    console.error('[quizgen] gen failed:', res.code, res.detail);
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }

  // Independent re-solve per item — the STEM-accuracy check.
  const solverPrompt = SOLVER_SYSTEM(lang);
  const kept: Array<{ text: string; options: string[]; answer: number; explanation: string }> = [];
  let tokensIn = res.value.tokensIn;
  let tokensOut = res.value.tokensOut;
  for (const item of res.value.value.items) {
    // MCQ sanity: unique options (case-insensitive), key in range.
    const lower = item.options.map((o) => o.trim().toLowerCase());
    if (item.answer >= item.options.length) continue;
    if (new Set(lower).size !== lower.length) continue;
    const solve = await completeJson(
      {
        feature: 'quizgen-solve',
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
    if (!solve.ok || !solve.value) { console.error('[quizgen] solve failed:', solve.code, solve.detail); continue; }
    tokensIn += solve.value.tokensIn;
    tokensOut += solve.value.tokensOut;
    if (solve.value.value.answerIndex !== item.answer) continue; // disagreement → drop
    const check = checkOutput(item.text + item.explanation);
    if (!check.ok) continue;
    kept.push(item);
  }

  if (kept.length < 3) {
    // Too few survivors for a fair quiz — fail honestly instead of showing
    // a trimmed set the learner did not ask for.
    console.error('[quizgen] kept', kept.length, 'of', res.value.value.items.length);
    return aiFail('INVALID_RESPONSE', 502);
  }

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'quizgen',
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
