// Lumio v2 state types (chunk 2).
// The source of truth is the append-only event log in IndexedDB (Dexie, key
// "lumio-events"); localStorage "lumio-v2" holds a projected snapshot mirror
// for fast boot, export and fallback. See docs/ADR/0002 and events.ts.

import type { Band, LearnerCat } from './content';
import type { NotesAiResult, PracticeAiItem, LessonAiResult, WorksheetAiResult } from './aiClient';
import type { AcceptedPlan, SyllabusTopicPatch, TopicProgress } from './syllabus/types';

export type ThemeName = 'morning' | 'evening' | 'night';
export type ThemeOverride = 'auto' | ThemeName;
export type DensityProfile = 'young' | 'school' | 'adult';

/** One structured commitment block that the scheduler avoids (7.1 upgrade). */
export interface Commitment {
  label: string;
  /** minutes from midnight */
  startMin: number;
  /** minutes from midnight */
  endMin: number;
}

export interface SchedulePlan {
  /** school / work start, minutes from midnight */
  startMin: number;
  /** school / work end, minutes from midnight */
  endMin: number;
  /** dinner start, minutes from midnight */
  dinnerMin: number;
  /** bedtime, minutes from midnight */
  bedMin: number;
  /** number of study sessions per day */
  sessions: number;
  /** session length in minutes */
  sessionLen: number;
  /** wake time, minutes from midnight (7.1: all meals + wake time) */
  wakeMin?: number;
  /** daily commitment blocks (converted from free text, 7.1 upgrade) */
  busy?: Commitment[];
}

export interface Profile {
  name: string;
  cat: LearnerCat;
  band: Band;
  board: string;
  state?: string;
  intl?: string;
  className: string;
  goalText: string;
  exam?: string;
  examDate?: string; // yyyy-mm-dd, future only
  /** learner IANA time zone (5.6) */
  tz: string;
  lang: 'en' | 'hi' | 'hinglish';
  // ---- school (3.3) ----
  academicYear?: string;
  /** subjects picked from the board-/class-/state-aware catalogue */
  subjects?: string[];
  customSubjects?: string[];
  textbooks?: string;
  nextExam?: string;
  nextExamDate?: string;
  /** competitive-exam goal (from Class 9) */
  compExam?: string;
  compExamDate?: string;
  /** complementary subject */
  compSub?: string;
  /** guardian step confirmed (required Nursery-5, recommended 6-8, optional 9-12) */
  guardianConfirmed?: boolean;
  // ---- dropper (3.3) ----
  attempts?: string;
  syllabusCovered?: string;
  strongAreas?: string;
  weakAreas?: string;
  prevPrep?: string;
  mocksTaken?: number;
  mockScore?: number;
  mockTotal?: number;
  // ---- above Class 12 (3.3) ----
  learnerType?: string;
  interest?: string;
  level?: string;
  targetDate?: string;
  hoursPerWeek?: number;
  // ---- shared ----
  /** wake time, minutes from midnight */
  wakeMin?: number;
  /** study time outside school, minutes per day (Classes 10-12 set a 1.5x target) */
  studyOutsideMin?: number;
  /** structured commitment blocks (converted from free text, 7.1 upgrade) */
  commitments?: Commitment[];
}

export interface ChapterResult {
  best: number; // best score achieved (number of questions correct)
  att: number; // total attempts
  last: string; // yyyy-mm-dd of last attempt
}

export interface Settings {
  theme: ThemeOverride;
  /** sch boundaries [morningEnd, eveningEnd, nightEnd] as hours, configurable */
  sch: [number, number, number];
  calm: boolean;
  soundOn: boolean;
  consent: boolean; // guardian summary sharing (young/middle default on)
}

/**
 * Guided product tour state. Persisted with the normal state pipeline so a
 * reload mid-tour resumes at the saved step. `start` marks a profile that was
 * created fresh on this device AFTER the tour shipped: the tour only ever
 * auto-runs for those. Existing profiles / imports / restored snapshots never
 * carry `start: true`, so they are never interrupted by it.
 */
export interface TourState {
  done: boolean;
  /** id of the current tour step (null = not started / finished) */
  stepId: string | null;
  /** set once by a fresh first-run onboarding (or an explicit Settings replay) */
  start?: boolean;
}

export interface QuestClaimRecord {
  questId: string;
  claimedOn: string; // yyyy-mm-dd (learner-local)
  periodKey: string; // day / iso-week key (Monday start) / month key
  xp: number;
}

// ---------- chunk 4A: focus suite, mocks, streak freezes, plan overrides ----------

/** One learner-local day of focus usage (7.9): blocks completed + total minutes. */
export interface FocusDay {
  blocks: number;
  mins: number;
}

