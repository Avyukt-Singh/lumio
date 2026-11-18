'use client';

import { useMemo, useState } from 'react';
import { Rocket, RotateCcw, CheckCircle2 } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Projectile Playground: angle, speed, launch height and an optional linear
 * drag force. Numerical integration (semi-implicit Euler, dt = 0.01) drives
 * every readout, so with drag off the numeric shot can be compared directly
 * against the thin analytic reference parabola. Three challenges leave
 * permanent checkmarks; all three -> onWin().
 */

const G = 9.8;
const DT = 0.01;

interface SimResult {
  pts: Array<{ x: number; y: number }>;
  range: number;
  maxH: number;
  tof: number;
}

/** Semi-implicit Euler with linear drag F = -k*v (mass 1 kg). */
function simulate(angle: number, speed: number, height: number, k: number): SimResult {
  const rad = (angle * Math.PI) / 180;
  let x = 0;
  let y = height;
  let vx = speed * Math.cos(rad);
  let vy = speed * Math.sin(rad);
  let maxH = height;
  let t = 0;
  const pts: Array<{ x: number; y: number }> = [{ x: 0, y: height }];
  let steps = 0;
  while (y >= 0 && steps < 40000) {
    const px = x;
    const py = y;
    const ax = -k * vx;
    const ay = -G - k * vy;
    vx += ax * DT;
    vy += ay * DT;
    x += vx * DT;
    y += vy * DT;
    t += DT;
    if (y > maxH) maxH = y;
    if (steps % 4 === 0) pts.push({ x, y });
    if (y < 0) {
      // interpolate the landing point between the last two samples
      const f = py / (py - y);
      const xLand = px + (x - px) * f;
      pts.push({ x: xLand, y: 0 });
      return { pts, range: Math.max(0, xLand), maxH: Math.max(0, maxH), tof: t - DT + DT * f };
    }
    steps++;
  }
  return { pts, range: Math.max(0, x), maxH: Math.max(0, maxH), tof: t };
}

/** Exact no-drag trajectory (thin reference curve). */
function analyticPath(angle: number, speed: number, height: number, toX: (m: number) => number, toY: (m: number) => number): string {
  const rad = (angle * Math.PI) / 180;
  const vx = speed * Math.cos(rad);
  const vy = speed * Math.sin(rad);
  const tf = (vy + Math.sqrt(vy * vy + 2 * G * height)) / G;
  const n = 60;
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (tf * i) / n;
    out.push(`${toX(vx * t).toFixed(1)},${toY(Math.max(0, height + vy * t - 0.5 * G * t * t)).toFixed(1)}`);
  }
  return out.join(' ');
}

function randTarget(min: number, max: number, prev?: number): number {
  let t = prev ?? -1;
  do {
    t = min + Math.floor(Math.random() * (max - min + 1));
  } while (prev !== undefined && Math.abs(t - prev) < 10);
  return t;
}

interface LaunchRow {
  angle: number;
  speed: number;
  height: number;
  k: number;
  range: number;
  maxH: number;
  tof: number;
}

