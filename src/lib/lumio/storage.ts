// Lumio storage layer (chunk 1): typed state, schema versioning, export/import,
// and the one-time legacy importer for prototype "lumio-s1" exports (R13).

import { BANDS, type Band } from './content';
import {
  chapterId,
  chapterTally,
  dayKey,
  newlyUnlocked,
  SAVER_CAP,
  SAVER_WEEK_XP_GOAL,
  streakFrom,
  totalXp,
  weekDatesOf,
  weekKey,
} from './domain';
import { dbClearAll } from './db';
import type { Band as BandT } from './content';
import type {
  ChapterResult,
  LumioState,
  Profile,
  SchedulePlan,
  Settings,
  ThemeName,
  XpEntry,
} from './types';
import { STORAGE_KEY } from './types';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  sch: [6, 17, 19],
  calm: false,
  soundOn: false,
  consent: false,
};

export const DEFAULT_TZ = 'Asia/Kolkata';

export function defaultState(): LumioState {
  return {
    schema: 2,
    profile: null,
    plan: null,
    settings: { ...DEFAULT_SETTINGS },
    days: [],
    res: {},
    xpLedger: [],
    quests: [],
    ach: {},
    bestStreak: 0,
    draft: null,
    planReviews: {},
    wrong: {},
    themes: [],
    flashcardDays: {},
    srs: {},
    practice: {},
    mistakes: {},
    // chunk 4A
    focusLog: {},
    mocks: [],
    freeze: { owned: 0, used: {}, granted: 0 },
    planOverrides: {},
    // chunk 4C
    sessionDone: {},
    // chunk 4B
    notes: [],
    videos: [],
    // chunk 5B
    aiContent: {},
    // chunk 5-AI
    aiQuizBest: {},
    // chunk 6
    syllabus: { topics: {}, plans: {}, hiddenSubjects: [] },
    // guided tour: inert until a fresh first-run onboarding sets start: true
    tour: { done: false, stepId: null },
    createdAt: new Date().toISOString(),
  };
}

/** Fill fields added after an older snapshot was written (forward migration). */
export function normalizeState(s: LumioState): LumioState {
  return {
    ...s,
    wrong: s.wrong ?? {},
    themes: Array.isArray(s.themes) ? s.themes : [],
    flashcardDays: s.flashcardDays ?? {},
    planReviews: s.planReviews ?? {},
    quests: Array.isArray(s.quests) ? s.quests : [],
    ach: s.ach ?? {},
    // chunk 3
    srs: s.srs ?? {},
    practice: s.practice ?? {},
    mistakes: s.mistakes ?? {},
    // chunk 4A
    focusLog: s.focusLog ?? {},
    mocks: Array.isArray(s.mocks) ? s.mocks : [],
    freeze: {
      ...{
        owned: 0,
        used: {},
        granted: 0,
        weekXp: [],
        weekScore: [],
        weekPlan: [],
        bought: 0,
      },
      ...(s.freeze ?? {}),
    },
    planOverrides: s.planOverrides ?? {},
    // chunk 4C
    sessionDone: s.sessionDone ?? {},
    // chunk 4B
    notes: Array.isArray(s.notes) ? s.notes : [],
    videos: Array.isArray(s.videos) ? s.videos : [],
    // chunk 5B
    aiContent: s.aiContent ?? {},
    // chunk 5-AI (older snapshots never had the AI-quiz best tracker)
    aiQuizBest: s.aiQuizBest ?? {},
    // chunk 6 (older snapshots never had the syllabus checklist)
    syllabus: {
      topics: s.syllabus?.topics ?? {},
      plans: s.syllabus?.plans ?? {},
      hiddenSubjects: Array.isArray(s.syllabus?.hiddenSubjects) ? s.syllabus.hiddenSubjects : [],
    },
    // guided tour (older snapshots never had it — and without start: true it
    // never auto-runs for them, which is exactly right for restored profiles)
    tour:
      s.tour && typeof s.tour === 'object'
        ? { done: s.tour.done === true, stepId: typeof s.tour.stepId === 'string' ? s.tour.stepId : null, start: s.tour.start === true }
        : { done: false, stepId: null },
  };
}

