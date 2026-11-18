'use client';

import { useState } from 'react';
import { GameShell, type GameProps } from './GameShell';
import { cn } from '@/lib/utils';

const CHAIN: Array<[string, string]> = [
  ['Grass', '🌱'],
  ['Grasshopper', '🦗'],
  ['Frog', '🐸'],
  ['Snake', '🐍'],
  ['Hawk', '🦅'],
];

const STARTS = [1000, 2000, 5000, 400, 10000];

interface Q {
  level: number;
  start: number;
  options: number[];
  answer: number;
}

function makeQ(seed: number): Q {
  const level = seed % 4;
  const start = STARTS[seed % STARTS.length];
  const answer = Math.round(start / 10);
  const opts = new Set<number>([answer]);
  // bounded: when answer <= 2 the delta rounds to 0 and this could spin forever
  let guard = 0;
  while (opts.size < 4 && guard < 60) {
    guard += 1;
    const cand = answer + Math.round((Math.random() < 0.5 ? -1 : 1) * (answer / 5) * (1 + Math.floor(Math.random() * 3)));
    if (cand > 0 && cand !== answer) opts.add(Math.max(1, Math.round(cand)));
  }
  let near = 1;
  while (opts.size < 4 && near <= 4) {
    if (answer - near >= 1) opts.add(answer - near);
    near += 1;
  }
  return { level, start, options: [...opts].sort(() => Math.random() - 0.5), answer };
}

/** Ecosystem Builder (xp 20): follow energy up the food chain with the 10% rule. */
export function EcosystemBuilderGame({ won, onWin, onBack }: GameProps) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 25));
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const best = 5;

  const q = makeQ(seed);
  const [hereName, hereEmoji] = CHAIN[q.level];
  const [nextName, nextEmoji] = CHAIN[q.level + 1];

  const choose = (v: number) => {
    if (v === q.answer) {
      const next = streak + 1;
      setStreak(next);
      setFeedback(`Yes! About ${q.answer} kJ reaches the ${nextName.toLowerCase()}.`);
      if (next >= best) onWin();
    } else {
      setStreak(0);
      setFeedback(`Not quite — only about 10% of ${q.start} kJ moves up, so about ${q.answer} kJ.`);
    }
    setSeed((s) => s + 1);
  };

  return (
    <GameShell
      title="Ecosystem Builder"
      blurb="Follow energy up a food chain with the 10% rule (an approximation)."
      modelNote="The 10% rule is an approximation — real ecosystems vary around it."
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

        <div className="mx-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-background p-3 text-sm">
          {CHAIN.map(([name, emoji], i) => (
            <span key={name} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex items-center gap-1 rounded-lg px-2 py-1',
                  i === q.level && 'bg-primary/10 font-semibold text-primary',
                  i === q.level + 1 && 'bg-accent/10 font-semibold'
                )}
              >
                <span aria-hidden="true">{emoji}</span> {name}
              </span>
              {i < CHAIN.length - 1 && <span className="text-muted-foreground" aria-hidden="true">→</span>}
            </span>
          ))}
        </div>

        <p className="text-center text-lg" aria-live="polite">
          The {hereName.toLowerCase()} {hereEmoji} holds <b>{q.start.toLocaleString('en-IN')} kJ</b> of energy.
          <br />
          About how much reaches the {nextName.toLowerCase()} {nextEmoji}?
        </p>

        <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-3">
          {q.options.map((v) => (
            <button
              key={v}
              className="press min-h-[52px] rounded-xl border border-border bg-background font-semibold hover:border-primary/50"
              onClick={() => choose(v)}
            >
              {v.toLocaleString('en-IN')} kJ
            </button>
          ))}
        </div>

        {feedback && (
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            {feedback}
          </p>
        )}
      </div>
    </GameShell>
  );
}
