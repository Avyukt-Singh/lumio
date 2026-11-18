// Quiz-generator prompt v1 — chunk 5-AI feature 2 ("Generate fresh quiz").
// Every item passes schema validation, MCQ sanity checks (unique options,
// exactly one key, index in range) and an independent re-solve agreement
// check in the route before it is shown. Difficulty is a learner choice.
import 'server-only';
import { z } from 'zod';
import { DATA_RULE, fenceData } from '@/lib/ai/safety';

/**
 * Normalise the raw model JSON before schema validation: providers phrase the
 * wrapper and field names differently (`items`/`questions`, `text`/`question`,
 * `answer` as index or as the option text). Normalisation never invents
 * content — unknown shapes still fail the schema.
 */
function normalizeQuizItems(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  const arr = Array.isArray(obj.items)
    ? obj.items
    : Array.isArray(obj.questions)
      ? obj.questions
      : Array.isArray(raw)
        ? raw
        : null;
  if (!arr) return raw;
  const items = arr.map((el) => {
    if (!el || typeof el !== 'object') return el;
    const o = el as Record<string, unknown>;
    const options = Array.isArray(o.options) ? (o.options as unknown[]).map((x) => String(x)) : [];
    let answer: unknown = o.answerIndex ?? o.answer;
    if (typeof answer === 'string') {
      const needle: string = answer;
      const idx = options.findIndex((op) => op.trim().toLowerCase() === needle.trim().toLowerCase());
      answer = idx >= 0 ? idx : -1;
    }
    return {
      text: typeof o.text === 'string' ? o.text : typeof o.question === 'string' ? o.question : o.prompt,
      options,
      answer: typeof answer === 'number' ? answer : -1,
      explanation: typeof o.explanation === 'string' ? o.explanation : typeof o.reason === 'string' ? o.reason : o.why,
    };
  });
  return { items };
}

export const QuizGenOutputSchema = z.preprocess(
  normalizeQuizItems,
  z.object({
    items: z
      .array(
        z.object({
          text: z.string().min(10).max(400),
          options: z.array(z.string().min(1).max(200)).min(3).max(5),
          answer: z.number().int().min(0),
          explanation: z.string().min(5).max(400),
        })
      )
      .min(1)
      .max(8),
  })
);

export const quizGenPrompt = {
  id: 'quizgen',
  version: 1,
  system: (opts: { band: string; lang: string; difficulty: string }) => {
    const language =
      opts.lang === 'hi'
        ? 'Write all values in simple Hindi (Devanagari).'
        : opts.lang === 'hinglish'
          ? 'Write all values in natural Hinglish (Roman script).'
          : 'Write all values in simple English.';
    const diff: Record<string, string> = {
      easy: 'Difficulty EASY: direct recall and one-step questions.',
      medium: 'Difficulty MEDIUM: two-step reasoning and applied questions.',
      hard: 'Difficulty HARD: multi-step, HOTS-style questions — still fully solvable from the chapter context.',
    };
    return [
      'You write fresh multiple-choice quiz questions for a chapter the learner is studying.',
      diff[opts.difficulty] ?? diff.medium,
      'Each question must be solvable from the chapter data alone; avoid trick wording; exactly ONE option must be correct.',
      'Be careful with arithmetic and units: re-check every calculation yourself and only include items you are certain about.',
      'Never claim board alignment or official status. Learning topics only.',
      language,
      'Reply with ONLY a JSON object matching the schema — no markdown fences, no prose.',
      DATA_RULE,
    ].join('\n');
  },
  buildUser(input: {
    chapterId: string;
    chapterTitle: string;
    subject: string;
    summary: string;
    keyPoints: string[];
    difficulty: string;
    count: number;
    wrongTexts: string[];
  }) {
    return [
      fenceData(
        `chapter ${input.chapterId}`,
        [
          `Title: ${input.chapterTitle}`,
          `Subject: ${input.subject}`,
          `Summary: ${input.summary}`,
          input.keyPoints.length ? `Key points:\n- ${input.keyPoints.join('\n- ')}` : '',
          input.wrongTexts.length
            ? `The learner previously got these questions wrong — write the new questions around the SAME misconceptions, but never copy them:\n- ${input.wrongTexts.join('\n- ')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      ),
      `Produce JSON with key items: exactly ${input.count} multiple-choice question(s) with 4 options, the answer index and a short explanation. Every item must be independently verifiable from the chapter context.`,
    ].join('\n');
  },
} as const;