// ---------- validation at the boundary (5.1) ----------

function isState(v: unknown): v is LumioState {
  if (!v || typeof v !== 'object') return false;
  const s = v as LumioState;
  return s.schema === 2 && typeof s.days === 'object' && Array.isArray(s.xpLedger);
}

/** Persist the projected snapshot mirror to localStorage (fast boot + export). */
export function saveState(state: LumioState): { ok: true } | { ok: false; error: string } {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof DOMException && e.name === 'QuotaExceededError'
          ? 'Storage is full. Export a backup and clear old data.'
          : 'Could not save on this device.',
    };
  }
}

export function loadState(): LumioState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isState(parsed)) return null;
    return normalizeState(parsed);
  } catch {
    return null;
  }
}

/** Delete everything on this device: event log (IndexedDB) + snapshot mirror. */
export async function resetAllStorage(): Promise<void> {
  await dbClearAll();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------- export / import (R13) ----------

export function exportBlob(state: LumioState): Blob {
  const payload = {
    kind: 'lumio-v2-export',
    exportedAt: new Date().toISOString(),
    state,
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

export type ImportResult =
  | { state: LumioState }
  | { state: LumioState; report: LegacyReport }
  | { error: string };

export function parseImport(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'That file is not valid JSON.' };
  }
  const obj = data as Record<string, unknown>;
  // v2 export
  if (obj && obj.kind === 'lumio-v2-export' && isState(obj.state)) {
    return { state: obj.state as LumioState };
  }
  // legacy prototype export
  const legacy = importLegacyState(typeof obj.lumio === 'object' ? obj.lumio : obj);
  if ('state' in legacy) return legacy;
  return { error: 'This file is not a Lumio export (v2 or prototype lumio-s1).' };
}

// ---------- legacy importer (R13, 5.4) ----------
// Accepts a prototype lumio-s1 object. Unknown keys are collected and reported,
// never dropped silently.

export interface LegacyReport {
  preserved: string[];
  skipped: string[];
}

interface LegacyS1 {
  name?: string;
  cat?: string;
  board?: string;
  state?: string;
  intl?: string;
  cls?: string | number;
  band?: string;
  subs?: unknown;
  lang?: string;
  year?: string;
  exam?: string;
  edate?: string;
  compSub?: string;
  weak?: unknown;
  goalTxt?: string;
  sch?: number[];
  calm?: boolean;
  xp?: number;
  days?: string[];
  res?: Record<string, { best?: number; att?: number; last?: string }>;
  used?: Record<string, number>;
  fc?: unknown;
  mocks?: unknown;
  wrong?: unknown;
  flag?: unknown;
  cleared?: unknown;
  qs?: unknown;
  mt?: unknown;
  mis?: unknown;
  papers?: unknown;
  comp?: unknown;
  consent?: boolean;
  dn?: string;
  code?: unknown;
  ships?: unknown;
  up?: unknown;
  fo?: unknown;
  rem?: unknown;
  remd?: unknown;
  plan?: Record<string, unknown>;
  [k: string]: unknown;
}

const KNOWN_LEGACY_KEYS = new Set([
  'name', 'cat', 'board', 'state', 'intl', 'cls', 'band', 'subs', 'lang', 'year', 'exam',
  'edate', 'compSub', 'weak', 'prev', 'goalTxt', 'mode', 'sch', 'calm', 'col', 'owl', 'xp',
  'days', 'themes', 'res', 'used', 'shift', 'rs', 'plan', 'fc', 'rev', 'mocks', 'wrong',
  'flag', 'cleared', 'qs', 'mt', 'mis', 'papers', 'comp', 'fo', 'code', 'ships', 'chk',
  'up', 'rem', 'remd', 'consent', 'dn', 'lbOut', 'lid',
]);

export function importLegacyState(raw: unknown): { state: LumioState; report: LegacyReport } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Not a lumio-s1 export.' };
  const L = raw as LegacyS1;
  const report: LegacyReport = { preserved: [], skipped: [] };

  const state = defaultState();

  // report unknown keys
  for (const k of Object.keys(L)) {
    if (!KNOWN_LEGACY_KEYS.has(k)) report.skipped.push(k);
  }
  report.preserved.push('days', 'res', 'xp', 'profile answers', 'plan times', 'consent');

  // band / cat
  const band = (['young', 'middle', 'sec', 'senior', 'dropper', 'above'] as const).includes(
    L.band as BandT
  )
    ? (L.band as Band)
    : null;
  const cat = L.cat === 'dropper' ? 'dropper' : L.cat === 'above' ? 'above' : 'school';

  // profile
  const profile: Profile = {
    name: typeof L.name === 'string' ? L.name : '',
    cat,
    band: band ?? (cat === 'dropper' ? 'dropper' : cat === 'above' ? 'above' : 'sec'),
    board: typeof L.board === 'string' ? L.board : 'CBSE',
    state: typeof L.state === 'string' ? L.state : undefined,
    intl: typeof L.intl === 'string' ? L.intl : undefined,
    className: typeof L.cls === 'string' || typeof L.cls === 'number' ? String(L.cls) : '',
    goalText: typeof L.goalTxt === 'string' ? L.goalTxt : '',
    exam: typeof L.exam === 'string' ? L.exam : undefined,
    examDate: typeof L.edate === 'string' ? L.edate : undefined,
    tz: DEFAULT_TZ,
    lang: 'en',
  };
  state.profile = profile;

  // plan times from legacy plan{st,len,n,bed,dn} (minutes from midnight)
  const p = L.plan ?? {};
  const num = (v: unknown, d: number) => (typeof v === 'number' && isFinite(v) ? v : d);
  state.plan = {
    startMin: num(p.st, 8 * 60),
    endMin: num(p.cur ?? p.en, 15 * 60),
    dinnerMin: num(p.dn, 20 * 60),
    bedMin: num(p.bed, 22 * 60 + 30),
    sessions: Math.max(1, Math.min(6, num(p.n, profile.band === 'young' ? 1 : 2))),
    sessionLen: Math.max(10, Math.min(120, num(p.len, profile.band === 'young' ? 15 : 30))),
  };

  // settings
  if (Array.isArray(L.sch) && L.sch.length === 3 && L.sch.every((n) => typeof n === 'number')) {
    state.settings.sch = [L.sch[0], L.sch[1], L.sch[2]];
  }
  state.settings.calm = L.calm === true;
  state.settings.consent = L.consent === true;

  // progress
  state.days = Array.isArray(L.days) ? L.days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  state.xpLedger = [];
  if (typeof L.xp === 'number' && L.xp > 0) {
    // Legacy XP had no per-day breakdown; it is imported as one snapshot entry
    // on the earliest known day, source "import". It counts toward total XP but
    // not toward activity quests (quest progress excludes source "import").
    const anchor = state.days[0] ?? dayKey(new Date(), DEFAULT_TZ);
    state.xpLedger.push({ id: 'import-root', date: anchor, amount: L.xp, source: 'import' });
  }
  if (L.res && typeof L.res === 'object') {
    const res: Record<string, ChapterResult> = {};
    for (const [k, v] of Object.entries(L.res)) {
      if (v && typeof v === 'object' && typeof (v as { best?: unknown }).best === 'number') {
        res[k] = {
          best: (v as { best: number }).best,
          att: typeof (v as { att?: number }).att === 'number' ? (v as { att: number }).att : 1,
          last: typeof (v as { last?: string }).last === 'string' ? (v as { last: string }).last : '',
        };
      }
    }
    state.res = res;
  }

  // streak + achievements recomputation happens in the caller via projections.
  return { state, report };
}

