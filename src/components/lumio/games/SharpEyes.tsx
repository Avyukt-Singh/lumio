'use client';

import { useEffect, useRef, useState } from 'react';
import { GameShell, type GameProps } from './GameShell';

interface Round {
  prompt: string;
  options: string[];
  answer: number;
}

const ROUNDS: Round[] = [
  { prompt: 'Spot the odd one out', options: ['🍎', '🍌', '🚗', '🍇'], answer: 2 },
  { prompt: 'Spot the odd one out', options: ['🐶', '🐸', '🌸', '🐘'], answer: 2 },
  { prompt: 'Spot the odd one out', options: ['🌞', '⭐', '☁️', '🌙'], answer: 2 },
  { prompt: 'Spot the odd one out', options: ['🚲', '🛵', '🛴', '🐢'], answer: 3 },
  { prompt: 'Spot the odd one out', options: ['✏️', '🖊️', '📚', '🖍️'], answer: 2 },
  { prompt: 'Finish the pattern: 2 4 6 ?', options: ['6', '7', '8', '9'], answer: 2 },
  { prompt: 'Finish the pattern: 🔴 🔵 🔴 🔵 …', options: ['🔴', '🔵', '🟢', '🟡'], answer: 0 },
  { prompt: 'Finish the pattern: 10 12 14 ?', options: ['10', '12', '14', '16'], answer: 3 },
  { prompt: 'Spot the odd one out', options: ['🍫', '🍭', '🧱', '🍬'], answer: 2 },
  { prompt: 'Finish the pattern: 5 10 15 …', options: ['18', '20', '22', '25'], answer: 1 },
];

const TOTAL = 8;
const WIN_AT = 6;

function pick8(): Round[] {
  return [...ROUNDS].sort(() => Math.random() - 0.5).slice(0, TOTAL);
}

/** Sharp Eyes (xp 20): observation puzzles — odd one out and patterns. */
export function SharpEyesGame({ won, onWin, onBack }: GameProps) {
  const [rounds, setRounds] = useState<Round[]>(pick8);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const done = step >= TOTAL;

  const restart = () => {
    if (timer.current) clearTimeout(timer.current);
    setRounds(pick8());
    setStep(0);
    setScore(0);
    setFeedback(null);
  };

  const choose = (i: number) => {
    if (feedback || done) return;
    const r = rounds[step];
    const isRight = i === r.answer;
    const newScore = score + (isRight ? 1 : 0);
    setScore(newScore);
    setFeedback(isRight ? 'Yes — sharp eyes!' : `It was “${r.options[r.answer]}”.`);
    timer.current = setTimeout(() => {
      setFeedback(null);
      if (step + 1 >= TOTAL) {
        if (newScore >= WIN_AT) onWin();
      }
      setStep((st) => st + 1);
    }, 900);
  };

  return (
    <GameShell
      title="Sharp Eyes"
      blurb="Observation puzzles: spot the odd one out and finish the pattern."
      xp={20}
      won={won}
      onBack={onBack}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          {done
            ? `Round finished — you spotted ${score} of ${TOTAL}. ${score >= WIN_AT ? 'Sharp eyes indeed!' : 'Look closely and try again.'}`
            : `Round ${step + 1} of ${TOTAL} · Score ${score} · reach ${WIN_AT} to win`}
        </p>
        {!done && (
          <>
            <p className="text-center text-lg font-semibold" aria-live="polite">
              {rounds[step].prompt}
            </p>
            <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3 sm:grid-cols-4">
              {rounds[step].options.map((opt, i) => (
                <button
                  key={`${step}-${i}`}
                  className="press flex min-h-[72px] items-center justify-center rounded-xl border border-border bg-background text-3xl hover:border-primary/50"
                  onClick={() => choose(i)}
                  aria-label={`Option ${i + 1}: ${opt}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </>
        )}
        {feedback && (
          <p className="text-center text-sm font-medium" aria-live="polite">
            {feedback}
          </p>
        )}
        {done && (
          <button
            className="press mx-auto min-h-[44px] rounded-xl border border-border px-4 text-sm font-medium hover:bg-accent/10"
            onClick={restart}
          >
            Play again
          </button>
        )}
      </div>
    </GameShell>
  );
}
