// Deterministic daily plan builder (chunk 6, prompt section 5.1). Pure: same
// inputs always give the same plan — no clock, no I/O, no randomness. Time
// (today) is injected by the caller. The AI refinement (section 5.2) may
// reorder and re-label a copy of this plan; it can never invent topics.

import { subjectForSession, type SessionSlot } from '../domain';
import { findTopic, subjectTopics, topicOrderIndex, unitMarksShare } from './index';
import { deriveMark, type PlanActivity, type SyllabusPlanItem, type SyllabusSubject, type TopicId, type TopicProgress } from './types';

// ---------- tuning constants (documented in docs/ARCHITECTURE.md) ----------

/** Base priority by learner-visible state. Higher = planned earlier. */
export const PRIORITY_BASE = {
  completedNotConfident: 40, // "I finished it but I don't feel sure"
  completedLacksPractice: 35, // done, but flagged "needs more question practice"
  inProgress: 30,
  notStarted: 20,
  /** small bonus so "next in syllabus order" beats later topics */
  nextInOrderBonus: 8,
  completedUnrated: 15,
  completedConfident: 0,
} as const;

/** Flag bonuses — the learner's own words raise a topic's priority. */
export const FLAG_BONUS = {
  concept_unclear: 12,
  lacks_practice: 10,
  needs_revision: 8,
  formulas: 6,
  needs_help: 6,
  speed: 5,
  careless: 4,
} as const;

/** Marks weight cap: scaled by the unit's share of the subject's marks. */
export const MARKS_WEIGHT_MAX = 30;
/** A unit contributes HIGH_MARKS_UNIT when its share is at least this. */
export const HIGH_MARKS_SHARE = 0.15;
/** Completed-and-confident topics go stale after this many days. */
export const STALE_AFTER_DAYS = 21;
/** Staleness bonus cap (gentle spaced revision). */
export const STALE_BONUS_MAX = 15;
/** Exam-urgency window: scale the marks weight inside it. */
export const EXAM_SOON_DAYS = 30;
export const EXAM_MARKS_SCALE = 1.5;
/** Assessment multipliers — lower weight, never excluded. */
export const ASSESSMENT_MULTIPLIER = {
  summative: 1,
  formative_only: 0.4,
  /** NCERT-only chapter (CS "Emerging Trends"): out of the plan unless the
   *  learner flagged it themselves (see FLAGGED_NOT_IN_DOC_BASE). */
  not_in_syllabus_doc: 0,
} as const;
/** Flat score for a flagged topic from a not-in-syllabus-doc chapter. */
export const FLAGGED_NOT_IN_DOC_BASE = 10;

/** Estimated minutes per activity (prompt 5.1). */
export const ACTIVITY_MINUTES = {
  learn: 35,
  practise: 25,
  revise: 15,
  recall: 10,
} as const;

/** Smallest chunk worth planning into a slot. */
export const MIN_SLOT_CHUNK = 10;
/** Max items per slot keeps a plan scannable and honest. */
export const MAX_ITEMS_PER_SLOT = 4;

// ---------- scoring ----------

export interface ScoredTopic {
  topicId: TopicId;
  title: string;
  subjectId: string;
  score: number;
  activity: PlanActivity;
  minutes: number;
  reasonCodes: string[];
  order: number;
}