/** One self-reported mock test (honest results — never inferred). */
export interface MockResult {
  date: string; // learner-local yyyy-mm-dd, never in the future
  subject: string;
  score: number;
  total: number;
  /** chapter indexes (in the band's chapter list) the learner marked as weak */
  weakChapters: number[];
}

/**
 * Streak Saver inventory (7.10 + chunk 4C): protects the streak when a day is
 * missed. Earned through good performance (weekly XP milestone, a 90%+ quiz or
 * lab pass, a full schedule week, a 7-day streak milestone), or bought with XP
 * as a fallback. Capped to prevent hoarding.
 */
export interface FreezeState {
  owned: number;
  /** learner-local days shielded by a spent saver */
  used: Record<string, true>;
  /** highest 7-day milestone count already rewarded (prevents re-grant on replay) */
  granted: number;
  /** ISO week keys where the weekly-XP milestone already paid a saver */
  weekXp?: string[];
  /** ISO week keys where a 90%+ quiz / lab pass already paid a saver */
  weekScore?: string[];
  /** ISO week keys where a full schedule week already paid a saver */
  weekPlan?: string[];
  /** how many savers were bought with XP (display only) */
  bought?: number;
}

// ---------- chunk 4B: study tools (7.14) ----------

/** One uploaded note (.txt/.md), stored as sanitized plain text — never rendered as HTML. */
export interface LearnerNote {
  id: string;
  name: string; // original filename, extension kept
  text: string; // sanitized: control chars stripped, HTML-significant chars escaped
  added: string; // learner-local yyyy-mm-dd
}

/** One saved study-video link. Only validated YouTube ids are ever embedded. */
export interface StudyVideo {
  id: string;
  /** 11-character YouTube video id, extracted from a validated URL */
  videoId: string;
  /** the original URL the learner pasted (display only) */
  sourceUrl: string;
  added: string;
}

// ---------- chunk 3: practice engine, games and labs ----------

/** Leitner box intervals in days (master prompt 7.6: 5 boxes, 1/2/4/8/16). */
export const LEITNER_INTERVALS = [1, 2, 4, 8, 16] as const;

/** One flashcard's spaced-repetition state. box is 1..5 (Leitner). */
export interface SrsCard {
  box: number; // 1..5
  due: string; // yyyy-mm-dd (learner-local)
}

/** Kinds of practice activity, each awarding XP once per day. */
export type PracticeKind = 'srs' | 'drill' | 'adaptive' | 'revision' | 'errorlab' | 'remedial';

/** Mistake notebook tags (master prompt 7.6). */
export type MistakeTag = 'concept' | 'careless' | 'calculation' | 'fact';

/** One immutable record of an XP grant (ledger). Derived XP = sum. */
export interface XpEntry {
  id: string;
  date: string; // learner-local yyyy-mm-dd
  amount: number;
  /** 'purchase' is the ONLY negative kind (a Streak Saver bought with XP) */
  source: 'quest' | 'quiz' | 'game' | 'focus' | 'practice' | 'import' | 'mock' | 'schedule' | 'purchase' | 'aiquiz';
  ref?: string;
}

/**
 * Stable question id (fixes the prototype's weakness of keying wrong answers by
 * question text — editing a question could orphan history). Format:
 * `${band}#${chapterIndex}#${questionIndex}`.
 */
export type QuestionId = string;

