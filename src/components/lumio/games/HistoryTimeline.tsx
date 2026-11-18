'use client';

import { useEffect, useRef, useState } from 'react';
import { GameShell, type GameProps } from './GameShell';
import { cn } from '@/lib/utils';

interface Ev {
  name: string;
  year: number; // negative = BCE, used only for ordering
  label: string; // shown honestly after ordering
}

const EVENTS: Ev[] = [
  { name: 'Indus Valley Civilisation', year: -2500, label: 'about 2500 BCE' },
  { name: 'Reign of Emperor Ashoka', year: -268, label: 'about 268 BCE' },
  { name: 'Gupta era begins', year: 320, label: 'about 320 CE' },
  { name: 'Bhakti movement spreads', year: 800, label: 'about 7th–12th century' },
  { name: 'Mughal empire founded', year: 1526, label: '1526' },
  { name: 'Battle of Plassey', year: 1757, label: '1757' },
  { name: 'Revolt of 1857', year: 1857, label: '1857' },
  { name: 'Indian National Congress founded', year: 1885, label: '1885' },
  { name: 'Independence', year: 1947, label: '1947' },
  { name: 'Republic of India', year: 1950, label: '1950' },
];

function pickFour(seed: number): Ev[] {
  const pool = [...EVENTS];
  const out: Ev[] = [];
  let s = seed;
  for (let i = 0; i < 4; i++) {
    s = (s * 31 + 17) % 9973;
    out.push(pool.splice(s % pool.length, 1)[0]);
  }
  return out;
}

const ROUNDS = 3;

/** History Timeline (xp 20): order Indian-history events by clicking them in order. */
export function HistoryTimelineGame({ won, onWin, onBack }: GameProps) {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 500) + 1);
  const [round, setRound] = useState(0);
  const [order, setOrder] = useState<number[]>([]); // indexes into current four
  const [wrongFlash, setWrongFlash] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const four = pickFour(seed);
  const sortedIdx = [0, 1, 2, 3].sort((a, b) => four[a].year - four[b].year);
  const nextNeeded = sortedIdx[order.length];

  const click = (i: number) => {
    if (order.includes(i) || finished) return;
    if (i === nextNeeded) {
      const no = [...order, i];
      setOrder(no);
      if (no.length === 4) {
        timer.current = setTimeout(() => {
          if (round + 1 >= ROUNDS) {
            setFinished(true);
            onWin();
          } else {
            setRound((r) => r + 1);
            setSeed((s) => s + 13);
            setOrder([]);
          }
        }, 1200);
      }
    } else {
      setWrongFlash(i);
      timer.current = setTimeout(() => setWrongFlash(null), 800);
    }
  };

  const restart = () => {
    if (timer.current) clearTimeout(timer.current);
    setRound(0);
    setOrder([]);
    setFinished(false);
    setSeed(Math.floor(Math.random() * 500) + 1);
  };

  return (
    <GameShell
      title="History Timeline"
      blurb="Order key events of Indian history: click them from oldest to newest."
      modelNote="Dates are approximate, and shown with each event after you order it."
      xp={20}
      won={won}
      onBack={onBack}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted-foreground">
          {finished
            ? 'All three rounds ordered correctly — the timeline is yours!'
            : `Round ${round + 1} of ${ROUNDS} · next oldest event: ${order.length + 1} of 4`}
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {four.map((ev, i) => {
            const picked = order.includes(i);
            const slot = picked ? order.indexOf(i) + 1 : null;
            return (
              <button
                key={`${round}-${i}`}
                className={cn(
                  'press flex min-h-[56px] items-center justify-between gap-3 rounded-xl border px-4 py-2 text-left font-medium',
                  picked
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : wrongFlash === i
                      ? 'border-destructive/50 bg-destructive/10'
                      : 'border-border bg-background hover:border-primary/50'
                )}
                onClick={() => click(i)}
                disabled={picked}
                aria-label={
                  slot
                    ? `${ev.name}, placed ${slot} of 4, ${ev.label}`
                    : `Event: ${ev.name}`
                }
              >
                <span>{ev.name}</span>
                {slot ? (
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                    {slot} · {ev.label}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">approx. date hidden</span>
                )}
              </button>
            );
          })}
        </div>

        {wrongFlash !== null && (
          <p className="text-center text-sm text-muted-foreground" aria-live="polite">
            Not that one — think about which came first.
          </p>
        )}
        {finished && (
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
