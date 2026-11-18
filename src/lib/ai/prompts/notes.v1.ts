// Notes-to-study prompt v1 — summary bullets, glossary, flashcards, quiz
// questions from the learner's own sanitised note. Output saved through
// practice-only events; never XP, never SRS.
import 'server-only';
import { z } from 'zod';
import { DATA_RULE, fenceData } from '@/lib/ai/safety';

export const NotesOutputSchema = z.object({
  summary: z.array(z.string().min(5).max(400)).min(1).max(6),
  glossary: z.array(z.object({ term: z.string().min(1).max(60), meaning: z.string().min(2).max(200) })).max(8),
  flashcards: z
    .array(z.object({ front: z.string().min(2).max(200), back: z.string().min(1).max(400) }))
    .min(1)
    .max(10),
  questions: z
    .array(
      z.object({
        text: z.string().min(10).max(400),
        options: z.array(z.string().min(1).max(200)).min(3).max(6),
        answer: z.number().int().min(0),
        explanation: z.string().min(2).max(400),
      })
    )
    .min(1)
    .max(5),
});

export const notesPrompt = {
  id: 'notes',
  version: 1,
  system: (opts: { band: string; lang: string }) => {
    const language =
      opts.lang === 'hi'
        ? 'Write all values in simple Hindi (Devanagari), keeping technical terms in English where the note uses English.'
        : opts.lang === 'hinglish'
          ? 'Write all values in natural Hinglish (Roman script).'
          : 'Write all values in simple English.';
    return [
      'You turn a learner\'s own study note into revision material.',
      'Stay strictly inside what the note says — do not add facts from outside it; if the note is too thin for something, leave it out.',
      'Never claim board alignment. Never mention that you are an AI model. Learning topics only.',
      language,
      'Reply with ONLY a JSON object matching the schema — no markdown fences, no prose.',
      DATA_RULE,
    ].join('\n');
  },
  buildUser(input: { noteName: string; noteText: string; band: string; lang: string }) {
    return [
      fenceData('learner note', `Document name: ${input.noteName}\n\n${input.noteText}`),
      'Produce JSON with keys: summary (1-6 bullets, each strictly from the note), glossary (up to 8 terms defined as the note uses them), flashcards (up to 10, front/back), questions (up to 5 multiple-choice with options, answer index, explanation). Every item must be answerable from the note alone.',
    ].join('\n');
  },
} as const;
