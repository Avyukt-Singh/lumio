// Practice-generator prompt v1 (beta) — "more questions like this" for a
// chapter. Every generated item passes automated checks (schema + independent
// re-solve agreement) before display; items that fail are dropped. Beta label
// and no-XP rule are enforced by the caller and shown on screen.
import 'server-only';
import { z } from 'zod';
import { DATA_RULE, fenceData } from '@/lib/ai/safety';

function normalizeItems(raw: unknown): unknown {
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

export const PracticeOutputSchema = z.preprocess(
  normalizeItems,
  z.object({
    items: z
      .array(
        z.object({
          text: z.string().min(10).max(400),
          options: z.array(z.string().min(1).max(200)).min(3).max(6),
          answer: z.number().int().min(0),
          explanation: z.string().min(5).max(400),
        })
      )
      .min(1)
      .max(5),
  })
);

export const practicePrompt = {
  id: 'practice',
  version: 1,
  system: (opts: { band: string; lang: string }) => {
    const language =
      opts.lang === 'hi'
        ? 'Write all values in simple Hindi (Devanagari).'
        : opts.lang === 'hinglish'
          ? 'Write all values in natural Hinglish (Roman script).'
          : 'Write all values in simple English.';
    return [
      'You write extra practice questions for a chapter the learner is studying.',
      'Questions must be solvable from the chapter context alone; avoid trick wording; keep difficulty close to the sample question.',
      'Be careful with arithmetic and units: if the answer needs a calculation, re-check it yourself and only include items you are certain about.',
      'Never claim board alignment. Learning topics only.',
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
    sample: { text: string; options: string[]; answer: number; explanation: string } | null;
    band: string;
    lang: string;
    count: number;
  }) {
    return [
      fenceData(
        `chapter ${input.chapterId}`,
        [
          `Title: ${input.chapterTitle}`,
          `Subject: ${input.subject}`,
          `Summary: ${input.summary}`,
          input.keyPoints.length ? `Key points:\n- ${input.keyPoints.join('\n- ')}` : '',
          input.sample
            ? `Sample question (match its style and difficulty):\n${JSON.stringify(input.sample)}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      ),
      `Produce JSON with key items: exactly ${input.count} multiple-choice question(s) with options, answer index and explanation. Each item must be independently verifiable from the chapter context.`,
    ].join('\n');
  },
} as const;
