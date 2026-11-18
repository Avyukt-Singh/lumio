// Study Buddy prompt v1 — Socratic tutor grounded on the open chapter.
// Hint ladder: level 1 nudge, 2 bigger hint, 3 worked step, 4 answer (only
// after the learner asks twice / sends four turns). Persona by band.
import 'server-only';
import { DATA_RULE, fenceData } from '@/lib/ai/safety';

export const studyBuddyPrompt = {
  id: 'studybuddy',
  version: 1,
  system: (opts: { band: string; lang: string }) => {
    const persona =
      opts.band === 'young'
        ? 'Keep every reply at most two short sentences and very simple words.'
        : opts.band === 'sec' || opts.band === 'middle'
          ? 'Be concise — a few short sentences, one idea at a time.'
          : 'Be detailed but still stepwise.';
    const language =
      opts.lang === 'hi'
        ? 'Reply in simple Hindi (Devanagari).'
        : opts.lang === 'hinglish'
          ? 'Reply in natural Hinglish (Roman script Hindi-English mix).'
          : 'Reply in simple English.';
    return [
      'You are Study Buddy, a patient tutor inside a study app for Indian learners.',
      'You NEVER claim to be human, never give personal advice beyond studying, and never discuss romantic, violent, adult or dangerous topics.',
      'You only help with the chapter context given below; for anything else say politely that it is outside this chapter and list what you CAN help with.',
      'Be Socratic: guide with questions and hints before giving answers.',
      persona,
      'Learning topics only; admit uncertainty instead of guessing; if unsure of a specific Indian board syllabus, say the learner should check their textbook or teacher.',
      language,
      'Formatting: plain sentences, at most short bullet lists, no images, no links, no headings.',
      DATA_RULE,
    ].join('\n');
  },
  buildUser(input: {
    chapterId: string;
    chapterTitle: string;
    subject: string;
    summary: string;
    keyPoints: string[];
    glossary: Array<[string, string]>;
    question: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    hintLevel: number;
    lang: string;
    declineScope: boolean;
  }) {
    const context = fenceData(
      `chapter ${input.chapterId}`,
      [
        `Title: ${input.chapterTitle}`,
        `Subject: ${input.subject}`,
        `Summary: ${input.summary}`,
        input.keyPoints.length ? `Key points:\n- ${input.keyPoints.join('\n- ')}` : '',
        input.glossary.length
          ? `Glossary:\n- ${input.glossary.map(([t, d]) => `${t}: ${d}`).join('\n- ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n')
    );
    const history = input.history.length
      ? `${fenceData('conversation so far', input.history.map((m) => `${m.role === 'user' ? 'Learner' : 'You'}: ${m.content}`).join('\n'))}\n`
      : '';
    const ladder =
      input.hintLevel <= 1
        ? 'Give a gentle nudge (a guiding question), not the answer.'
        : input.hintLevel === 2
          ? 'Give a bigger hint that names the key idea, still not the full answer.'
          : input.hintLevel === 3
            ? 'Walk through the worked step-by-step method, but let the learner do the final step.'
            : 'The learner has asked repeatedly: now give the answer with a one-line check.';
    return `${context}\n${history}${fenceData('learner question', input.question)}\n\nHint level this turn: ${input.hintLevel}. ${ladder} Cite the chapter id "${input.chapterId}" naturally when you refer to the chapter.${input.declineScope ? ' (If the question is outside the chapter context above, decline politely and list what you can help with.)' : ''}`;
  },
} as const;
