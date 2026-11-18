'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { aiApi, type AiApiCode } from '@/lib/lumio/aiClient';
import { tFor, type UiLang } from '@/lib/lumio/i18n';
import { BANDS } from '@/lib/lumio/content';
import {
  addDays, chapterId, dayKey, minToLabel, planDayWithOverrides,
  rescheduleOptions, subjectForSession, subjectPool,
} from '@/lib/lumio/domain';
import type { LumioState } from '@/lib/lumio/types';
import { AiBadge, AiLabel, AiMarkdown, aiErrKey, fillVars } from './AiMarkdown';

/**
 * Plan Coach (chunk 5B, Tier 2): a collapsible Planner section. Aggregates ONLY
 * deterministic, locally-known facts (weak topics, latest mock %, exam date,
 * commitments, the next 7 days of sessions with their valid reschedule times)
 * and asks aiApi.plan for move suggestions. Every suggestion is re-validated
 * against rescheduleOptions — the deterministic scheduler stays the source of
 * truth; invalid moves are discarded and counted honestly. Accept reuses the
 * existing `session-rescheduled` event path; nothing here touches XP.
 */

interface CoachCard {
  key: string;
  date: string;
  index: number;
  subject: string;
  oldStartMin: number;
  newStartMin: number;
  reason: string;
}

