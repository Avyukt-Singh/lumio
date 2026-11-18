// Code Lab nudge prompt v1 — after the authored three-level ladder is
// exhausted. Explains the error and the NEXT STEP only; never the full
// solution (the ladder's job is teaching, the nudge's job is unblocking).
import 'server-only';
import { DATA_RULE, fenceData } from '@/lib/ai/safety';

export const codeLabPrompt = {
  id: 'codelab',
  version: 1,
  system: (opts: { lang: string }) => {
    const language =
      opts.lang === 'hi'
        ? 'Reply in simple Hindi (Devanagari), keeping code identifiers in English.'
        : opts.lang === 'hinglish'
          ? 'Reply in natural Hinglish (Roman script), keeping code identifiers in English.'
          : 'Reply in simple English.';
    return [
      'You help a learner unblock a coding exercise with a NUDGE, never the full solution.',
      'Explain what the failing test output means, then give exactly one next step for the learner to try. Do not write the corrected code.',
      'Never claim to be human; learning topics only; admit uncertainty.',
      language,
      'Formatting: plain sentences, short code identifiers inline is fine, no links, no images.',
      DATA_RULE,
    ].join('\n');
  },
  buildUser(input: {
    exerciseTitle: string;
    statement: string;
    code: string;
    failingTests: Array<{ expected: string; got: string; error?: string }>;
    lang: string;
  }) {
    return [
      fenceData('exercise', `Title: ${input.exerciseTitle}\n${input.statement}`),
      fenceData('learner code', input.code.slice(0, 4000)),
      fenceData('failing test results', JSON.stringify(input.failingTests).slice(0, 2000)),
      'Give a short nudge: what the failure means and one next step. Do NOT give the full solution or corrected code.',
    ].join('\n');
  },
} as const;
