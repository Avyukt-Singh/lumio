// Lumio domain logic (chunk 1). Pure functions only: no I/O, no DOM, no clock access.
// Time is always injected (see 5.3 in the master prompt: packages/domain has no clock access).

import { BANDS, type Band } from './content';
import type {
  ChapterResult,
  LumioState,
  SchedulePlan,
  ThemeName,
  XpEntry,
} from './types';

// ---------- dates (one date utility with explicit zone awareness) ----------
// The prototype used a locale trick to produce yyyy-mm-dd. We use Intl with an
// explicit time zone. All learner-local day keys are produced by this function.

export function dayKey(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d); // en-CA gives yyyy-mm-dd
}

export function hourOf(d: Date, tz: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(d)
  );
}

export function weekdayOf(d: Date, tz: string): number {
  // 0 = Sunday ... 6 = Saturday, computed from the learner-local date
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

/** Monday-start ISO week key like 2025-W45 (5.6: weeks start on Monday). */
export function weekKey(d: Date, tz: string): string {
  const dateStr = dayKey(d, tz);
  const dt = new Date(dateStr + 'T12:00:00Z');
  const day = (dt.getUTCDay() + 6) % 7; // Mon=0
  dt.setUTCDate(dt.getUTCDate() - day + 3); // shift to Thursday of this ISO week
  const isoYear = dt.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const firstThu = new Date(jan4);
  firstThu.setUTCDate(jan4.getUTCDate() - jan4Day + 3);
  const weekNum = 1 + Math.round((dt.getTime() - firstThu.getTime()) / (7 * 86400000));
  return `${isoYear}-W${String(Math.max(1, weekNum)).padStart(2, '0')}`;
}

export function monthKey(d: Date, tz: string): string {
  return dayKey(d, tz).slice(0, 7); // yyyy-mm
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---------- theme engine (3.2, 6.1) ----------

export function themeAt(hour: number, sch: [number, number, number]): ThemeName {
  // sch = [morningStart, eveningStart, nightStart] (defaults 06 / 17 / 19).
  // Night wraps past midnight: 19:00 -> 05:59 (prototype 3.2).
  const [morningStart, eveningStart, nightStart] = sch;
  if (hour >= nightStart || hour < morningStart) return 'night';
  if (hour >= eveningStart) return 'evening';
  return 'morning';
}

// ---------- XP ledger ----------

/**
 * Total XP = raw sum of the ledger. All grant entries are positive; the ONLY
 * negative kind is 'purchase' (a Streak Saver bought with XP, chunk 4C).
 * Summing raw keeps purchases honest — clamping would make them free.
 */
export function totalXp(ledger: XpEntry[]): number {
  return ledger.reduce((s, e) => s + e.amount, 0);
}

export function xpOn(ledger: XpEntry[], date: string): number {
  return ledger.filter((e) => e.date === date).reduce((s, e) => s + e.amount, 0);
}

/**
 * XP earned this week (Monday-start, learner-local dates), excluding quest and
 * import entries — the milestone tracks *learning activity*, not claims.
 */
export function xpThisWeek(ledger: XpEntry[], today: string): number {
  const days = new Set(weekDatesOf(today));
  return ledger
    .filter((e) => days.has(e.date) && e.source !== 'quest' && e.source !== 'import' && e.source !== 'purchase')
    .reduce((s, e) => s + e.amount, 0);
}

/** XP per day (date -> raw sum), for heatmaps and the activity feed. */
export function xpPerDay(ledger: XpEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of ledger) m.set(e.date, (m.get(e.date) ?? 0) + e.amount);
  return m;
}

/**
 * Heatmap columns for the last `weeks` Monday-start weeks ending with the week
 * that contains `today`. Future dates (after today) are flagged so the UI can
 * dim them. Pure: no clock access, everything derives from the ledger + today.
 */
export interface HeatCell {
  date: string;
  xp: number;
  active: boolean;
  future: boolean;
}

export function heatmapWeeks(ledger: XpEntry[], today: string, weeks: number): HeatCell[][] {
  const perDay = xpPerDay(ledger);
  const thisWeek = weekDatesOf(today);
  const cols: HeatCell[][] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDays(thisWeek[0], -7 * w);
    cols.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        const xp = perDay.get(date) ?? 0;
        return { date, xp, active: xp > 0, future: date > today };
      })
    );
  }
  return cols;
}

