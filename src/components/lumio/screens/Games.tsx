'use client';

import { useState, type ReactNode } from 'react';
import { Gamepad2, LayoutGrid, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tFor } from '@/lib/lumio/i18n';
import { Mascot } from '../Mascot';
import { gamesForBand, gamesForBandAndSubjects } from '../games/registry';
import { PracticeHub } from './Practice';
import { gameXpGranted } from '@/lib/lumio/domain';
import type { LumioState, MistakeTag, PracticeKind } from '@/lib/lumio/types';
import type { Band } from '@/lib/lumio/content';

/**
 * Games hub (chunk 3): the Practice engine on top (SRS, weak topics, drills,
 * error lab, mistake notebook) and the band-eligible games and labs that match
 * the learner's chosen subjects. "Show all games" lifts the subject filter.
 * Games open in place; XP-once is enforced by the event log.
 */
export function GamesScreen({
  state,
  band,
  today,
  onGameWin,
  onCardReview,
  onPracticeDone,
  onLegendary,
  onTagMistake,
  onOpenChapter,
  aiAvailable,
  demo,
  mocksPanel,
  /** guided tour: the open game is owned by the app shell so Back can restore it */
  gameOpen,
  onGameOpen,
}: {
  state: LumioState;
  band: Band;
  today: string;
  onGameWin: (gameId: string) => void;
  onCardReview: (cardId: string, correct: boolean) => void;
  onPracticeDone: (kind: PracticeKind) => void;
  onLegendary: () => void;
  onTagMistake: (questionId: string, tag: MistakeTag | null) => void;
  onOpenChapter: (chapterIndex: number) => void;
  /** chunk 5B: AI explain-my-mistake availability (practice-only, no XP) */
  aiAvailable?: boolean;
  demo?: boolean;
  /** chunk 4A: the mock-test flow rendered as an extra Practice tab */
  mocksPanel?: ReactNode;
  /** guided tour: controlled open-game id (null = hub) */
  gameOpen?: string | null;
  onGameOpen?: (id: string | null) => void;
}) {
  const [openGameLocal, setOpenGameLocal] = useState<string | null>(null);
  const openGame = gameOpen !== undefined ? gameOpen : openGameLocal;
  const setOpenGame = (id: string | null) => {
    setOpenGameLocal(id);
    onGameOpen?.(id);
  };
  const [showAllGames, setShowAllGames] = useState(false);
  const tr = tFor(state.profile?.lang);

  // Subject filter: only games whose subject keywords match the learner's
  // chosen subjects (profile subjects + custom ones). No subjects chosen ->
  // every band-eligible game shows.
  const allBandGames = gamesForBand(band);
  const chosenSubjects = [
    ...(state.profile?.subjects ?? []),
    ...(state.profile?.customSubjects ?? []),
  ];
  const subjectGames = gamesForBandAndSubjects(band, chosenSubjects);
  const games = showAllGames ? allBandGames : subjectGames;
  const hasHiddenGames = subjectGames.length < allBandGames.length;

  const def = games.find((g) => g.id === openGame);

  if (def) {
    const Game = def.Component;
    return (
      <div data-game={def.id}>
        <Game
          won={gameXpGranted(state, def.id)}
          onWin={() => onGameWin(def.id)}
          onBack={() => setOpenGame(null)}
          // chunk 5B: optional AI props (only CodingLab uses them today)
          aiAvailable={aiAvailable}
          lang={state.profile?.lang ?? 'en'}
          demo={demo}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Practice engine */}
      <PracticeHub
        state={state}
        today={today}
        onCardReview={onCardReview}
        onPracticeDone={onPracticeDone}
        onLegendary={onLegendary}
        onTagMistake={onTagMistake}
        onOpenChapter={onOpenChapter}
        aiAvailable={aiAvailable}
        demo={demo}
        mocks={mocksPanel}
      />

      {/* Games and labs */}
      <section aria-labelledby="games-heading" data-tour="games-games" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Gamepad2 className="size-5 text-primary" aria-hidden="true" />
          <h2 id="games-heading" className="font-heading text-xl font-bold">
            {tr('games.gamesLabs')}
          </h2>
          <span className="text-xs text-muted-foreground">
            {showAllGames || chosenSubjects.length === 0
              ? tr('games.xpOnce')
              : tr('games.matchingSubjects')}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g, gi) => {
            const won = gameXpGranted(state, g.id);
            return (
              <button
                key={g.id}
                className={cn(
                  'press flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/5',
                  won && 'border-emerald-500/30'
                )}
                onClick={() => setOpenGame(g.id)}
                data-tour={gi === 0 ? 'game-first' : undefined}
                aria-label={`Open ${g.title}`}
              >
                <span className="text-3xl" aria-hidden="true">
                  {g.icon}
                </span>
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-semibold">{g.title}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                      won ? 'bg-emerald-500/15 text-emerald-600' : 'bg-primary/10 text-primary'
                    )}
                  >
                    <Sparkles className="size-3" aria-hidden="true" />
                    {won ? `+${g.xp} ${tr('games.collected')}` : `+${g.xp} XP`}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{g.blurb}</span>
              </button>
            );
          })}
        </div>
        {games.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-8 text-center">
            <Mascot pose="curious" size="md" bob />
            <p className="text-sm text-muted-foreground">
              {tr('games.noSubjects')}
            </p>
          </div>
        )}
        {hasHiddenGames && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowAllGames((v) => !v)}
              aria-pressed={showAllGames}
              className="press inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-accent/10"
            >
              <LayoutGrid className="size-4" aria-hidden="true" />
              {showAllGames
                ? tr('games.mySubjects')
                : `${tr('games.showAll')} (${allBandGames.length})`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
