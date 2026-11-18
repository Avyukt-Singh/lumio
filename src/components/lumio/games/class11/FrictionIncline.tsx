'use client';

import { useEffect, useRef, useState } from 'react';
import { Mountain, RotateCcw, CheckCircle2, Scale } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Friction on an inclined plane: live force diagram, block that breaks away
 * when tan(theta) exceeds the static coefficient, angle-of-repose experiment
 * with a measured us = tan(theta_repose), and three surface MCQs -> onWin().
 */

const G = 9.8;

interface Surface {
  label: string;
  us: number;
  uk: number;
}
const SURFACES = {
  ice: { label: 'Ice', us: 0.1, uk: 0.05 },
  wood: { label: 'Wood on wood', us: 0.4, uk: 0.3 },
  steel: { label: 'Steel on steel', us: 0.3, uk: 0.25 },
  rubber: { label: 'Rubber on concrete', us: 0.9, uk: 0.7 },
} as const satisfies Record<string, Surface>;
type SurfaceKey = keyof typeof SURFACES;
const SURFACE_KEYS = Object.keys(SURFACES) as SurfaceKey[];
/** Surfaces whose breakaway experiment + MCQ count toward the win. */
const WIN_SURFACES: SurfaceKey[] = ['ice', 'wood', 'rubber'];

const MCQS: Record<SurfaceKey, { options: Array<{ label: string; correct?: boolean }>; explain: string }> = {
  ice: {
    options: [{ label: 'μs ≈ 0.05' }, { label: 'μs ≈ 0.10', correct: true }, { label: 'μs ≈ 0.30' }, { label: 'μs ≈ 0.60' }],
    explain: 'Ice is the slippiest surface here: it breaks away near 6°, and tan 6° is about 0.10.',
  },
  wood: {
    options: [{ label: 'μs ≈ 0.15' }, { label: 'μs ≈ 0.25' }, { label: 'μs ≈ 0.40', correct: true }, { label: 'μs ≈ 0.70' }],
    explain: 'Wood on wood broke away near 22°, and tan 22° is about 0.40.',
  },
  steel: {
    options: [{ label: 'μs ≈ 0.10' }, { label: 'μs ≈ 0.30', correct: true }, { label: 'μs ≈ 0.55' }, { label: 'μs ≈ 0.90' }],
    explain: 'Steel on steel broke away near 17°, and tan 17° is about 0.30.',
  },
  rubber: {
    options: [{ label: 'μs ≈ 0.35' }, { label: 'μs ≈ 0.55' }, { label: 'μs ≈ 0.70' }, { label: 'μs ≈ 0.90', correct: true }],
    explain: 'Rubber grips hard: it holds until about 42°, and tan 42° is about 0.90.',
  },
};

const SLOPE_M = 3; // physical ramp length in metres (used only for the slide)

interface ReposeRow {
  surface: string;
  mass: number;
  angle: number;
  us: number;
}

