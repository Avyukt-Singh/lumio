// Reader material builders (chunk 2). Pure functions that derive lesson blocks
// from the verbatim prototype content — content.ts itself is never edited, so
// provenance stays intact. Everything here is labelled Lumio sample material.

import { GLOSSARY, type Band, type Chapter } from './content';
import { chapterId } from './domain';

/** Split a summary into sentences (read-aloud reads sentence by sentence). */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Key points: unique explanations of the chapter's questions (they state the facts). */
export function keyPointsFor(chapter: Chapter): string[] {
  const seen = new Set<string>();
  const points: string[] = [];
  for (const q of chapter.questions) {
    const p = q.explanation.trim();
    if (p && !seen.has(p)) {
      seen.add(p);
      points.push(p);
    }
  }
  return points.slice(0, 6);
}

/**
 * Glossary terms whose headword appears in the chapter text; when nothing
 * matches, fall back to the first general terms so the pane is never empty.
 */
export function glossaryFor(chapter: Chapter): Array<[string, string]> {
  const haystack = [chapter.summary, ...chapter.questions.map((q) => q.text + ' ' + q.explanation)]
    .join(' ')
    .toLowerCase();
  const hits = GLOSSARY.filter(([term]) => haystack.includes(term.toLowerCase()));
  if (hits.length > 0) return hits.slice(0, 6);
  return GLOSSARY.slice(0, 4);
}

export interface Flashcard {
  id: string; // stable: `${chapterId}#q${i}` / `${chapterId}#g${i}`
  front: string;
  back: string;
  /** front side shows the term, back the definition (vs. question side) */
  kind: 'qa' | 'term';
}

/** Flashcards built from the chapter's Q&A pairs plus its glossary terms. */
export function flashcardsFor(band: Band, chapterIndex: number, chapter: Chapter): Flashcard[] {
  const cid = chapterId(band, chapterIndex);
  const cards: Flashcard[] = [];
  chapter.questions.forEach((q, i) => {
    cards.push({
      id: `${cid}#q${i}`,
      front: q.text,
      back: q.options[q.answer],
      kind: 'qa',
    });
  });
  glossaryFor(chapter).forEach(([term, def], i) => {
    cards.push({ id: `${cid}#g${i}`, front: term, back: def, kind: 'term' });
  });
  return cards;
}

/**
 * Board-, class- and state-aware subject catalogue (7.2). Classes below 6 see a
 * smaller primary list; Classes 9+ and droppers see the full 34-subject
 * catalogue. Custom subjects are added verbatim by the learner.
 */
export function subjectsForClass(className: string, cat: 'school' | 'dropper' | 'above'): string[] {
  if (cat === 'dropper') {
    return ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Applied Mathematics'];
  }
  if (cat === 'above') return [];
  const grade = classGrade(className);
  if (grade <= 5) {
    return ['English', 'Hindi', 'Mathematics', 'EVS', 'Art', 'Music', 'Physical Education'];
  }
  if (grade <= 8) {
    return [
      'English', 'Hindi', 'Sanskrit', 'Mathematics', 'Science', 'Social Science',
      'Computer Science', 'Artificial Intelligence', 'Art', 'Physical Education',
    ];
  }
  return SUBJECT_CATALOGUE_FULL;
}

const SUBJECT_CATALOGUE_FULL = [
  'English', 'Hindi', 'Sanskrit', 'Mathematics', 'Applied Mathematics', 'Science',
  'Physics', 'Chemistry', 'Biology', 'Social Science', 'History', 'Geography',
  'Political Science', 'Economics', 'Sociology', 'Accountancy', 'Business Studies',
  'Entrepreneurship', 'Computer Science', 'Informatics Practices', 'Information Technology',
  'Artificial Intelligence', 'Psychology', 'Legal Studies', 'Physical Education',
  'Home Science', 'Fine Arts', 'Music', 'Dance', 'Engineering Graphics', 'Data Science',
  'Financial Markets', 'Web Applications', 'Marketing',
];

/** 1 = Class 1 … 12 = Class 12; 0 for pre-primary. */
export function classGrade(className: string): number {
  const m = /^Class (\d+)$/.exec(className);
  if (m) return Number(m[1]);
  return 0; // Nursery / LKG / UKG
}

/** Current Indian academic year label, e.g. "2025-26" (AY starts in April). */
export function currentAcademicYear(now: Date): string {
  // Indian academic year runs April to March. The zone is handled by the caller
  // passing a learner-local date; month here uses the local clock on purpose —
  // onboarding always runs client-side after hydration.
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Areas of interest for "Beyond Class 12" learners (3.3: topic areas + custom). */
export const INTEREST_AREAS = [
  'Coding basics', 'AI basics', 'Financial literacy', 'Entrepreneurship', 'Communication',
  'Spanish basics', 'Data analysis', 'Design', 'Writing', 'Teaching', 'Marketing',
  'Web development', 'Python', 'Mathematics for careers', 'Statistics', 'Public speaking',
  'Photography', 'Music production', 'Fitness', 'Cooking', 'Agriculture', 'Law basics',
  'Banking exams', 'Civil services',
];
