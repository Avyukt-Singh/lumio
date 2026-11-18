// Syllabus tracker data model (chunk 6). Pure types only — no I/O, DOM or
// clock (purity rule). The dataset lives in class11.ts and is served by
// syllabusFor() in index.ts; adding another class or board later means
// adding data, not code.

export type SyllabusSubjectId = 'maths' | 'physics' | 'chemistry' | 'cs' | 'ai';
export type TopicId = string;

/**
 * How the CBSE document assesses a topic:
 * - `summative`            — counted in the theory paper.
 * - `formative_only`       — "assessed only formatively, not in summative
 *                            assessments" (CBSE wording). Never hidden, the
 *                            planner just weights it lower.
 * - `not_in_syllabus_doc`  — the chapter exists in the NCERT book but the
 *                            supplied syllabus does not list it (CS Ch 3).
 */
export type TopicAssessment = 'summative' | 'formative_only' | 'not_in_syllabus_doc';

export interface SyllabusTopic {
  /** STABLE, human-readable: `phy.c07.t03`. Never renumbered — stored
   *  progress keys on it. If wording changes, keep the id. */
  id: TopicId;
  title: string;
  assessment: TopicAssessment;
  /** AI 843 "Advanced Learners": taught but not evaluated. */
  advanced?: boolean;
}

export interface SyllabusChapter {
  /** `${subjectId}.c01` … or `${subjectId}.cf01` for CBSE-only formative
   *  chapters that the rationalised NCERT book dropped. */
  id: string;
  /** NCERT chapter title (A.0 chapter spine). */
  title: string;
  /** Chapter number in the NCERT book; absent for CBSE-only items. */
  ncertNo?: number;
  /** NCERT volume where the book ships in two parts (Physics, Chemistry). */
  ncertPart?: 1 | 2;
  periods?: number;
  /** Short honest note shown under the chapter title. */
  note?: string;
  topics: SyllabusTopic[];
}

export interface SyllabusUnit {
  id: string; // `phy.u01`
  title: string;
  /** CBSE unit marks; `null` for grouped units (physics) or informational
   *  groups (CS "not in syllabus list", chemistry formative group). */
  marks: number | null;
  /** Physics groups share their marks across units: the label names the
   *  group ("Units I to III") and the marks sit on the FIRST unit of the
   *  group. The UI shows "23 marks (Units I to III)". */
  marksGroup?: string;
  /** CBSE teaching periods for the unit (physics). */
  periods?: number;
  chapters: SyllabusChapter[];
}

export interface SyllabusPracticalScheme {
  label: string;
  marks: number;
}

export interface SyllabusSubject {
  id: SyllabusSubjectId;
  name: string; // display name
  /** CBSE subject code: '041' | '042' | '043' | '083' | '843'. */
  code: string;
  /** Must match an entry of SUBJECT_CATALOGUE so the planner can pair the
   *  syllabus with the learner's chosen subjects and the day's slots. */
  catalogueName: string;
  theoryMarks: number;
  units: SyllabusUnit[];
  /** Trackable practical/IA items (chem, cs, ai, maths IA). Physics has none
   *  yet — its practical list was not captured (honest limit). */
  practical?: { items: SyllabusTopic[]; scheme: SyllabusPracticalScheme[] };
  /** Shown in the Practical tab when the list is genuinely missing. */
  practicalNote?: string;
  /** Provenance (R1): named document only — never an invented URL. */
  source: { label: string; note: string };
}

// ---------- learner marks (chunk 6) ----------

export type SyllabusProgress = 'not_started' | 'in_progress' | 'completed';
export type SyllabusConfidence = 'confident' | 'unsure' | null;

/** Self-reported flags, plain-language, max 8 per topic, deduped. */
export type SyllabusFlag =
  | 'lacks_practice' // "Needs more question practice"
  | 'concept_unclear' // "Concept not clear yet"
  | 'formulas' // "Formulas not memorised"
  | 'careless' // "Careless mistakes"
  | 'speed' // "Too slow in problems"
  | 'needs_revision' // "Needs revision"
  | 'needs_help' // "Need to ask a teacher"
  | 'practical_pending'; // "Practical not done"