export interface LumioState {
  schema: 2;
  profile: Profile | null;
  plan: SchedulePlan | null;
  settings: Settings;
  /** learner-local yyyy-mm-dd days on which an XP-earning activity completed */
  days: string[];
  /** chapterId (band + '#' + index) -> best/att/last */
  res: Record<string, ChapterResult>;
  /** total XP is derived from xpLedger (5.4: monotonic values are derived, never set) */
  xpLedger: XpEntry[];
  quests: QuestClaimRecord[];
  /** achievements unlocked, by achievement id, with the date unlocked */
  ach: Record<string, string>;
  /** best streak achieved */
  bestStreak: number;
  /** draft of an unfinished first-run wizard, keyed by step index */
  draft: Record<string, unknown> | null;
  /** review-plan review marker per day (daily quest activity) */
  planReviews: Record<string, true>;
  /** missed answers keyed by stable question id (3.7 v2 fix) */
  wrong: Record<QuestionId, 1>;
  /** themes in which at least one scored quiz (score >= 1) was completed — powers the any-light achievement */
  themes: ThemeName[];
  /** learner-local days on which a flashcard set was reviewed (daily XP lands in chunk 3) */
  flashcardDays: Record<string, true>;
  /** Leitner SRS state per flashcard id (chunk 3) */
  srs: Record<string, SrsCard>;
  /** practice activities already rewarded, keyed `${kind}#${yyyy-mm-dd}` (XP once per day) */
  practice: Record<string, true>;
  /** mistake notebook: stable question id -> chosen tag */
  mistakes: Record<QuestionId, { tag: MistakeTag }>;
  // ---- chunk 4A ----
  /** focus minutes per learner-local day (7.9) */
  focusLog: Record<string, FocusDay>;
  /** self-reported mock tests, newest last */
  mocks: MockResult[];
  /** streak-freeze inventory and spendings */
  freeze: FreezeState;
  /** interactive reschedule: date -> session index -> new startMin (minutes from midnight) */
  planOverrides: Record<string, Record<string, number>>;
  /** completed planned sessions, keyed `${date}#${index}` — powers schedule XP + the full-week saver (chunk 4C) */
  sessionDone: Record<string, true>;
  // ---- chunk 4B ----
  /** uploaded notes (sanitized plain text, 7.14) */
  notes: LearnerNote[];
  /** saved study-video links (validated YouTube only, 7.14) */
  videos: StudyVideo[];
  // ---- chunk 5B: AI practice-only saves (never any XP) ----
  /** saved AI results, keyed by event id — capped at the 30 most recent (applyEvent) */
  aiContent: Record<string, AiContentRecord>;
  /** chunk 5-AI: best score per chapter across ALL generated quiz sets
   *  (`${band}#${chapterIndex}` -> best) — regeneration never resets it (anti-farm) */
  aiQuizBest: Record<string, number>;
  // ---- chunk 6: syllabus tracker (self-reported marks — never any XP) ----
  syllabus: SyllabusState;
  /** guided product tour (optional field — older snapshots migrate in normalizeState) */
  tour: TourState;
  createdAt: string;
}

/** Learner's own syllabus checklist (chunk 6). Self-reported and honest: it
 *  never earns XP, streak days or achievements (prompt section 3). */
export interface SyllabusState {
  /** TopicId / practical-item id -> the learner's marks */
  topics: Record<string, TopicProgress>;
  /** accepted "Today's plan" per learner-local yyyy-mm-dd */
  plans: Record<string, AcceptedPlan>;
  /** subject ids the learner hid ("subjects I don't take") */
  hiddenSubjects: string[];
}

/** One saved AI result — display/practice only. Which kinds exist is decided
 *  by what the routes return; every kind carries provenance in `label`. */
export type AiContentKind = 'notes' | 'practice' | 'lesson' | 'worksheet' | 'mock';
export interface AiContentRecord {
  kind: AiContentKind;
  date: string; // learner-local yyyy-mm-dd
  payload: NotesAiResult | { items: PracticeAiItem[] } | LessonAiResult | WorksheetAiResult;
  label: string; // the server-side ai_generated_unreviewed label
}

export const STORAGE_KEY = 'lumio-v2';
export const LEGACY_KEY = 'lumio-s1';
export const DEVICE_KEY = 'lumio-device';

// ---------- event log (chunk 2, ADR 0002) ----------

/**
 * Append-only event log. The persisted state snapshot is a *projection* of these
 * events; derived values (XP, streak, best scores, achievements) are never set
 * directly (master prompt 5.4), which keeps replay safe.
 */
