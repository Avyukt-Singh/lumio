// Worksheet prompt v1 — chunk 5-AI feature 3. Mixed-type worksheets with
// class-appropriate marks and an answer key. MCQ and numerical items pass the
// same independent re-solve check as the quiz generator; failing items are
// dropped and the count is reported honestly.
import 'server-only';
import { z } from 'zod';
import { DATA_RULE, fenceData } from '@/lib/ai/safety';

export const WORKSHEET_TYPES = ['mcq', 'fill', 'short', 'long', 'numerical', 'hots'] as const;

function normalizeWorksheet(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  const inner = (obj.worksheet && typeof obj.worksheet === 'object' ? obj.worksheet : obj) as Record<string, unknown>;
  const arr = Array.isArray(inner.items)
    ? inner.items
    : Array.isArray(inner.questions)
      ? inner.questions
      : null;
  if (!arr) return raw;
  const items = arr.map((el) => {
    if (!el || typeof el !== 'object') return el;
    const o = el as Record<string, unknown>;
    const rawType = typeof o.type === 'string' ? o.type.toLowerCase() : '';
    const type = (WORKSHEET_TYPES as readonly string[]).includes(rawType)
      ? rawType
      : rawType.includes('mcq') || rawType.includes('choice')
        ? 'mcq'
        : rawType.includes('fill') || rawType.includes('blank')
          ? 'fill'
          : rawType.includes('short')
            ? 'short'
            : rawType.includes('long') || rawType.includes('essay')
              ? 'long'
              : rawType.includes('numer') || rawType.includes('calc')
                ? 'numerical'
                : 'hots';
    const marksRaw = typeof o.marks === 'number' ? o.marks : typeof o.mark === 'number' ? o.mark : NaN;
    const fallbackMarks = type === 'mcq' || type === 'fill' ? 2 : type === 'short' ? 3 : 4;
    const marks = Number.isFinite(marksRaw) && marksRaw >= 1 && marksRaw <= 10 ? Math.round(marksRaw) : fallbackMarks;
    return {
      type,
      text: typeof o.text === 'string' ? o.text : typeof o.question === 'string' ? o.question : o.prompt,
      options: Array.isArray(o.options) ? (o.options as unknown[]).map((x) => String(x)) : [],
      answer:
        typeof o.answer === 'string'
          ? o.answer
          : typeof o.answer === 'number'
            ? String(o.answer)
            : Array.isArray(o.options) && typeof o.answerIndex === 'number'
              ? String((o.options as unknown[])[o.answerIndex] ?? '')
              : typeof o.key === 'string'
                ? o.key
                : '',
      marks,
    };
  });
  return {
    title: typeof inner.title === 'string' ? inner.title : 'Practice worksheet',
    instructions:
      typeof inner.instructions === 'string'
        ? inner.instructions
        : typeof inner.note === 'string'
          ? inner.note
          : 'Answer all questions.',
    items,
  };
}

export const WorksheetOutputSchema = z.preprocess(
  normalizeWorksheet,
  z.object({
    title: z.string().min(4).max(120),
    instructions: z.string().min(10).max(400),
    items: z
      .array(
        z.object({
          type: z.enum(WORKSHEET_TYPES),
          text: z.string().min(5).max(600),
          options: z.array(z.string().min(1).max(200)).max(5).default([]),
          answer: z.string().min(1).max(600),
          marks: z.number().int().min(1).max(10),
        })
      )
      .min(3)
      .max(12),
  })
);

export const worksheetPrompt = {
  id: 'worksheet',
  version: 1,
  system: (opts: { band: string; lang: string; difficulty: string }) => {
    const language =
      opts.lang === 'hi'
        ? 'Write all values in simple Hindi (Devanagari).'
        : opts.lang === 'hinglish'
          ? 'Write all values in natural Hinglish (Roman script).'
          : 'Write all values in simple English.';
    const diff: Record<string, string> = {
      easy: 'Difficulty EASY: recall and one-step items, most learners finish it.',
      medium: 'Difficulty MEDIUM: a fair mix of recall and application.',
      hard: 'Difficulty HARD: application and HOTS items dominate.',
    };
    return [
      'You build a printable practice worksheet for a chapter, with an answer key.',
      'Item mix: some mcq, at least one fill (fill-in-the-blank with ___), short answer, long answer; numerical where the subject supports it; hots (higher-order thinking) as a stretch item.',
      'Marks per item should suit the type: mcq/fill 1-2, short 2-3, long/numerical/hots 3-5.',
      diff[opts.difficulty] ?? diff.medium,
      'Every item must be solvable from the chapter data alone. Re-check numerical answers yourself; only include items you are certain about.',
      'For mcq items: options must be unique strings and exactly one correct — put the correct option TEXT in answer. For others: answer is the expected solution (a full worked answer for long/numerical).',
      'Never claim board alignment or official status. Learning topics only.',
      language,
      'Reply with ONLY a JSON object matching the schema — no markdown fences, no prose.',
      DATA_RULE,
    ].join('\n');
  },
  buildUser(input: {
    chapterTitle: string;
    subject: string;
    summary: string;
    keyPoints: string[];
    difficulty: string;
    band: string;
    lang: string;
  }) {
    return [
      fenceData(
        'chapter',
        [
          `Title: ${input.chapterTitle}`,
          `Subject: ${input.subject}`,
          `Summary: ${input.summary}`,
          input.keyPoints.length ? `Key points:\n- ${input.keyPoints.join('\n- ')}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      ),
      'Produce JSON: title, instructions, and 6-10 items with type, text, options (mcq only), answer and marks. The answer key is built from the same items — answers must be complete and correct.',
    ].join('\n');
  },
} as const;