export const SYLLABUS_FLAGS: readonly SyllabusFlag[] = [
  'lacks_practice',
  'concept_unclear',
  'formulas',
  'careless',
  'speed',
  'needs_revision',
  'needs_help',
  'practical_pending',
] as const;

export const MAX_TOPIC_FLAGS = 8;
export const MAX_TOPIC_NOTE = 280;

/** The part of a topic update that comes from the UI (all optional). */
export interface SyllabusTopicPatch {
  progress?: SyllabusProgress;
  confidence?: SyllabusConfidence;
  flags?: SyllabusFlag[];
  note?: string;
}

/**
 * Sanitise a syllabus note at the event boundary: control characters
 * stripped, whitespace trimmed, clamped to 280 chars. Unlike the uploaded-file
 * sanitiser, HTML-significant characters are NOT escaped — syllabus notes are
 * only ever rendered as React text children (never dangerouslySetInnerHTML),
 * so escaping would corrupt the learner's text on screen. Documented in
 * docs/ASSUMPTIONS.md.
 */
export function sanitizeSyllabusNote(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, MAX_TOPIC_NOTE)
    .trim();
}

/** Validate + dedupe flags (bounded union, max 8). */
export function sanitizeFlags(flags: readonly string[]): SyllabusFlag[] {
  const out: SyllabusFlag[] = [];
  for (const f of flags) {
    if (SYLLABUS_FLAGS.includes(f as SyllabusFlag) && !out.includes(f as SyllabusFlag)) {
      out.push(f as SyllabusFlag);
      if (out.length >= MAX_TOPIC_FLAGS) break;
    }
  }
  return out;
}

/** One topic's learner marks. Lives in state.syllabus.topics keyed by TopicId. */
export interface TopicProgress {
  progress: SyllabusProgress;
  /** Only meaningful when progress === 'completed'. */
  confidence: SyllabusConfidence;
  flags: SyllabusFlag[];
  /** Sanitised plain text, max 280 chars. */
  note: string;
  /** learner-local yyyy-mm-dd of the last change (injected, never the clock). */
  updatedOn: string;
  /** set when progress first becomes 'completed' */
  completedOn?: string;
  /** set whenever the learner marks it confident again */
  lastReviewedOn?: string;
}

export function emptyTopicProgress(date: string): TopicProgress {
  return { progress: 'not_started', confidence: null, flags: [], note: '', updatedOn: date };
}

// ---------- today's plan (chunk 6) ----------

export type PlanActivity = 'learn' | 'practise' | 'revise' | 'recall';

export interface SyllabusPlanItem {
  /** index into today's SessionSlot[] */
  slotIndex: number;
  subjectId: SyllabusSubjectId;
  topicIds: TopicId[];
  topicTitles: string[];
  activity: PlanActivity;
  minutes: number;
  /** deterministic, machine-readable codes rendered via i18n templates. */
  reasonCodes: string[];
  /** AI refinement only: the short encouraging reason (max 160 chars),
   *  length-capped and never rendered as HTML. Deterministic items use
   *  reasonCodes instead. */
  reason?: string;
}

/**
 * The accepted plan for one learner-local day. `source` keeps the honest
 * label: 'ai' plans are always AI-generated-and-validated, never silent.
 */
export interface AcceptedPlan {
  date: string;
  source: 'deterministic' | 'ai';
  items: SyllabusPlanItem[];
  /** one-sentence day summary (AI refinement only, length-capped). */
  summary?: string;
}

// ---------- the five learner-visible marks ----------

/**
 * The marks the learner sees (derive, never store):
 * 1. not_started            -> "Not started"
 * 2. in_progress            -> "In progress"
 * 3. completed_unrated      -> "Completed"
 * 4. completed_confident    -> "Completed and confident"
 * 5. completed_unsure       -> "Completed but not confident"
 */
export type TopicMark =
  | 'not_started'
  | 'in_progress'
  | 'completed_unrated'
  | 'completed_confident'
  | 'completed_unsure';

export function deriveMark(p: TopicProgress | undefined): TopicMark {
  if (!p) return 'not_started';
  if (p.progress === 'not_started') return 'not_started';
  if (p.progress === 'in_progress') return 'in_progress';
  if (p.confidence === 'confident') return 'completed_confident';
  if (p.confidence === 'unsure') return 'completed_unsure';
  return 'completed_unrated';
}
