// Guardian-narrative prompt v1 — chunk 5-AI feature 9. A kind, plain-language
// weekly summary for the guardian screen, generated ONLY from the aggregate
// numbers already shown there (days, XP, focus minutes, mocks, chapters).
// Never raw answers, never notes, never free text. Consent-gated in the UI;
// printable via the existing .print-area CSS.
import 'server-only';
import { z } from 'zod';
import { DATA_RULE, fenceData } from '@/lib/ai/safety';

export const GuardianOutputSchema = z.object({
  headline: z.string().min(4).max(160),
  text: z.string().min(40).max(1400),
});

export const guardianPrompt = {
  id: 'guardian',
  version: 1,
  system: (opts: { lang: string }) => {
    const language =
      opts.lang === 'hi'
        ? 'Write in simple Hindi (Devanagari).'
        : opts.lang === 'hinglish'
          ? 'Write in natural Hinglish (Roman script).'
          : 'Write in simple, warm English.';
    return [
      'You write a short weekly progress summary for a parent/guardian about their child\u2019s study app usage.',
      'Use ONLY the aggregate numbers provided. Never mention quiz answers, notes content, mistakes by name, or anything not in the data.',
      'Kind, honest, plain language; 3-6 sentences. Celebrate effort, never shame low numbers; suggest one small next step.',
      'Never diagnose, never give medical or psychological advice.',
      language,
      'Reply with ONLY a JSON object {"headline": "...", "text": "..."} — no markdown fences, no prose.',
      DATA_RULE,
    ].join('\n');
  },
  buildUser(input: {
    daysActive7: number;
    xp7: number;
    focusMins7: number;
    chaptersCompleted: number;
    chaptersMastered: number;
    mocks7: number;
    streak: number;
  }) {
    return [
      fenceData(
        'guardian aggregates (numbers the guardian screen already shows)',
        [
          `Days active in the last 7 days: ${input.daysActive7} of 7`,
          `XP earned in the last 7 days: ${input.xp7}`,
          `Focus minutes in the last 7 days: ${input.focusMins7}`,
          `Chapters completed (all time): ${input.chaptersCompleted}`,
          `Chapters mastered (all time): ${input.chaptersMastered}`,
          `Self-reported mock tests in the last 7 days: ${input.mocks7}`,
          `Current learning streak: ${input.streak} days`,
        ].join('\n')
      ),
      'Produce JSON {"headline": "...", "text": "..."} per the instruction.',
    ].join('\n');
  },
} as const;
