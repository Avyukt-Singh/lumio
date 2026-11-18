// Syllabus progress derivation (chunk 6). Pure: takes stored TopicProgress
// records and derives everything the UI shows. No I/O, DOM or clock.

import { deriveMark, type SyllabusSubject, type SyllabusTopic, type TopicId, type TopicProgress, type TopicMark } from './types';
import { subjectChapters, subjectTrackables, unitMarksShare } from './index';

export type { TopicMark };

/** A topic with its derived mark and stored record. */
export interface MarkedTopic {
  topic: SyllabusTopic;
  mark: TopicMark;
  record?: TopicProgress;
  /** true when the topic carries any flag (part of "needs attention"). */
  flagged: boolean;
}

export interface UnitProgress {
  unitId: string;
  counts: MarkCounts;
  /** grouped units share marks; this is the effective share (0..1). */
  marksShare: number;
}

export interface MarkCounts {
  notStarted: number;
  inProgress: number;
  completedUnrated: number;
  completedConfident: number;
  completedUnsure: number;
  total: number;
  /** completed-but-not-confident + any flagged topic (counts once). */
  needsAttention: number;
}

export function emptyCounts(): MarkCounts {
  return {
    notStarted: 0,
    inProgress: 0,
    completedUnrated: 0,
    completedConfident: 0,
    completedUnsure: 0,
    total: 0,
    needsAttention: 0,
  };
}

export function countMarks(topics: MarkedTopic[]): MarkCounts {
  const c = emptyCounts();
  for (const t of topics) {
    c.total++;
    if (t.mark === 'not_started') c.notStarted++;
    else if (t.mark === 'in_progress') c.inProgress++;
    else if (t.mark === 'completed_unrated') c.completedUnrated++;
    else if (t.mark === 'completed_confident') c.completedConfident++;
    else if (t.mark === 'completed_unsure') c.completedUnsure++;
    if (t.mark === 'completed_unsure' || t.flagged) c.needsAttention++;
  }
  return c;
}

/**
 * Build the marked view of one subject. `includeFormative` keeps
 * formative-only and not-in-syllabus-doc topics in the counts (default on —
 * the learner can turn it off in the UI; the topics themselves never hide).
 */
export function markSubject(
  subject: SyllabusSubject,
  topics: Record<TopicId, TopicProgress>,
  includeFormative: boolean,
  practical: boolean
): MarkedTopic[] {
  const all = practical ? subjectTrackables(subject) : subjectTopicsOf(subject);
  return all
    .filter((t) => includeFormative || t.assessment === 'summative')
    .map((topic) => {
      const record = topics[topic.id];
      return {
        topic,
        mark: deriveMark(record),
        record,
        flagged: (record?.flags?.length ?? 0) > 0,
      };
    });
}

function subjectTopicsOf(subject: SyllabusSubject): SyllabusTopic[] {
  return subjectChapters(subject).flatMap((c) => c.topics);
}

export function markUnit(
  subject: SyllabusSubject,
  unitId: string,
  topics: Record<TopicId, TopicProgress>,
  includeFormative: boolean
): MarkedTopic[] {
  const unit = subject.units.find((u) => u.id === unitId);
  if (!unit) return [];
  const out: MarkedTopic[] = [];
  for (const chapter of unit.chapters) {
    for (const topic of chapter.topics) {
      if (!includeFormative && topic.assessment !== 'summative') continue;
      const record = topics[topic.id];
      out.push({
        topic,
        mark: deriveMark(record),
        record,
        flagged: (record?.flags?.length ?? 0) > 0,
      });
    }
  }
  return out;
}

export function unitProgress(subject: SyllabusSubject, unitId: string, includeFormative: boolean): UnitProgress {
  const unit = subject.units.find((u) => u.id === unitId);
  return {
    unitId,
    counts: emptyCounts(),
    marksShare: unit ? unitMarksShare(subject, unit) : 0,
  };
}

/** Overall completion across the visible subjects (0..1, formative filterable). */
export function overallProgress(
  subjects: readonly SyllabusSubject[],
  topics: Record<TopicId, TopicProgress>,
  includeFormative: boolean
): { counts: MarkCounts; fraction: number } {
  let marked: MarkedTopic[] = [];
  for (const s of subjects) {
    marked = marked.concat(markSubject(s, topics, includeFormative, false));
  }
  const counts = countMarks(marked);
  const done = counts.completedUnrated + counts.completedConfident + counts.completedUnsure;
  return { counts, fraction: counts.total > 0 ? done / counts.total : 0 };
}

/** Topics of one subject that still need attention (planner candidates too). */
export function needsAttentionIds(
  subject: SyllabusSubject,
  topics: Record<TopicId, TopicProgress>,
  includeFormative: boolean
): TopicId[] {
  return markSubject(subject, topics, includeFormative, false)
    .filter((m) => m.mark === 'completed_unsure' || m.flagged)
    .map((m) => m.topic.id);
}