/**
 * XP for a quiz attempt (chunk 4C rules, replaces the older improvement-only
 * formula). Anti-farm: a retake with no improvement over the best score earns
 * nothing, so re-running the same quiz can never repeat XP.
 *
 * - base 15 XP for completing a quiz (first attempt with score >= 1, or any
 *   attempt that beats the previous best)
 * - +10 XP improvement per question gained over the previous best
 * - +10 XP bonus for scoring 80%+, +25 XP (instead) for a perfect 100%
 */
export interface QuizXpBreakdown {
  qualifies: boolean;
  base: number;
  improvement: number;
  bonus80: number;
  bonus100: number;
  total: number;
}

export function quizXpBreakdown(
  prevBest: number,
  score: number,
  nq: number,
  firstAttempt: boolean
): QuizXpBreakdown {
  const qualifies = firstAttempt ? score >= 1 : score > prevBest;
  const base = qualifies ? QUIZ_BASE_XP : 0;
  const improvement = qualifies ? Math.max(0, score - prevBest) * 10 : 0;
  const pct = nq > 0 ? score / nq : 0;
  const bonus80 = qualifies && pct >= 0.8 && pct < 1 ? QUIZ_BONUS_80 : 0;
  const bonus100 = qualifies && pct >= 1 ? QUIZ_BONUS_100 : 0;
  return {
    qualifies,
    base,
    improvement,
    bonus80,
    bonus100,
    total: base + improvement + bonus80 + bonus100,
  };
}

// ---------- chunk 4C: XP rules, levels, daily goal and Streak Savers ----------

/** Daily XP goal — meeting it is the recommended "streak-active" target. */
export const DAILY_XP_GOAL = 50;
/** Quiz XP rules (chunk 4C): base completion XP + score bonuses. */
export const QUIZ_BASE_XP = 15;
export const QUIZ_BONUS_80 = 10;
export const QUIZ_BONUS_100 = 25;
/** Extra XP when a lab is cleared for the very first time (its one-time win). */
export const LAB_FIRST_CLEAR_BONUS = 10;
/** XP for completing a planned schedule session, + bonus when done on time. */
export const SCHEDULE_XP = 10;
export const SCHEDULE_ONTIME_BONUS = 5;
/**
 * Chunk 5-AI: hard daily cap on XP earned from AI-generated quizzes (all sets
 * combined). AI quizzes follow the deterministic improvement rule, but this
 * cap bounds the regeneration farm vector. 40 XP = 4 perfect improvements.
 */
export const AI_QUIZ_XP_DAILY_CAP = 40;
/** Streak Saver inventory cap — good performance can't be hoarded. */
export const SAVER_CAP = 3;
/** Fallback: buy one Streak Saver with XP. */
export const SAVER_XP_COST = 100;
/** Weekly XP milestone that earns a Streak Saver (once per ISO week). */
export const SAVER_WEEK_XP_GOAL = 150;

/** Game ids that are labs (pass = a 100% score → can earn a Streak Saver). */
export const LAB_GAME_IDS = new Set([
  'pend', 'chem', 'bio', 'math', 'circ', 'proj', 'eng', 'ship', 'ai', 'aif', 'code', 'web',
]);

/** Level titles, indexed by tier (level 1-2 Spark, 3-4 Bright, ... 11+ Luminary). */
const LEVEL_TITLES = [
  'Spark', 'Spark', 'Bright', 'Bright', 'Radiant', 'Radiant',
  'Brilliant', 'Brilliant', 'Stellar', 'Stellar', 'Luminary',
] as const;

export interface LevelInfo {
  level: number;
  title: string;
  /** XP earned inside the current level */
  into: number;
  /** XP needed to reach the next level from the current one */
  need: number;
  /** 0..1 progress through the current level */
  pct: number;
}

/**
 * Level curve: level 1 starts at 0 XP; reaching level n+1 costs
 * 100 + 50 * (n - 1) XP (so 100, 150, 200, ... — gently steepening).
 */
export function levelInfo(total: number): LevelInfo {
  let level = 1;
  let need = 100;
  let into = Math.max(0, total);
  while (into >= need) {
    into -= need;
    level += 1;
    need = 100 + 50 * (level - 1);
  }
  return {
    level,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    into,
    need,
    pct: need > 0 ? Math.min(1, into / need) : 1,
  };
}

/** ISO week key (Monday start) for a learner-local yyyy-mm-dd date string. */
export function weekKeyOfDate(dateStr: string): string {
  return weekKey(new Date(dateStr + 'T12:00:00Z'), 'UTC');
}

// ---------- streaks (3.6) ----------

