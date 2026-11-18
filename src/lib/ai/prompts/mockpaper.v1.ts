// Mock-paper prompt v1 — chunk 5-AI feature 5. A timed, sectioned PRACTICE
// paper for the learner's chosen exam. Labelled everywhere: practice paper,
// not official, no previous-year questions. MCQ items pass the independent
// re-solve check; the client auto-grades in-app.
import 'server-only';
import { z } from 'zod';
import { DATA_RULE, fenceData } from '@/lib/ai/safety';

/** Normalise the raw model JSON: sections may be `sections`/`parts`, questions
 *  `questions`/`items`, field names `question`/`text`, `correct`/`answerIndex`,
 *  answers given as the option text. Derived purely from the model's content. */
function normalizeMockPaper(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const sectionsRaw: unknown[] = arr(obj.sections).length
    ? arr(obj.sections)
    : arr(obj.parts).length
      ? arr(obj.parts)
      : Array.isArray(obj.questions) || Array.isArray(obj.items)
        ? [{ name: str(obj.title, 80) || 'Section A', instructions: str(obj.instructions, 300) || 'Answer all questions.', questions: (obj.questions ?? obj.items) }]
        : [];
  const sections = sectionsRaw.slice(0, 4).map((el) => {
    const o = (el && typeof el === 'object' ? el : {}) as Record<string, unknown>;
    const qsRaw: unknown[] = arr(o.questions).length ? arr(o.questions) : arr(o.items);
    const questions = qsRaw.slice(0, 10).map((elq) => {
      const q = (elq && typeof elq === 'object' ? elq : {}) as Record<string, unknown>;
      const options = arr(q.options).map((x) => String(x).slice(0, 200));
      const norm = (v: string): string => v.toLowerCase().replace(/[^a-z0-9]/g, '');
      let answer = -1;
      const rawAns: unknown = q.answerIndex ?? q.correct_option ?? q.correctIndex ?? q.answer;
      if (typeof rawAns === 'number' && Number.isInteger(rawAns) && rawAns >= 0) {
        answer = rawAns < options.length ? rawAns : -1;
      } else if (typeof rawAns === 'string') {
        const needle = norm(rawAns);
        let idx = options.findIndex((op) => norm(op) === needle);
        // single letter A-E and bare numbers also map to an index
        if (idx < 0 && /^[a-e]$/i.test(rawAns.trim())) idx = rawAns.trim().toLowerCase().charCodeAt(0) - 97;
        if (idx < 0 && /^\d+$/.test(rawAns.trim())) {
          const n = Number.parseInt(rawAns.trim(), 10);
          if (n >= 1 && n <= options.length) idx = n - 1;
        }
        answer = idx >= 0 && idx < options.length ? idx : -1;
      }
      const marksRaw = typeof q.marks === 'number' ? q.marks : NaN;
      const text = str(q.text ?? q.question ?? q.prompt, 500);
      const optionsForAnswer = arr(q.options).map((x) => String(x));
      // No explanation field? Derive an honest one from the model's own key —
      // it states which option is correct, nothing more.
      const explanation = str(q.explanation ?? q.reason ?? q.why, 500) ||
        (answer >= 0 && optionsForAnswer[answer]
          ? `The correct answer is: ${optionsForAnswer[answer].slice(0, 200)}.`
          : '');
      // Drop unusable questions here so the schema validates survivors only;
      // the route re-checks every survivor independently anyway.
      if (text.length < 10 || answer < 0 || options.length < 3 || explanation.length < 5) return null;
      return {
        text,
        options,
        answer,
        marks: Number.isFinite(marksRaw) && marksRaw >= 1 && marksRaw <= 10 ? Math.round(marksRaw) : 2,
        chapter: str(q.chapter ?? q.chapterName ?? q.topic, 120) || 'General',
        explanation,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
    return {
      name: str(o.name ?? o.section_name ?? o.sectionName ?? o.title, 80) || 'Section',
      instructions: str(o.instructions ?? o.note, 300) || 'Answer all questions.',
      questions,
    };
  }).filter((sec) => sec.questions.length > 0);
  return { title: str(obj.title, 140) || 'Practice paper', sections };
}

export const MockPaperOutputSchema = z.preprocess(
  normalizeMockPaper,
  z.object({
  title: z.string().min(4).max(140),
  sections: z
    .array(
      z.object({
        name: z.string().min(2).max(80),
        instructions: z.string().min(5).max(300),
        questions: z
          .array(
            z.object({
              text: z.string().min(10).max(500),
              options: z.array(z.string().min(1).max(200)).min(3).max(5),
              answer: z.number().int().min(0),
              marks: z.number().int().min(1).max(10),
              chapter: z.string().min(1).max(120),
              explanation: z.string().min(5).max(500),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .min(1)
    .max(4),
  })
);

export const mockPaperPrompt = {
  id: 'mockpaper',
  version: 1,
  system: (opts: { band: string; lang: string; exam: string }) => {
    const language =
      opts.lang === 'hi'
        ? 'Write all values in simple Hindi (Devanagari).'
        : opts.lang === 'hinglish'
          ? 'Write all values in natural Hinglish (Roman script).'
          : 'Write all values in simple English.';
    return [
      'You build a practice paper for an exam-prep student.',
      'Exam style: ' + opts.exam + ' — match its question style but NEVER reproduce or imitate real previous-year questions.',
      'Every question must be solvable from the chapter topics given; exactly ONE option correct; mark per question in the marks field.',
      'Tag each question with the chapter name it tests (from the provided list) so a weakness analysis is possible.',
      'Every question needs a short "explanation" saying why the keyed option is correct.',
      'Re-check arithmetic and units; only include questions you are certain about.',
      'This is Lumio practice material — never claim board or exam-conductor alignment.',
      language,
      'Reply with ONLY a JSON object matching the schema — no markdown fences, no prose.',
      DATA_RULE,
    ].join('\n');
  },
  buildUser(input: { exam: string; subject: string; chapters: string[]; count: number; band: string; lang: string }) {
    return [
      fenceData(
        'mock paper request',
        [
          `Exam style: ${input.exam}`,
          `Subject: ${input.subject}`,
          `Chapters to cover (tag each question with one): ${input.chapters.join(', ')}`,
        ].join('\n')
      ),
      `Produce JSON: title, sections (1-3; e.g. Section A short MCQs, Section B harder MCQs) totalling exactly ${input.count} questions across the sections. Balanced spread across the chapters.`,
    ].join('\n');
  },
} as const;