/** Full projection: recomputes derived values (XP total, streak, achievements) from state.
 * Normalises first, so snapshots written by older builds (missing wrong/themes/flashcardDays)
 * never break the fold — the bootstrap migration replays them unchanged. */
export function projectState(state: LumioState, now: Date, tz: string): LumioState {
  const s = normalizeState(state);
  const today = dayKey(now, tz);
  const streak = streakFrom(s.days, today, s.freeze.used);
  const snapshot = {
    daysCount: s.days.length,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    questsClaimed: s.quests.length,
    weeklyQuests: s.quests.filter((c) => c.questId === 'weekly-3-days').length,
    monthlyQuests: s.quests.filter((c) => c.questId === 'monthly-100xp').length,
    themesCount: s.themes.length,
    focusBlocks: Object.values(s.focusLog).reduce((sum, d) => sum + d.blocks, 0),
    ...chapterSnapshot(s),
  };
  const unlocked = newlyUnlocked(snapshot, s.ach);
  const ach = { ...s.ach };
  for (const id of unlocked) {
    if (!ach[id]) ach[id] = today;
  }
  // streak freezes: +1 earned per reached 7-day milestone (never re-granted on replay)
  const milestones = Math.floor(streak / 7);
  let freeze =
    milestones > s.freeze.granted
      ? {
          ...s.freeze,
          owned: s.freeze.owned + (milestones - s.freeze.granted),
          granted: milestones,
        }
      : s.freeze;

  // Streak Saver earn rules (chunk 4C) — evaluated on every projection so the
  // dashboard stays honest after any change. Each rule pays at most once per
  // ISO week, and only while the inventory is below the cap.
  const wk = weekKey(now, tz);
  const weekDates = new Set(weekDatesOf(today));

  // (1) weekly XP milestone: activity XP this week >= 150 (quests/imports/purchases excluded)
  const weekActivityXp = s.xpLedger
    .filter((e) => weekDates.has(e.date) && e.source !== 'quest' && e.source !== 'import' && e.source !== 'purchase')
    .reduce((sum, e) => sum + e.amount, 0);
  if (weekActivityXp >= SAVER_WEEK_XP_GOAL && !(freeze.weekXp ?? []).includes(wk) && freeze.owned < SAVER_CAP) {
    freeze = { ...freeze, owned: freeze.owned + 1, weekXp: [...(freeze.weekXp ?? []), wk] };
  }

  // (2) full schedule week: every planned session of the week completed
  if (s.plan) {
    const expected = s.plan.sessions * 7;
    const done = Object.keys(s.sessionDone).filter((k) => weekDates.has(k.split('#')[0])).length;
    if (done >= expected && !(freeze.weekPlan ?? []).includes(wk) && freeze.owned < SAVER_CAP) {
      freeze = { ...freeze, owned: freeze.owned + 1, weekPlan: [...(freeze.weekPlan ?? []), wk] };
    }
  }

  return { ...s, bestStreak: Math.max(s.bestStreak, streak), ach, freeze };
}

function chapterSnapshot(state: LumioState) {
  if (!state.profile) return { masteredChapters: 0, completedPath: false, anyQuiz: false, fullScore: false };
  const band = state.profile.band;
  const tally = chapterTally(band, state.res);
  const total = BANDS[band].chapters.length;
  const anyQuiz = Object.keys(state.res).some((k) => k.startsWith(band));
  const fullScore = Object.entries(state.res).some(([k, v]) => {
    if (!k.startsWith(band)) return false;
    const idx = Number(k.split('#')[1]);
    const nq = BANDS[band].chapters[idx]?.questions.length ?? 0;
    return nq > 0 && v.best === nq;
  });
  return {
    masteredChapters: tally.mastered,
    completedPath: tally.completed >= total && total > 0,
    anyQuiz,
    fullScore,
  };
}

export { chapterId };
