// Coach prompt v1 — chunk 5-AI feature 8. Three display-only coach texts:
// "why this plan" (explains the deterministic schedule in plain language),
// a weekly reflection, and a "question of the day" prompt. Reads AGGREGATES
// ONLY — never names, notes, or raw answers. The schedule itself stays
// produced by planDay; the AI proposes and explains, rules decide.
import 'server-only';
import { z } from 'zod';
import { DATA_RULE, fenceData } from '@/lib/ai/safety';

export const CoachOutputSchema = z.object({
  text: z.string().min(20).max(1600),
});

export const coachPrompt = {
  id: 'coach',
  version: 1,
  system: (opts: { band: string; lang: string; mode: 'why' | 'reflect' | 'qotd' }) => {
    const age =
      opts.band === 'young'
        ? 'Write for a young child: very short sentences, warm and kind.'
        : 'Write plainly and kindly for a student.';
    const language =
      opts.lang === 'hi'
        ? 'Write in simple Hindi (Devanagari).'
        : opts.lang === 'hinglish'
          ? 'Write in natural Hinglish (Roman script).'
          : 'Write in simple English.';
    const perMode: Record<string, string> = {
      why: 'Explain in plain language WHY today\u2019s plan looks the way it does (which subjects got slots and why, what the scheduler avoided). Be specific to the data; 3-6 sentences. Never propose moving sessions here — explanation only.',
      reflect: 'Write a short weekly reflection: what went well, what to try next week. Ground every claim in the aggregates given; 3-6 sentences. Kind tone, no guilt.',
      qotd: 'Write ONE study question of the day the learner can answer from the topics given — with its short answer on a new line after "Answer:". Keep it at the learner\u2019s level.',
    };
    return [
      'You are Lumio\u2019s study coach. You explain and encourage; you never change the plan.',
      'Use ONLY the aggregates provided — never invent scores, streaks, dates or board rules. If the data is thin, say so honestly.',
      age,
      language,
      perMode[opts.mode],
      'Reply with ONLY a JSON object {"text": "..."} — no markdown fences, no prose.',
      DATA_RULE,
    ].join('\n');
  },
  buildUser(input: {
    mode: 'why' | 'reflect' | 'qotd';
    band: string;
    lang: string;
    planSummary: string;
    weakTopics: string[];
    streak: number;
    xpLast7: number;
    focusMins7: number;
    mocksSummary: string;
    level?: string;
  }) {
    return [
      fenceData(
        'coach aggregates (numbers only — no personal data)',
        [
          `Streak days: ${input.streak}`,
          `XP earned last 7 days: ${input.xpLast7}`,
          `Focus minutes last 7 days: ${input.focusMins7}`,
          input.mocksSummary ? `Mocks (self-reported): ${input.mocksSummary}` : 'Mocks: none recorded yet',
          input.weakTopics.length ? `Weakest topics (by the learner\u2019s own misses): ${input.weakTopics.slice(0, 5).join(', ')}` : 'Weak topics: none recorded',
          input.mode === 'why' ? `Today\u2019s schedule (already fixed by the deterministic scheduler): ${input.planSummary}` : '',
          input.mode === 'qotd' && input.weakTopics.length ? `Question must come from: ${input.weakTopics.slice(0, 3).join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      ),
      'Produce JSON {"text": "..."} per the instruction.',
    ].join('\n');
  },
} as const;