export function FrictionInclineLab(props: GameProps) {
  const [angle, setAngleRaw] = useState(10);
  const [mass, setMass] = useState(5);
  const [surface, setSurface] = useState<SurfaceKey>('wood');
  const [pos, setPos] = useState(0);
  const [repose, setRepose] = useState<Record<SurfaceKey, number | null>>({ ice: null, wood: null, steel: null, rubber: null });
  const [picked, setPicked] = useState<Record<SurfaceKey, number | null>>({ ice: null, wood: null, steel: null, rubber: null });
  const [rows, setRows] = useState<ReposeRow[]>([]);
  const [msg, setMsg] = useState('');

  // Derived physics (above any effect).
  const rad = (angle * Math.PI) / 180;
  const s = SURFACES[surface];
  const tanTheta = Math.tan(rad);
  const isStatic = tanTheta <= s.us;
  const a = G * (Math.sin(rad) - s.uk * Math.cos(rad));
  const w = mass * G;
  const wPar = w * Math.sin(rad); // mg sin(theta), down the slope
  const wPerp = w * Math.cos(rad); // mg cos(theta), into the slope
  const normal = wPerp;
  const friction = isStatic ? wPar : s.uk * normal;
  const usMeasured = repose[surface] !== null ? Math.tan(((repose[surface] as number) * Math.PI) / 180) : null;

  const velRef = useRef(0);

  // Slide animation: restart on any parameter change, cancel on cleanup.
  useEffect(() => {
    if (isStatic) return;
    velRef.current = 0;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      velRef.current += a * dt;
      setPos((p) => {
        const np = p + velRef.current * dt;
        return np >= SLOPE_M ? 0 : np;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isStatic, a, surface]);

  function setAngle(next: number) {
    const nextRad = (next * Math.PI) / 180;
    const wasStatic = Math.tan(rad) <= s.us;
    const nowStatic = Math.tan(nextRad) <= s.us;
    if (wasStatic && !nowStatic && next > angle) {
      // Breakaway: record this angle as the measured angle of repose.
      const key = surface;
      setRepose((r) => ({ ...r, [key]: next }));
      setRows((old) => [...old, { surface: s.label, mass, angle: next, us: Math.tan(nextRad) }]);
      setMsg(
        `Breakaway at ${next}° on ${s.label}. The angle of repose satisfies tan(θ) = μs, so your measurement says μs ≈ ${Math.tan(nextRad).toFixed(2)}. Now answer the question for this surface.`
      );
    }
    setAngleRaw(next);
  }

  function resetBlock() {
    setPos(0);
    velRef.current = 0;
    setMsg('Block reset to the top of the ramp.');
  }

  function pickAnswer(i: number) {
    const key = surface;
    if (picked[key] !== null) return;
    setPicked((p) => ({ ...p, [key]: i }));
    const correctIdx = MCQS[key].options.findIndex((o) => o.correct);
    if (i === correctIdx) {
      const allDone = WIN_SURFACES.every((sk) => {
        if (sk === key) return true;
        const pi = picked[sk];
        return pi !== null && pi === MCQS[sk].options.findIndex((o) => o.correct);
      });
      setMsg(`Correct — ${MCQS[key].explain}`);
      if (allDone) props.onWin();
    } else {
      setMsg('Not this one — compare your measured tan(θ_repose) with the options and try again after a fresh breakaway run.');
      // allow a retry: clear the pick
      setTimeout(() => setPicked((p) => ({ ...p, [key]: null })), 1200);
    }
  }

  // SVG geometry: ramp rises to the right from the base point.
  const BX = 30;
  const BY = 268;
  const RAMP_PX = 380;
  const tx = BX + RAMP_PX * Math.cos(rad);
  const ty = BY - RAMP_PX * Math.sin(rad);
  const frac = Math.min(1, pos / SLOPE_M);
  const blockCx = BX + (RAMP_PX * frac) * Math.cos(rad);
  const blockCy = BY - (RAMP_PX * frac) * Math.sin(rad);
  // offset the block so it sits ON the surface (half height perpendicular)
  const halfH = 11;
  const offX = halfH * Math.sin(rad);
  const offY = halfH * Math.cos(rad);
  const bcx = blockCx + offX;
  const bcy = blockCy - offY;
  const UX = Math.cos(rad); // up-slope unit vector (SVG x)
  const UY = -Math.sin(rad);
  const NX = -Math.sin(rad); // away from the surface
  const NY = -Math.cos(rad);
  const PPN = 0.55; // px per newton
  const arrow = (dx: number, dy: number) => `${(bcx + dx * PPN).toFixed(1)},${(bcy + dy * PPN).toFixed(1)}`;

  const doneSurfaces = WIN_SURFACES.filter((sk) => {
    const pi = picked[sk];
    return pi !== null && pi === MCQS[sk].options.findIndex((o) => o.correct);
  });

  return (
    <GameShell
      title="Friction on an Incline"
      blurb="Tilt the ramp until the block breaks away. Watch the force vectors grow with mass, discover the angle of repose, and recover μs from tan(θ)."
      modelNote="Block treated as a point mass. Static regime: friction balances mg sinθ while tanθ ≤ μs. Once tanθ > μs the block slides with a = g(sinθ − μk cosθ). The μs values are hidden from you and must be measured from the breakaway angle."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Mountain className="size-4" aria-hidden="true" /> Ramp controls
            </h3>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Incline angle: <b className="tabular-nums">{angle.toFixed(1)}&deg;</b>
              </span>
              <input
                type="range"
                min={0}
                max={60}
                step={0.5}
                value={angle}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Incline angle, currently ${angle} degrees`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Block mass: <b className="tabular-nums">{mass} kg</b>
              </span>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={mass}
                onChange={(e) => {
                  setMass(Number(e.target.value));
                  setPos(0);
                  velRef.current = 0;
                }}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Block mass, currently ${mass} kilograms`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Surface</span>
              <select
                value={surface}
                onChange={(e) => {
                  setSurface(e.target.value as SurfaceKey);
                  setPos(0);
                  velRef.current = 0;
                  setMsg('');
                }}
                className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 text-sm"
                aria-label="Surface material"
              >
                {SURFACE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {SURFACES[key].label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="press min-h-[44px]" onClick={resetBlock}>
                <RotateCcw className="size-4" aria-hidden="true" /> Reset block
              </Button>
              <Button
                variant="ghost"
                className="press min-h-[44px]"
                onClick={() => {
                  setAngleRaw(0);
                  setPos(0);
                  velRef.current = 0;
                  setMsg('Ramp levelled. Raise the angle slowly and watch for breakaway.');
                }}
              >
                Level ramp
              </Button>
            </div>
            <p
              role="status"
              aria-live="polite"
              className={cn(
                'text-sm font-semibold',
                msg.startsWith('Breakaway') || msg.startsWith('Correct') ? 'text-emerald-600' : 'text-amber-600'
              )}
            >
              {msg || 'Raise the angle slowly until the block breaks away, then answer the surface question.'}
            </p>
            <div className="rounded-2xl border border-border bg-card p-3 text-sm">
              <p className="font-semibold">State readout</p>
              <p className="mt-1 tabular-nums">
                tan θ = {tanTheta.toFixed(2)} · regime: <b>{isStatic ? 'static (held by friction)' : `sliding, a = ${a.toFixed(2)} m/s²`}</b>
              </p>
              {usMeasured !== null && (
                <p className="mt-1 tabular-nums">
                  Measured μs = tan({repose[surface]}&deg;) = <b>{usMeasured.toFixed(2)}</b> — the identity μ = tan θ turns
                  the breakaway angle into the coefficient.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
            <svg
              viewBox="0 0 480 300"
              className="w-full"
              role="img"
              aria-label={`Force diagram: ${s.label}, ${mass} kg block on a ${angle} degree incline, ${isStatic ? 'static' : 'sliding'}`}
            >
              {/* ramp */}
              <line x1={BX} y1={BY} x2={tx} y2={ty} className="stroke-foreground" strokeWidth="4" />
              <polygon points={`${BX},${BY} ${tx},${ty} ${tx},${BY}`} className="fill-muted/40" />
              <text x={(BX + tx) / 2 - 20} y={BY - 6} fontSize="12" className="fill-muted-foreground">
                {angle.toFixed(1)}&deg;
              </text>
              {/* block */}
              <g transform={`rotate(${-angle} ${bcx.toFixed(1)} ${bcy.toFixed(1)})`}>
                <rect
                  x={(bcx - 17).toFixed(1)}
                  y={(bcy - 11).toFixed(1)}
                  width="34"
                  height="22"
                  rx="3"
                  className={isStatic ? 'fill-primary' : 'fill-amber-500'}
                />
              </g>
              {/* weight mg */}
              <line x1={bcx} y1={bcy} x2={bcx} y2={(bcy + w * PPN).toFixed(1)} className="stroke-red-600" strokeWidth="3" />
              <text x={bcx + 6} y={(bcy + w * PPN - 4).toFixed(1)} fontSize="11" className="fill-red-600">
                mg = {w.toFixed(0)} N
              </text>
              {/* mg sin (down-slope) */}
              <line
                x1={bcx}
                y1={bcy}
                x2={(bcx - wPar * PPN * UX).toFixed(1)}
                y2={(bcy - wPar * PPN * UY).toFixed(1)}
                className="stroke-orange-600"
                strokeWidth="3"
              />
              <text
                x={(bcx - wPar * PPN * UX - 10).toFixed(1)}
                y={(bcy - wPar * PPN * UY + 14).toFixed(1)}
                fontSize="11"
                className="fill-orange-600"
              >
                mg sin θ = {wPar.toFixed(0)} N
              </text>
              {/* mg cos (into slope) */}
              <line
                x1={bcx}
                y1={bcy}
                x2={(bcx + wPerp * PPN * -NX).toFixed(1)}
                y2={(bcy + wPerp * PPN * -NY).toFixed(1)}
                className="stroke-violet-600"
                strokeWidth="3"
              />
              <text
                x={(bcx + wPerp * PPN * -NX + 6).toFixed(1)}
                y={(bcy + wPerp * PPN * -NY).toFixed(1)}
                fontSize="11"
                className="fill-violet-600"
              >
                mg cos θ = {wPerp.toFixed(0)} N
              </text>
              {/* normal N */}
              <line
                x1={bcx}
                y1={bcy}
                x2={(bcx + normal * PPN * NX).toFixed(1)}
                y2={(bcy + normal * PPN * NY).toFixed(1)}
                className="stroke-sky-600"
                strokeWidth="3"
              />
              <text
                x={(bcx + normal * PPN * NX - 10).toFixed(1)}
                y={(bcy + normal * PPN * NY - 6).toFixed(1)}
                fontSize="11"
                className="fill-sky-600"
              >
                N = {normal.toFixed(0)} N
              </text>
              {/* friction (up-slope) */}
              <line
                x1={bcx}
                y1={bcy}
                x2={(bcx + friction * PPN * UX).toFixed(1)}
                y2={(bcy + friction * PPN * UY).toFixed(1)}
                className="stroke-emerald-600"
                strokeWidth="3"
              />
              <text
                x={(bcx + friction * PPN * UX - 14).toFixed(1)}
                y={(bcy + friction * PPN * UY - 6).toFixed(1)}
                fontSize="11"
                className="fill-emerald-600"
              >
                f = {friction.toFixed(0)} N
              </text>
            </svg>
            <p className="text-xs text-muted-foreground">
              All five vectors are drawn to one shared scale (0.55 px per newton), so doubling the mass visibly doubles every
              weight-related arrow while the breakaway angle stays the same.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Scale className="size-4 text-primary" aria-hidden="true" /> Angle-of-repose experiment
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            For each required surface (ice, wood, rubber-on-concrete), raise the angle until the block breaks away, read your
            measured μs = tan(θ_repose), then pick the coefficient that matches. Steel is there for extra practice and
            does not count toward the win.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {WIN_SURFACES.map((sk) => {
              const pi = picked[sk];
              const done = pi !== null && pi === MCQS[sk].options.findIndex((o) => o.correct);
              return (
                <span
                  key={sk}
                  className={cn(
                    'inline-flex min-h-[32px] items-center gap-1 rounded-full px-2.5 text-xs font-semibold',
                    done ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {done && <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                  {SURFACES[sk].label}
                </span>
              );
            })}
            <span className="text-sm tabular-nums text-muted-foreground">{doneSurfaces.length}/3</span>
          </div>
          {MCQS[surface] && (
            <div className="mt-3">
              <p className="text-sm font-semibold">
                {SURFACES[surface].label}: which μs matches your breakaway measurement?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {MCQS[surface].options.map((o, i) => {
                  const isPicked = picked[surface] === i;
                  const resolved = picked[surface] !== null;
                  const isCorrect = o.correct === true;
                  return (
                    <button
                      key={o.label}
                      onClick={() => pickAnswer(i)}
                      disabled={resolved || repose[surface] === null}
                      aria-pressed={isPicked}
                      className={cn(
                        'press inline-flex min-h-[44px] items-center rounded-xl border px-3 text-sm font-medium',
                        !resolved && repose[surface] !== null && 'border-border bg-card hover:bg-accent/10',
                        !resolved && repose[surface] === null && 'border-border bg-card text-muted-foreground opacity-50',
                        resolved && isCorrect && 'border-emerald-500 bg-emerald-500/10 text-emerald-600',
                        resolved && isPicked && !isCorrect && 'border-amber-500 bg-amber-500/10 text-amber-600',
                        resolved && !isPicked && !isCorrect && 'border-border bg-card text-muted-foreground opacity-60'
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {repose[surface] === null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Run a breakaway on this surface first — the question unlocks once you have a measured angle.
                </p>
              )}
            </div>
          )}
        </div>

        <PredictFirst
          prompt="Will a heavier block start sliding at a lower, higher, or the same angle as a lighter one on the same surface?"
          options={[
            { label: 'Lower angle' },
            { label: 'Higher angle' },
            { label: 'The same angle', correct: true },
          ]}
          explain="Both the limiting friction and the weight scale with mass, so mass cancels in tanθ = μs. The breakaway angle depends only on the surface — try 2 kg vs 18 kg on the same material to confirm it."
        />

        <LabReport
          title="Repose log"
          columns={['Surface', 'Mass (kg)', 'Slid at angle (°)', 'Measured μs = tan']}
          rows={rows.map((r) => [r.surface, r.mass, r.angle.toFixed(1), r.us.toFixed(2)])}
          note="One row per breakaway. Re-run a surface with a different mass: the recorded angle should not change."
        />

        <ChapterRef subject="Physics" chapter="Ch 5 — Laws of Motion" topic="Friction" />
      </div>
    </GameShell>
  );
}
