'use client';

import { useState } from 'react';
import { Check, Scale } from 'lucide-react';
import { GameShell, type GameProps } from './GameShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Algebra Challenges: balance linear equations on a CSS balance scale.
 * Learner solves equations like 3x + 4 = 19 with numeric entry, sees the
 * working steps after every answer, and wins with 5 correct in a row.
 */

interface Equation {
  a: number;
  b: number;
  x: number;
  c: number;
}

function makeEquation(): Equation {
  const a = 2 + Math.floor(Math.random() * 4); // 2..5
  const x = 1 + Math.floor(Math.random() * 12); // 1..12
  let b = Math.floor(Math.random() * 19) - 9; // -9..9
  if (b === 0) b = 4;
  return { a, b, x, c: a * x + b };
}

const signed = (n: number) => (n >= 0 ? `+ ${n}` : `− ${-n}`);

function stepsFor(eq: Equation): string[] {
  const step1 = eq.b >= 0 ? `Subtract ${eq.b} from both sides` : `Add ${-eq.b} to both sides`;
  return [
    `${step1}: ${eq.a}x = ${eq.c - eq.b}`,
    `Divide both sides by ${eq.a}: x = ${eq.c - eq.b} ÷ ${eq.a} = ${eq.x}`,
  ];
}

export function AlgebraChallengesGame(props: GameProps) {
  const [eq, setEq] = useState<Equation>(() => makeEquation());
  const [guess, setGuess] = useState('');
  const [checked, setChecked] = useState<null | { correct: boolean }>(null);
  const [streak, setStreak] = useState(0);

  // Derivations (plain consts, above any effects — there are none here).
  const guessNum = guess.trim() === '' ? null : Number(guess);
  const leftValue = guessNum === null || Number.isNaN(guessNum) ? null : eq.a * guessNum + eq.b;
  // Balance-scale tilt: proportional to how far off the guess is, clamped.
  const tilt =
    leftValue === null ? 0 : Math.max(-12, Math.min(12, ((leftValue - eq.c) / Math.max(eq.c, 1)) * 24));
  const balanced = leftValue !== null && leftValue === eq.c;
  const won = streak >= 5;

  function check() {
    if (guessNum === null || Number.isNaN(guessNum)) return;
    const correct = guessNum === eq.x;
    setChecked({ correct });
    if (correct) {
      const next = streak + 1;
      setStreak(next);
      if (next >= 5) props.onWin();
    } else {
      setStreak(0);
    }
  }

  function nextEquation() {
    setEq(makeEquation());
    setGuess('');
    setChecked(null);
  }

  return (
    <GameShell
      title="Algebra Challenges"
      blurb="Find the value of x that balances both sides of the equation. Tip: undo the +/− first, then divide."
      modelNote="Linear equations in one variable — the scale shows that both sides must hold the same value."
      xp={20}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Balance scale (pure CSS) */}
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <div className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
            <Scale className="size-4" aria-hidden="true" /> Balance scale
          </div>
          <div className="relative h-6 w-full max-w-sm">
            <div
              className="absolute left-1/2 top-1/2 h-1.5 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 transition-transform duration-300"
              style={{ transform: `translateX(-50%) rotate(${tilt}deg)` }}
              aria-hidden="true"
            />
            <div className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-600" aria-hidden="true" />
          </div>
          <div className="grid w-full max-w-sm grid-cols-2 gap-4">
            <div
              className={cn(
                'rounded-xl border-2 p-3 text-center',
                leftValue !== null && !balanced ? 'border-amber-500/60 bg-amber-500/10' : 'border-border bg-card'
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">Left side</p>
              <p className="text-lg font-bold">
                {leftValue === null ? `${eq.a}x ${signed(eq.b)}` : `${eq.a}×${guessNum} ${signed(eq.b)} = ${leftValue}`}
              </p>
            </div>
            <div
              className={cn(
                'rounded-xl border-2 p-3 text-center',
                balanced ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-card'
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">Right side</p>
              <p className="text-lg font-bold">{eq.c}</p>
            </div>
          </div>
          <p className="text-lg font-extrabold" aria-live="polite">
            {eq.a}x {signed(eq.b)} = {eq.c}
          </p>
        </div>

        {/* Solve it */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Your value of x</span>
              <Input
                type="number"
                inputMode="numeric"
                value={guess}
                onChange={(e) => {
                  setGuess(e.target.value);
                  setChecked(null);
                }}
                disabled={checked?.correct ?? false}
                className="w-32"
                aria-label={`Value of x for the equation ${eq.a}x ${signed(eq.b)} = ${eq.c}`}
              />
            </label>
            <Button
              className="press min-h-[44px]"
              onClick={check}
              disabled={checked?.correct ?? false}
            >
              <Check className="size-4" aria-hidden="true" /> Check
            </Button>
            {checked?.correct && (
              <Button variant="outline" className="press min-h-[44px]" onClick={nextEquation}>
                Next equation
              </Button>
            )}
          </div>

          <p aria-live="polite" role="status">
            {checked === null ? (
              <span className="text-sm text-muted-foreground">
                Type a number and check — the scale tilts toward the heavier side.
              </span>
            ) : checked.correct ? (
              <span className="font-semibold text-emerald-600">
                Correct — x = {eq.x}. The scale is balanced!
              </span>
            ) : (
              <span className="font-semibold text-amber-600">
                Not quite — the left side gives {leftValue}, not {eq.c}. Follow the steps below and try
                another equation.
              </span>
            )}
          </p>

          {checked && (
            <div className="rounded-2xl border border-border bg-background/50 p-4">
              <h3 className="text-sm font-bold">Working steps</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {stepsFor(eq).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Correct in a row:</span>
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'size-3 rounded-full',
                    i < streak ? 'bg-emerald-500' : 'bg-muted'
                  )}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">{streak}/5</span>
          </div>
          {won && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
              5 in a row — algebra balancing mastered!
            </p>
          )}
        </div>
      </div>
    </GameShell>
  );
}