export function ProjectilePlaygroundLab(props: GameProps) {
  const [angle, setAngle] = useState(45);
  const [speed, setSpeed] = useState(25);
  const [height, setHeight] = useState(0);
  const [dragOn, setDragOn] = useState(false);
  const [dragK, setDragK] = useState(0.2);

  // Challenges
  const [ch1Target, setCh1Target] = useState(() => randTarget(20, 100));
  const [ch1Done, setCh1Done] = useState(false);
  const [refAngle, setRefAngle] = useState(() => 25 + Math.floor(Math.random() * 41));
  const [refRange, setRefRange] = useState<number | null>(null);
  const [refSpeed, setRefSpeed] = useState<number | null>(null);
  const [ch2Done, setCh2Done] = useState(false);
  const [ch2Note, setCh2Note] = useState('');
  const [ch3Target, setCh3Target] = useState(() => randTarget(10, 50));
  const [ch3Done, setCh3Done] = useState(false);

  const [current, setCurrent] = useState<SimResult | null>(null);
  const [ghost, setGhost] = useState<SimResult | null>(null);
  const [rows, setRows] = useState<LaunchRow[]>([]);
  const [msg, setMsg] = useState('');

  // Live simulation of the current slider settings (derived, above effects).
  const k = dragOn ? dragK : 0;
  const sim = useMemo(() => simulate(angle, speed, height, k), [angle, speed, height, k]);

  // SVG world scale derived from everything currently drawn.
  const worldX = Math.max(sim.range, current?.range ?? 0, ghost?.range ?? 0, ch1Target, ch3Target, 30) + 8;
  const worldY = Math.max(sim.maxH, current?.maxH ?? 0, ghost?.maxH ?? 0, 8) + 3;
  const toX = (m: number) => 40 + (m / worldX) * 500;
  const toY = (m: number) => 240 - (m / worldY) * 220;

  const ptsToPolyline = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p) => `${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`).join(' ');

  const analytic = !dragOn ? analyticPath(angle, speed, height, toX, toY) : '';

  const doneCount = [ch1Done, ch2Done, ch3Done].filter(Boolean).length;

  function record(row: LaunchRow) {
    setRows((r) => [...r, row]);
  }

  function launch() {
    const res = simulate(angle, speed, height, k);
    setGhost(current);
    setCurrent(res);
    record({ angle, speed, height, k, range: res.range, maxH: res.maxH, tof: res.tof });
    const d1 = ch1Done ? Infinity : Math.abs(res.range - ch1Target);
    const d2 =
      ch2Done || refRange === null || refSpeed === null
        ? Infinity
        : dragOn || height !== 0 || speed !== refSpeed
          ? Infinity
          : Math.abs(res.range - refRange);
    const d3 = ch3Done ? Infinity : !dragOn || dragK < 0.2 ? Infinity : Math.abs(res.range - ch3Target);

    if (d1 <= 2) setCh1Done(true);
    if (d2 <= 1.5) {
      setCh2Done(true);
      setCh2Note(
        `Range is R = (v² sin 2θ)/g at height 0. ${angle}° and ${90 - angle}° give the same sin 2θ, so the two shots land together.`
      );
    }
    if (d3 <= 2) setCh3Done(true);

    if (d1 <= 2 || d2 <= 1.5 || d3 <= 2) {
      const parts: string[] = [];
      if (d1 <= 2) parts.push(`Challenge 1: landed ${res.range.toFixed(1)} m, within 2 m of the ${ch1Target} m target.`);
      if (d2 <= 1.5) parts.push('Challenge 2: range matched the reference launch — complementary angles share a range.');
      if (d3 <= 2) parts.push(`Challenge 3: drag shot landed ${res.range.toFixed(1)} m near the ${ch3Target} m target.`);
      setMsg(parts.join(' '));
      if ([ch1Done || d1 <= 2, ch2Done || d2 <= 1.5, ch3Done || d3 <= 2].every(Boolean)) props.onWin();
    } else {
      setMsg(
        `Landed at ${res.range.toFixed(1)} m. No challenge hit this time — check which challenge is active and adjust.`
      );
    }
  }

  function launchReference() {
    const res = simulate(refAngle, speed, 0, 0);
    setGhost(current);
    setCurrent(res);
    setRefRange(res.range);
    setRefSpeed(speed);
    record({ angle: refAngle, speed, height: 0, k: 0, range: res.range, maxH: res.maxH, tof: res.tof });
    setCh2Note(
      `Reference launch at ${refAngle}° landed at ${res.range.toFixed(1)} m (dashed ghost). Now find a different angle with the same speed, drag off and height 0, that lands within 1.5 m of it.`
    );
    setMsg('');
  }

  function resetChallenges() {
    setCh1Done(false);
    setCh2Done(false);
    setCh3Done(false);
    setCh1Target(randTarget(20, 100));
    setCh3Target(randTarget(10, 50));
    setRefAngle(25 + Math.floor(Math.random() * 41));
    setRefRange(null);
    setRefSpeed(null);
    setCh2Note('');
    setMsg('');
  }

  return (
    <GameShell
      title="Projectile Playground"
      blurb="Angle, speed, launch height and optional air drag — all simulated numerically so you can compare the real trajectory with the textbook parabola."
      modelNote="Semi-implicit Euler integration at dt = 0.01 s, mass 1 kg, g = 9.8 m/s², drag force F = −k·v. With drag off, a thin reference curve shows the exact analytic parabola R = v² sin 2θ/g (valid at height 0)."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <PredictFirst
            prompt="What happens to the range if the angle goes from 45 to 60 degrees at the same speed?"
            options={[
              { label: 'It increases' },
              { label: 'It decreases', correct: true },
              { label: 'It stays the same' },
            ]}
            explain="Range peaks at 45° because sin 2θ is largest at 90°. Moving from 45° to 60° lowers sin 2θ from 1 to 0.866, so the shot lands closer (with drag off and height 0)."
          />
          <PredictFirst
            prompt="Turn drag on: how will the range compare with the same launch with drag off?"
            options={[
              { label: 'Shorter', correct: true },
              { label: 'Longer' },
              { label: 'Identical' },
            ]}
            explain="Drag always pushes opposite the velocity, so it steals speed the whole flight — the range and max height both drop below the no-drag parabola."
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Rocket className="size-4" aria-hidden="true" /> Launch controls
            </h3>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Launch angle: <b className="tabular-nums">{angle}&deg;</b>
              </span>
              <input
                type="range"
                min={5}
                max={85}
                step={1}
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Launch angle, currently ${angle} degrees`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Launch speed: <b className="tabular-nums">{speed} m/s</b>
              </span>
              <input
                type="range"
                min={5}
                max={60}
                step={1}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Launch speed, currently ${speed} metres per second`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Launch height: <b className="tabular-nums">{height} m</b>
              </span>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Launch height, currently ${height} metres`}
              />
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={dragOn}
                  onChange={(e) => setDragOn(e.target.checked)}
                  className="size-5 accent-primary"
                  aria-label="Enable air resistance"
                />
                Air resistance on
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                <span>
                  Drag coefficient k: <b className="tabular-nums">{dragK.toFixed(2)}</b> (0 = off)
                </span>
                <input
                  type="range"
                  min={0}
                  max={0.5}
                  step={0.05}
                  value={dragK}
                  onChange={(e) => setDragK(Number(e.target.value))}
                  disabled={!dragOn}
                  className="press min-h-[44px] w-full accent-primary disabled:opacity-50"
                  aria-label={`Drag coefficient, currently ${dragK.toFixed(2)}`}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button className="press min-h-[44px]" onClick={launch}>
                <Rocket className="size-4" aria-hidden="true" /> Launch
              </Button>
              <Button variant="outline" className="press min-h-[44px]" onClick={launchReference}>
                Launch reference angle ({refAngle}&deg;)
              </Button>
              <Button variant="ghost" className="press min-h-[44px]" onClick={resetChallenges}>
                <RotateCcw className="size-4" aria-hidden="true" /> Reset challenges
              </Button>
            </div>

            <p
              role="status"
              aria-live="polite"
              className={cn('text-sm font-semibold', msg.startsWith('Challenge') ? 'text-emerald-600' : 'text-amber-600')}
            >
              {msg || 'Set the sliders, then launch to record a shot and try the challenges.'}
            </p>

            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Range (sim)</p>
                <p className="text-lg font-bold tabular-nums">{sim.range.toFixed(1)} m</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Max height</p>
                <p className="text-lg font-bold tabular-nums">{sim.maxH.toFixed(1)} m</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Flight time</p>
                <p className="text-lg font-bold tabular-nums">{sim.tof.toFixed(2)} s</p>
              </div>
            </div>
            {ch2Note && (
              <p role="status" aria-live="polite" className={cn('text-sm', ch2Done ? 'text-emerald-600' : 'text-muted-foreground')}>
                {ch2Note}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
            <svg
              viewBox="0 0 560 262"
              className="w-full"
              role="img"
              aria-label={`Trajectory view: live shot, previous launch as ghost, challenge targets at ${ch1Target} and ${ch3Target} metres`}
            >
              <rect x="0" y="240" width="560" height="14" className="fill-border" />
              {/* Challenge 1 target band */}
              <rect
                x={toX(Math.max(0, ch1Target - 2)).toFixed(0)}
                y="234"
                width={(4 / worldX) * 500}
                height="6"
                className={ch1Done ? 'fill-emerald-600' : 'fill-emerald-500/50'}
              />
              <text x={toX(ch1Target).toFixed(0)} y="228" textAnchor="middle" fontSize="11" className="fill-emerald-600">
                C1: {ch1Target} m
              </text>
              {/* Challenge 3 target band */}
              <rect
                x={toX(Math.max(0, ch3Target - 2)).toFixed(0)}
                y="228"
                width={(4 / worldX) * 500}
                height="6"
                className={ch3Done ? 'fill-orange-600' : 'fill-orange-500/50'}
              />
              <text x={toX(ch3Target).toFixed(0)} y="222" textAnchor="middle" fontSize="11" className="fill-orange-600">
                C3: {ch3Target} m
              </text>
              {/* Analytic reference parabola (drag off only) */}
              {analytic && <polyline points={analytic} fill="none" className="stroke-sky-400" strokeWidth="1.5" />}
              {/* Ghost = previous launch */}
              {ghost && (
                <polyline
                  points={ptsToPolyline(ghost.pts)}
                  fill="none"
                  className="stroke-muted-foreground"
                  strokeWidth="2"
                  strokeDasharray="6 5"
                />
              )}
              {/* Current live shot */}
              <polyline points={ptsToPolyline(sim.pts)} fill="none" className="stroke-primary" strokeWidth="3" />
              <text x="42" y="256" fontSize="10" className="fill-muted-foreground">
                0 m
              </text>
              <text x="522" y="256" fontSize="10" className="fill-muted-foreground">
                {worldX.toFixed(0)} m
              </text>
            </svg>
            <p className="text-xs text-muted-foreground">
              Solid: live settings. Dashed: previous launch (ghost). Thin blue: exact analytic parabola, shown when drag is
              off. Compare the solid and thin curves to see what dt = 0.01 integration costs.
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Challenges:</span>
              {(['C1', 'C2', 'C3'] as const).map((c, i) => {
                const done = [ch1Done, ch2Done, ch3Done][i];
                return (
                  <span
                    key={c}
                    className={cn(
                      'inline-flex min-h-[32px] items-center gap-1 rounded-full px-2.5 text-xs font-semibold',
                      done ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {done && <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                    {c}
                  </span>
                );
              })}
              <span className="text-sm tabular-nums text-muted-foreground">{doneCount}/3</span>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>
                <b>C1</b> — height above 0, drag off: land within 2 m of the green target ({ch1Target} m).
              </li>
              <li>
                <b>C2</b> — launch the stored reference angle ({refAngle}&deg;), then match its range within 1.5 m using a
                different angle, same speed, drag off, height 0.
              </li>
              <li>
                <b>C3</b> — drag on with k at least 0.2: land within 2 m of the orange target ({ch3Target} m).
              </li>
            </ul>
          </div>
        </div>

        <LabReport
          title="Launch log"
          columns={['Angle (°)', 'Speed (m/s)', 'Height (m)', 'Drag k', 'Range (m)', 'Max height (m)', 'Flight time (s)']}
          rows={rows.map((r) => [r.angle, r.speed, r.height, r.k.toFixed(2), r.range.toFixed(1), r.maxH.toFixed(1), r.tof.toFixed(2)])}
          note="Every launch is recorded, including the reference-angle launch, so you can compare two rows side by side."
        />

        <ChapterRef subject="Physics" chapter="Ch 4 — Motion in a Plane" topic="Projectile motion" />
      </div>
    </GameShell>
  );
}
