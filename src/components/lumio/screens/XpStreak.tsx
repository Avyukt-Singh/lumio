'use client';

import {
  Award, BookOpen, CalendarCheck, CalendarDays, ClipboardCheck, Flame, Gamepad2,
  Info, PartyPopper, ShieldCheck, ShoppingCart, Sparkles, Timer, TrendingUp, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Mascot } from '../Mascot';
import {
  addDays, dayKey, heatmapWeeks, hourOf, levelInfo, streakFrom, weekDatesOf, weekKey,
  xpOn, xpThisWeek,
  DAILY_XP_GOAL, SAVER_CAP, SAVER_XP_COST, SAVER_WEEK_XP_GOAL,
  LAB_FIRST_CLEAR_BONUS, QUIZ_BASE_XP, QUIZ_BONUS_80, QUIZ_BONUS_100,
  SCHEDULE_XP, SCHEDULE_ONTIME_BONUS, FOCUS_BLOCK_XP,
} from '@/lib/lumio/domain';
import type { LumioState, XpEntry } from '@/lib/lumio/types';

/**
 * XP & Streak dashboard (chunk 4C): total XP, level + progress, XP today/this
 * week, current + longest streak, a 10-week activity heatmap, the Streak Saver
 * inventory with its earn rules, and a recent XP activity feed.
 * All numbers derive from the typed state — nothing here is stored separately.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const SOURCE_META: Record<
  XpEntry['source'],
  { label: string; Icon: typeof Sparkles }
> = {
  quiz: { label: 'Chapter quiz', Icon: BookOpen },
  game: { label: 'Game / lab', Icon: Gamepad2 },
  focus: { label: 'Focus block', Icon: Timer },
  practice: { label: 'Practice session', Icon: Zap },
  schedule: { label: 'Planned session', Icon: CalendarCheck },
  quest: { label: 'Quest claimed', Icon: PartyPopper },
  mock: { label: 'Mock test logged', Icon: ClipboardCheck },
  import: { label: 'Imported progress', Icon: TrendingUp },
  purchase: { label: 'Streak Saver bought', Icon: ShoppingCart },
  aiquiz: { label: 'AI quiz (capped)', Icon: Sparkles },
};

function heatClass(xp: number): string {
  if (xp <= 0) return 'bg-muted';
  if (xp < 30) return 'bg-success/40';
  if (xp < 60) return 'bg-success/70';
  return 'bg-success';
}

export function XpStreakDashboard({
  state,
  now,
  onBuySaver,
  onUseSaver,
}: {
  state: LumioState;
  now: Date;
  onBuySaver: () => void;
  onUseSaver: (date: string) => void;
}) {
  const tz = state.profile?.tz ?? 'Asia/Kolkata';
  const today = dayKey(now, tz);
  const hour = hourOf(now, tz);

  const total = state.xpLedger.reduce((s, e) => s + e.amount, 0);
  const lvl = levelInfo(total);
  const xpToday = xpOn(state.xpLedger, today);
  // weekly card: ALL XP earned this week (purchases are spends, not earnings);
  // the Saver milestone row below uses activity-only XP.
  const weekDates = new Set(weekDatesOf(today));
  const weekXpAll = state.xpLedger
    .filter((e) => weekDates.has(e.date) && e.source !== 'purchase')
    .reduce((s, e) => s + e.amount, 0);
  const weekXp = xpThisWeek(state.xpLedger, today);
  const goalPct = Math.min(1, xpToday / DAILY_XP_GOAL);

  const streak = streakFrom(state.days, today, state.freeze.used);
  const bestStreak = Math.max(state.bestStreak, streak);
  const heat = heatmapWeeks(state.xpLedger, today, 10);

  // --- Streak Saver inventory ---
  const freeze = state.freeze;
  const savers = freeze.owned;
  const atCap = savers >= SAVER_CAP;
  const balance = total;
  const canBuy = !atCap && balance >= SAVER_XP_COST;

  // earn-rule progress for this ISO week
  const wk = weekKey(now, tz);
  const weekScoreEarned = (freeze.weekScore ?? []).includes(wk);
  const weekPlanDone = state.plan
    ? Object.keys(state.sessionDone).filter((k) => weekDates.has(k.split('#')[0])).length
    : 0;
  const weekPlanTarget = state.plan ? state.plan.sessions * 7 : 0;

  // yesterday redemption target (same rule as Home)
  const yesterday = addDays(today, -1);
  const saverTarget =
    savers > 0 && !state.days.includes(yesterday) && !freeze.used[yesterday] ? yesterday : null;

  // at-risk: streak alive but today's goal unmet and the day is winding down
  const atRisk = streak > 0 && xpToday < DAILY_XP_GOAL && hour >= 17;
  const goalLeft = Math.max(0, DAILY_XP_GOAL - xpToday);

  // recent activity feed, newest first
  const feed = [...state.xpLedger].slice(-14).reverse();

  const usedDays = Object.keys(freeze.used).length;
  const bought = freeze.bought ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Level + XP hero */}
      <section
        aria-labelledby="xps-title"
        data-tour="xps-root"
        className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-6"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full"
          style={{ background: 'var(--hero-glow)' }}
        />
        <div className="flex items-start gap-4">
          <Mascot pose={goalPct >= 1 ? 'cheering' : 'happy'} size="lg" bob />
          <div className="min-w-0 flex-1">
            <h1 id="xps-title" className="flex items-center gap-2 font-heading text-2xl font-bold">
              <Zap className="size-6 text-primary" aria-hidden="true" /> XP &amp; Streak
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Level {lvl.level} · {lvl.title} ·{' '}
              <span className="font-semibold tabular-nums text-foreground">
                {total.toLocaleString('en-IN')}
              </span>{' '}
              XP total
            </p>

            {/* level progress */}
            <div
              className="mt-3 h-3 w-full overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuenow={Math.round(lvl.pct * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Level ${lvl.level} progress: ${lvl.into} of ${lvl.need} XP toward level ${lvl.level + 1}`}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${Math.max(2, lvl.pct * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
              {lvl.into}/{lvl.need} XP to level {lvl.level + 1}
            </p>
          </div>
        </div>

        {/* XP today / week / daily goal */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">Earned today</p>
            <p className="font-heading text-xl font-bold tabular-nums">{xpToday} XP</p>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-valuenow={Math.round(goalPct * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Daily goal: ${xpToday} of ${DAILY_XP_GOAL} XP`}
            >
              <div
                className={cn('h-full rounded-full transition-[width]', goalPct >= 1 ? 'bg-success' : 'bg-primary')}
                style={{ width: `${Math.max(2, goalPct * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs tabular-nums text-muted-foreground">
              Daily goal {xpToday}/{DAILY_XP_GOAL}
              {goalPct >= 1 ? ' — streak-active!' : ''}
            </p>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">Earned this week</p>
            <p className="font-heading text-xl font-bold tabular-nums">{weekXpAll} XP</p>
            <p className="mt-1 text-xs text-muted-foreground">Monday-start week</p>
          </div>
          <div className="rounded-xl bg-muted/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">Longest streak</p>
            <p className="font-heading text-xl font-bold tabular-nums">
              {bestStreak} day{bestStreak === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Savers shielded days included</p>
          </div>
        </div>

        {/* at-risk warning */}
        {atRisk && (
          <div
            role="status"
            className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm font-medium"
            style={{ borderColor: 'var(--gold)', background: 'var(--gold-soft, rgba(234,179,8,0.12))', color: 'var(--gold)' }}
          >
            <Flame className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              Streak at risk: {goalLeft} XP short of today&apos;s goal
              {savers === 0 ? ' — and no Streak Saver is in stock. Earn one below or buy it with XP.' : ' — a Streak Saver can protect it if the day is missed.'}
            </span>
          </div>
        )}
      </section>

      {/* Streak + heatmap */}
      <section aria-labelledby="xps-streak" className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="xps-streak" className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Flame className="size-5 text-accent" aria-hidden="true" /> Streak calendar
          </h2>
          <Badge className="bg-accent/15 text-accent" variant="secondary">
            <Flame className="size-3.5" aria-hidden="true" />
            <span className="tabular-nums">{streak}</span> current
          </Badge>
          <Badge variant="secondary">
            <Award className="size-3.5" aria-hidden="true" />
            <span className="tabular-nums">{bestStreak}</span> best
          </Badge>
        </div>

        {/* 10-week heatmap: columns = weeks, rows = Mon..Sun */}
        <div className="mt-4 overflow-x-auto">
          <div
            role="grid"
            aria-label="Activity heatmap of the last 10 weeks"
            className="flex gap-1.5"
          >
            <div className="flex flex-col gap-1.5 pr-1" aria-hidden="true">
              {WEEKDAYS.map((d) => (
                <span key={d} className="flex h-5 items-center text-[10px] font-medium text-muted-foreground">
                  {d}
                </span>
              ))}
            </div>
            {heat.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-1.5">
                {col.map((cell) => (
                  <span
                    key={cell.date}
                    role="gridcell"
                    title={`${cell.date}${cell.xp > 0 ? ` · ${cell.xp} XP` : ''}`}
                    aria-label={`${cell.date}${cell.future ? ', upcoming' : cell.active ? `, ${cell.xp} XP earned` : ', no activity'}`}
                    className={cn(
                      'size-5 rounded-sm transition-colors',
                      heatClass(cell.xp),
                      cell.future && 'opacity-30',
                      cell.date === today && 'ring-2 ring-primary'
                    )}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-muted" aria-hidden="true" /> no activity
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-success/40" aria-hidden="true" /> &lt;30 XP
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-success/70" aria-hidden="true" /> 30–59 XP
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-success" aria-hidden="true" /> 60+ XP
          </li>
          <li className="ml-auto">
            Days roll over at midnight in <span className="font-medium">{tz}</span>.
          </li>
        </ul>

        {saverTarget && (
          <div
            role="status"
            className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/50 p-3 text-sm"
          >
            <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              Missed {saverTarget}? Use a Streak Saver to keep your <span className="tabular-nums">{streak}</span>-day streak alive.
            </span>
            <Button size="sm" variant="secondary" className="min-h-[36px]" onClick={() => onUseSaver(saverTarget)}>
              Use Saver
            </Button>
          </div>
        )}
        {streak === 0 && !saverTarget && (
          <p className="mt-3 text-sm text-muted-foreground">
            No active streak right now. Complete any XP-earning activity today to start one — quizzes,
            labs, focus blocks, practice or a planned session all count.
          </p>
        )}
      </section>

      {/* Streak Savers */}
      <section aria-labelledby="xps-savers" data-tour="xps-savers" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="xps-savers" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" /> Streak Savers
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A Saver protects your streak when a day is missed. You confirm its use — it is never spent silently.
        </p>

        {/* inventory */}
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={`Savers owned: ${savers} of ${SAVER_CAP}`}>
          {Array.from({ length: SAVER_CAP }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={cn(
                'flex size-11 items-center justify-center rounded-xl border',
                i < savers
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-dashed border-border text-muted-foreground/50'
              )}
            >
              <ShieldCheck className="size-5" />
            </span>
          ))}
          <span className="ml-1 text-sm font-semibold tabular-nums">
            {savers}/{SAVER_CAP} owned
          </span>
          {atCap && (
            <Badge className="bg-primary/10 text-primary" variant="secondary">inventory full</Badge>
          )}
          {(usedDays > 0 || bought > 0) && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {usedDays} used · {bought} bought
            </span>
          )}
        </div>

        {/* earn rules */}
        <ul className="mt-4 flex flex-col gap-2 text-sm">
          <li className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 p-3">
            <TrendingUp className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              Reach <span className="font-semibold tabular-nums">{SAVER_WEEK_XP_GOAL} XP</span> of activities this week
              <span className="block text-xs tabular-nums text-muted-foreground">{Math.min(weekXp, SAVER_WEEK_XP_GOAL)}/{SAVER_WEEK_XP_GOAL} XP earned this week</span>
            </span>
            <Badge
              variant="secondary"
              className={cn(weekXp >= SAVER_WEEK_XP_GOAL ? 'bg-success-soft text-success-soft-foreground' : undefined)}
            >
              {weekXp >= SAVER_WEEK_XP_GOAL ? 'done' : 'in progress'}
            </Badge>
          </li>
          <li className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 p-3">
            <Award className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              Score <span className="font-semibold">90%+</span> on a quiz, or pass a lab
              <span className="block text-xs text-muted-foreground">Once per week — a lab pass counts as a perfect score</span>
            </span>
            <Badge
              variant="secondary"
              className={cn(weekScoreEarned ? 'bg-success-soft text-success-soft-foreground' : undefined)}
            >
              {weekScoreEarned ? 'earned this week' : 'not yet this week'}
            </Badge>
          </li>
          <li className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 p-3">
            <CalendarCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              Complete a full week of your schedule
              <span className="block text-xs tabular-nums text-muted-foreground">
                {state.plan ? `${weekPlanDone}/${weekPlanTarget} planned sessions done this week` : 'Set up a daily plan first'}
              </span>
            </span>
            <Badge
              variant="secondary"
              className={cn(weekPlanTarget > 0 && weekPlanDone >= weekPlanTarget ? 'bg-success-soft text-success-soft-foreground' : undefined)}
            >
              {weekPlanTarget > 0 && weekPlanDone >= weekPlanTarget ? 'done' : 'in progress'}
            </Badge>
          </li>
          <li className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 p-3">
            <Flame className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              Every 7-day streak milestone pays one automatically
              <span className="block text-xs tabular-nums text-muted-foreground">
                next at {Math.max(7, (Math.floor(streak / 7) + 1) * 7)}-day streak
              </span>
            </span>
            <Badge variant="secondary">always on</Badge>
          </li>
        </ul>

        {/* fallback purchase */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border p-3">
          <Info className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            Fallback: buy one with <span className="font-semibold tabular-nums text-foreground">{SAVER_XP_COST} XP</span>.
            {atCap ? ' Inventory is full (cap 3) — spend one first.' : ` Balance: ${balance.toLocaleString('en-IN')} XP.`}
          </p>
          <Button
            size="sm"
            className="min-h-[44px]"
            onClick={onBuySaver}
            disabled={!canBuy}
            aria-label={
              canBuy
                ? `Buy a Streak Saver for ${SAVER_XP_COST} XP`
                : atCap
                  ? 'Saver inventory is full'
                  : `Need ${SAVER_XP_COST - balance} more XP to buy a Saver`
            }
          >
            <ShoppingCart className="size-4" aria-hidden="true" /> Buy Saver
          </Button>
        </div>
      </section>

      {/* How XP works */}
      <section aria-labelledby="xps-rules" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="xps-rules" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Info className="size-5 text-primary" aria-hidden="true" /> How XP works
        </h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <li className="rounded-xl bg-muted/60 p-3">
            <span className="font-semibold">Chapter quiz</span>
            <span className="block text-xs text-muted-foreground tabular-nums">
              {QUIZ_BASE_XP} base · +10 per improved question · +{QUIZ_BONUS_80} at 80%+ · +{QUIZ_BONUS_100} for 100%
            </span>
          </li>
          <li className="rounded-xl bg-muted/60 p-3">
            <span className="font-semibold">Game or lab</span>
            <span className="block text-xs text-muted-foreground tabular-nums">
              once per game · labs add +{LAB_FIRST_CLEAR_BONUS} first-clear bonus
            </span>
          </li>
          <li className="rounded-xl bg-muted/60 p-3">
            <span className="font-semibold">Planned session done</span>
            <span className="block text-xs text-muted-foreground tabular-nums">
              {SCHEDULE_XP} XP · +{SCHEDULE_ONTIME_BONUS} when finished before its end time
            </span>
          </li>
          <li className="rounded-xl bg-muted/60 p-3">
            <span className="font-semibold">Focus blocks</span>
            <span className="block text-xs text-muted-foreground tabular-nums">
              {FOCUS_BLOCK_XP} XP per block · daily cap of 4 XP-earning blocks
            </span>
          </li>
          <li className="rounded-xl bg-muted/60 p-3 sm:col-span-2">
            <span className="font-semibold">No XP farming</span>
            <span className="block text-xs text-muted-foreground">
              Repeating the same quiz without beating your best pays nothing, every game pays once,
              practice pays once per kind per day, and quests can only be claimed once per period.
            </span>
          </li>
        </ul>
      </section>

      {/* Recent activity feed */}
      <section aria-labelledby="xps-feed" data-tour="xps-feed" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="xps-feed" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <CalendarDays className="size-5 text-primary" aria-hidden="true" /> Recent XP activity
        </h2>
        {feed.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing yet — finish a quiz, win a game or complete a planned session to see it here.
          </p>
        ) : (
          <ul className="mt-3 flex max-h-96 flex-col gap-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {feed.map((e) => {
              const meta = SOURCE_META[e.source];
              const negative = e.amount < 0;
              return (
                <li
                  key={e.id}
                  className="flex min-h-[44px] items-center gap-3 rounded-xl bg-muted/50 px-3 py-2"
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg',
                      negative ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                    )}
                    aria-hidden="true"
                  >
                    <meta.Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {meta.label}
                      {e.source === 'game' && e.ref ? ` · ${e.ref}` : ''}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">{e.date}</p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-sm font-bold tabular-nums',
                      negative ? 'text-destructive' : 'text-success'
                    )}
                  >
                    {negative ? '' : '+'}
                    {e.amount} XP
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
