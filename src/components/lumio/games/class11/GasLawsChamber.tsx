'use client';

import { MoveHorizontal, Thermometer, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { cn } from '@/lib/utils';

/**
 * Gas Laws Chamber: piston-cylinder with ~40 animated particles. Three law
 * modes (Boyle / Charles / Gay-Lussac) pin one variable, let you drive a
 * second with a slider and compute the third from P V = n R T with n = 1 mol.
 * A live SVG graph shows the predicted curve with the current state as a
 * moving point. Win: 3 PredictFirst scenarios answered correctly.
 */

const R = 8.314; // kPa·L/(mol·K) — keeps kPa, L, K unit-consistent with n = 1
const N_MOL = 1;

type Law = 'Boyle' | 'Charles' | 'Gay-Lussac';
type Changed = 'V' | 'T' | 'P';

const LAWS: Law[] = ['Boyle', 'Charles', 'Gay-Lussac'];

const LAW_INFO: Record<Law, { pinned: string; changed: string; computed: string; caption: string }> = {
  Boyle: { pinned: 'T fixed', changed: 'V', computed: 'P', caption: 'isotherm (fixed T)' },
  Charles: { pinned: 'P fixed', changed: 'T', computed: 'V', caption: 'isobar (fixed P)' },
  'Gay-Lussac': { pinned: 'V fixed', changed: 'T', computed: 'P', caption: 'isochore (fixed V)' },
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function fmtVal(changed: Changed, x: number): string {
  if (changed === 'V') return `${x.toFixed(1)} L`;
  if (changed === 'T') return `${x.toFixed(0)} K`;
  return `${x.toFixed(1)} kPa`;
}

interface Particle {
  x: number; // relative 0..1 across the gas width
  y: number; // relative 0..1 across the gas height
  vx: number;
  vy: number;
}

function makeParticles(): Particle[] {
  return Array.from({ length: 40 }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (0.2 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1),
    vy: (0.2 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1),
  }));
}

function bounce(p: Particle, speed: number, dt: number): Particle {
  let x = p.x + p.vx * dt * speed;
  let y = p.y + p.vy * dt * speed;
  let vx = p.vx;
  let vy = p.vy;
  if (x <= 0) {
    x = 0;
    vx = Math.abs(vx);
  }
  if (x >= 1) {
    x = 1;
    vx = -Math.abs(vx);
  }
  if (y <= 0) {
    y = 0;
    vy = Math.abs(vy);
  }
  if (y >= 1) {
    y = 1;
    vy = -Math.abs(vy);
  }
  return { x, y, vx, vy };
}

