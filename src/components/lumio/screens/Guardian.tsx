'use client';

import { useState } from 'react';
import { Download, Eraser, Printer, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { tFor } from '@/lib/lumio/i18n';
import { chapterTally, dayKey, streakFrom, weekDatesOf } from '@/lib/lumio/domain';
import { exportBlob } from '@/lib/lumio/storage';
import type { LumioState, Settings } from '@/lib/lumio/types';
import { AiGuardian } from '../ai/AiGuardian';
import { chapterTallies } from '@/lib/lumio/coachAggregates';

/**
 * Guardian (chunk 4B): read-only progress summary (7.13) + privacy dashboard
 * (7.15). The guardian cannot change learning data here — the only writable
 * controls are the consent switch, the export, the draft-clear and the full
 * reset (the reset mirrors Settings exactly).
 */

const DRAFT_KEYS = [
  'lumio-code-drafts',
  'lumio-web-drafts',
  'lumio-tts-speed',
  'lumio-focus-run',
  'lumio-focus-prefs',
] as const;

export function GuardianScreen({
  state, now, onSettings, onReset,
  aiAvailable, demo,
}: {
  state: LumioState;
  now: Date;
  onSettings: (patch: Partial<Settings>) => void;
  onReset: () => void;
  /** chunk 5-AI feature 9: guardian narrative availability */
  aiAvailable?: boolean;
  demo?: boolean;
}) {
  const tr = tFor(state.profile?.lang);
  const tz = state.profile?.tz ?? 'Asia/Kolkata';
  const today = dayKey(now, tz);
  const weekDates = weekDatesOf(today);

  const [draftsCleared, setDraftsCleared] = useState(false);

  // ---- summary numbers (plain consts, no memo) ----
  const weekXp = state.xpLedger
    .filter((e) => weekDates.includes(e.date))
    .reduce((s, e) => s + e.amount, 0);
  const allXp = state.xpLedger.reduce((s, e) => s + e.amount, 0);
  const weekFocus = weekDates.reduce((s, d) => s + (state.focusLog[d]?.mins ?? 0), 0);
  const allFocus = Object.values(state.focusLog).reduce((s, f) => s + f.mins, 0);
  const weekMocks = state.mocks.filter((m) => weekDates.includes(m.date)).length;
  const chaptersDone = state.profile
    ? chapterTally(state.profile.band, state.res).completed
    : null;
  const streak = streakFrom(state.days, today, state.freeze.used);
  const streakLabel = streak > 0
    ? `${streak} ${tr('common.streakDays')}`
    : tr('common.noStreak');

  const download = () => {
    const blob = exportBlob(state);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumio-export-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearDrafts = () => {
    try {
      for (const key of DRAFT_KEYS) window.localStorage.removeItem(key);
      setDraftsCleared(true);
    } catch {
      setDraftsCleared(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <header>
        <h1 className="font-heading text-2xl font-bold">{tr('guardian.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tr('guardian.subtitle')}</p>
      </header>

      {/* Section 1 — consent gate */}
      <section aria-labelledby="gd-consent" data-tour="guardian-root" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="gd-consent" className="sr-only">{tr('guardian.consent')}</h2>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="gd-consent-switch" className="text-sm font-semibold">
            {tr('guardian.consent')}
          </label>
          <Switch
            id="gd-consent-switch"
            checked={state.settings.consent}
            onCheckedChange={(v) => onSettings({ consent: v })}
            aria-label={tr('guardian.consent')}
          />
        </div>
        {!state.settings.consent && (
          <p role="status" className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            {tr('guardian.consentOff')}
          </p>
        )}
      </section>

      {/* Section 2 — progress summary (consent ON only) */}
      {state.settings.consent && (
        <section aria-labelledby="gd-summary" className="flex flex-col gap-3">
          <h2 id="gd-summary" className="sr-only">{tr('guardian.weeklyReport')}</h2>

          <div className="print-hide flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {tr('guardian.weeklyReport')} · {weekDates[0]} – {weekDates[6]}
            </p>
            <Button variant="secondary" className="print-hide min-h-[44px]" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden="true" /> {tr('guardian.print')}
            </Button>
          </div>

          <div className="print-area grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 font-heading text-lg font-semibold">{tr('guardian.weeklyReport')}</h3>
              <dl className="flex flex-col gap-2">
                <StatRow label={tr('guardian.daysLearned')}
                  value={state.days.filter((d) => weekDates.includes(d)).length} />
                <StatRow label={tr('guardian.xpEarned')} value={weekXp} />
                <StatRow label={tr('guardian.focusMins')} value={weekFocus} />
                <StatRow label={tr('guardian.mocks')} value={weekMocks} />
                <StatRow label={tr('guardian.chaptersDone')} value="—" />
                <StatRow label={tr('guardian.streak')} value={streakLabel} />
              </dl>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 font-heading text-lg font-semibold">{tr('guardian.allTime')}</h3>
              <dl className="flex flex-col gap-2">
                <StatRow label={tr('guardian.daysLearned')} value={state.days.length} />
                <StatRow label={tr('guardian.xpEarned')} value={allXp} />
                <StatRow label={tr('guardian.focusMins')} value={allFocus} />
                <StatRow label={tr('guardian.mocks')} value={state.mocks.length} />
                <StatRow label={tr('guardian.chaptersDone')} value={chaptersDone ?? '—'} />
                <StatRow label={tr('guardian.streak')} value={streakLabel} />
              </dl>
            </div>
          </div>

          <p className="print-hide text-xs text-muted-foreground">
            The print dialog can also save this as a PDF.
          </p>

          {/* chunk 5-AI feature 9: optional AI narrative from the same aggregates */}
          <div className="print-area">
            <AiGuardian
              lang={state.profile?.lang ?? 'en'}
              daysActive7={state.days.filter((d) => weekDates.includes(d)).length}
              xp7={weekXp}
              focusMins7={weekFocus}
              chaptersCompleted={chapterTallies(state).completed}
              chaptersMastered={chapterTallies(state).mastered}
              mocks7={weekMocks}
              streak={streak}
              consent={state.settings.consent}
              aiAvailable={aiAvailable === true}
              demo={demo}
            />
          </div>
        </section>
      )}

      {/* Section 3 — privacy dashboard (always shown, consent or not) */}
      <section aria-labelledby="gd-privacy" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="gd-privacy" className="mb-1 flex items-center gap-2 font-heading text-lg font-semibold">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" /> {tr('guardian.privacy')}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{tr('guardian.storedHere')}</p>

        <dl className="flex flex-col gap-2">
          <StatRow label={tr('guardian.eventCount')} value={state.xpLedger.length} />
          <StatRow label={tr('guardian.notesCount')} value={state.notes.length} />
          <StatRow label={tr('guardian.videosCount')} value={state.videos.length} />
        </dl>
        <p className="mt-2 text-sm tabular-nums text-muted-foreground">
          Records: quests {state.quests.length} · chapter results {Object.keys(state.res).length} ·
          mock tests {state.mocks.length}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" className="min-h-[44px]" onClick={download}>
            <Download className="size-4" aria-hidden="true" /> {tr('guardian.exportCta')}
          </Button>
          <Button variant="secondary" className="min-h-[44px]" onClick={clearDrafts}>
            <Eraser className="size-4" aria-hidden="true" /> {tr('guardian.clearDrafts')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="min-h-[44px]">
                <Eraser className="size-4" aria-hidden="true" /> {tr('common.reset')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all Lumio data on this device?</AlertDialogTitle>
                <AlertDialogDescription>
                  This clears your profile, plan, XP, streaks and quests from this browser.
                  Export a backup first if you want to keep them. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tr('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={onReset}>Delete everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {draftsCleared && (
          <p role="status" className={cn('mt-3 rounded-xl px-3 py-2 text-sm font-medium')}>
            Saved drafts cleared.
          </p>
        )}

        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>No accounts in this build — Lumio never asks for a sign-up.</li>
          <li>Cloud sync is not active yet; a sync flag arrives in a later chunk (chunk 5) and will stay opt-in.</li>
          <li>The export file contains everything stored on this device — keep a copy before resetting.</li>
        </ul>
      </section>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
