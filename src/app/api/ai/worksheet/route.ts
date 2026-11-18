// POST /api/ai/worksheet — chunk 5-AI feature 3. Mixed-type worksheet with an
// answer key. MCQ and numerical items pass the independent re-solve check
// (failing items are dropped and reported honestly); the answer key is derived
// from the surviving items, so it can never disagree with the printed paper.
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail, normLang } from '@/lib/ai/route';
import { recordUsage } from '@/lib/ai/budget';
import { checkOutput, outputHash, preFilter, scrubText } from '@/lib/ai/safety';
import { completeJson } from '@/lib/ai/gateway';
import { WorksheetOutputSchema, worksheetPrompt } from '@/lib/ai/prompts/worksheet.v1';

const BodySchema = z.object({
  chapterTitle: z.string().min(1).max(200),
  subject: z.string().max(40),
  summary: z.string().max(2000),
  keyPoints: z.array(z.string().max(400)).max(6),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  band: z.enum(['young', 'middle', 'sec', 'senior', 'dropper', 'above']),
  lang: z.enum(['en', 'hi', 'hinglish']),
});

const SolveSchema = z.object({ answerText: z.string().min(1).max(600) });

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

  const res = await completeJson(
    {
      feature: 'worksheet',
      messages: [
        { role: 'system', content: worksheetPrompt.system({ band: body.band, lang, difficulty: body.difficulty }) },
        {
          role: 'user',
          content: worksheetPrompt.buildUser({
            chapterTitle: scrubText(body.chapterTitle).text,
            subject: body.subject,
            summary: scrubText(body.summary).text,
            keyPoints: body.keyPoints.map((k) => scrubText(k).text),
            difficulty: body.difficulty,
            band: body.band,
            lang,
          }),
        },
      ],
      maxTokens: 2600,
      meta: { lang, topic: body.chapterTitle },
    },
    WorksheetOutputSchema,
    { timeoutMs: 60_000, retries: 1 }
  );
  if (!res.ok || !res.value) {
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }

  const data = res.value.value;
  let tokensIn = res.value.tokensIn;
  let tokensOut = res.value.tokensOut;

  // Verify checkable items: mcq (re-solve + sanity) and numerical (re-solve).
  const checkable = new Set(['mcq', 'numerical'] as const);
  const kept: typeof data.items = [];
  let dropped = 0;
  for (const item of data.items) {
    const check = checkOutput(item.text + ' ' + item.answer);
    if (!check.ok) {
      dropped += 1;
      continue;
    }
    if (checkable.has(item.type as 'mcq' | 'numerical')) {
      if (item.type === 'mcq') {
        const lower = item.options.map((o) => o.trim().toLowerCase());
        if (lower.length < 3 || new Set(lower).size !== lower.length || !lower.includes(item.answer.trim().toLowerCase())) {
          dropped += 1;
          continue;
        }
      }
      const solve = await completeJson(
        {
          feature: 'worksheet-solve',
          messages: [
            { role: 'system', content: SOLVER_SYSTEM(lang) },
            {
              role: 'user',
              content: `<DATA>\n${JSON.stringify({ question: item.text, options: item.type === 'mcq' ? item.options : undefined })}\n</DATA>\nSolve using only the item above. Reply ONLY with JSON {"answerText": "<your answer>"}.`,
            },
          ],
          maxTokens: 200,
          meta: { lang, answer: item.answer },
        },
        SolveSchema
      );
      if (!solve.ok || !solve.value) {
        dropped += 1;
        continue;
      }
      tokensIn += solve.value.tokensIn;
      tokensOut += solve.value.tokensOut;
      // Agreement: the re-solve must land on the same answer (exact for mcq,
      // containment for numerical — model re-formats are tolerated).
      const a = item.answer.trim().toLowerCase();
      const b = solve.value.value.answerText.trim().toLowerCase();
      const agree =
        item.type === 'mcq'
          ? a === b
          : b.includes(a.replace(/[^\w.]/g, '')) || a.includes(b.replace(/[^\w.]/g, ''));
      if (!agree) {
        dropped += 1;
        continue;
      }
    }
    kept.push(item);
  }

  if (kept.length < 3) {
    return aiFail('INVALID_RESPONSE', 502);
  }

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'worksheet',
    ip: gate.gate.ip,
    tokensIn,
    tokensOut,
    now: new Date(),
  });

  return aiOk({
    data: { title: data.title, instructions: data.instructions, items: kept, dropped },
    label: 'ai_generated_unreviewed',
    outputHash: outputHash(JSON.stringify(kept)),
  });
}

function SOLVER_SYSTEM(lang: string): string {
  const language =
    lang === 'hi' ? 'Solve silently; reply only with JSON.' : 'Reply only with JSON.';
  return [
    'You solve worksheet questions.',
    'Work out the answer carefully, watching arithmetic and units; if the question cannot be answered from the item alone, still give the best-supported answer.',
    language,
  ].join(' ');
}