export type LumioEvent =
  /** one-time migration: seeds the log from an existing v2 snapshot */
  | { type: 'bootstrap'; state: LumioState }
  | { type: 'onboarding-finished'; profile: Profile; plan: SchedulePlan }
  | { type: 'settings-changed'; patch: Partial<Settings> }
  | { type: 'plan-changed'; plan: SchedulePlan }
  | {
      type: 'quiz-attempted';
      chapterId: string;
      score: number;
      nq: number;
      /** stable question ids answered wrongly this attempt */
      wrongIds: QuestionId[];
      theme: ThemeName;
      date: string; // learner-local yyyy-mm-dd
    }
  | { type: 'quest-claimed'; questId: string; periodKey: string; xp: number; date: string }
  | { type: 'plan-reviewed'; date: string }
  | { type: 'draft-saved'; draft: Record<string, unknown> | null }
  | { type: 'profile-patched'; patch: Partial<Profile> }
  | { type: 'flashcards-reviewed'; chapterId: string; date: string }
  // ---- chunk 3: games, labs and the practice engine ----
  /** XP-once per game id: the ledger ref dedupes, so a second win grants nothing.
   *  `lab` + `firstClear` add the first-clear bonus and can pay a Streak Saver (chunk 4C). */
  | { type: 'game-won'; gameId: string; xp: number; date: string; lab?: boolean; firstClear?: boolean }
  /** a planned session was completed (XP once per date#index; onTime adds a bonus) */
  | { type: 'session-done'; date: string; index: number; onTime: boolean }
  /** buy one Streak Saver with XP (capped; only when the balance covers the cost) */
  | { type: 'saver-bought'; date: string }
  /** one Leitner card review (box up on correct, reset to 1 on a miss) */
  | { type: 'card-reviewed'; cardId: string; correct: boolean; date: string }
  /** a practice activity completed (XP once per kind per day, enforced in applyEvent) */
  | { type: 'practice-done'; kind: PracticeKind; xp: number; date: string }
  /** the legendary challenge (+40 XP once ever, after two mastered chapters) */
  | { type: 'legendary-completed'; date: string }
  /** mistake notebook tagging (tag null removes the entry) */
  | { type: 'mistake-tagged'; questionId: string; tag: MistakeTag | null }
  // ---- chunk 4A: focus suite, mocks, streak freezes, reschedule ----
  /** one completed focus work block (XP 5/block, capped 4/day — enforced here) */
  | { type: 'focus-block-done'; date: string; mins: number }
  /** a self-reported mock test result (XP once per day for recording one) */
  | { type: 'mock-recorded'; mock: MockResult }
  /** spend one Streak Saver on a missed day (inventory lives in state.freeze) */
  | { type: 'freeze-used'; date: string }
  /** move one planned session to a new start time (null clears the override) */
  | { type: 'session-rescheduled'; date: string; index: number; startMin: number | null }
  // ---- chunk 4B: study tools ----
  | { type: 'note-added'; note: LearnerNote }
  | { type: 'note-removed'; noteId: string }
  | { type: 'video-added'; video: StudyVideo }
  | { type: 'video-removed'; videoId: string }
  // ---- chunk 5B: AI practice-only saves (no XP, deduped by id, capped at 30) ----
  | { type: 'ai-generated'; id: string; kind: 'notes' | 'practice'; date: string; payload: NotesAiResult | { items: PracticeAiItem[] }; label: string }
  // ---- chunk 5-AI: lesson/worksheet saves (same cap + dedupe as ai-generated)
  | { type: 'ai-content-saved'; id: string; kind: 'lesson' | 'worksheet'; date: string; payload: LessonAiResult | WorksheetAiResult; label: string }
  | { type: 'ai-content-removed'; id: string }
  // ---- chunk 5-AI: one attempt at an AI-generated quiz. XP flows through
  //  the deterministic improvement rule with a daily cap (AI_QUIZ_XP_DAILY_CAP)
  //  and a per-chapter best across ALL sets (aiQuizBest) — regenerating a quiz
  //  on the same chapter can never reset the previous best to farm XP.
  | { type: 'ai-quiz-attempted'; chapterRef: string; quizHash: string; score: number; nq: number; wrongIds: QuestionId[]; theme: ThemeName; date: string }
  // ---- chunk 6: syllabus tracker (self-reported; never XP, streak or achievements) ----
  /** one topic/practical-item mark changed. The reducer enforces: confidence
   *  cleared unless progress==='completed'; completedOn set on first
   *  completion; note sanitised + clamped to 280; flags validated, deduped,
   *  capped at 8. Unknown topic ids are stored harmlessly — the UI and
   *  planner only ever look up ids that exist in the dataset. */
  | { type: 'syllabus-topic-updated'; topicId: string; patch: SyllabusTopicPatch; date: string }
  /** bulk mark a chapter/unit (max 60 ids, enforced here) */
  | { type: 'syllabus-topics-bulk'; topicIds: string[]; patch: SyllabusTopicPatch; date: string }
  /** "Today's plan" accepted for a day (overwrite = last write wins). Plan
   *  acceptance itself gives no XP. */
  | { type: 'syllabus-plan-accepted'; date: string; plan: AcceptedPlan }
  | { type: 'syllabus-plan-cleared'; date: string }
  /** hide/show a syllabus subject ("subjects I don't take") */
  | { type: 'syllabus-subject-visibility'; subjectId: string; hidden: boolean }
  /** guided product tour progress (persisted so a reload resumes mid-tour) */
  | { type: 'tour-updated'; patch: Partial<TourState> };

/** A persisted event row in IndexedDB (meta added by the db layer). The row
 *  `id` is the auto-increment primary key (number); an `ai-generated` event
 *  carries its own string `id`, so the row-level type widens to number|string. */
export type StoredEvent = LumioEvent & {
  id?: number | string; // auto-increment (string when the event has its own id)
  deviceId: string;
  clientTime: string; // ISO instant
  tz: string;
  /** 0 = pending upload (sync queue drained in chunk 5) */
  synced: 0 | 1;
};