export function GasLawsChamberLab(props: GameProps) {
  const [law, setLaw] = useState<Law>('Boyle');
  const [V, setV] = useState(20);
  const [T, setT] = useState(300);
  const [P, setP] = useState(124.7);
  const [rows, setRows] = useState<(string | number)[][]>([]);
  const [answers, setAnswers] = useState<(boolean | null)[]>([null, null, null]);
  const [predKey, setPredKey] = useState(0);
  const [particles, setParticles] = useState<Particle[]>(makeParticles);

  const beforeRef = useRef<number | null>(null);

  // Derived values — declared above the rAF effect (anti-TDZ rule).
  const particleSpeed = Math.sqrt(T / 300);
  const drawnV = clamp(V, 4, 44);
  const gasH = 45 + ((drawnV - 5) / 35) * 175;
  const pistonY = 270 - gasH;
  const tempHue = Math.round(220 - ((clamp(T, 150, 600) - 150) / 450) * 220);
  const gx = law === 'Boyle' ? { min: 5, max: 40, label: 'V (L)' } : { min: 150, max: 600, label: 'T (K)' };
  const gyMax = law === 'Charles' ? 105 : 1000;
  const gyLabel = law === 'Charles' ? 'V (L)' : 'P (kPa)';
  const toGX = (xv: number) => 45 + ((xv - gx.min) / (gx.max - gx.min)) * 260;
  const toGY = (yv: number) => 205 - (yv / gyMax) * 185;
  const curvePts: [number, number][] = [];
  if (law === 'Boyle') {
    for (let v = 5; v <= 40.01; v += 1) curvePts.push([v, (R * N_MOL * T) / v]);
  } else if (law === 'Charles') {
    for (let t = 150; t <= 600.01; t += 25) curvePts.push([t, (R * N_MOL * t) / P]);
  } else {
    for (let t = 150; t <= 600.01; t += 25) curvePts.push([t, (R * N_MOL * t) / V]);
  }
  const currentPt: [number, number] = law === 'Boyle' ? [V, P] : law === 'Charles' ? [T, V] : [T, P];

  // Particle animation: speeds scale with sqrt(T); cleaned up and restarted
  // whenever the speed factor changes.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setParticles((ps) => ps.map((p) => bounce(p, particleSpeed, dt)));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [particleSpeed]);

  function switchLaw(next: Law) {
    setLaw(next);
    if (next === 'Boyle') {
      const t = clamp(T, 150, 600);
      setT(t);
      setP((R * N_MOL * t) / V);
    } else if (next === 'Charles') {
      const p = clamp(P, 50, 400);
      setP(p);
      setV((R * N_MOL * T) / p);
    } else {
      const v = clamp(V, 5, 40);
      setV(v);
      setP((R * N_MOL * T) / v);
    }
  }

  function adjustV(v: number) {
    setV(v);
    setP((R * N_MOL * T) / v);
  }

  function adjustT(t: number) {
    setT(t);
    if (law === 'Charles') setV((R * N_MOL * t) / P);
    else setP((R * N_MOL * t) / V);
  }

  function beginCommit(value: number) {
    if (beforeRef.current === null) beforeRef.current = value;
  }

  function endCommit(changed: Changed) {
    const before = beforeRef.current;
    beforeRef.current = null;
    if (before === null) return;
    const after = changed === 'V' ? V : changed === 'T' ? T : P;
    if (Math.abs(after - before) < 1e-9) return;
    const pinned =
      law === 'Boyle'
        ? `T = ${T.toFixed(0)} K`
        : law === 'Charles'
          ? `P = ${P.toFixed(1)} kPa`
          : `V = ${V.toFixed(1)} L`;
    setRows((r) => [...r, [law, pinned, changed, fmtVal(changed, before), fmtVal(changed, after)]]);
  }

  function answer(i: number, ok: boolean) {
    const next = answers.map((a, j) => (j === i ? ok : a));
    setAnswers(next);
    if (next.every((a) => a === true)) props.onWin();
  }

  function resetPredictions() {
    setAnswers([null, null, null]);
    setPredKey((k) => k + 1);
  }

  const sliderCommit = (changed: Changed) => ({
    onPointerDown: () => beginCommit(changed === 'V' ? V : T),
    onPointerUp: () => endCommit(changed),
    onKeyDown: () => beginCommit(changed === 'V' ? V : T),
    onKeyUp: () => endCommit(changed),
    onBlur: () => endCommit(changed),
  });

  const wonAll = answers.every((a) => a === true);

  return (
    <GameShell
      title="Gas Laws Chamber"
      blurb="A piston, 40 gas particles and one equation: P V = n R T. Switch between Boyle, Charles and Gay-Lussac, drive the free variable, and watch the state point ride the predicted curve."
      modelNote="P V = n R T with n = 1 mol and R = 8.314 kPa·L/(mol·K), so P is in kPa, V in litres and T in kelvin. Particles move in relative coordinates, so they always fill the gas region; their speeds scale with sqrt(T), which is a visual hint, not an exact Maxwell distribution."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Thermometer className="size-4" aria-hidden="true" /> Chamber controls
          </h3>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Choose the gas law mode">
            {LAWS.map((l) => (
              <button
                key={l}
                onClick={() => switchLaw(l)}
                aria-pressed={law === l}
                className={cn(
                  'press inline-flex min-h-[44px] items-center justify-center rounded-xl border px-2 text-sm font-medium',
                  law === l ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10'
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {LAW_INFO[law].pinned}; adjust {LAW_INFO[law].changed}; {LAW_INFO[law].computed} is computed from P V = n R T.
          </p>

          {law === 'Boyle' ? (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Volume: <b className="tabular-nums">{V.toFixed(1)} L</b>
              </span>
              <input
                type="range"
                min={5}
                max={40}
                step={0.5}
                value={V}
                onChange={(e) => adjustV(Number(e.target.value))}
                {...sliderCommit('V')}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Volume, currently ${V.toFixed(1)} litres`}
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Temperature: <b className="tabular-nums">{T.toFixed(0)} K</b>
              </span>
              <input
                type="range"
                min={150}
                max={600}
                step={5}
                value={T}
                onChange={(e) => adjustT(Number(e.target.value))}
                {...sliderCommit('T')}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Temperature, currently ${T.toFixed(0)} kelvin`}
              />
            </label>
          )}

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl border border-border bg-card p-2">
              <p className="text-xs text-muted-foreground">P = nRT/V</p>
              <p className="tabular-nums font-bold">{P.toFixed(1)} kPa</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              <p className="text-xs text-muted-foreground">V</p>
              <p className="tabular-nums font-bold">{V.toFixed(1)} L</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              <p className="text-xs text-muted-foreground">T</p>
              <p className="tabular-nums font-bold">{T.toFixed(0)} K</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <svg
            viewBox="0 0 320 300"
            className="mx-auto w-full max-w-[320px]"
            role="img"
            aria-label={`Piston chamber with gas at ${P.toFixed(0)} kilopascals, ${V.toFixed(1)} litres and ${T.toFixed(0)} kelvin`}
          >
            <rect x="62" y={pistonY} width="196" height={gasH} fill="#38bdf8" opacity="0.12" />
            {particles.map((p, i) => (
              <circle
                key={i}
                cx={62 + p.x * 192}
                cy={pistonY + 4 + p.y * (gasH - 8)}
                r="4"
                fill={`hsl(${tempHue} 80% 55%)`}
              />
            ))}
            <rect x="154" y="24" width="12" height={Math.max(0, pistonY - 40)} fill="#cbd5e1" />
            <rect x="55" y={pistonY - 16} width="210" height="16" rx="3" fill="#64748b" />
            <line x1="60" y1="40" x2="60" y2="270" stroke="#94a3b8" strokeWidth="2" />
            <line x1="260" y1="40" x2="260" y2="270" stroke="#94a3b8" strokeWidth="2" />
            <rect x="50" y="270" width="220" height="8" fill="#94a3b8" />
            <text x="160" y="296" textAnchor="middle" fontSize="11" fill="#64748b">
              {P.toFixed(0)} kPa · {V.toFixed(1)} L · {T.toFixed(0)} K
            </text>
          </svg>

          <svg
            viewBox="0 0 320 240"
            className="w-full"
            role="img"
            aria-label={`${LAW_INFO[law].caption} curve with the current state marked`}
          >
            <line x1="45" y1="205" x2="305" y2="205" stroke="#94a3b8" />
            <line x1="45" y1="20" x2="45" y2="205" stroke="#94a3b8" />
            <polyline
              points={curvePts.map(([x, y]) => `${toGX(x).toFixed(1)},${toGY(y).toFixed(1)}`).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx={toGX(currentPt[0])} cy={toGY(currentPt[1])} r="5" className="fill-primary" />
            <text x="48" y="16" fontSize="11" fill="#64748b">
              {gyLabel}
            </text>
            <text x="175" y="232" textAnchor="middle" fontSize="11" fill="#64748b">
              {gx.label} — {LAW_INFO[law].caption}
            </text>
            <text x={toGX(gx.min)} y="220" textAnchor="middle" fontSize="10" fill="#64748b">
              {gx.min}
            </text>
            <text x={toGX(gx.max)} y="220" textAnchor="middle" fontSize="10" fill="#64748b">
              {gx.max}
            </text>
            <text x="40" y="209" textAnchor="end" fontSize="10" fill="#64748b">
              0
            </text>
            <text x="40" y={toGY(gyMax) + 4} textAnchor="end" fontSize="10" fill="#64748b">
              {gyMax}
            </text>
          </svg>
          <p className="text-xs text-muted-foreground">
            The solid curve is what the gas law predicts; the dot is your live state. Commit a slider change and it lands in the report below.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <LabReport
          title="State change log"
          columns={['Law', 'Pinned', 'Changed', 'Before', 'After']}
          rows={rows}
          note="A row is appended when you release a slider (or lift a key) after moving it."
        />

        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <MoveHorizontal className="size-4" aria-hidden="true" /> Predict first — three scenarios
          </h3>
          <PredictFirst
            key={`boy-${predKey}`}
            prompt="At constant temperature, we halve the volume of the gas. What happens to the pressure?"
            options={[
              { label: 'It doubles', correct: true },
              { label: 'It halves' },
              { label: 'It stays the same' },
            ]}
            explain="Boyle: at fixed T and n, P is inversely proportional to V, so halving V doubles P."
            onResolved={(ok) => answer(0, ok)}
          />
          <PredictFirst
            key={`cha-${predKey}`}
            prompt="At constant pressure, we heat the gas from 300 K to 600 K. What happens to the volume?"
            options={[
              { label: 'It doubles', correct: true },
              { label: 'It halves' },
              { label: 'It stays the same' },
            ]}
            explain="Charles: at fixed P, V is proportional to the Kelvin temperature, so 300 K to 600 K doubles V."
            onResolved={(ok) => answer(1, ok)}
          />
          <PredictFirst
            key={`gay-${predKey}`}
            prompt="At constant volume, we double the Kelvin temperature. What happens to the pressure?"
            options={[
              { label: 'It doubles', correct: true },
              { label: 'It halves' },
              { label: 'It stays the same' },
            ]}
            explain="Gay-Lussac: at fixed V, P is proportional to the Kelvin temperature, so doubling T doubles P."
            onResolved={(ok) => answer(2, ok)}
          />
          {answers.some((a) => a === false) && (
            <button
              className="press inline-flex min-h-[44px] items-center gap-2 self-start rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
              onClick={resetPredictions}
            >
              <RotateCcw className="size-4" aria-hidden="true" /> Reset the three scenarios
            </button>
          )}
        </div>

        {wonAll && (
          <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600">
            All three predictions correct — you reason with gas laws, not memorise them.
          </p>
        )}

        <ChapterRef subject="Chemistry" chapter="Ch 5 — States of Matter" topic="Boyle, Charles, Gay-Lussac, ideal gas equation" />
      </div>
    </GameShell>
  );
}
