// Coach aggregates (chunk 5-AI feature 8/9): pure, client-safe helpers that
// distil the learner's state into the anonymous AGGREGATE numbers the coach
// and guardian prompts receive. Never names, notes or raw answers — the
// prompts see only what the screens already show.

import { BANDS, type Band } from './content';
import { dayKey, streakFrom, weakTopics } from './domain';
import type { LumioState } from './types';

function lastNDates(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });
}

export function xpLast7Days(state: LumioState, today: string): number {
  const dates = new Set(lastNDates(today, 7));
  return state.xpLedger.filter((x) => dates.has(x.date)).reduce((n, x) => n + x.amount, 0);
}

export function focusMinsLast7(state: LumioState, today: string): number {
  const dates = lastNDates(today, 7);
  return dates.reduce((n, d) => n + (state.focusLog[d]?.mins ?? 0), 0);
}

export function daysActiveLast7(state: LumioState, today: string): number {
  const dates = new Set(lastNDates(today, 7));
  return state.days.filter((d) => dates.has(d)).length;
}

export function mocksLast7(state: LumioState, today: string): number {
  const dates = new Set(lastNDates(today, 7));
  return state.mocks.filter((m) => dates.has(m.date)).length;
}

export function weakTopicTitles(state: LumioState): string[] {
  return weakTopics(state, 6).map((w) => w.chapterTitle);
}

export function chapterTallies(state: LumioState): { completed: number; mastered: number } {
  if (!state.profile) return { completed: 0, mastered: 0 };
  const chapters = BANDS[state.profile.band].chapters;
  let completed = 0;
  let mastered = 0;
  for (let i = 0; i < chapters.length; i += 1) {
    const r = state.res[`${state.profile.band}#${i}`];
    if (!r) continue;
    if (r.best >= chapters[i].questions.length) mastered += 1;
    else if (r.best >= 1) completed += 1;
  }
  return { completed, mastered };
}

/** Plain-language summary of today's deterministic plan (for "why this plan"). */
export function planSummaryFor(state: LumioState, now: Date): string {
  const tz = state.profile?.tz ?? 'Asia/Kolkata';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  if (!state.plan) return '';
  const overrides = state.planOverrides[today];
  const sessionLen = state.plan.sessionLen;
  const blocks = state.plan.sessions;
  const rows: string[] = [];
  for (let i = 0; i < blocks; i += 1) {
    const startMin = overrides?.[String(i)] ?? state.plan.startMin + i * sessionLen * 2;
    const hh = String(Math.floor(startMin / 60)).padStart(2, '0');
    const mm = String(startMin % 60).padStart(2, '0');
    rows.push(`${hh}:${mm} (${sessionLen} min)`);
  }
  return `${blocks} sessions of ${sessionLen} minutes at ${rows.join(', ')}, avoiding school ${Math.floor(state.plan.startMin / 60)}:00–${Math.floor(state.plan.endMin / 60)}:00 and dinner.`;
}

/** One-line self-reported mocks summary (aggregate only). */
export function mocksSummary(state: LumioState): string {
  if (state.mocks.length === 0) return '';
  const last = state.mocks[state.mocks.length - 1];
  const avg = Math.round(
    (state.mocks.reduce((n, m) => n + (m.total > 0 ? m.score / m.total : 0), 0) / state.mocks.length) * 100
  );
  return `${state.mocks.length} recorded; average ${avg}%; latest ${last.score}/${last.total} (${last.subject})`;
}

export function bandForCoach(state: LumioState): Band {
  return state.profile?.band ?? 'sec';
}

export function currentStreak(state: LumioState, now: Date): number {
  const tz = state.profile?.tz ?? 'Asia/Kolkata';
  return streakFrom(state.days, dayKey(now, tz), state.freeze?.used);
}
