// Lesson prompt v1 — chunk 5-AI feature 1 (chapter content engine). Generates
// fresh notes/sections, key points, glossary and flashcards for any chapter at
// the right reading level, with follow-up modes (simpler / example /
// translate). Grounded ONLY on the chapter data passed in; the model is told
// to say so when unsure and never to invent facts, formulas, dates or board
// rules. Output is schema-validated by the route before anything is shown.
import 'server-only';
import { z } from 'zod';
import { DATA_RULE, fenceData } from '@/lib/ai/safety';

/**
 * Clamp the raw model JSON to the schema bounds instead of failing the whole
 * lesson on an over-long sentence (clamping removes content, never invents
 * it; unknown shapes still fail validation below).
 */
function clampLesson(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const clampSection = (el: unknown) => {
    const o = (el && typeof el === 'object' ? el : {}) as Record<string, unknown>;
    return { heading: str(o.heading, 120), text: str(o.text, 1200) };
  };
  const clampGloss = (el: unknown) => {
    const o = (el && typeof el === 'object' ? el : {}) as Record<string, unknown>;
    return { term: str(o.term, 60), meaning: str(o.meaning, 300) };
  };
  const clampCard = (el: unknown) => {
    const o = (el && typeof el === 'object' ? el : {}) as Record<string, unknown>;
    return { front: str(o.front, 200), back: str(o.back, 400) };
  };

  // Providers phrase follow-up lessons differently. Map the observed shapes
  // into the canonical one — every value comes verbatim from the model output
  // (or is derived from it), nothing is invented:
  // - key points: `keyPoints` (strings) or `key_points` [{point, explanation, example}]
  // - glossary: array [{term, meaning}] or a plain {term: meaning} object
  // - sections: `sections`, or built from summary + the key-point explanations
  // - flashcards: `flashcards`, or derived front/back pairs from the key points
  const rawKeyPoints: unknown[] = arr(obj.keyPoints).length
    ? arr(obj.keyPoints)
    : arr(obj.key_points);
  const keyPoints: string[] = [];
  const sections: Array<{ heading: string; text: string }> = [];
  const derivedCards: Array<{ front: string; back: string }> = [];
  const summary = str(obj.summary, 1200);
  if (summary) sections.push({ heading: 'Overview', text: summary });
  for (const el of rawKeyPoints.slice(0, 8)) {
    if (typeof el === 'string') {
      keyPoints.push(el.slice(0, 400));
      continue;
    }
    if (el && typeof el === 'object') {
      const o = el as Record<string, unknown>;
      const point = str(o.point ?? o.title ?? o.term, 200);
      const explanation = str(o.explanation ?? o.text ?? o.meaning, 1200);
      const example = str(o.example, 400);
      if (point) keyPoints.push((explanation ? `${point}: ${explanation}` : point).slice(0, 400));
      if (point && explanation) {
        sections.push({
          heading: point.slice(0, 120),
          text: (explanation + (example ? ` For example: ${example}` : '')).slice(0, 1200),
        });
        derivedCards.push({ front: point.slice(0, 200), back: explanation.slice(0, 400) });
      }
    }
  }

  // glossary: array or {term: meaning}
  let glossaryRaw: unknown[] = [];
  if (Array.isArray(obj.glossary)) glossaryRaw = obj.glossary;
  else if (obj.glossary && typeof obj.glossary === 'object') {
    glossaryRaw = Object.entries(obj.glossary as Record<string, unknown>).map(([t, m]) => ({
      term: t,
      meaning: typeof m === 'string' ? m : '',
    }));
  }

  // Flashcard fallback chain (all derived from the model's own content):
  // flashcards -> key-point pairs -> glossary pairs -> section heading + first sentence.
  const glossaryPairs = (arr(obj.glossary).length ? arr(obj.glossary) : glossaryRaw)
    .map(clampGloss)
    .filter((g) => g.term && g.meaning);
  const cardsFromGlossary = glossaryPairs.map((g) => ({ front: g.term, back: g.meaning }));
  const sectionsRaw = (arr(obj.sections).length ? arr(obj.sections) : sections).map(clampSection);
  const cardsFromSections = sectionsRaw
    .filter((sec) => sec.heading && sec.text.length > 20)
    .map((sec) => ({
      front: sec.heading,
      back: sec.text.split(/(?<=[.!?])\s+/)[0]?.slice(0, 400) ?? sec.text.slice(0, 400),
    }));
  const flashcards = arr(obj.flashcards).length
    ? arr(obj.flashcards)
    : derivedCards.length
      ? derivedCards
      : cardsFromGlossary.length
        ? cardsFromGlossary
        : cardsFromSections;

  return {
    sections: sectionsRaw.slice(0, 6),
    keyPoints: (keyPoints.length ? keyPoints : rawKeyPoints)
      .map((k) => (typeof k === 'string' ? k.slice(0, 400) : String(k ?? '').slice(0, 400)))
      .slice(0, 8),
    glossary: glossaryPairs.slice(0, 8),
    flashcards: flashcards.map(clampCard).slice(0, 10),
  };
}

