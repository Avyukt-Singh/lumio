'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, PauseCircle, PlayCircle, FlaskConical, CheckCircle2 } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * SHM Explorer: spring-mass oscillator and simple pendulum side by side,
 * animated in real time from analytic solutions, with rolling displacement /
 * velocity graphs, spring energy bars, and three claim tests -> onWin().
 */

const G = 9.8;
const WINDOW = 8; // seconds of history shown in the graphs

interface Sample {
  t: number;
  x: number;
  v: number;
}

/** Numeric scan of the model solution: time between two upward zero crossings. */
function measurePeriod(w: number, A: number): number {
  const dt = 0.001;
  let first = -1;
  let xPrev = A * Math.cos(0);
  for (let i = 1; i <= 12000; i++) {
    const xNow = A * Math.cos(w * i * dt);
    if (xPrev < 0 && xNow >= 0) {
      if (first < 0) first = i * dt;
      else return i * dt - first;
    }
    xPrev = xNow;
  }
  return NaN;
}

interface TestRow {
  test: string;
  settingA: string;
  settingB: string;
  result: string;
}

export function ShmExplorerLab(props: GameProps) {
  const [springM, setSpringM] = useState(1);
  const [springK, setSpringK] = useState(40);
  const [springA, setSpringA] = useState(0.5);
  const [pendL, setPendL] = useState(1);
  const [pendA, setPendA] = useState(0.3);
  const [running, setRunning] = useState(true);
  const [frame, setFrame] = useState<{ t: number; sh: Sample[]; ph: Sample[] }>({ t: 0, sh: [], ph: [] });
  const [testsDone, setTestsDone] = useState([false, false, false]);
  const [testResult, setTestResult] = useState<Array<string | null>>([null, null, null]);
  const [rows, setRows] = useState<TestRow[]>([]);

  // Animation accumulators live in refs and are only touched inside effects;
  // each frame publishes an immutable snapshot to `frame` for rendering.
  const simTRef = useRef(0);
  const springHistRef = useRef<Sample[]>([]);
  const pendHistRef = useRef<Sample[]>([]);

  // Derived oscillation quantities (declared above any effect).
  const wS = Math.sqrt(springK / springM);
  const wP = Math.sqrt(G / pendL);
  const t = frame.t;
  const xS = springA * Math.cos(wS * t);
  const vS = -springA * wS * Math.sin(wS * t);
  const thP = pendA * Math.cos(wP * t);
  const KE = 0.5 * springM * vS * vS;
  const PE = 0.5 * springK * xS * xS;
  const ETot = 0.5 * springK * springA * springA;
  const TS = (2 * Math.PI) / wS;
  const TP = (2 * Math.PI) / wP;

  // Real-time animation: advance simulated time, record history, publish frame.
  // Phase and history are reset in the slider handlers (see resetPhase below).
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      simTRef.current += dt;
      const tt = simTRef.current;
      springHistRef.current.push({ t: tt, x: springA * Math.cos(wS * tt), v: -springA * wS * Math.sin(wS * tt) });
      pendHistRef.current.push({ t: tt, x: pendA * Math.cos(wP * tt), v: -pendA * wP * Math.sin(wP * tt) });
      const sh = springHistRef.current;
      const ph = pendHistRef.current;
      while (sh.length > 0 && sh[0].t < tt - WINDOW) sh.shift();
      while (ph.length > 0 && ph[0].t < tt - WINDOW) ph.shift();
      setFrame({ t: tt, sh: [...sh], ph: [...ph] });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, wS, wP, springA, pendA]);

  // Graph polylines (derived each render from the published frame).
  const tStart = Math.max(0, t - WINDOW);
  const gx = (time: number) => 10 + ((time - tStart) / WINDOW) * 460;
  const yDisp = (x: number) => 70 - x * 55;
  const vScale = Math.max(springA * wS, pendA * wP, 0.5) * 1.15;
  const yVel = (v: number) => 70 - (v / vScale) * 55;
  const toLine = (hist: Sample[], mapY: (val: number) => number, key: 'x' | 'v') =>
    hist
      .filter((s) => s.t >= tStart)
      .map((s) => `${gx(s.t).toFixed(1)},${mapY(s[key]).toFixed(1)}`)
      .join(' ');
  const springDispLine = toLine(frame.sh, yDisp, 'x');
  const pendDispLine = toLine(frame.ph, yDisp, 'x');
  const springVelLine = toLine(frame.sh, yVel, 'v');
  const pendVelLine = toLine(frame.ph, yVel, 'v');

  // Spring drawing geometry (wall on the left, mass follows xS).
  const springWallX = 20;
  const massX = springWallX + 150 + xS * 90;
  const coil: string[] = [];
  const coils = 8;
  for (let i = 0; i <= coils * 2; i++) {
    const fx = springWallX + 8 + ((massX - springWallX - 24) * i) / (coils * 2);
    coil.push(`${fx.toFixed(1)},${i % 2 === 0 ? 55 : 85}`);
  }

  // Pendulum drawing geometry (pivot at top centre).
  const bobX = 240 + 100 * Math.sin(thP);
  const bobY = 25 + 100 * Math.cos(thP);

  const doneCount = testsDone.filter(Boolean).length;

  function resetPhase() {
    simTRef.current = 0;
    springHistRef.current = [];
    pendHistRef.current = [];
    setFrame({ t: 0, sh: [], ph: [] });
  }

  function runTest(i: number) {
    let result = '';
    let row: TestRow;
    if (i === 0) {
      const p1 = measurePeriod(wS, 0.3);
      const p2 = measurePeriod(wS, 0.9);
      result = `Measured spring periods with m = ${springM} kg, k = ${springK} N/m: T(A = 0.3) = ${p1.toFixed(3)} s and T(A = 0.9) = ${p2.toFixed(3)} s — identical within the 1 ms scan step. Amplitude does not enter ω = √(k/m).`;
      row = { test: 'Period vs amplitude', settingA: 'A = 0.3', settingB: 'A = 0.9', result: `T = ${p1.toFixed(3)} s in both cases` };
    } else if (i === 1) {
      const w1 = Math.sqrt(springK / 0.2);
      const w2 = Math.sqrt(springK / 0.8);
      const p1 = measurePeriod(w1, 0.5);
      const p2 = measurePeriod(w2, 0.5);
      result = `With k = ${springK} N/m: T(m = 0.2 kg) = ${p1.toFixed(3)} s, T(m = 0.8 kg) = ${p2.toFixed(3)} s. The ratio is ${(p2 / p1).toFixed(2)} ≈ √4 = 2 — quadrupling the mass doubles the period, because T ∝ √m.`;
      row = { test: 'Period vs mass', settingA: 'm = 0.2 kg', settingB: 'm = 0.8 kg', result: `T ratio ≈ ${(p2 / p1).toFixed(2)} (√4 = 2)` };
    } else {
      const w1 = Math.sqrt(G / 0.2);
      const w2 = Math.sqrt(G / 0.8);
      const p1 = measurePeriod(w1, 0.3);
      const p2 = measurePeriod(w2, 0.3);
      result = `Pendulum: T(L = 0.2 m) = ${p1.toFixed(3)} s, T(L = 0.8 m) = ${p2.toFixed(3)} s. The ratio is ${(p2 / p1).toFixed(2)} ≈ √4 = 2, and there is no mass term in ω = √(g/L), so the bob weight never matters.`;
      row = { test: 'Pendulum period vs length', settingA: 'L = 0.2 m', settingB: 'L = 0.8 m', result: `T ratio ≈ ${(p2 / p1).toFixed(2)} (√4 = 2)` };
    }
    setTestResult((r) => {
      const next = [...r];
      next[i] = result;
      return next;
    });
    setRows((old) => [...old, row]);
    setTestsDone((done) => {
      const next = [...done];
      next[i] = true;
      if (next.every(Boolean)) props.onWin();
      return next;
    });
  }

  return (
    <GameShell
      title="SHM Explorer"
      blurb="A spring-mass system and a simple pendulum oscillating live. Watch the KE and PE bars trade energy, then run the claim tests to see what really sets the period."
      modelNote="Ideal SHM: x(t) = A cos(ωt + φ) with ω = √(k/m) for the spring-mass system and ω = √(g/L) for the pendulum under the small-angle approximation (sin θ ≈ θ, reasonable at these amplitudes). No damping or friction; graphs show a rolling 8 s window; energy bars use E = ½kA²."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Activity className="size-4" aria-hidden="true" /> Spring-mass controls
            </h3>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Mass m: <b className="tabular-nums">{springM.toFixed(1)} kg</b>
              </span>
              <input
                type="range"
                min={0.1}
                max={2}
                step={0.1}
                value={springM}
                onChange={(e) => {
                  setSpringM(Number(e.target.value));
                  resetPhase();
                }}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Spring mass, currently ${springM.toFixed(1)} kilograms`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Spring constant k: <b className="tabular-nums">{springK} N/m</b>
              </span>
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={springK}
                onChange={(e) => {
                  setSpringK(Number(e.target.value));
                  resetPhase();
                }}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Spring constant, currently ${springK} newtons per metre`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Amplitude A: <b className="tabular-nums">{springA.toFixed(2)}</b>
              </span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={springA}
                onChange={(e) => setSpringA(Number(e.target.value))}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Spring amplitude, currently ${springA.toFixed(2)}`}
              />
            </label>
            <p className="text-sm tabular-nums text-muted-foreground">
              ω = {wS.toFixed(2)} rad/s · T = {TS.toFixed(3)} s
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Activity className="size-4" aria-hidden="true" /> Pendulum controls
            </h3>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Length L: <b className="tabular-nums">{pendL.toFixed(1)} m</b>
              </span>
              <input
                type="range"
                min={0.2}
                max={2}
                step={0.1}
                value={pendL}
                onChange={(e) => {
                  setPendL(Number(e.target.value));
                  resetPhase();
                }}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Pendulum length, currently ${pendL.toFixed(1)} metres`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Amplitude (radians): <b className="tabular-nums">{pendA.toFixed(2)}</b>
              </span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={pendA}
                onChange={(e) => setPendA(Number(e.target.value))}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Pendulum amplitude, currently ${pendA.toFixed(2)} radians`}
              />
            </label>
            <p className="text-sm tabular-nums text-muted-foreground">
              ω = {wP.toFixed(2)} rad/s · T = {TP.toFixed(3)} s
            </p>
            <Button variant="outline" className="press min-h-[44px] self-start" onClick={() => setRunning((r) => !r)}>
              {running ? (
                <>
                  <PauseCircle className="size-4" aria-hidden="true" /> Pause
                </>
              ) : (
                <>
                  <PlayCircle className="size-4" aria-hidden="true" /> Resume
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
            <svg viewBox="0 0 480 140" className="w-full" role="img" aria-label={`Spring-mass animation, displacement ${xS.toFixed(2)}`}>
              <rect x="4" y="45" width="12" height="50" className="fill-foreground" />
              <polyline points={coil.join(' ')} fill="none" className="stroke-primary" strokeWidth="2.5" />
              <rect x={massX.toFixed(1)} y="50" width="30" height="30" rx="4" className="fill-primary" />
              <text x={massX + 15} y="100" textAnchor="middle" fontSize="11" className="fill-muted-foreground tabular-nums">
                x = {xS.toFixed(2)}
              </text>
            </svg>
          </div>
          <div className="rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
            <svg viewBox="0 0 480 140" className="w-full" role="img" aria-label={`Pendulum animation, angle ${thP.toFixed(2)} radians`}>
              <line x1="240" y1="25" x2={bobX.toFixed(1)} y2={bobY.toFixed(1)} className="stroke-foreground" strokeWidth="2.5" />
              <circle cx="240" cy="25" r="4" className="fill-foreground" />
              <circle cx={bobX.toFixed(1)} cy={bobY.toFixed(1)} r="14" className="fill-amber-500" />
              <text x="452" y="130" textAnchor="end" fontSize="11" className="fill-muted-foreground tabular-nums">
                θ = {thP.toFixed(2)} rad
              </text>
            </svg>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
            <p className="text-sm font-bold">Displacement vs time (rolling {WINDOW} s)</p>
            <svg viewBox="0 0 480 140" className="mt-2 w-full" role="img" aria-label="Displacement history for both oscillators">
              <line x1="10" y1="70" x2="470" y2="70" className="stroke-border" strokeWidth="1" />
              <polyline points={springDispLine} fill="none" className="stroke-sky-500" strokeWidth="2" />
              <polyline points={pendDispLine} fill="none" className="stroke-emerald-500" strokeWidth="2" />
              <text x="12" y="16" fontSize="11" className="fill-sky-600">spring x (m)</text>
              <text x="120" y="16" fontSize="11" className="fill-emerald-600">pendulum θ (rad)</text>
            </svg>
          </div>
          <div className="rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
            <p className="text-sm font-bold">Velocity vs time (rolling {WINDOW} s)</p>
            <svg viewBox="0 0 480 140" className="mt-2 w-full" role="img" aria-label="Velocity history for both oscillators">
              <line x1="10" y1="70" x2="470" y2="70" className="stroke-border" strokeWidth="1" />
              <polyline points={springVelLine} fill="none" className="stroke-sky-500" strokeWidth="2" />
              <polyline points={pendVelLine} fill="none" className="stroke-emerald-500" strokeWidth="2" />
              <text x="12" y="16" fontSize="11" className="fill-sky-600">spring v (m/s)</text>
              <text x="120" y="16" fontSize="11" className="fill-emerald-600">pendulum ω (rad/s)</text>
            </svg>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <p className="text-sm font-bold">Spring energy bars (E = ½kA² = {ETot.toFixed(2)} J)</p>
          <div className="mt-2 flex flex-col gap-2">
            {(
              [
                { label: 'Kinetic ½mv²', val: KE, cls: 'bg-sky-500' },
                { label: 'Potential ½kx²', val: PE, cls: 'bg-violet-500' },
                { label: 'Total E', val: ETot, cls: 'bg-emerald-500' },
              ] as const
            ).map((bar) => (
              <div key={bar.label} className="flex items-center gap-2 text-sm">
                <span className="w-36 shrink-0">{bar.label}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-none', bar.cls)}
                    style={{ width: `${ETot > 0 ? Math.min(100, (bar.val / ETot) * 100) : 0}%` }}
                  />
                </div>
                <span className="w-20 text-right tabular-nums">{bar.val.toFixed(2)} J</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            At the extremes all energy is potential; at the equilibrium point it is all kinetic. The total bar never moves —
            that is conservation of mechanical energy in an ideal oscillator.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <FlaskConical className="size-4" aria-hidden="true" /> Claim tests — predict, then run
          </p>
          {(
            [
              {
                prompt: 'If you double the amplitude of the spring, what happens to the period?',
                options: [{ label: 'It doubles' }, { label: 'It stays the same', correct: true }, { label: 'It halves' }],
                explain: 'In ideal SHM the period is set by m and k only; A appears in neither ω = √(k/m) nor T = 2π√(m/k).',
                run: 'Run the amplitude test (A = 0.3 vs A = 0.9)',
              },
              {
                prompt: 'If you quadruple the mass on the same spring, the period will…',
                options: [{ label: 'Double', correct: true }, { label: 'Stay the same' }, { label: 'Quadruple' }],
                explain: 'T = 2π√(m/k), so four times the mass gives √4 = 2 times the period.',
                run: 'Run the mass test (m = 0.2 kg vs m = 0.8 kg)',
              },
              {
                prompt: 'Swap a heavy bob for a light one at the same pendulum length: the period…',
                options: [{ label: 'Gets longer' }, { label: 'Gets shorter' }, { label: 'Stays the same', correct: true }],
                explain: 'T = 2π√(L/g) contains no mass at all — length and g set the pendulum period.',
                run: 'Run the pendulum test (L = 0.2 m vs L = 0.8 m)',
              },
            ] as const
          ).map((card, i) => (
            <div key={card.prompt} className="rounded-2xl border border-border bg-background/50 p-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Claim test {i + 1}</span>
                {testsDone[i] && <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />}
              </div>
              <PredictFirst
                key={`predict-${i}`}
                prompt={card.prompt}
                options={card.options.map((o) => ({ label: o.label, correct: 'correct' in o ? o.correct : undefined }))}
                explain={card.explain}
                className="mt-3"
              />
              <Button
                className="press mt-3 min-h-[44px]"
                variant={testsDone[i] ? 'outline' : 'default'}
                onClick={() => runTest(i)}
              >
                {card.run}
              </Button>
              {testResult[i] && (
                <p role="status" aria-live="polite" className="mt-2 rounded-xl bg-emerald-500/10 p-3 text-sm font-medium text-emerald-600 tabular-nums">
                  {testResult[i]}
                </p>
              )}
            </div>
          ))}
          <p className="text-sm tabular-nums text-muted-foreground">{doneCount}/3 claim tests run</p>
        </div>

        <LabReport
          title="Claim-test log"
          columns={['Test', 'Setting A', 'Setting B', 'Result']}
          rows={rows.map((r) => [r.test, r.settingA, r.settingB, r.result])}
          note="Periods are measured numerically from the model solution as the time between two upward zero crossings, accurate to about 1 ms."
        />

        <ChapterRef subject="Physics" chapter="Ch 14 — Oscillations" topic="SHM: spring-mass and simple pendulum" />
      </div>
    </GameShell>
  );
}