/**
 * Streak = consecutive learner-local days with an XP-earning activity, counting back
 * from today, or from yesterday if today is not yet done. Opening the app never counts.
 * A spent streak freeze (`freezeUsed[date]`) shields one missed day, keeping the chain
 * alive (chunk 4A, 7.10).
 */
export function streakFrom(
  days: string[],
  today: string,
  freezeUsed?: Record<string, true>
): number {
  const set = new Set(days);
  const shield = freezeUsed ?? {};
  const active = (d: string) => set.has(d) || shield[d] === true;
  let cursor = active(today) ? today : addDays(today, -1);
  let n = 0;
  while (active(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function streakMilestone(streak: number): number | null {
  for (const m of [100, 60, 30, 14, 7, 3]) {
    if (streak >= m) return m;
  }
  return null;
}

// ---------- mastery (3.6) ----------

export type ChapterState = 'locked' | 'available' | 'completed' | 'mastered';

export function chapterId(band: Band, index: number): string {
  return `${band}#${index}`;
}

export function bestScore(res: Record<string, ChapterResult>, id: string): number {
  return res[id]?.best ?? 0;
}

/** A chapter unlocks when the previous one is completed (best >= 1). */
export function chapterState(
  band: Band,
  index: number,
  res: Record<string, ChapterResult>
): ChapterState {
  const nq = BANDS[band].chapters[index]?.questions.length ?? 0;
  const best = bestScore(res, chapterId(band, index));
  if (best >= nq && nq > 0) return 'mastered';
  if (best >= 1) return 'completed';
  if (index === 0) return 'available';
  return bestScore(res, chapterId(band, index - 1)) >= 1 ? 'available' : 'locked';
}

/** Number of chapters completed (best >= 1) and mastered (best == nq). */
export function chapterTally(band: Band, res: Record<string, ChapterResult>) {
  const n = BANDS[band].chapters.length;
  let completed = 0;
  let mastered = 0;
  for (let i = 0; i < n; i++) {
    const st = chapterState(band, i, res);
    if (st === 'completed' || st === 'mastered') completed += 1;
    if (st === 'mastered') mastered += 1;
  }
  return { completed, mastered, total: n };
}

// ---------- scheduler (3.6 / 7.3 basics) ----------
// Sessions are placed after school, around dinner, before bedtime, with 15-minute gaps.
// Busy windows: school hours and dinner (45 minutes).

export interface SessionSlot {
  startMin: number;
  endMin: number;
  label: string;
}

export const GAP_MIN = 15;
export const DINNER_LEN = 45;

/** Free study windows for a day: after school/work and after dinner, minus commitment blocks. */
function freeWindows(plan: SchedulePlan): Array<[number, number]> {
  const { startMin: _s, endMin, dinnerMin, bedMin, sessionLen } = plan;
  let free: Array<[number, number]> = [];
  if (endMin + GAP_MIN <= dinnerMin) free.push([endMin + GAP_MIN, dinnerMin]);
  if (dinnerMin + DINNER_LEN <= bedMin) free.push([dinnerMin + DINNER_LEN, bedMin]);

  // subtract commitment blocks (clamped to sensible bounds) from the free windows
  const blocks = (plan.busy ?? [])
    .filter((c) => c.endMin > c.startMin)
    .map((c) => [Math.max(0, c.startMin), Math.min(24 * 60, c.endMin)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  for (const [bs, be] of blocks) {
    const next: Array<[number, number]> = [];
    for (const [ws, we] of free) {
      if (be <= ws || bs >= we) {
        next.push([ws, we]); // no overlap
        continue;
      }
      if (bs > ws) next.push([ws, Math.min(bs, we)]);
      if (be < we) next.push([Math.max(be, ws), we]);
    }
    free = next.filter(([ws, we]) => we - ws >= Math.min(10, sessionLen));
  }
  return free;
}

/**
 * Lay out `plan.sessions` study sessions for one day. Sessions go after
 * school/work and after dinner, before bedtime, with 15-minute gaps. Structured
 * commitment blocks (7.1 upgrade) are subtracted from the free windows —
 * the planner never overlaps a commitment. Returns the slots, or a
 * "day too full" verdict instead of guessing (3.3: if the day is too full say so).
 */
export function planDay(plan: SchedulePlan): { slots: SessionSlot[]; dropped: number } {
  const { sessions, sessionLen } = plan;
  const free = freeWindows(plan);

  const slots: SessionSlot[] = [];
  for (const [ws, we] of free) {
    let t = ws;
    while (slots.length < sessions && t + sessionLen <= we) {
      slots.push({
        startMin: t,
        endMin: t + sessionLen,
        label: sessions === 1 ? 'Study session' : `Session ${slots.length + 1}`,
      });
      t += sessionLen + GAP_MIN;
    }
    if (slots.length >= sessions) break;
  }
  return { slots, dropped: sessions - slots.length };
}

/**
 * The day's plan with the learner's interactive reschedule overrides applied
 * (chunk 4A). Overrides are validated when generated (rescheduleOptions); an
 * override for a slot index that does not exist is ignored.
 */
export function planDayWithOverrides(
  plan: SchedulePlan,
  overrides?: Record<string, number>
): { slots: SessionSlot[]; dropped: number } {
  const base = planDay(plan);
  if (!overrides || Object.keys(overrides).length === 0) return base;
  const slots = base.slots.map((s, i) => {
    const ov = overrides[String(i)];
    if (typeof ov !== 'number') return s;
    return { ...s, startMin: ov, endMin: ov + (plan.sessionLen ?? s.endMin - s.startMin) };
  });
  return { slots, dropped: base.dropped };
}

/**
 * Every valid 15-minute-aligned start time for moving session `index`: inside a
 * free window (school/dinner/commitments honoured), not overlapping another
 * placed session, and not its own current start.
 */
export function rescheduleOptions(
  plan: SchedulePlan,
  overrides: Record<string, number> | undefined,
  index: number
): number[] {
  const { slots } = planDay(plan);
  if (index < 0 || index >= slots.length) return [];
  const len = plan.sessionLen;
  const others = slots
    .map((s, i) => {
      const ov = overrides?.[String(i)];
      const start = typeof ov === 'number' ? ov : s.startMin;
      return { i, startMin: start, endMin: start + len };
    })
    .filter((s) => s.i !== index);
  const out: number[] = [];
  for (const [ws, we] of freeWindows(plan)) {
    for (let t = ws; t + len <= we; t += 15) {
      const clash = others.some((o) => t < o.endMin && o.startMin < t + len);
      if (!clash && t !== slots[index].startMin) out.push(t);
    }
  }
  return out;
}

/**
 * Subject pairing (7.3): even-indexed sessions carry a core subject that rotates
 * day by day; odd-indexed sessions pair with the complementary subject when one
 * is set (session 2 pairs with the same core as session 1, keeping the pair). */
export function subjectForSession(
  subjects: string[],
  compSub: string | undefined,
  dayIndex: number,
  sessionIndex: number
): string | null {
  if (subjects.length === 0 && !compSub) return null;
  if (sessionIndex % 2 === 1 && compSub) return compSub;
  const pool = subjects.length > 0 ? subjects : compSub ? [compSub] : [];
  if (pool.length === 0) return null;
  const pairIndex = Math.floor(sessionIndex / 2);
  return pool[(dayIndex + pairIndex) % pool.length];
}

/** The 7 dates Monday..Sunday of the week containing `today` (5.6: weeks start Monday). */
export function weekDatesOf(today: string): string[] {
  const d = new Date(today + 'T12:00:00Z');
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  const monday = addDays(today, -day);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function minToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** The session currently unlocked (its slot has started) — sessions lock until start time. */
export function currentSlots(slots: SessionSlot[], nowMin: number) {
  return slots.map((s) => ({ ...s, unlocked: nowMin >= s.startMin, done: nowMin >= s.endMin }));
}

// ---------- quests (3.6: daily, weekly, monthly, computed from real activity) ----------
// Chunk 4A: the full quest set. Every quest is computed from real logged activity
// — nothing here can be claimed without the underlying work.

export interface QuestDef {
  id: string;
  period: 'daily' | 'weekly' | 'monthly';
  title: string;
  description: string;
  xp: number;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'daily-plan-review',
    period: 'daily',
    title: 'Ready for today',
    description: 'Review your plan for today',
    xp: 10,
  },
  {
    id: 'daily-focus-block',
    period: 'daily',
    title: 'Lock in once',
    description: 'Finish one focus block today',
    xp: 10,
  },
  {
    id: 'daily-cards',
    period: 'daily',
    title: 'Card refresh',
    description: 'Run one flashcard session today',
    xp: 10,
  },
  {
    id: 'weekly-3-days',
    period: 'weekly',
    title: 'Weekly rhythm',
    description: 'Learn on 3 different days this week',
    xp: 30,
  },
  {
    id: 'weekly-practice',
    period: 'weekly',
    title: 'Practice habit',
    description: 'Complete 3 practice sessions this week',
    xp: 30,
  },
  {
    id: 'weekly-mock',
    period: 'weekly',
    title: 'Mock check-in',
    description: 'Record one honest mock test this week',
    xp: 30,
  },
  {
    id: 'monthly-100xp',
    period: 'monthly',
    title: 'Monthly momentum',
    description: 'Earn 100 XP from activities this month',
    xp: 60,
  },
  {
    id: 'monthly-8-days',
    period: 'monthly',
    title: 'Monthly habit',
    description: 'Learn on 8 different days this month',
    xp: 60,
  },
];

export interface QuestProgress {
  quest: QuestDef;
  progress: number;
  target: number;
  claimable: boolean;
  claimed: boolean;
}

function daysInWeek(days: string[], week: string): number {
  return days.filter((d) => weekKey(new Date(d + 'T12:00:00Z'), 'UTC') === week).length;
}

export function questProgress(
  state: Pick<
    LumioState,
    'days' | 'xpLedger' | 'quests' | 'planReviews' | 'practice' | 'focusLog' | 'mocks'
  >,
  now: Date,
  tz: string
): QuestProgress[] {
  const today = dayKey(now, tz);
  const wk = weekKey(now, tz);
  const mk = monthKey(now, tz);
  const weekDays = new Set(weekDatesOf(today));
  return QUESTS.map((q) => {
    let progress = 0;
    let target = 1;
    if (q.id === 'daily-plan-review') {
      progress = state.planReviews[today] ? 1 : 0;
    } else if (q.id === 'daily-focus-block') {
      progress = Math.min(1, state.focusLog[today]?.blocks ?? 0);
    } else if (q.id === 'daily-cards') {
      progress = state.practice['srs#' + today] ? 1 : 0;
    } else if (q.id === 'weekly-3-days') {
      target = 3;
      progress = Math.min(target, daysInWeek(state.days, wk));
    } else if (q.id === 'weekly-practice') {
      target = 3;
      const practiceDays = new Set(
        state.xpLedger
          .filter((e) => e.source === 'practice' && weekDays.has(e.date))
          .map((e) => e.date)
      );
      progress = Math.min(target, practiceDays.size);
    } else if (q.id === 'weekly-mock') {
      progress = Math.min(1, state.mocks.filter((m) => weekDays.has(m.date)).length);
    } else if (q.id === 'monthly-100xp') {
      target = 100;
      progress = Math.min(
        target,
        state.xpLedger
          .filter((e) => e.date.startsWith(mk) && e.source !== 'import' && e.source !== 'quest')
          .reduce((s, e) => s + Math.max(0, e.amount), 0)
      );
    } else if (q.id === 'monthly-8-days') {
      target = 8;
      progress = Math.min(target, state.days.filter((d) => d.startsWith(mk)).length);
    }
    const claimed = state.quests.some(
      (c) => c.questId === q.id && c.periodKey === (q.period === 'daily' ? today : q.period === 'weekly' ? wk : mk)
    );
    return { quest: q, progress, target, claimable: progress >= target && !claimed, claimed };
  });
}

// ---------- achievements (3.6, ported from prototype ACH) ----------

export interface AchDef {
  id: string;
  description: string;
  target: number;
  test: (s: AchSnapshot) => boolean;
}

export interface AchSnapshot {
  daysCount: number;
  streak: number;
  bestStreak: number;
  questsClaimed: number;
  /** weekly quests claimed (Monday-start period) — chunk 2 */
  weeklyQuests: number;
  /** monthly quests claimed — chunk 2 */
  monthlyQuests: number;
  /** themes with at least one scored quiz — powers Any-light learner (chunk 2) */
  themesCount: number;
  focusBlocks: number;
  masteredChapters: number;
  completedPath: boolean;
  anyQuiz: boolean;
  fullScore: boolean;
}

export const ACHIEVEMENT_RULES: AchDef[] = [
  { id: 'First lesson', description: 'Complete any chapter quiz', target: 1, test: (s) => s.anyQuiz },
  { id: 'First mastery', description: 'Score full marks on a chapter', target: 1, test: (s) => s.fullScore },
  { id: 'Path complete', description: 'Complete every chapter in your path', target: 1, test: (s) => s.completedPath },
  { id: 'Legend', description: 'Master every chapter in your path', target: 1, test: (s) => s.masteredChapters > 0 && s.completedPath },
  { id: 'Quest finisher', description: 'Claim any quest', target: 1, test: (s) => s.questsClaimed >= 1 },
  { id: 'Weekly champion', description: 'Claim a weekly quest', target: 1, test: (s) => s.weeklyQuests >= 1 },
  { id: 'Monthly master', description: 'Claim a monthly quest', target: 1, test: (s) => s.monthlyQuests >= 1 },
  { id: 'Any-light learner', description: 'Finish quizzes in all three themes', target: 3, test: (s) => s.themesCount >= 3 },
  { id: 'Quest hunter', description: 'Claim 10 quests', target: 10, test: (s) => s.questsClaimed >= 10 },
  { id: 'Focus starter', description: 'Complete one focus block', target: 1, test: (s) => s.focusBlocks >= 1 },
  { id: 'Steady focus', description: 'Complete 10 focus blocks', target: 10, test: (s) => s.focusBlocks >= 10 },
  { id: '3-day streak', description: 'Learn on 3 days in a row', target: 3, test: (s) => s.streak >= 3 || s.bestStreak >= 3 },
  { id: '7-day streak', description: 'Learn on 7 days in a row', target: 7, test: (s) => s.streak >= 7 || s.bestStreak >= 7 },
  { id: '14-day streak', description: 'Learn on 14 days in a row', target: 14, test: (s) => s.streak >= 14 || s.bestStreak >= 14 },
  { id: '30-day streak', description: 'Learn on 30 days in a row', target: 30, test: (s) => s.streak >= 30 || s.bestStreak >= 30 },
  { id: '60-day streak', description: 'Learn on 60 days in a row', target: 60, test: (s) => s.streak >= 60 || s.bestStreak >= 60 },
  { id: '100-day streak', description: 'Learn on 100 days in a row', target: 100, test: (s) => s.streak >= 100 || s.bestStreak >= 100 },
];

/** Returns ids of achievements newly satisfied (not yet recorded). */
export function newlyUnlocked(s: AchSnapshot, already: Record<string, string>): string[] {
  return ACHIEVEMENT_RULES.filter((a) => !already[a.id] && a.test(s)).map((a) => a.id);
}

// ---------- chunk 3: practice engine, games and labs ----------

/** XP awarded per game id, once ever (master prompt 3.5: typically +20, labs +25). */
export const GAME_XP: Record<string, number> = {
  count: 20, memory: 20, word: 20, obs: 20, geo: 20, time: 20,
  frac: 20, eco: 20, pend: 25, alg: 20, bio: 25, math: 25, biz: 20,
  circ: 25, proj: 25, eng: 25, dx: 20, ship: 25, chem: 25,
  ai: 25, aif: 25, web: 25, code: 25,
  // Class 11 lab set (senior band): physics, chemistry, math, CS and AI labs
  projplay: 25, friction: 25, shm: 25, vernier: 25,
  titration: 25, gaslaws: 25, periodic: 25, salt: 25,
  unitcircle: 25, conic: 25, permcomb: 25, limits: 25,
  numsys: 25, logic: 25, pytrace: 25, sorting: 25,
  dtree: 25, traincls: 25, bias11: 25, dataclean: 25,
};

/** XP awarded once per day per practice kind. */
export const PRACTICE_XP: Record<string, number> = {
  srs: 10, drill: 10, adaptive: 15, revision: 15, errorlab: 10, remedial: 10,
};

/** The legendary challenge: +40 XP once ever, unlocked after 2 mastered chapters. */
export const LEGENDARY_XP = 40;

// ---------- chunk 4A: focus suite, mocks, streak freezes ----------

/** XP per completed focus work block (7.9). */
export const FOCUS_BLOCK_XP = 5;
/** Max blocks that earn XP per day (7.9: daily limit guard). */
export const FOCUS_DAILY_BLOCK_CAP = 4;
/** XP for recording one honest mock test, once per day. */
export const MOCK_XP = 10;

/** Focus presets: work / short break / long break, minutes (7.9). */
export const FOCUS_PRESETS = [
  { id: 'classic', label: 'Classic', work: 25, breakMin: 5, longBreak: 15 },
  { id: 'deep', label: 'Deep', work: 50, breakMin: 10, longBreak: 20 },
  { id: 'quick', label: 'Quick', work: 15, breakMin: 3, longBreak: 10 },
] as const;

export type FocusPresetId = (typeof FOCUS_PRESETS)[number]['id'];

export function focusPreset(id: string): (typeof FOCUS_PRESETS)[number] {
  return FOCUS_PRESETS.find((p) => p.id === id) ?? FOCUS_PRESETS[0];
}

export function focusBlocksOn(focusLog: Record<string, FocusDayLite>, date: string): number {
  return focusLog[date]?.blocks ?? 0;
}

interface FocusDayLite {
  blocks: number;
  mins: number;
}

/** How many of today's blocks may still earn XP (daily limit guard). */
export function focusXpBlocksLeft(
  focusLog: Record<string, FocusDayLite>,
  date: string
): number {
  return Math.max(0, FOCUS_DAILY_BLOCK_CAP - focusBlocksOn(focusLog, date));
}

/** Whether a mock XP grant for this day already exists (XP once per day). */
export function mockXpGranted(state: Pick<LumioState, 'xpLedger'>, date: string): boolean {
  return state.xpLedger.some((x) => x.source === 'mock' && x.date === date);
}

/** The learner's subject pool (catalogue picks + custom entries). */
export function subjectPool(state: LumioState): string[] {
  return [
    ...new Set([...(state.profile?.subjects ?? []), ...(state.profile?.customSubjects ?? [])]),
  ];
}

/** Whether this game has already paid out its one-time XP. */
export function gameXpGranted(state: LumioState, gameId: string): boolean {
  return state.xpLedger.some((x) => x.source === 'game' && x.ref === gameId);
}

/** Whether a practice kind has already paid out today. */
export function practiceDoneToday(state: LumioState, kind: string, today: string): boolean {
  return Boolean(state.practice[`${kind}#${today}`]);
}

/** Whether the legendary challenge has been completed (once ever). */
export function legendaryDone(state: LumioState): boolean {
  return state.xpLedger.some((x) => x.source === 'practice' && x.ref === 'legendary');
}

/** Number of mastered chapters for the current band. */
export function masteredCount(state: LumioState): number {
  if (!state.profile) return 0;
  const band = state.profile.band;
  return BANDS[band].chapters.filter((_, i) => (state.res[chapterId(band, i)]?.best ?? 0) >= 2).length;
}

export interface WeakTopic {
  chapterIndex: number;
  chapterTitle: string;
  subject: string;
  /** distinct missed question ids in this chapter */
  misses: number;
  /** chapter weight emphasises earlier fundamentals (2/3/1/2/1/2 ranking heuristic) */
  weight: number;
}

/**
 * Weak-topic ranking from `state.wrong` (stable ids `${band}#${ch}#${q}`),
 * merged with the chapters the learner marked weak in self-reported mocks
 * (chunk 4A — each mock marking adds one miss-like weight). Chapters are
 * ranked by distinct misses, then by an importance weight that emphasises
 * the chapters the study path treats as foundations.
 */
export function weakTopics(state: LumioState, limit = 6): WeakTopic[] {
  if (!state.profile) return [];
  const band = state.profile.band;
  const counts = new Map<number, Set<string>>();
  for (const id of Object.keys(state.wrong)) {
    const [b, ch] = id.split('#');
    if (b !== band) continue;
    const idx = Number(ch);
    if (!Number.isFinite(idx)) continue;
    if (!counts.has(idx)) counts.set(idx, new Set());
    counts.get(idx)!.add(id);
  }
  // mock-reported weak chapters merge into the same ranking
  for (const mock of state.mocks ?? []) {
    for (const idx of mock.weakChapters ?? []) {
      if (!counts.has(idx)) counts.set(idx, new Set());
      counts.get(idx)!.add(`mock#${mock.date}#${mock.subject}`);
    }
  }
  const chapters = BANDS[band].chapters;
  const weightFor = (i: number) => [2, 3, 1, 2, 1, 2][i % 6];
  const rows: WeakTopic[] = [];
  for (const [idx, ids] of counts) {
    const ch = chapters[idx];
    if (!ch) continue;
    rows.push({
      chapterIndex: idx,
      chapterTitle: ch.title,
      subject: ch.subject,
      misses: ids.size,
      weight: weightFor(idx),
    });
  }
  rows.sort((a, b) => b.misses * b.weight - a.misses * a.weight || a.chapterIndex - b.chapterIndex);
  return rows.slice(0, limit);
}

export interface DueCardGroup {
  chapterIndex: number;
  chapterTitle: string;
  cardIds: string[];
}

/** Flashcards due today (or overdue) grouped by chapter, for the SRS session. */
export function dueCards(state: LumioState, today: string, cards: Array<{ id: string; chapterIndex: number; chapterTitle: string }>): DueCardGroup[] {
  const due = cards.filter((c) => {
    const s = state.srs[c.id];
    return !s || s.due <= today; // never-seen cards are always due
  });
  const groups = new Map<number, DueCardGroup>();
  for (const c of due) {
    if (!groups.has(c.chapterIndex)) {
      groups.set(c.chapterIndex, { chapterIndex: c.chapterIndex, chapterTitle: c.chapterTitle, cardIds: [] });
    }
    groups.get(c.chapterIndex)!.cardIds.push(c.id);
  }
  return [...groups.values()];
}

// ---------- chunk 4A: calendar grid and RFC-5545 export ----------

/**
 * A Monday-start month grid (6 rows x 7 cols). Cells outside the month are
 * null, so the calendar never invents neighbouring-month data.
 */
export function monthCells(year: number, month0: number): Array<string | null> {
  const first = new Date(Date.UTC(year, month0, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Mon=0 blank cells
  const dayCount = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= dayCount; d++) {
    cells.push(
      `${year}-${String(month0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Convert a learner-local wall-clock time (date + minutes) in `tz` to the true
 * UTC instant. Iterative offset resolution handles DST boundaries honestly.
 */
export function zonedMinutesToUtc(dateStr: string, minutes: number, tz: string): Date {
  const hh = Math.floor(minutes / 60) % 24;
  const mm = minutes % 60;
  const naive = Date.parse(`${dateStr}T${pad(hh)}:${pad(mm)}:00Z`);
  let ts = naive;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  for (let i = 0; i < 3; i++) {
    const parts = fmt.formatToParts(new Date(ts));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour') % 24,
      get('minute'),
      get('second')
    );
    ts = naive - (asUtc - naive);
  }
  return new Date(ts);
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function icsStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export interface IcsEvent {
  /** stable unique id, e.g. `lumio-2025-11-15-0` */
  uid: string;
  date: string; // yyyy-mm-dd (learner-local)
  startMin: number;
  endMin: number;
  summary: string;
  description?: string;
}

/**
 * Build an RFC-5545 VCALENDAR string. Times are emitted as UTC instants
 * (converted from the learner's zone), which every calendar app accepts
 * without requiring a VTIMEZONE block.
 */
export function buildIcs(events: IcsEvent[], tz: string, calName: string): string {
  const stamp = icsStamp(new Date());
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lumio//Study Plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calName)}`,
  ];
  for (const ev of events) {
    const start = zonedMinutesToUtc(ev.date, ev.startMin, tz);
    const end = zonedMinutesToUtc(ev.date, ev.endMin, tz);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}@lumio.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${icsEscape(ev.summary)}`,
      ev.description ? `DESCRIPTION:${icsEscape(ev.description)}` : '',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n') + '\r\n';
}

// ---------- chunk 4B: study tools helpers (7.14, pure) ----------

export const NOTE_MAX_BYTES = 200 * 1024; // 200 KB per note, honest limit
export const MAX_NOTES = 50;
export const MAX_VIDEOS = 20;

/**
 * Sanitize uploaded note text (defence in depth). Notes are ALWAYS rendered as
 * plain text children in React (never dangerouslySetInnerHTML), so this is a
 * second layer: control characters stripped, HTML-significant characters
 * escaped, length clamped.
 */
export function sanitizeNoteText(raw: string): string {
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // strip control chars (keep \t \n \r)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .slice(0, NOTE_MAX_BYTES);
}

/** Strip control characters from a filename before storing it. */
export function sanitizeFileName(name: string): string {
  const clean = name.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return clean.length > 0 ? clean.slice(0, 120) : 'note.txt';
}

export function isNoteExtension(name: string): boolean {
  return /\.(txt|md|markdown)$/i.test(name);
}

/**
 * Validate a study-video URL and extract the 11-character YouTube id.
 * Only youtube.com/watch?v=, youtube.com/shorts/, youtu.be/ and
 * youtube.com/embed/ forms are accepted — every other host is refused.
 */
export function youtubeIdFromUrl(raw: string): string | null {
  const url = raw.trim();
  if (url.length === 0 || url.length > 2048) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const isYouTube = host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com';
  if (!isYouTube || parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  let candidate: string | null = null;
  if (host === 'youtu.be') {
    candidate = parsed.pathname.slice(1).split('/')[0];
  } else if (parsed.pathname === '/watch') {
    candidate = parsed.searchParams.get('v');
  } else {
    const m = parsed.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]+)/);
    candidate = m ? m[1] : null;
  }
  return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
}

/** Safe embed URL for a validated YouTube id (privacy-enhanced nocookie host). */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0`;
}
