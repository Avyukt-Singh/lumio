// Explain-my-mistake prompt v1 — schema-validated JSON output: level-
// appropriate explanation, the likely misconception, ONE remedial question.
// Practice-only: the caller must never grant XP for this.
import 'server-only';
import { z } from 'zod';
import { DATA_RULE, fenceData } from '@/lib/ai/safety';

export const MistakeOutputSchema = z.object({
  explanation: z.string().min(10).max(1200),
  misconception: z.string().min(5).max(300),
  // chunk 5-AI feature 7: auto-suggested mistake tag (the learner confirms it —
  // the suggestion never writes to the mistake notebook by itself).
  suggestedTag: z.enum(['concept', 'careless', 'calculation', 'fact']).optional(),
  practice: z.object({
    text: z.string().min(10).max(500),
    options: z.array(z.string().min(1).max(200)).min(3).max(6),
    answer: z.number().int().min(0),
    explanation: z.string().min(5).max(500),
  }),
});

export const mistakePrompt = {
  id: 'mistake',
  version: 1,
  system: (opts: { band: string; lang: string }) => {
    const level =
      opts.band === 'young'
        ? 'Explain for a young child in at most three short, simple sentences.'
        : opts.band === 'sec' || opts.band === 'middle'
          ? 'Explain clearly and concisely for a school student.'
          : 'Explain thoroughly for an adult exam aspirant.';
    const language =
      opts.lang === 'hi'
        ? 'Write all values in simple Hindi (Devanagari).'
        : opts.lang === 'hinglish'
          ? 'Write all values in natural Hinglish (Roman script).'
          : 'Write all values in simple English.';
    return [
      'You are a patient tutor explaining WHY a quiz answer was wrong.',
      'Never mention that you are an AI model; never give personal advice beyond studying; only discuss this question and its topic.',
      'Admit uncertainty rather than inventing facts.',
      'Also suggest exactly ONE mistake tag: concept (misunderstood the idea), careless (rushed or misread), calculation (arithmetic slip), fact (remembered wrong). Pick the best fit.',
      level,
      language,
      'Reply with ONLY a JSON object matching the schema — no markdown fences, no prose.',
      DATA_RULE,
    ].join('\n');
  },
  buildUser(input: {
    chapterTitle: string;
    subject: string;
    question: { text: string; options: string[]; answer: number; explanation: string };
    chosen: number | null;
    band: string;
    lang: string;
  }) {
    return [
      fenceData(
        'question and key',
        JSON.stringify({
          chapter: input.chapterTitle,
          subject: input.subject,
          question: input.question.text,
          options: input.question.options,
          correctIndex: input.question.answer,
          why: input.question.explanation,
          learnerChoseIndex: input.chosen,
        })
      ),
      'Produce JSON with keys: explanation (why the correct answer is right and the learner\'s choice, if given, is wrong), misconception (the likely single misconception behind the mistake), practice (one NEW question on the same idea: text, options, answer index, explanation). The practice question is practice-only and must be solvable from the chapter idea alone.',
    ].join('\n');
  },
} as const;
