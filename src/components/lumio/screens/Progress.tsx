'use client';

import { useMemo } from 'react';
import {
  BarChart3, CalendarDays, Flame, Sparkles, Target, TrendingUp,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { BANDS, type Band } from '@/lib/lumio/content';
import {
  addDays, chapterState, chapterTally, dayKey, totalXp, weekdayOf,
} from '@/lib/lumio/domain';
import type { LumioState } from '@/lib/lumio/types';

/**
 * Progress dashboard (chunk 2, 7.11). Chart types justified from the UI UX Pro
 * skill `charts.csv`:
 *  - completion vs mastery  -> row 19 "Proportional / Percentage" (progress bars + waffle-style list)
 *  - consistency calendar   -> row 5  "Heatmap / Intensity" (28-day grid, printed values, text summary)
 *  - XP trend               -> row 1  "Trend Over Time" (14-day bars; stat card when < 4 points)
 * Every chart has a table/text alternative and never relies on colour alone.
 */

export function ProgressScreen({ state, now }: { state: LumioState; now: Date }) {
  const band: Band = state.profile?.band ?? 'sec';
  const bandDef = BANDS[band];
  const tz = state.profile?.tz ?? 'Asia/Kolkata';
  const today = dayKey(now, tz);

  const tally = chapterTally(band, state.res);
  const pctCompleted = bandDef.chapters.length ? Math.round((tally.completed / bandDef.chapters.length) * 100) : 0;
  const pctMastered = bandDef.chapters.length ? Math.round((tally.mastered / bandDef.chapters.length) * 100) : 0;

  // subject mastery map: average best ratio per subject
  const subjectMap = useMemo(() => {
    const acc: Record<string, { got: number; total: number }> = {};
    bandDef.chapters.forEach((ch, i) => {
      const st = chapterState(band, i, state.res);
      const best = state.res[`${band}#${i}`]?.best ?? 0;
      const a = (acc[ch.subject] ??= { got: 0, total: 0 });
      a.got += Math.min(best, ch.questions.length);
      a.total += ch.questions.length;
      void st;
    });
    return Object.entries(acc).map(([subject, a]) => ({
      subject,
      pct: a.total ? Math.round((a.got / a.total) * 100) : 0,
      got: a.got,
      total: a.total,
    }));
  }, [band, bandDef.chapters, state.res]);

  // consistency calendar: last 28 days (Monday-start weeks stacked)
  const calendar = useMemo(() => {
    const days = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27));
    const set = new Set(state.days);
    return days.map((date) => ({ date, learned: set.has(date) }));
  }, [today, state.days]);

  // XP trend: last 14 days (bar list with table alternative)
  const xpTrend = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
    const byDay = new Map<string, number>();
    for (const e of state.xpLedger) {
      byDay.set(e.date, (byDay.get(e.date) ?? 0) + Math.max(0, e.amount));
    }
    const rows = days.map((date) => ({ date, xp: byDay.get(date) ?? 0 }));
    return { rows, max: Math.max(10, ...rows.map((r) => r.xp)), activeDays: rows.filter((r) => r.xp > 0).length };
  }, [today, state.xpLedger]);

  const streakNow = useMemo(() => {
    const set = new Set(state.days);
    let cursor = set.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (set.has(cursor)) { n += 1; cursor = addDays(cursor, -1); }
    return n;
  }, [state.days, today]);

  const total = totalXp(state.xpLedger);

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="prog-head" className="rounded-2xl border border-border bg-card p-5">
        <h1 id="prog-head" className="flex items-center gap-2 font-heading text-2xl font-bold">
          <BarChart3 className="size-6 text-primary" aria-hidden="true" /> Progress
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Completion and mastery are shown separately — finishing and mastering are different wins.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-primary/10 px-3 font-semibold text-primary">
            <Sparkles className="size-4" aria-hidden="true" /> {total.toLocaleString('en-IN')} XP total
          </span>
          <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-accent/15 px-3 font-semibold text-accent">
            <Flame className="size-4" aria-hidden="true" /> {streakNow}-day streak (best {state.bestStreak})
          </span>
        </div>
      </section>

      {/* Completion vs mastery — charts.csv row 19 */}
      <section aria-labelledby="prog-cm" data-tour="progress-cm" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="prog-cm" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Target className="size-5 text-primary" aria-hidden="true" /> Completion vs mastery
        </h2>
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">Completed (best score ≥ 1)</span>
              <span className="text-muted-foreground">{tally.completed}/{tally.total} · {pctCompleted}%</span>
            </div>
            <Progress value={pctCompleted} className="h-3" aria-label={`Chapters completed: ${tally.completed} of ${tally.total}`} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">Mastered (full marks)</span>
              <span className="text-muted-foreground">{tally.mastered}/{tally.total} · {pctMastered}%</span>
            </div>
            <Progress value={pctMastered} className="h-3 [&>div]:bg-success" aria-label={`Chapters mastered: ${tally.mastered} of ${tally.total}`} />
          </div>
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Table alternative</summary>
          <table className="mt-2 w-full text-left text-sm">
            <caption className="sr-only">Chapter completion table</caption>
            <thead>
              <tr className="text-xs uppercase text-muted-foreground">
                <th className="py-1">Chapter</th><th className="py-1">Status</th><th className="py-1">Best</th>
              </tr>
            </thead>
            <tbody>
              {bandDef.chapters.map((ch, i) => {
                const st = chapterState(band, i, state.res);
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1.5 pr-2">{ch.title}</td>
                    <td className="py-1.5 pr-2 capitalize">{st}</td>
                    <td className="py-1.5">{state.res[`${band}#${i}`]?.best ?? 0}/{ch.questions.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Subject mastery map */}
        <section aria-labelledby="prog-subj" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="prog-subj" className="font-heading text-lg font-semibold">Subject mastery map</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {subjectMap.map((s) => (
              <li key={s.subject}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{s.subject}</span>
                  <span className="text-muted-foreground">{s.got}/{s.total} points · {s.pct}%</span>
                </div>
                <Progress value={s.pct} className="h-2.5" aria-label={`${s.subject} mastery ${s.pct} percent`} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Points = best quiz scores added up per subject. Sample content only.
          </p>
        </section>

        {/* Consistency calendar — charts.csv row 5 */}
        <section aria-labelledby="prog-cal" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="prog-cal" className="flex items-center gap-2 font-heading text-lg font-semibold">
            <CalendarDays className="size-5 text-primary" aria-hidden="true" /> Consistency (last 4 weeks)
          </h2>
          <ul className="mt-3 grid grid-cols-7 gap-1.5" aria-label="Learning-day calendar">
            {calendar.map((c) => (
              <li
                key={c.date}
                title={`${c.date}${c.learned ? ' — learned' : ''}`}
                aria-label={`${c.date}${c.learned ? ', learning day' : ', no activity'}`}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-md border text-[10px] font-semibold',
                  c.learned
                    ? 'border-success bg-success text-success-foreground'
                    : 'border-border bg-muted text-muted-foreground'
                )}
              >
                {c.date.slice(8)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            {state.days.length} learning day{state.days.length === 1 ? '' : 's'} in total —
            every cell shows the day of the month; filled cells are days with an XP-earning activity.
          </p>
        </section>
      </div>

      {/* XP trend — charts.csv row 1 */}
      <section aria-labelledby="prog-xp" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="prog-xp" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <TrendingUp className="size-5 text-primary" aria-hidden="true" /> XP per day (last 14 days)
        </h2>
        {xpTrend.activeDays < 4 && (
          <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            Only {xpTrend.activeDays} active day{xpTrend.activeDays === 1 ? '' : 's'} so far — a trend chart needs
            a few more; here are the numbers directly.
          </p>
        )}
        <ul className="mt-3 flex items-end justify-between gap-1" aria-hidden={xpTrend.activeDays < 4}>
          {xpTrend.rows.map((r) => (
            <li key={r.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground">{r.xp > 0 ? r.xp : ''}</span>
              <span
                className={cn('w-full rounded-t-md', r.xp > 0 ? 'bg-primary' : 'bg-border')}
                style={{ height: `${Math.max(4, (r.xp / xpTrend.max) * 72)}px` }}
              />
              <span className="text-[9px] text-muted-foreground">{r.date.slice(8)}</span>
            </li>
          ))}
        </ul>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Table alternative</summary>
          <table className="mt-2 w-full text-left text-sm">
            <caption className="sr-only">XP earned per day, last 14 days</caption>
            <thead>
              <tr className="text-xs uppercase text-muted-foreground"><th className="py-1">Day</th><th className="py-1">XP</th></tr>
            </thead>
            <tbody>
              {xpTrend.rows.map((r) => (
                <tr key={r.date} className="border-t border-border">
                  <td className="py-1">{r.date} ({['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][weekdayOf(new Date(r.date + 'T12:00:00Z'), 'UTC')]})</td>
                  <td className="py-1">{r.xp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>
    </div>
  );
}