function daysBetween(from: string, to: string): number {
  const a = Date.UTC(...(from.split('-').map(Number) as [number, number, number]));
  const b = Date.UTC(...(to.split('-').map(Number) as [number, number, number]));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Score every candidate topic of the subject. Deterministic: identical inputs
 * produce identical scores and tie-breaks (syllabus order, then id).
 */
export function scoreTopics(
  subject: SyllabusSubject,
  progress: Record<TopicId, TopicProgress>,
  orderOf: Map<TopicId, number>,
  examDate: string | undefined,
  today: string
): ScoredTopic[] {
  // the earliest not-yet-started topic of the subject earns the order bonus
  let nextInOrder: TopicId | null = null;
  for (const t of subjectTopics(subject)) {
    if (deriveMark(progress[t.id]) === 'not_started') {
      nextInOrder = t.id;
      break;
    }
  }

  const daysToExam = examDate ? daysBetween(today, examDate) : undefined;
  const examSoon = daysToExam !== undefined && daysToExam >= 0 && daysToExam <= EXAM_SOON_DAYS;

  const out: ScoredTopic[] = [];
  for (const unit of subject.units) {
    const share = unitMarksShare(subject, unit);
    for (const chapter of unit.chapters) {
      for (const topic of chapter.topics) {
        const rec = progress[topic.id];
        const mark = deriveMark(rec);
        const reasons: string[] = [];
        let base: number;
        switch (mark) {
          case 'completed_unsure':
            base = PRIORITY_BASE.completedNotConfident;
            reasons.push('NOT_CONFIDENT');
            break;
          case 'in_progress':
            base = PRIORITY_BASE.inProgress;
            reasons.push('IN_PROGRESS');
            break;
          case 'completed_unrated':
            base = PRIORITY_BASE.completedUnrated;
            break;
          case 'completed_confident':
            base = PRIORITY_BASE.completedConfident;
            break;
          default: {
            base = PRIORITY_BASE.notStarted;
            if (topic.id === nextInOrder) {
              base += PRIORITY_BASE.nextInOrderBonus;
              reasons.push('NEXT_IN_ORDER');
            }
          }
        }
        // completed-but-flagged-lacks-practice outranks plain unsures' peers
        if (rec?.flags.includes('lacks_practice') && mark !== 'completed_confident') {
          base = Math.max(base, PRIORITY_BASE.completedLacksPractice);
        }

        let flags = 0;
        for (const f of rec?.flags ?? []) {
          const bonus = FLAG_BONUS[f];
          if (bonus) flags += bonus;
        }
        if (rec?.flags.includes('concept_unclear')) reasons.push('CONCEPT_UNCLEAR');

        let marksBonus = MARKS_WEIGHT_MAX * share;
        if (examSoon && marksBonus > 0) {
          marksBonus *= EXAM_MARKS_SCALE;
          reasons.push('EXAM_SOON');
        }
        if (share >= HIGH_MARKS_SHARE) reasons.push('HIGH_MARKS_UNIT');

        // staleness: "confident" must not mean "forgotten"
        let stale = 0;
        if (mark === 'completed_confident') {
          const last = rec?.lastReviewedOn ?? rec?.completedOn;
          if (last) {
            const since = daysBetween(last, today);
            if (since >= STALE_AFTER_DAYS) {
              stale = Math.min(STALE_BONUS_MAX, 5 + (since - STALE_AFTER_DAYS) / 3);
              reasons.push('STALE_REVISION');
            }
          }
        }

        let multiplier = ASSESSMENT_MULTIPLIER[topic.assessment];
        if (topic.assessment === 'not_in_syllabus_doc') {
          // only the learner's own flags can pull it into the plan
          if ((rec?.flags?.length ?? 0) > 0) {
            base = Math.max(base, FLAGGED_NOT_IN_DOC_BASE);
            multiplier = 1;
          }
        }
        if (topic.advanced) multiplier *= 0.2;

        const score = (base + flags + marksBonus + stale) * multiplier;

        // activity derived from the learner's own marks — never invented
        let activity: PlanActivity;
        let minutes: number;
        if ((rec?.flags ?? []).includes('lacks_practice')) {
          activity = 'practise';
          minutes = ACTIVITY_MINUTES.practise;
          if (!reasons.includes('LACKS_PRACTICE')) reasons.unshift('LACKS_PRACTICE');
        } else if (mark === 'completed_unsure' || (rec?.flags ?? []).includes('needs_revision')) {
          activity = 'revise';
          minutes = ACTIVITY_MINUTES.revise;
        } else if (mark === 'completed_confident' && stale > 0) {
          activity = 'recall';
          minutes = ACTIVITY_MINUTES.recall;
        } else {
          activity = 'learn';
          minutes = ACTIVITY_MINUTES.learn;
        }

        out.push({
          topicId: topic.id,
          title: topic.title,
          subjectId: subject.id,
          score,
          activity,
          minutes,
          reasonCodes: [...new Set(reasons)],
          order: orderOf.get(topic.id) ?? Number.MAX_SAFE_INTEGER,
        });
      }
    }
  }
  out.sort((a, b) => b.score - a.score || a.order - b.order || a.topicId.localeCompare(b.topicId));
  return out;
}

export interface SyllabusPlanInput {
  /** learner-local yyyy-mm-dd (injected) */
  today: string;
  /** 0 = today, 1 = tomorrow … (drives the subject rotation) */
  dayIndex: number;
  slots: SessionSlot[];
  /** visible syllabus subjects the learner takes (subjectPool ∩ visible) */
  subjects: readonly SyllabusSubject[];
  /** complementary subject pairing (catalogue name) */
  compSub?: string;
  progress: Record<TopicId, TopicProgress>;
  /** per-subject next exam date (yyyy-mm-dd) or undefined */
  examDates: Record<string, string | undefined>;
  /** topics already planned or marked today are skipped */
  plannedToday: ReadonlySet<TopicId>;
  dueCardsCount?: number;
}

export interface SyllabusPlan {
  date: string;
  source: 'deterministic' | 'ai';
  items: SyllabusPlanItem[];
  /** honest context notes, rendered via i18n (`DUE_CARDS` carries a count). */
  notes: string[];
}

/**
 * Build today's deterministic study plan. Explainable (every item carries
 * reason codes) and honest (empty slots produce an empty plan, not filler).
 */
export function buildSyllabusPlan(input: SyllabusPlanInput): SyllabusPlan {
  const { today, dayIndex, slots, subjects, compSub, progress, examDates, plannedToday } = input;
  if (slots.length === 0) {
    return { date: today, source: 'deterministic', items: [], notes: ['NO_SLOTS'] };
  }
  if (subjects.length === 0) {
    return { date: today, source: 'deterministic', items: [], notes: ['NO_SUBJECTS'] };
  }

  const orderOf = topicOrderIndex(subjects);
  const notes: string[] = [];
  if ((input.dueCardsCount ?? 0) > 0) notes.push(`DUE_CARDS:${input.dueCardsCount}`);

  const items: SyllabusPlanItem[] = [];
  const used = new Set<TopicId>(plannedToday);
  let fallbackIdx = 0; // round-robin when no subjects are configured on the plan

  for (let slotIndex = 0; slotIndex < slots.length; slotIndex++) {
    const slot = slots[slotIndex];
    const remaining = slot.endMin - slot.startMin;
    if (remaining < MIN_SLOT_CHUNK) continue;

    // the slot's subject comes from the existing rotation (keeps pairing)
    const slotSubjectName = subjectForSession(
      subjects.map((s) => s.catalogueName),
      compSub,
      dayIndex,
      slotIndex
    );
    const subject =
      subjects.find((s) => s.catalogueName === slotSubjectName) ??
      subjects[fallbackIdx++ % subjects.length];

    const scored = scoreTopics(subject, progress, orderOf, examDates[subject.id], today);
    const candidates = scored.filter((c) => !used.has(c.topicId) && c.score > 0);

    const placed: string[] = [];
    const titles: string[] = [];
    const codes: string[] = [];
    let minutes = 0;
    for (const c of candidates) {
      if (placed.length >= MAX_ITEMS_PER_SLOT) break;
      const chunk = Math.min(c.minutes, remaining - minutes);
      if (chunk < MIN_SLOT_CHUNK) continue;
      placed.push(c.topicId);
      titles.push(c.title);
      codes.push(...c.reasonCodes);
      minutes += chunk;
      used.add(c.topicId);
      if (minutes >= remaining) break;
    }
    if (placed.length === 0) continue;
    items.push({
      slotIndex,
      subjectId: subject.id,
      topicIds: placed,
      topicTitles: titles,
      activity: candidates[0]?.activity ?? 'learn',
      minutes,
      reasonCodes: [...new Set(codes)],
    });
  }

  if (items.length === 0) notes.push('ALL_CAUGHT_UP');
  return { date: today, source: 'deterministic', items, notes };
}

/**
 * Human activity label derived from a plan item — pure, shared by the UI so
 * the deterministic plan and the validated AI plan render identically.
 */
export function activityOfItem(item: SyllabusPlanItem): PlanActivity {
  return item.activity;
}

/** Defensive re-validation of ANY plan before it is stored or rendered. */
export function validatePlan(
  plan: SyllabusPlan,
  subjects: readonly SyllabusSubject[],
  slots: SessionSlot[],
  plannedToday: ReadonlySet<TopicId>
): string[] {
  const errors: string[] = [];
  const seen = new Set<TopicId>();
  const known = new Set<string>();
  for (const s of subjects) {
    for (const t of subjectTopics(s)) known.add(t.id);
  }
  for (const item of plan.items) {
    if (item.slotIndex < 0 || item.slotIndex >= slots.length) {
      errors.push(`slot ${item.slotIndex} out of range`);
      continue;
    }
    const slot = slots[item.slotIndex];
    if (item.minutes > slot.endMin - slot.startMin) {
      errors.push(`item in slot ${item.slotIndex} exceeds slot minutes`);
    }
    if (item.topicIds.length === 0) errors.push(`item in slot ${item.slotIndex} has no topics`);
    for (const id of item.topicIds) {
      if (!known.has(id)) errors.push(`unknown topic id ${id}`);
      if (seen.has(id)) errors.push(`duplicate topic id ${id}`);
      if (plannedToday.has(id)) errors.push(`topic ${id} already planned/touched today`);
      seen.add(id);
    }
    if (!subjects.some((s) => s.id === item.subjectId)) errors.push(`unknown subject ${item.subjectId}`);
    if (item.minutes <= 0) errors.push(`item in slot ${item.slotIndex} has non-positive minutes`);
  }
  return errors;
}
