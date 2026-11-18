'use client';

import { useMemo, useState } from 'react';
import {
  BookOpen, CalendarDays, CheckCircle2, CircleDashed, Clock,
  Flame, ListChecks, Lock, PartyPopper, ShieldCheck, Snowflake, Sparkles, Timer, Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Mascot } from '../Mascot';
import { cn } from '@/lib/utils';
import { tFor, questTitle, questDesc } from '@/lib/lumio/i18n';
import { BANDS } from '@/lib/lumio/content';
import { fillVars } from '../ai/AiMarkdown';
import {
  chapterState, chapterTally, currentSlots, dayKey, hourOf, minToLabel,
  planDay, planDayWithOverrides, questProgress, streakFrom, weekdayOf, xpOn,
  DAILY_XP_GOAL,
} from '@/lib/lumio/domain';
import type { LumioState, ThemeName } from '@/lib/lumio/types';
import { TodayFocusCard } from './Syllabus';
import type { AcceptedPlan, SyllabusTopicPatch } from '@/lib/lumio/syllabus/types';

/**
 * Home (chunk 1): continue card, today's sessions, streak, week strip, quests.
 * All data is real: it comes from the typed state, the scheduler or the XP ledger.
 */

export function Home({
  state,
  now,
  theme,
  onOpenSettings,
  onOpenStudy,
  onOpenChapter,
  onPlanReviewed,
  onQuestClaim,
  onOpenPlanner,
  onOpenFocus,
  onUseFreeze,
  onSessionDone,
  onOpenXpStreak,
  syllabusPlan,
  onSyllabusTopicUpdate,
}: {
  state: LumioState;
  now: Date;
  theme: ThemeName;
  onOpenSettings: () => void;
  onOpenStudy: () => void;
  onOpenChapter: (index: number) => void;
  onPlanReviewed: () => void;
  onQuestClaim: (questId: string, periodKey: string, xp: number) => void;
  onOpenPlanner: () => void;
  onOpenFocus: () => void;
  onUseFreeze: (date: string) => void;
  onSessionDone: (index: number, onTime: boolean) => void;
  onOpenXpStreak: () => void;
  /** chunk 6: the accepted syllabus plan for today (null when none accepted) */
  syllabusPlan: AcceptedPlan | null;
  onSyllabusTopicUpdate: (topicId: string, patch: SyllabusTopicPatch) => void;
}) {
  const tz = state.profile?.tz ?? 'Asia/Kolkata';
  const today = dayKey(now, tz);
  const hour = hourOf(now, tz);
  const band = state.profile?.band ?? 'sec';
  const bandDef = BANDS[band];
  const isYoung = band === 'young';
  const lang = state.profile?.lang ?? 'en';
  const tr = tFor(lang);

  // --- continue card: next available chapter (cheap linear scan; no memo needed) ---
  const nextChapter = (() => {
    for (let i = 0; i < bandDef.chapters.length; i++) {
      const st = chapterState(band, i, state.res);
      if (st === 'available' || st === 'completed') return { index: i, chapter: bandDef.chapters[i], state: st };
    }
    return null;
  })();

  // --- today's sessions from the scheduler ---
  const slots = useMemo(() => {
    if (!state.plan) return null;
    const { slots: s, dropped } = planDay(state.plan);
    return { slots: currentSlots(s, hour * 60 + now.getMinutes()), dropped };
  }, [state.plan, hour, now]);

  const planReviewedToday = !!state.planReviews[today];

  // --- streak + week strip (streak freezes shield missed days, chunk 4A) ---
  const streak = useMemo(
    () => streakFrom(state.days, today, state.freeze.used),
    [state.days, state.freeze.used, today]
  );

  // freeze redemption: the most recent missed day that a freeze can shield
  const yesterday = shiftDay(today, -1);
  const freezeTarget =
    state.freeze.owned > 0 && !state.days.includes(yesterday) && !state.freeze.used[yesterday]
      ? yesterday
      : null;
  const showFreeze = freezeTarget !== null && streak > 0;

  // --- XP today: powers the daily-goal / at-risk notice (chunk 4C) ---
  const xpToday = xpOn(state.xpLedger, today);
  const goalMet = xpToday >= DAILY_XP_GOAL;
  const atRisk = streak > 0 && !goalMet && hour >= 17;
  const goalLeft = Math.max(0, DAILY_XP_GOAL - xpToday);
  const nowMin = hour * 60 + now.getMinutes();

  // --- Daily Coach line (chunk 5B Tier 3, template-only): ONE kind sentence
  // computed locally from deterministic stats — no server call, no AI output,
  // never guilt-trips, never mentions rank.
  const dueCount = useMemo(
    () => Object.values(state.srs).filter((s) => s.due <= today).length,
    [state.srs, today]
  );
  const todaySessionCount = useMemo(
    () =>
      state.plan
        ? planDayWithOverrides(state.plan, state.planOverrides[today]).slots.length
        : 0,
    [state.plan, state.planOverrides, today]
  );
  const coachLine =
    dueCount > 0
      ? fillVars(tr('ai.coachLineDue'), { n: dueCount })
      : todaySessionCount > 0
        ? fillVars(tr('ai.coachLineSessions'), { n: todaySessionCount, s: streak })
        : tr('ai.coachLineRest');

  const weekStrip = useMemo(() => {
    // Monday-start week (5.6)
    const wd = weekdayOf(now, tz); // 0=Sun
    const mondayOffset = wd === 0 ? -6 : 1 - wd;
    return Array.from({ length: 7 }, (_, i) => {
      const date = shiftDay(today, mondayOffset + i);
      return { date, learned: state.days.includes(date), isToday: date === today };
    });
  }, [now, tz, today, state.days]);

  // --- quests ---
  const quests = useMemo(() => questProgress(state, now, tz), [state, now, tz]);

  // --- tally + greeting ---
  const tally = chapterTally(band, state.res);
  const name = state.profile?.name?.trim();
  const greeting =
    hour < 12 ? tr('home.goodMorning') : hour < 17 ? tr('home.goodAfternoon') : tr('home.goodEvening');
  const themeLabel = theme === 'morning' ? 'Morning' : theme === 'evening' ? 'Evening' : 'Night';

  return (
    <div className="flex flex-col gap-4">
      {/* Hero */}
      <section
        aria-labelledby="home-hello"
        data-tour="home-hero"
        className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-6"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full"
          style={{ background: 'var(--hero-glow)' }}
        />
        <div className="flex items-start gap-4">
          <Mascot pose={isYoung ? 'excited' : 'happy'} size="lg" bob />
          <div className="min-w-0">
            <h1 id="home-hello" className="font-heading text-2xl font-bold sm:text-3xl">
              {greeting}{name ? `, ${name}` : ''}!
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {state.profile
                ? `${bandDef.name} · ${state.profile.board || state.profile.exam || 'Self-learning'} · ${themeLabel} theme`
                : 'Welcome to Lumio'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-accent/15 px-3 text-sm font-semibold text-accent">
                <Flame className="size-4" aria-hidden="true" />
                {streak === 0 ? tr('common.noStreak') : `${streak} ${tr('common.streakDays')}`}
              </span>
              <button
                type="button"
                onClick={onOpenXpStreak}
                className="press inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-primary/10 px-3 text-sm font-semibold text-primary hover:bg-primary/20"
                aria-label="Open the XP and Streak dashboard"
              >
                <Sparkles className="size-4" aria-hidden="true" />
                {state.xpLedger.reduce((s, e) => s + e.amount, 0).toLocaleString('en-IN')} {tr('common.xpLabel')}
              </button>
              <span
                className={cn(
                  'inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold tabular-nums',
                  goalMet ? 'bg-success-soft text-success-soft-foreground' : 'bg-muted text-muted-foreground'
                )}
                title={`Daily XP goal: ${xpToday} of ${DAILY_XP_GOAL}`}
              >
                <Sparkles className="size-4" aria-hidden="true" />
                {xpToday}/{DAILY_XP_GOAL}
              </span>
              {state.freeze.owned > 0 && (
                <span
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-muted px-3 text-sm font-semibold text-muted-foreground"
                  title="Streak Savers shield one missed day each"
                >
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  {state.freeze.owned} {state.freeze.owned === 1 ? tr('home.freezePill') : tr('home.freezesPill')}
                </span>
              )}
              <Button size="sm" variant="secondary" className="min-h-[36px]" onClick={onOpenFocus} data-tour="home-focus-cta">
                <Timer className="size-4" aria-hidden="true" /> {tr('home.focusCta')}
              </Button>
            </div>
            {showFreeze && freezeTarget && (
              <div
                role="status"
                className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/50 p-3 text-sm"
              >
                <Snowflake className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  {tr('home.freezeAsk')} {weekdayLong(freezeTarget)}? {tr('home.freezeOffer')} {streak} {tr('home.freezeAlive')}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="min-h-[36px]"
                  onClick={() => onUseFreeze(freezeTarget)}
                >
                  {tr('home.useFreeze')}
                </Button>
              </div>
            )}
            {atRisk && (
              <div
                role="status"
                className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm font-medium"
                style={{ borderColor: 'var(--gold)', background: 'var(--gold-soft, rgba(234,179,8,0.12))', color: 'var(--gold)' }}
              >
                <Flame className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  Streak at risk: {goalLeft} XP short of today&apos;s goal
                  {state.freeze.owned === 0
                    ? ' — no Streak Saver in stock. A quiz, game or planned session can close the gap.'
                    : ' — a Streak Saver will protect the streak if the day is missed.'}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Daily Coach line — local template, never an AI claim */}
      <section
        className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
        data-tour="home-coach"
      >
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <p aria-live="polite" className="text-sm leading-relaxed">
          {coachLine}
        </p>
      </section>

      {/* Continue card */}
      <section aria-labelledby="home-continue" data-tour="home-continue" className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="home-continue" className="mb-1 flex items-center gap-2 font-heading text-lg font-semibold">
            <BookOpen className="size-5 text-primary" aria-hidden="true" /> {tr('home.nextUp')}
          </h2>
          <Button variant="ghost" size="sm" onClick={onOpenStudy} aria-label="Open the full study path">
            {tr('home.studyPath')}
          </Button>
        </div>
        {nextChapter ? (
          <button
            onClick={() => onOpenChapter(nextChapter.index)}
            aria-label={`Open ${nextChapter.chapter.title}`}
            className="press mt-2 flex w-full items-center gap-3 rounded-xl bg-muted/60 p-3 text-left hover:bg-muted"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              {nextChapter.index + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{nextChapter.chapter.title}</p>
              <p className="text-xs text-muted-foreground">
                {nextChapter.chapter.subject} · {nextChapter.chapter.questions.length} quiz questions
                {nextChapter.state === 'completed' ? ' · completed — retry to improve' : ''}
              </p>
            </div>
            <span className="ml-auto rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success-soft-foreground">
              {nextChapter.state === 'completed' ? tr('home.improve') : tr('home.ready')}
            </span>
          </button>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            {tr('home.masteredAll')}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {tally.completed}/{tally.total} chapters completed · {tally.mastered} mastered
        </p>
      </section>

      {/* Today's plan */}
      <section aria-labelledby="home-plan" data-tour="home-plan" className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="home-plan" className="flex items-center gap-2 font-heading text-lg font-semibold">
            <CalendarDays className="size-5 text-primary" aria-hidden="true" /> {tr('home.todaysPlan')}
          </h2>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={onOpenPlanner} aria-label="Open the full planner">
              {tr('home.planner')}
            </Button>
            <Button
              variant={planReviewedToday ? 'ghost' : 'secondary'}
              size="sm"
              onClick={onPlanReviewed}
              data-tour="home-plan-review"
              disabled={planReviewedToday}
              aria-label={planReviewedToday ? 'Plan reviewed for today' : 'Mark plan as reviewed'}
            >
              {planReviewedToday ? (
                <><CheckCircle2 className="size-4" aria-hidden="true" /> {tr('home.reviewed')}</>
              ) : (
                tr('home.markReviewed')
              )}
            </Button>
          </div>
        </div>
        {slots ? (
          slots.slots.length ? (
            <ol className="mt-3 flex flex-col gap-2">
              {slots.slots.map((s, i) => {
                const doneMarked = !!state.sessionDone[`${today}#${i}`];
                const onTime = nowMin <= s.endMin;
                return (
                  <li
                    key={i}
                    className={cn(
                      'flex min-h-[44px] items-center gap-3 rounded-xl border border-border p-3',
                      (s.done || doneMarked) && 'opacity-60'
                    )}
                  >
                    <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="font-mono text-sm">{minToLabel(s.startMin)}–{minToLabel(s.endMin)}</span>
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                    <span className="ml-auto">
                      {doneMarked ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-soft-foreground"
                          aria-label={`Session ${i + 1} completed${onTime ? ' on time' : ''}`}
                        >
                          <CheckCircle2 className="size-3.5" aria-hidden="true" /> Done
                        </span>
                      ) : s.unlocked || s.done ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="min-h-[36px]"
                          onClick={() => onSessionDone(i, onTime)}
                          aria-label={`Mark session ${i + 1} as done${onTime ? ' on time' : ''}`}
                        >
                          <CheckCircle2 className="size-4" aria-hidden="true" /> Done
                        </Button>
                      ) : (
                        <Lock className="size-4 text-muted-foreground" aria-label="Locked until start time" />
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{tr('home.noRoom')}</p>
          )
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">{tr('home.setUpDay')}</p>
        )}
        {slots && slots.dropped > 0 && (
          <p role="status" className="mt-2 rounded-lg bg-gold-soft px-3 py-2 text-sm font-medium" style={{ color: 'var(--gold)' }}>
            {slots.dropped} {tr('home.didNotFit')}
          </p>
        )}
      </section>

      {/* chunk 6: the accepted syllabus plan as "Today's focus" */}
      {syllabusPlan && syllabusPlan.items.length > 0 && (
        <section aria-labelledby="home-focus" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="home-focus" className="flex items-center gap-2 font-heading text-lg font-semibold">
            <ListChecks className="size-5 text-primary" aria-hidden="true" /> {tr('syllabus.planFocus')}
          </h2>
          <div className="mt-3">
            <TodayFocusCard lang={state.profile?.lang ?? 'en'} plan={syllabusPlan} onTopicUpdate={onSyllabusTopicUpdate} />
          </div>
        </section>
      )}

      {/* Week strip + quests */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="home-week" data-tour="home-week" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="home-week" className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold">
            <Trophy className="size-5 text-primary" aria-hidden="true" /> {tr('home.thisWeek')}
          </h2>
          <ul className="flex items-center justify-between" aria-label="Learning days this week">
            {weekStrip.map((d) => (
              <li key={d.date} className="flex flex-col items-center gap-1">
                <span className={cn('text-xs font-semibold', d.isToday ? 'text-primary' : 'text-muted-foreground')}>
                  {weekdayShort(d.date)}
                </span>
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full',
                    d.learned ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground',
                    d.isToday && 'ring-2 ring-primary'
                  )}
                  aria-label={`${d.date}${d.learned ? ', learned' : ', no activity'}${d.isToday ? ', today' : ''}`}
                >
                  {d.learned ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <CircleDashed className="size-5" aria-hidden="true" />}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            {tr('home.weekNote')}
          </p>
        </section>

        <section aria-labelledby="home-quests" data-tour="home-quests" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="home-quests" className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold">
            <PartyPopper className="size-5 text-primary" aria-hidden="true" /> {tr('home.quests')}
          </h2>
          <ul className="flex flex-col gap-2">
            {quests.map((q) => (
              <li key={q.quest.id} className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{questTitle(lang, q.quest.id, q.quest.title)}</p>
                  <p className="text-xs text-muted-foreground">
                    {questDesc(lang, q.quest.id, q.quest.description)} · +{q.quest.xp} XP
                  </p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${(q.progress / q.target) * 100}%` }}
                      role="progressbar"
                      aria-valuenow={q.progress}
                      aria-valuemin={0}
                      aria-valuemax={q.target}
                      aria-label={`${q.quest.title} progress`}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={q.claimable ? 'default' : 'ghost'}
                  data-tour="quest-claim"
                  disabled={!q.claimable}
                  onClick={() => {
                    const key =
                      q.quest.period === 'daily' ? today
                        : q.quest.period === 'weekly' ? mondayOf(today)
                          : today.slice(0, 7);
                    onQuestClaim(q.quest.id, key, q.quest.xp);
                  }}
                  aria-label={q.claimed ? tr('common.claimed') : q.claimable ? tr('common.claim') : tr('quest.notReady')}
                >
                  {q.claimed ? tr('common.claimed') : tr('common.claim')}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function weekdayShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
}

function shiftDay(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

function weekdayLong(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
}
