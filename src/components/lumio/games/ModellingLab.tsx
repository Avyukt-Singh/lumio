'use client';

import { useState } from 'react';
import { Fence } from 'lucide-react';
import { GameShell, type GameProps } from './GameShell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Modelling Lab: the fencing problem. Fixed perimeter P, slider for one side
 * x; the other side is P/2 − x and the area is A = x(P/2 − x) — a quadratic
 * with its maximum at x = P/4. Find it (within ±0.5 m) in 3 missions -> onWin().
 */

const PERIMETERS = [40, 60, 26];

export function ModellingLabGame(props: GameProps) {
  const [mission, setMission] = useState(0);
  const [x, setX] = useState(6);
  const [result, setResult] = useState<null | { passed: boolean }>(null);
  const [passedCount, setPassedCount] = useState(0);

  const P = PERIMETERS[Math.min(mission, PERIMETERS.length - 1)];
  const half = P / 2;
  const other = half - x;
  const area = x * other;
  const bestX = P / 4;
  const bestArea = bestX * bestX;
  const maxSlider = half - 1;
  // Rectangle visual: scale so the longer side maps to ~260 px.
  const scale = 260 / Math.max(x, other);
  const wPx = Math.max(24, x * scale);
  const hPx = Math.max(24, other * scale);
  const won = passedCount >= 3;

  function submit() {
    const passed = Math.abs(x - bestX) <= 0.5;
    setResult({ passed });
    if (passed) {
      const next = passedCount + 1;
      setPassedCount(next);
      if (next >= 3) props.onWin();
    }
  }

  function nextMission() {
    const nextMissionIndex = mission + 1;
    setMission(nextMissionIndex);
    const nextP = PERIMETERS[Math.min(nextMissionIndex, PERIMETERS.length - 1)];
    setX(nextP / 4);
    setResult(null);
  }

  return (
    <GameShell
      title="Modelling Lab: the fence"
      blurb={`Mission ${Math.min(mission + 1, 3)} of 3: you have ${P} m of fence for a rectangular field. One side is x, the other is ${half} − x, so the area is x(${half} − x) — a quadratic. Find the x that maximises it.`}
      modelNote="Area is a quadratic in x: A = x(P/2 − x), a downward parabola whose maximum sits exactly at x = P/4 (a square field)."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Fence className="size-4" aria-hidden="true" /> Design the rectangle
          </h3>
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span>
              Side x: <b className="text-base">{x} m</b>
              <span className="ml-2 text-muted-foreground">
                (other side {other} m · area <b className={cn(result?.passed && 'text-emerald-600')}>{area} m²</b>)
              </span>
            </span>
            <input
              type="range"
              min={1}
              max={maxSlider}
              step={0.5}
              value={Math.min(x, maxSlider)}
              onChange={(e) => {
                setX(Number(e.target.value));
                setResult(null);
              }}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Side x in metres, currently ${x} metres`}
            />
          </label>
          <div className="flex justify-center py-2">
            <div
              className="rounded-lg border-2 border-emerald-600 bg-emerald-500/15 transition-all duration-200"
              style={{ width: `${wPx}px`, height: `${hPx}px` }}
              role="img"
              aria-label={`Rectangle ${x} metres by ${other} metres, area ${area} square metres`}
            />
          </div>
          <div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                style={{ width: `${Math.min(100, (area / (half * half)) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Area vs the largest possible ({Math.round(bestArea)} m² for P = {P})
            </p>
          </div>
          <Button className="press min-h-[44px]" onClick={submit} disabled={result?.passed ?? false}>
            Submit this x
          </Button>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="text-sm font-bold">Mission report</h3>
          <p role="status" aria-live="polite" className="text-sm font-semibold">
            {result === null ? (
              <span className="text-muted-foreground">
                Move the slider, watch the area, then submit the x you think is best.
              </span>
            ) : result.passed ? (
              <span className="text-emerald-600">
                Mission passed! You chose x = {x} m. The maximum of A = x({half} − x) is at x = {half}/2 = {bestX} m,
                giving {bestArea} m² — a square field.
              </span>
            ) : (
              <span className="text-amber-600">
                x = {x} m gives {area} m². Better is possible: the quadratic peaks at x = {bestX} m (area {bestArea} m²).
                Adjust and submit again.
              </span>
            )}
          </p>
          {result?.passed && passedCount < 3 && (
            <Button variant="outline" className="press min-h-[44px] self-start" onClick={nextMission}>
              Next mission (P = {PERIMETERS[Math.min(mission + 1, PERIMETERS.length - 1)]} m)
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            {PERIMETERS.map((p, i) => (
              <span
                key={p}
                className={cn(
                  'inline-flex min-h-[32px] items-center rounded-full px-3 text-xs font-semibold',
                  i < passedCount ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
                )}
              >
                {i < passedCount ? '✓' : '•'} P = {p} m
              </span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Missions passed: {passedCount}/3</p>
          {won && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
              Three missions passed — you turned a fence into a quadratic and found its maximum!
            </p>
          )}
        </div>
      </div>
    </GameShell>
  );
}
