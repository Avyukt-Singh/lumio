'use client';

import { ArrowLeft, Sparkles, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { UiLang } from '@/lib/lumio/i18n';
import { Mascot } from '../Mascot';

/**
 * Props every game receives from the Games hub. XP-once is enforced by the
 * event log: `won` is true when this game's one-time XP was already collected,
 * and `onWin` may be called as often as the win condition is reached — the
 * projection dedupes, so a repeat win can never grant XP twice.
 */
export interface GameProps {
  /** The game's one-time XP has already been collected. */
  won: boolean;
  /** The win condition was reached (safe to call repeatedly). */
  onWin: () => void;
  /** Return to the Games hub (each game passes it to GameShell). */
  onBack: () => void;
  // ---- chunk 5B: optional AI props (only games that offer AI help use them;
  // safe defaults are applied at the Games.tsx call site) ----
  aiAvailable?: boolean;
  lang?: UiLang;
  demo?: boolean;
}

/**
 * Shared game shell (master prompt 7.7): consistent header, honest model
 * notes, XP-once status, keyboard-focusable content and a kind voice.
 * Every game renders inside this shell.
 */
export function GameShell({
  title,
  blurb,
  modelNote,
  xp,
  won,
  onBack,
  children,
}: {
  title: string;
  blurb: string;
  /** Honest note about simplified physics/models — shown, never hidden. */
  modelNote?: string;
  xp: number;
  won: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="press inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Games
        </button>
        <span
          className={cn(
            'inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold',
            won ? 'bg-emerald-500/15 text-emerald-600' : 'bg-primary/10 text-primary'
          )}
          title={won ? 'This game already awarded its one-time XP' : `Win once to collect +${xp} XP`}
        >
          <Sparkles className="size-4" aria-hidden="true" />
          {won ? `+${xp} XP collected` : `Win once → +${xp} XP`}
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <Mascot pose="excited" size="md" className="hidden shrink-0 sm:block" />
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
            {modelNote && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>{modelNote}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">{children}</div>
    </div>
  );
}
