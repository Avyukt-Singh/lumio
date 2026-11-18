'use client';

import { useState } from 'react';
import { GameShell, type GameProps } from './GameShell';
import { cn } from '@/lib/utils';

/** One fraction puzzle: target n/d, with a known equivalent for the reveal. */
function makePuzzle(seed: number): { n: number; d: number; equivalent: string } {
  const d = 2 + (seed % 7); // 2..8
  const n = 1 + (seed * 3) % (d - 1 || 1); // 1..d-1
  const mult = 2;
  return { n, d, equivalent: `${n * mult}/${d * mult}` };
}

/** Fraction Puzzles (xp 20): shade a bar to match a fraction; 5 in a row wins. */
export function FractionPuzzlesGame({ won, onWin, onBack }: GameProps) {
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 40));
  const [shaded, setShaded] = useState<number[]>([]);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const best = 5;

  const puzzle = makePuzzle(seed);

  const toggle = (i: number) => {
    setShaded((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
    setFeedback(null);
  };

  const check = () => {
    if (shaded.length === puzzle.n) {
      const next = streak + 1;
      setStreak(next);
      setFeedback(`Right! ${puzzle.n}/${puzzle.d} = ${puzzle.equivalent} too.`);
      if (next >= best) onWin();
      setTimeout(() => {
        setShaded([]);
        setSeed((v) => v + 7);
        setFeedback(null);
      }, 1100);
    } else {
      setStreak(0);
      setFeedback(
        shaded.length < puzzle.n
          ? `You shaded ${shaded.length} of ${puzzle.d} parts — count the shaded parts against ${puzzle.n}/${puzzle.d}.`
          : `You shaded ${shaded.length} parts but ${puzzle.n}/${puzzle.d} needs exactly ${puzzle.n}.`
      );
    }
  };

  return (
    <GameShell
      title="Fraction Puzzles"
      blurb="Shade a bar to match a fraction and see equivalent fractions."
      modelNote="The bar has equal parts, so a fraction is “shaded parts out of all parts.”"
      xp={20}
      won={won}
      onBack={onBack}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-1.5" aria-label={`Streak ${streak} of ${best}`}>
          {Array.from({ length: best }, (_, i) => (
            <span
              key={i}
              className={cn('size-3 rounded-full', i < streak ? 'bg-emerald-500' : 'bg-border')}
              aria-hidden="true"
            />
          ))}
          <span className="ml-2 text-xs text-muted-foreground">{streak} in a row</span>
        </div>

        <p className="text-center text-xl font-semibold" aria-live="polite">
          Shade <span className="text-primary">{puzzle.n}/{puzzle.d}</span> of the bar
        </p>

        <div className="mx-auto flex w-full max-w-md" role="group" aria-label="Fraction bar">
          {Array.from({ length: puzzle.d }, (_, i) => (
            <button
              key={i}
              className={cn(
                'press h-16 flex-1 border border-border transition-colors',
                i === 0 && 'rounded-l-lg',
                i === puzzle.d - 1 && 'rounded-r-lg',
                shaded.includes(i) ? 'bg-primary/70' : 'bg-background hover:bg-accent/20'
              )}
              onClick={() => toggle(i)}
              aria-pressed={shaded.includes(i)}
              aria-label={`Part ${i + 1} of ${puzzle.d}, ${shaded.includes(i) ? 'shaded' : 'not shaded'}`}
            />
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {shaded.length} of {puzzle.d} parts shaded
        </p>

        <button
          className="press mx-auto min-h-[44px] rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90"
          onClick={check}
        >
          Check
        </button>

        {feedback && (
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            {feedback}
          </p>
        )}
      </div>
    </GameShell>
  );
}
