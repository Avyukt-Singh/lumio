'use client';

import { useState } from 'react';
import { GameShell, type GameProps } from './GameShell';
import { SPELL_WORDS } from '@/lib/lumio/content';
import { cn } from '@/lib/utils';

function optionsFor(i: number, rnd: () => number): string[] {
  const [word, wrongs] = [SPELL_WORDS[i][1], SPELL_WORDS[i][2]];
  return [word, ...wrongs].sort(() => rnd() - 0.5);
}

/** Spell the Word (xp 20): pick the right spelling for each picture; 5 in a row wins. */
export function SpellWordGame({ won, onWin, onBack }: GameProps) {
  const [seed, setSeed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [pick, setPick] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const best = 5;

  const rnd = () => {
    const x = Math.sin(seed * 7717 + pick * 104729 + streak * 15485863) * 43758.5453;
    return x - Math.floor(x);
  };
  const idx = Math.floor(rnd() * SPELL_WORDS.length);
  const [emoji, word] = SPELL_WORDS[idx];
  const options = optionsFor(idx, rnd);

  const choose = (opt: string) => {
    if (opt === word) {
      const next = streak + 1;
      setStreak(next);
      setFeedback(null);
      setPick((p) => p + 1);
      if (next >= best) onWin();
    } else {
      setStreak(0);
      setFeedback(`That spelled a different word — it was “${word}”. Try the next one!`);
      setPick((p) => p + 1);
    }
  };

  return (
    <GameShell
      title="Spell the Word"
      blurb="Reading game: pick the right spelling for each picture."
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

        <p className="text-center text-6xl" aria-hidden="true">
          {emoji}
        </p>
        <p className="sr-only">Spell the word shown by this picture.</p>

        <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
          {options.map((opt) => (
            <button
              key={opt}
              className="press min-h-[52px] rounded-xl border border-border bg-background text-lg font-semibold hover:border-primary/50"
              onClick={() => choose(opt)}
            >
              {opt}
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
