'use client';

import { useState } from 'react';
import { GameShell, type GameProps } from './GameShell';
import { cn } from '@/lib/utils';

const TARGETS = [1.5, 2.0, 2.5];
const G = 9.8;

/** Pendulum Lab (xp 25): set the string length so the swing takes the target time. */
export function PendulumLabGame({ won, onWin, onBack }: GameProps) {
  const [length, setLength] = useState(1.0);
  const [mission, setMission] = useState(0);
  const [passed, setPassed] = useState<number[]>([]);
  const [result, setResult] = useState<string | null>(null);

  const period = 2 * Math.PI * Math.sqrt(length / G);
  const target = TARGETS[mission % TARGETS.length];
  const ok = Math.abs(period - target) <= 0.05;

  const fly = () => {
    if (ok) {
      const np = passed.includes(mission) ? passed : [...passed, mission];
      setPassed(np);
      setResult(
        `Swing time ${period.toFixed(2)} s — within 0.05 s of ${target.toFixed(1)} s. Mission passed!`
      );
      if (np.length >= 3) onWin();
      setTimeout(() => {
        setMission((m) => m + 1);
        setResult(null);
      }, 1400);
    } else {
      const dir = period < target ? 'longer' : 'shorter';
      setResult(
        `Swing time ${period.toFixed(2)} s — the target is ${target.toFixed(1)} s. Try a ${dir} string.`
      );
    }
  };

  return (
    <GameShell
      title="Pendulum Lab"
      blurb="Change the string length and discover how it affects the time of a swing."
      modelNote="Simplified physics: small swings, no air resistance, string mass ignored. T = 2π√(L/g)."
      xp={25}
      won={won}
      onBack={onBack}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          Missions passed: <b>{passed.length} of 3</b> — set the length so one swing takes about{' '}
          <b>{target.toFixed(1)} s</b> (within 0.05 s).
        </p>

        <div className="flex flex-col items-center gap-2">
          {/* Simple pendulum visual: the string length maps to the rod height */}
          <div className="relative h-40 w-24" aria-hidden="true">
            <div className="absolute left-1/2 top-0 h-6 w-1 -translate-x-1/2 rounded bg-muted-foreground/40" />
            <div
              className="absolute left-1/2 top-6 w-0.5 -translate-x-1/2 rounded bg-muted-foreground"
              style={{ height: `${Math.max(24, Math.min(120, length * 60))}px` }}
            />
            <div
              className="absolute left-1/2 size-6 -translate-x-1/2 rounded-full bg-primary"
              style={{ top: `calc(24px + ${Math.max(24, Math.min(120, length * 60))}px)` }}
            />
          </div>

          <label className="flex w-full max-w-sm flex-col gap-1 text-sm font-medium">
            String length: {length.toFixed(2)} m
            <input
              type="range"
              min={0.5}
              max={2.5}
              step={0.01}
              value={length}
              onChange={(e) => {
                setLength(Number(e.target.value));
                setResult(null);
              }}
              className="h-6 accent-[var(--primary)]"
              aria-label="String length in metres"
            />
          </label>

          <p className="text-center text-lg" aria-live="polite">
            One swing takes about <b>{period.toFixed(2)} s</b>
          </p>
        </div>

        <button
          className="press mx-auto min-h-[44px] rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90"
          onClick={fly}
        >
          Submit this length
        </button>

        {result && (
          <p className={cn('text-center text-sm font-medium', ok ? 'text-emerald-600' : 'text-muted-foreground')} aria-live="polite">
            {result}
          </p>
        )}
      </div>
    </GameShell>
  );
}
