'use client';

import { useEffect, useRef, useState } from 'react';
import { GameShell, type GameProps } from './GameShell';
import { cn } from '@/lib/utils';

const PAIRS: Array<[string, string]> = [
  ['🐶', 'dog'],
  ['🐱', 'cat'],
  ['🌞', 'sun'],
  ['🐟', 'fish'],
  ['🚌', 'bus'],
  ['🌳', 'tree'],
];

type Card = { key: string; face: string; pairId: number };

function shuffledDeck(rnd: () => number): Card[] {
  const cards: Card[] = [];
  PAIRS.forEach(([emoji, word], i) => {
    cards.push({ key: `e${i}`, face: emoji, pairId: i });
    cards.push({ key: `w${i}`, face: word, pairId: i });
  });
  return cards.sort(() => rnd() - 0.5);
}

/** Match the Pictures (xp 20): memory game; find all 6 pairs. */
export function MatchPicturesGame({ won, onWin, onBack }: GameProps) {
  const [seed, setSeed] = useState(0);
  const [deck, setDeck] = useState<Card[]>(() => shuffledDeck(() => Math.random()));
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const restart = () => {
    if (timer.current) clearTimeout(timer.current);
    setDeck(shuffledDeck(() => Math.random()));
    setOpen([]);
    setMatched([]);
    setMoves(0);
    setSeed((s) => s + 1);
  };

  const flip = (card: Card) => {
    if (open.includes(card.key) || matched.includes(card.pairId) || open.length === 2) return;
    const next = [...open, card.key];
    setOpen(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((k) => deck.find((c) => c.key === k)!);
      if (a.pairId === b.pairId) {
        const nm = [...matched, a.pairId];
        setMatched(nm);
        setOpen([]);
        if (nm.length === PAIRS.length) onWin();
      } else {
        timer.current = setTimeout(() => setOpen([]), 700);
      }
    }
  };

  const isFaceUp = (c: Card) => open.includes(c.key) || matched.includes(c.pairId);

  return (
    <GameShell
      title="Match the Pictures"
      blurb="Memory game: match each picture with its word."
      xp={20}
      won={won}
      onBack={onBack}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {matched.length === PAIRS.length
            ? 'All pairs found — great memory!'
            : `Pairs found: ${matched.length} of ${PAIRS.length} · ${moves} move${moves === 1 ? '' : 's'}`}
        </p>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" role="group" aria-label="Memory cards">
          {deck.map((c) => (
            <button
              key={`${seed}-${c.key}`}
              className={cn(
                'press flex min-h-[72px] items-center justify-center rounded-xl border text-2xl font-semibold',
                isFaceUp(c)
                  ? matched.includes(c.pairId)
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-primary/50 bg-background'
                  : 'border-border bg-sidebar text-transparent hover:border-primary/40'
              )}
              onClick={() => flip(c)}
              aria-label={isFaceUp(c) ? c.face : 'Hidden card'}
            >
              {isFaceUp(c) ? c.face : '?'}
            </button>
          ))}
        </div>
        <button
          className="press mx-auto min-h-[44px] rounded-xl border border-border px-4 text-sm font-medium hover:bg-accent/10"
          onClick={restart}
        >
          Restart
        </button>
      </div>
    </GameShell>
  );
}
