// Syllabus service (chunk 6): the only entry point the UI and planner use to
// reach syllabus data. Pure — no I/O, DOM or clock. Adding Class 12 or another
// board later means adding a data file and a branch here, not new code.

import { classGrade } from '../chapterContent';
import { CLASS11_SUBJECTS } from './class11';
import type { SyllabusSubject, SyllabusUnit, SyllabusChapter, SyllabusTopic, TopicId } from './types';

/** The boards/classes that currently have a syllabus dataset (honest gate). */
export function syllabusFor(grade: number, board: string): readonly SyllabusSubject[] | null {
  if (grade !== 11) return null;
  if (board.trim().toLowerCase() !== 'cbse') return null;
  return CLASS11_SUBJECTS;
}

/** Convenience wrapper matching the app's profile shape. */
export function syllabusForProfile(
  className: string | undefined,
  board: string | undefined
): readonly SyllabusSubject[] | null {
  if (!className || !board) return null;
  return syllabusFor(classGrade(className), board);
}

export function syllabusSubjectById(
  subjects: readonly SyllabusSubject[],
  id: string
): SyllabusSubject | null {
  return subjects.find((s) => s.id === id) ?? null;
}

/** All theory chapters of a subject in syllabus order. */
export function subjectChapters(subject: SyllabusSubject): SyllabusChapter[] {
  return subject.units.flatMap((u) => u.chapters);
}

/** All topics of a subject (theory) in syllabus order. */
export function subjectTopics(subject: SyllabusSubject): SyllabusTopic[] {
  return subjectChapters(subject).flatMap((c) => c.topics);
}

/** Topics plus practical items — practical items are trackable like topics. */
export function subjectTrackables(subject: SyllabusSubject): SyllabusTopic[] {
  return [...subjectTopics(subject), ...(subject.practical?.items ?? [])];
}

/** The syllabus-order index of every topic id (deterministic tie-breaks). */
export function topicOrderIndex(subjects: readonly SyllabusSubject[]): Map<TopicId, number> {
  const map = new Map<TopicId, number>();
  let i = 0;
  for (const s of subjects) {
    for (const t of subjectTrackables(s)) {
      map.set(t.id, i++);
    }
  }
  return map;
}

export function findTopic(
  subjects: readonly SyllabusSubject[],
  topicId: TopicId
): { topic: SyllabusTopic; subject: SyllabusSubject; chapter: SyllabusChapter; unit: SyllabusUnit } | null {
  for (const s of subjects) {
    for (const u of s.units) {
      for (const c of u.chapters) {
        const t = c.topics.find((x) => x.id === topicId);
        if (t) return { topic: t, subject: s, chapter: c, unit: u };
      }
    }
    const p = s.practical?.items.find((x) => x.id === topicId);
    if (p) {
      // practical items sit outside units; synthesise a container
      const pseudoUnit: SyllabusUnit = { id: `${s.id}.practical`, title: s.name, marks: null, chapters: [] };
      const pseudoChapter: SyllabusChapter = { id: `${s.id}.practical`, title: s.name, topics: s.practical?.items ?? [] };
      return { topic: p, subject: s, chapter: pseudoChapter, unit: pseudoUnit };
    }
  }
  return null;
}

/**
 * Marks weight of a unit, as a share of the subject's theory marks (0..1).
 * Grouped units (physics, marks null with marksGroup) split their group's
 * marks evenly, so the planner still knows they matter.
 */
export function unitMarksShare(subject: SyllabusSubject, unit: SyllabusUnit): number {
  if (subject.theoryMarks <= 0) return 0;
  if (unit.marks != null) return unit.marks / subject.theoryMarks;
  if (!unit.marksGroup) return 0;
  const group = subject.units.filter((u) => u.marksGroup === unit.marksGroup);
  const carrier = group.find((u) => u.marks != null);
  if (!carrier || carrier.marks == null) return 0;
  return carrier.marks / subject.theoryMarks / Math.max(1, group.length);
}
