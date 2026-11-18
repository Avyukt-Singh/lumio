'use client';

import { useState } from 'react';
import {
  CalendarDays, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  Download, RotateCcw, Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { tFor } from '@/lib/lumio/i18n';
import {
  addDays, buildIcs, dayKey, hourOf, minToLabel, monthCells,
  planDayWithOverrides, rescheduleOptions, subjectForSession, subjectPool,
} from '@/lib/lumio/domain';
import type { IcsEvent } from '@/lib/lumio/domain';
import type { LumioState } from '@/lib/lumio/types';
import { ListChecks } from 'lucide-react';
import { AiPlanCoach } from '../ai/AiPlanCoach';
import { AiCoachPanel } from '../ai/AiCoachPanel';
import {
  bandForCoach, currentStreak, focusMinsLast7, mocksSummary,
  planSummaryFor, weakTopicTitles, xpLast7Days,
} from '@/lib/lumio/coachAggregates';

/**
 * Planner (chunk 4A): .ics export, the next 7 days with per-session reschedule
 * overrides, and a month calendar built from real logged activity.
 * All derivations are cheap plain consts; no clocks here — time comes from props.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function Planner({
  state,
  now,
  onReschedule, // (date, index, startMin | null) — null clears the override
  onSessionDone, // (date, index, onTime) — marks a planned session completed
  aiAvailable,
  demo,
}: {
  state: LumioState;
  now: Date;
  onReschedule: (date: string, index: number, startMin: number | null) => void;
  onSessionDone: (date: string, index: number, onTime: boolean) => void;
  /** chunk 5B Tier 2: Plan Coach availability probe */
  aiAvailable?: boolean;
  demo?: boolean;
}) {
  const tz = state.profile?.tz ?? 'Asia/Kolkata';
  const today = dayKey(now, tz);
  const plan = state.plan;
  const subjects = subjectPool(state);
  const compSub = state.profile?.compSub;
  const tr = tFor(state.profile?.lang);

  // one open reschedule panel at a time
  const [open, setOpen] = useState<{ date: string; index: number } | null>(null);

  // month grid state, initialised from the learner-local month of `now`
  const [monthView, setMonthView] = useState(() => {
    const ym = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).format(now);
    const [y, m] = ym.split('-');
    return { year: Number(y), month0: Number(m) - 1 };
  });

  // the next 7 dates starting today
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const cells = monthCells(monthView.year, monthView.month0);
  const monthLabel = `${MONTH_NAMES[monthView.month0]} ${monthView.year}`;

  function handleExportIcs() {
    if (!plan) return;
    const events: IcsEvent[] = [];
    for (let i = 0; i < 7; i++) {
      const date = week[i];
      const day = planDayWithOverrides(plan, state.planOverrides[date]);
      day.slots.forEach((slot, j) => {
        const subject = subjectForSession(subjects, compSub, i, j);
        events.push({
          uid: `lumio-${date}-${j}`,
          date,
          startMin: slot.startMin,
          endMin: slot.endMin,
          summary: subject ?? 'Study session',
          description: `${slot.label} · planned by Lumio`,
        });
      });
    }
    const ics = buildIcs(events, tz, 'Lumio study plan');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lumio-plan.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <section aria-labelledby="planner-header" data-tour="planner-root" className="rounded-2xl border border-border bg-card p-5">
        <h1 id="planner-header" className="flex items-center gap-2 font-heading text-2xl font-bold">
          <CalendarRange className="size-6 text-primary" aria-hidden="true" /> {tr('planner.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr('planner.subtitle')}
        </p>
        {!plan && (
          <p role="status" className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            No daily plan yet. Set up your day in the first-run guide to get timed sessions here.
          </p>
        )}
      </section>

      {/* .ics export */}
      <section aria-labelledby="planner-ics" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="planner-ics" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Download className="size-5 text-primary" aria-hidden="true" /> {tr('planner.exportTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr('planner.exportNote')}
        </p>
        <Button
          className="mt-3 min-h-[44px]"
          onClick={handleExportIcs}
          disabled={!plan}
          aria-label={plan ? 'Download the next 7 days as an .ics calendar file' : 'Export unavailable until a daily plan exists'}
        >
          <Download className="size-4" aria-hidden="true" /> {tr('planner.exportBtn')}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          {plan
            ? `${tr('planner.exportTz')} (${tz}). ${tr('planner.anyCalendar')}`
            : 'Export unlocks once you have a daily plan (set it up in the first-run guide).'}
        </p>
      </section>

      {/* Plan Coach (AI) — chunk 5B Tier 2 */}
      {aiAvailable && plan && (
        <AiPlanCoach
          state={state}
          now={now}
          aiAvailable={aiAvailable}
          demo={demo}
          onReschedule={onReschedule}
        />
      )}

      {/* chunk 5-AI feature 8: plain-language plan explanation + weekly reflection.
          Display-only — the schedule itself stays produced by the scheduler. */}
      {aiAvailable && plan && (
        <section aria-label="AI study coach" className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Sparkles className="size-5 text-primary" aria-hidden="true" /> AI study coach
          </h2>
          <AiCoachPanel
            mode="why"
            title={tr('ai.whyPlan')}
            lang={state.profile?.lang ?? 'en'}
            band={bandForCoach(state)}
            planSummary={planSummaryFor(state, now)}
            weakTopics={weakTopicTitles(state)}
            streak={currentStreak(state, now)}
            xpLast7={xpLast7Days(state, dayKey(now, tz))}
            focusMins7={focusMinsLast7(state, dayKey(now, tz))}
            mocksSummary={mocksSummary(state)}
            aiAvailable={aiAvailable === true}
            demo={demo}
          />
          <AiCoachPanel
            mode="reflect"
            title={tr('ai.weekReflect')}
            lang={state.profile?.lang ?? 'en'}
            band={bandForCoach(state)}
            planSummary=""
            weakTopics={weakTopicTitles(state)}
            streak={currentStreak(state, now)}
            xpLast7={xpLast7Days(state, dayKey(now, tz))}
            focusMins7={focusMinsLast7(state, dayKey(now, tz))}
            mocksSummary={mocksSummary(state)}
            aiAvailable={aiAvailable === true}
            demo={demo}
          />
        </section>
      )}

      {/* 7-day plan */}
      {plan && (
        <section aria-labelledby="planner-week" data-tour="planner-week" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="planner-week" className="flex items-center gap-2 font-heading text-lg font-semibold">
            <CalendarDays className="size-5 text-primary" aria-hidden="true" /> {tr('planner.sevenDay')}
          </h2>
          {compSub && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {tr('planner.compNote')} {compSub}.
              <Badge variant="outline" className="gap-1">
                <Sparkles className="size-3" aria-hidden="true" /> {compSub}
              </Badge>
            </p>
          )}
          <ol className="mt-3 flex flex-col gap-3">
            {week.map((date, dayIndex) => {
              const day = planDayWithOverrides(plan, state.planOverrides[date]);
              const isToday = date === today;
              const heading = new Intl.DateTimeFormat('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
              }).format(new Date(date + 'T12:00:00Z'));
              return (
                <li
                  key={date}
                  className={cn('rounded-xl border border-border p-3', isToday && 'ring-2 ring-primary')}
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-sm font-semibold">{heading}</h3>
                    {isToday && (
                      <Badge className="bg-primary text-primary-foreground">{tr('common.today')}</Badge>
                    )}
                  </div>
                  {day.slots.length ? (
                    <ul className="mt-2 flex flex-col gap-2">
                      {day.slots.map((s, i) => {
                        const overridden = typeof state.planOverrides[date]?.[String(i)] === 'number';
                        const subject = subjectForSession(subjects, compSub, dayIndex, i);
                        const panelOpen = open?.date === date && open.index === i;
                        const opts = panelOpen ? rescheduleOptions(plan, state.planOverrides[date], i) : [];
                        const doneMarked = !!state.sessionDone[`${date}#${i}`];
                        // Only today's started sessions can be marked done —
                        // ticking a future session would be dishonest XP.
                        const nowMin = hourOf(now, tz) * 60 + now.getMinutes();
                        const markable = isToday && !doneMarked && nowMin >= s.startMin;
                        const onTime = nowMin <= s.endMin;
                        // chunk 6: today's accepted syllabus-plan items for this slot
                        const focusItems =
                          isToday && plan
                            ? (state.syllabus.plans[today]?.items ?? []).filter((it) => it.slotIndex === i)
                            : [];
                        return (
                          <li key={i} className="rounded-lg bg-muted/60 p-3">
                            <div className="flex min-h-[44px] flex-wrap items-center gap-2">
                              <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                              <span className="font-mono text-sm">
                                {minToLabel(s.startMin)}–{minToLabel(s.endMin)}
                              </span>
                              {subject && <Badge variant="secondary">{subject}</Badge>}
                              {overridden && (
                                <span className="text-xs font-medium text-muted-foreground">{tr('common.rescheduled')}</span>
                              )}
                              {doneMarked && (
                                <Badge
                                  variant="secondary"
                                  className="bg-success-soft text-success-soft-foreground"
                                  aria-label={`Session ${i + 1} on ${heading} completed`}
                                >
                                  <CheckCircle2 className="size-3" aria-hidden="true" /> done
                                </Badge>
                              )}
                              <span className="ml-auto flex gap-1.5">
                                {markable && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="min-h-[44px]"
                                    onClick={() => onSessionDone(date, i, onTime)}
                                    aria-label={`Mark session ${i + 1} on ${heading} as done${onTime ? ' on time' : ''}`}
                                  >
                                    <CheckCircle2 className="size-4" aria-hidden="true" /> Done
                                  </Button>
                                )}
                                {overridden && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="min-h-[44px]"
                                    onClick={() => onReschedule(date, i, null)}
                                    aria-label={`Reset session ${i + 1} on ${heading} to its planned time`}
                                  >
                                    <RotateCcw className="size-4" aria-hidden="true" /> {tr('common.reset')}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="min-h-[44px]"
                                  onClick={() => setOpen(panelOpen ? null : { date, index: i })}
                                  aria-label={`Reschedule session ${i + 1} on ${heading}`}
                                  aria-expanded={panelOpen}
                                >
                                  {tr('planner.reschedule')}
                                </Button>
                              </span>
                            </div>
                            {focusItems.length > 0 && (
                              <div className="mt-2 border-t border-border pt-2" role="note" aria-label="Today's focus topics for this session">
                                {focusItems.map((it, k) => (
                                  <p key={k} className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground first:mt-0">
                                    <ListChecks className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                                    <span className="font-medium text-foreground">{it.topicTitles.join(', ')}</span>
                                    <span>
                                      · {it.topicIds.length} {it.topicIds.length === 1 ? 'topic' : 'topics'} · {it.minutes} min
                                    </span>
                                  </p>
                                ))}
                              </div>
                            )}
                            {panelOpen && (
                              <div className="mt-2 border-t border-border pt-2">
                                {opts.length ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {opts.map((t) => (
                                      <Button
                                        key={t}
                                        size="sm"
                                        variant="outline"
                                        className="min-h-[44px] font-mono"
                                        onClick={() => {
                                          onReschedule(date, i, t);
                                          setOpen(null);
                                        }}
                                        aria-label={`Move session ${i + 1} to ${minToLabel(t)}`}
                                      >
                                        {minToLabel(t)}
                                      </Button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    {tr('planner.noWindow')}
                                  </p>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No sessions planned for this day.
                    </p>
                  )}
                  {day.dropped > 0 && (
                    <p
                      role="status"
                      className="mt-2 rounded-lg bg-gold-soft px-3 py-2 text-sm font-medium"
                      style={{ color: 'var(--gold)' }}
                    >
                      {day.dropped} session{day.dropped === 1 ? '' : 's'} did not fit.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Month calendar */}
      <section aria-labelledby="planner-month" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="planner-month" className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold">
          <CalendarRange className="size-5 text-primary" aria-hidden="true" /> {tr('planner.monthTitle')}
        </h2>
        <div className="flex items-center justify-between gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="min-h-[44px]"
            onClick={() =>
              setMonthView((v) =>
                v.month0 === 0 ? { year: v.year - 1, month0: 11 } : { ...v, month0: v.month0 - 1 }
              )
            }
            aria-label={tr('planner.prevMonth')}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <p className="font-heading text-base font-semibold" aria-live="polite">{monthLabel}</p>
          <Button
            size="sm"
            variant="secondary"
            className="min-h-[44px]"
            onClick={() =>
              setMonthView((v) =>
                v.month0 === 11 ? { year: v.year + 1, month0: 0 } : { ...v, month0: v.month0 + 1 }
              )
            }
            aria-label={tr('planner.nextMonth')}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1" role="grid" aria-label={`${monthLabel} activity calendar`}>
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-center text-xs font-semibold text-muted-foreground" role="columnheader">
              {w}
            </div>
          ))}
          {cells.map((date, k) => {
            if (!date) return <div key={`empty-${k}`} role="gridcell" aria-hidden="true" />;
            const learned = state.days.includes(date);
            const reviewed = !!state.planReviews[date];
            const focus = state.focusLog[date]?.mins ?? 0;
            const isToday = date === today;
            const dayNum = Number(date.slice(8, 10));
            return (
              <div
                key={date}
                role="gridcell"
                aria-label={`${date}${isToday ? ', today' : ''}${learned ? ', learning day' : ''}${reviewed ? ', plan reviewed' : ''}${focus > 0 ? `, ${focus} focus minutes` : ''}`}
                className={cn(
                  'flex min-h-[44px] flex-col items-center justify-center rounded-lg px-0.5',
                  isToday && 'ring-2 ring-primary'
                )}
              >
                <span className={cn('text-sm tabular-nums', isToday && 'font-bold text-primary')}>
                  {dayNum}
                </span>
                {(learned || reviewed) && (
                  <span className="flex items-center gap-1" aria-hidden="true">
                    {learned && <span className="size-1.5 rounded-full bg-success" />}
                    {reviewed && <span className="size-1.5 rounded-full bg-primary" />}
                  </span>
                )}
                {focus > 0 && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">{focus}m</span>
                )}
              </div>
            );
          })}
        </div>
        <ul className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" /> {tr('planner.legendLearned')}
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" /> {tr('planner.legendReviewed')}
          </li>
          <li className="flex items-center gap-2">
            <span className="font-medium tabular-nums">12m</span> {tr('planner.legendFocus')}
          </li>
        </ul>
      </section>
    </div>
  );
}