export function AiPlanCoach({
  state,
  now,
  aiAvailable,
  demo,
  onReschedule,
}: {
  state: LumioState;
  now: Date;
  aiAvailable: boolean;
  demo?: boolean;
  onReschedule: (date: string, index: number, startMin: number | null) => void;
}) {
  const lang: UiLang = state.profile?.lang ?? 'en';
  const tr = tFor(lang);
  const band = state.profile?.band ?? 'sec';
  const tz = state.profile?.tz ?? 'Asia/Kolkata';
  const today = dayKey(now, tz);
  const plan = state.plan;

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done' | 'empty' | 'error'>('idle');
  const [cards, setCards] = useState<CoachCard[]>([]);
  const [dropped, setDropped] = useState(0);
  const [errCode, setErrCode] = useState<AiApiCode | null>(null);

  const run = async () => {
    if (!plan) return;
    setPhase('loading');
    setErrCode(null);

    // ---- aggregation: ONLY local, deterministic facts (contract) ----
    const subjects = subjectPool(state);
    const compSub = state.profile?.compSub;
    const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
    const sessions = week.flatMap((date, i) => {
      const day = planDayWithOverrides(plan, state.planOverrides[date]);
      return day.slots.map((slot, j) => ({
        date,
        index: j,
        subject: subjectForSession(subjects, compSub, i, j) ?? 'Study session',
        startMin: slot.startMin,
        endMin: slot.endMin,
        validStarts: rescheduleOptions(plan, state.planOverrides[date], j),
        done: !!state.sessionDone[`${date}#${j}`],
      }));
    });

    // Weak topics: tagged mistakes' chapter subjects/titles; fall back to the
    // band's chapters that are not yet mastered.
    const chapters = BANDS[band].chapters;
    const weak = new Set<string>();
    for (const qid of Object.keys(state.mistakes)) {
      const ci = Number(qid.split('#')[1]);
      const ch = chapters[ci];
      if (ch) weak.add(`${ch.subject} — ${ch.title}`);
    }
    if (weak.size === 0) {
      chapters.forEach((ch, i) => {
        const best = state.res[chapterId(band, i)]?.best ?? 0;
        if (ch.questions.length > 0 && best < ch.questions.length) {
          weak.add(`${ch.subject} — ${ch.title}`);
        }
      });
    }
    const weakTopics = [...weak].slice(0, 6);

    const lastMock = state.mocks.length ? state.mocks[state.mocks.length - 1] : null;
    const mockSummary =
      lastMock && lastMock.total > 0
        ? `Latest mock: ${Math.round((lastMock.score / lastMock.total) * 100)}% (${lastMock.subject}, ${lastMock.date}).`
        : 'No mock tests recorded yet.';

    const examDate = state.profile?.examDate ?? '';

    const freeWindows = plan
      ? `School/work ${minToLabel(plan.startMin)}–${minToLabel(plan.endMin)}; dinner ${minToLabel(plan.dinnerMin)}; bedtime ${minToLabel(plan.bedMin)}${plan.wakeMin ? `; wake ${minToLabel(plan.wakeMin)}` : ''}. Free study time sits between these.`
      : '';

    const blocks = plan?.busy ?? state.profile?.commitments ?? [];
    const commitments = blocks
      .map((c) => `${minToLabel(c.startMin)}-${minToLabel(c.endMin)} ${c.label}`)
      .join('; ');

    const res = await aiApi.plan({
      weakTopics,
      mockSummary,
      examDate,
      freeWindows,
      commitments,
      sessions,
      lang,
    });

    if (res.ok) {
      // Client-side validation: the deterministic scheduler is the source of
      // truth — anything it would not allow is discarded and counted.
      let bad = typeof res.data.dropped === 'number' ? res.data.dropped : 0;
      const valid: CoachCard[] = [];
      for (const s of res.data.data?.suggestions ?? []) {
        const sess = sessions.find((x) => x.date === s.date && x.index === s.sessionIndex);
        if (!sess || sess.done || !sess.validStarts.includes(s.newStartMin)) {
          bad++;
          continue;
        }
        valid.push({
          key: `${s.date}#${s.sessionIndex}#${s.newStartMin}`,
          date: s.date,
          index: s.sessionIndex,
          subject: sess.subject,
          oldStartMin: sess.startMin,
          newStartMin: s.newStartMin,
          reason: s.reason ?? '',
        });
      }
      setDropped(bad);
      setCards(valid);
      setPhase(valid.length > 0 ? 'done' : 'empty');
    } else {
      setErrCode(res.code);
      setPhase('error');
    }
  };

  const accept = (card: CoachCard) => {
    onReschedule(card.date, card.index, card.newStartMin);
    setCards((prev) => prev.filter((c) => c.key !== card.key));
  };

  const dismiss = (card: CoachCard) => {
    setCards((prev) => prev.filter((c) => c.key !== card.key));
  };

  const heading = (
    <h2 id="planner-coach" className="flex items-center gap-2 font-heading text-lg font-semibold">
      <Sparkles className="size-5 text-primary" aria-hidden="true" /> {tr('ai.planTitle')}
    </h2>
  );

  return (
    <section aria-labelledby="planner-coach" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        {heading}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={tr('ai.planTitle')}
          className="press flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-accent/10"
        >
          {open ? (
            <ChevronUp className="size-5" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {open && (
        <div className="mt-3">
            {phase === 'idle' && (
                <div>
                  <Button className="min-h-[44px]" onClick={() => void run()}>
                    <Sparkles className="size-4" aria-hidden="true" /> {tr('ai.planRun')}
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">{tr('ai.planSchedulerRule')}</p>
                </div>
              )}

              {phase === 'loading' && (
                <div role="status" aria-live="polite" className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <p className="text-xs text-muted-foreground">{tr('ai.thinking')}</p>
                </div>
              )}

              {phase === 'empty' && (
                <div role="status">
                  <p className="rounded-xl bg-muted/60 p-3 text-sm">{tr('ai.planEmpty')}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{tr('ai.planSchedulerRule')}</p>
                  <Button variant="ghost" size="sm" className="mt-2 min-h-[44px]" onClick={() => void run()}>
                    {tr('ai.regenerate')}
                  </Button>
                </div>
              )}

              {phase === 'error' && (
                <div role="status" className="rounded-xl border border-border bg-muted/60 p-3 text-sm">
                  {errCode ? tr(aiErrKey(errCode)) : tr('ai.err.UNAVAILABLE')}
                </div>
              )}

              {phase === 'done' && (
                <>
                  <ul className="flex flex-col gap-3">
                    {cards.map((card) => (
                      <li key={card.key} className="rounded-xl border border-border p-3">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                          <span>{card.date}</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            {card.subject}
                          </span>
                          <span className="font-mono tabular-nums">
                            {minToLabel(card.oldStartMin)} → {minToLabel(card.newStartMin)}
                          </span>
                        </p>
                        {card.reason && <AiMarkdown text={card.reason} className="mt-1" />}
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" className="min-h-[44px]" onClick={() => accept(card)}>
                            {tr('ai.planAccept')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="min-h-[44px]"
                            onClick={() => dismiss(card)}
                          >
                            {tr('ai.planDismiss')}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {cards.length === 0 && (
                    <p role="status" className="mt-2 rounded-xl bg-muted/60 p-3 text-sm">
                      {tr('ai.planEmpty')}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">{tr('ai.planSchedulerRule')}</p>
                  {dropped > 0 && (
                    <p role="status" className="mt-1 text-xs text-muted-foreground">
                      {fillVars(tr('ai.planDropped'), { n: dropped })}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AiBadge demo={demo} lang={lang} />
                    <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => void run()}>
                      {tr('ai.regenerate')}
                    </Button>
                  </div>
                  <AiLabel
                    feature="plancoach"
                    output={cards.map((c) => `${c.date} ${c.subject}: ${c.reason}`).join('\n').trim()}
                    lang={lang}
                    demo={demo}
                  />
                </>
              )}
        </div>
      )}
    </section>
  );
}