export const LessonOutputSchema = z.preprocess(
  clampLesson,
  z.object({
    sections: z
      .array(z.object({ heading: z.string().min(2).max(120), text: z.string().min(20).max(1200) }))
      .min(1)
      .max(6),
    keyPoints: z.array(z.string().min(5).max(400)).min(1).max(8),
    glossary: z
      .array(z.object({ term: z.string().min(1).max(60), meaning: z.string().min(3).max(300) }))
      .max(8),
    flashcards: z
      .array(z.object({ front: z.string().min(1).max(200), back: z.string().min(1).max(400) }))
      .min(1)
      .max(10),
  })
);

export type LessonMode = 'full' | 'simpler' | 'example' | 'translate';

export const lessonPrompt = {
  id: 'lesson',
  version: 1,
  system: (opts: { band: string; lang: string; mode: LessonMode }) => {
    const age =
      opts.band === 'young'
        ? 'Write for a young child: very short sentences, warm tone, no scary content, friendly everyday examples. Read-aloud friendly.'
        : opts.band === 'middle'
          ? 'Write for a middle-school student: short clear sentences, friendly examples.'
          : 'Write for a senior student: precise but plain language, exam-useful.';
    const language =
      opts.lang === 'hi'
        ? 'Write every value in simple Hindi in Devanagari script (technical terms may keep the English word in brackets).'
        : opts.lang === 'hinglish'
          ? 'Write every value in natural Hinglish in Roman script (never Devanagari).'
          : 'Write every value in simple English.';
    const perMode: Record<LessonMode, string> = {
      full: 'Produce a complete study set for the chapter.',
      simpler:
        'The learner asked for a SIMPLER explanation. Rewrite everything at an easier level: shorter sentences, everyday words, one concrete example per section.',
      example:
        'The learner asked for an EXAMPLE-led explanation. Build every section around one concrete worked example (personalise with the interest area when provided).',
      translate:
        'The learner asked for the SAME lesson in another language/script. Keep the structure and meaning identical; only the language changes.',
    };
    return [
      'You write study material for a learner about a specific chapter.',
      age,
      language,
      perMode[opts.mode],
      'Use ONLY the chapter data provided — never invent facts, formulas, dates or board rules. If unsure about something the data does not cover, say so inside the text instead of guessing.',
      'Never claim board alignment, official status or that anything is from NCERT or previous-year papers. This is Lumio AI practice material.',
      'Never reproduce copyrighted textbook passages; write original explanations in your own words.',
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
    glossary: Array<[string, string]>;
    mode: LessonMode;
    point?: string;
    interest?: string;
    band: string;
    lang: string;
  }) {
    const ask: Record<LessonMode, string> = {
      full: `Produce JSON: sections (1-6 objects with heading + text), keyPoints (up to 8), glossary (up to 8 term/meaning pairs), flashcards (up to 10 front/back pairs).`,
      simpler: `Re-explain the chapter SIMPLER. Produce JSON with the same shape as a full lesson.`,
      example:
        'Re-explain the chapter as an example-led lesson. Produce JSON with the same shape as a full lesson.',
      translate:
        'Translate the chapter lesson into the requested language/script, keeping the same structure. Produce JSON with the same shape as a full lesson.',
    };
    return [
      fenceData(
        `chapter ${input.chapterId}`,
        [
          `Title: ${input.chapterTitle}`,
          `Subject: ${input.subject}`,
          `Summary: ${input.summary}`,
          input.keyPoints.length ? `Key points:\n- ${input.keyPoints.join('\n- ')}` : '',
          input.glossary.length
            ? `Glossary:\n${input.glossary.map(([t, m]) => `- ${t}: ${m}`).join('\n')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      ),
      input.mode === 'simpler' && input.point
        ? `The learner especially wants this key point explained simply: "${input.point}".`
        : '',
      input.mode === 'example' && input.interest
        ? `Personalise examples with the learner's interest area: "${input.interest}".`
        : '',
      ask[input.mode],
    ]
      .filter(Boolean)
      .join('\n');
  },
} as const;
