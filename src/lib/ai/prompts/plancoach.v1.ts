// Plan Coach prompt v1 — reads AGGREGATES ONLY (no personal text), returns
// move suggestions that the deterministic scheduler validates before the
// learner sees them. The scheduler stays the source of truth; invalid moves
// are discarded silently (with a kind message when all are discarded).
import 'server-only';
import { z } from 'zod';
import { DATA_RULE, fenceData } from '@/lib/ai/safety';

export const PlanOutputSchema = z.object({
  suggestions: z
    .array(
      z.object({
        date: z.string().min(8).max(10),
        sessionIndex: z.number().int().min(0),
        newStartMin: z.number().int().min(0).max(24 * 60),
        reason: z.string().min(5).max(200),
      })
    )
    .max(7),
  note: z.string().max(300).optional(),
});

export const planCoachPrompt = {
  id: 'plancoach',
  version: 1,
  system: (opts: { lang: string }) => {
    const language =
      opts.lang === 'hi'
        ? 'Write reason/note in simple Hindi (Devanagari).'
        : opts.lang === 'hinglish'
          ? 'Write reason/note in natural Hinglish (Roman script).'
          : 'Write reason/note in simple English.';
    return [
      'You suggest small schedule adjustments for the next 7 days from aggregate study data.',
      'Only suggest moves to a start time listed as VALID for that session — never invent times. Never move more than one session per day. Never add or delete sessions.',
      'Never guilt-trip, never mention rank or compare the learner to others. Kind, specific, brief.',
      language,
      'Reply with ONLY a JSON object matching the schema — no markdown fences, no prose.',
      DATA_RULE,
    ].join('\n');
  },
  buildUser(input: {
    weakTopics: string[];
    mockSummary: string;
    examDate: string;
    freeWindows: string;
    commitments: string;
    sessions: Array<{ date: string; index: number; subject: string; startMin: number; endMin: number; validStarts: number[]; done: boolean }>;
    lang: string;
  }) {
    return [
      fenceData(
        'schedule aggregates',
        JSON.stringify({
          weakTopics: input.weakTopics,
          mockResults: input.mockSummary,
          examDate: input.examDate,
          freeWindows: input.freeWindows,
          commitments: input.commitments,
          upcomingSessions: input.sessions.map((s) => ({
            date: s.date,
            sessionIndex: s.index,
            subject: s.subject,
            startMin: s.startMin,
            endMin: s.endMin,
            validStarts: s.validStarts,
            done: s.done,
          })),
        })
      ),
      'Produce JSON: suggestions (each { date, sessionIndex, newStartMin, reason }) moving at most one session per day to a time in that session\'s validStarts, prioritising weak topics and the exam date; note (optional one-sentence summary). If nothing needs moving, return an empty suggestions array.',
    ].join('\n');
  },
} as const;
