'use client';

import { useState } from 'react';
import { GameShell, type GameProps } from './GameShell';
import { cn } from '@/lib/utils';

function makeQuestion(seed: number, streak: number): { prompt: string; options: number[]; answer: number } {
  // pure indexed LCG draw: every call index maps to a distinct pseudo-random
  // number, so no mutable closure is needed (and a constant rnd can never
  // freeze the loop below again)
  const draw = (i: number): number => {
    let s = (seed * 9301 + streak * 49297 + (i + 1) * 7919 + 12345) % 2147483647;
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  let d = 0;
  const nxt = (): number => draw(d++);

  const a = 1 + Math.floor(nxt() * 5);
  const b = 1 + Math.floor(nxt() * 5);
  const sum = a + b;
  const wrongs = new Set<number>();
  // bounded: a degenerate rng must never hang the render (this froze the tab
  // when seed 0 made rnd() return 0 forever)
  let guard = 0;
  while (wrongs.size < 2 && guard < 60) {
    guard += 1;
    const w = Math.max(0, sum + (nxt() < 0.5 ? -1 : 1) * (1 + Math.floor(nxt() * 3)));
    if (w !== sum) wrongs.add(w);
  }
  let fb = 1;
  while (wrongs.size < 2 && fb <= 6) {
    if (sum - fb >= 0) wrongs.add(sum - fb);
    fb += 1;
  }
  const options = [sum, ...wrongs].sort(() => nxt() - 0.5);
  const emoji = ['🍎', '🎈', '⭐', '🟡'][Math.floor(nxt() * 4)];
  return { prompt: `${emoji.repeat(a)} + ${emoji.repeat(b)}`, options, answer: sum };
}

/** Number Hop (xp 20): picture arithmetic; 5 right in a row wins. */
export function NumberHopGame({ won, onWin, onBack }: GameProps) {
  const [seed, setSeed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  const q = makeQuestion(seed, streak);
  const best = 5;

  const answer = (v: number) => {
    if (v === q.answer) {
      const next = streak + 1;
      setStreak(next);
      setFeedback(null);
      setSeed((s) => s + 1);
      if (next >= best) onWin();
    } else {
      setStreak(0);
      setFeedback(`Not quite — the answer was ${q.answer}. A new try is ready!`);
      setSeed((s) => s + 1);
    }
  };

  return (
    <GameShell
      title="Number Hop"
      blurb="Count and add with pictures. Get 5 right in a row."
      xp={20}
      won={won}
      onBack={onBack}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-1.5" aria-label={`Streak ${streak} of ${best}`}>
          {Array.from({ length: best }, (_, i) => (
            <span
              key={i}
              className={cn(
                'size-3 rounded-full',
                i < streak ? 'bg-emerald-500' : 'bg-border'
              )}
              aria-hidden="true"
            />
          ))}
          <span className="ml-2 text-xs text-muted-foreground">{streak} in a row</span>
        </div>

        <p className="text-center text-2xl leading-relaxed tracking-wide" aria-live="polite">
          {q.prompt} = <span className="font-bold">?</span>
        </p>

        <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-3">
          {q.options.map((v) => (
            <button
              key={v}
              className="press min-h-[56px] rounded-xl border border-border bg-background text-xl font-bold hover:border-primary/50"
              onClick={() => answer(v)}
            >
              {v}
            </button>
          ))}
        </div>

        {feedback && (
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            {feedback}
          </p>
        )}
        {streak > 0 && streak < best && (
          <p className="text-center text-sm font-medium text-emerald-600" aria-live="polite">
            Keep going!
          </p>
        )}
      </div>
    </GameShell>
  );
}
