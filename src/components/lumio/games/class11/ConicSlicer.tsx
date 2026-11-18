'use client';

import { useState } from 'react';
import { Shapes, Slice, Trophy } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, type PredictOption } from './shared';
import { cn } from '@/lib/utils';

/**
 * Conic Slicer: a double cone drawn as a trig-projected wireframe plus a
 * tiltable cutting plane. Sliders control the cone half-angle beta and the
 * plane tilt theta; the section (circle / ellipse / parabola / hyperbola),
 * its eccentricity e = sin(theta)/sin(beta) and its canonical equation are
 * derived honestly from the geometry. Four randomized setups must be
 * identified to win.
 */

const L = 50; // slant length of each cone in 3D units
const S3 = 2; // 3D -> px scale
const PLANE_H = 15; // height where the plane crosses the axis
const PLANE_W = 30; // half-width of the plane parallelogram
const S2 = 17; // 2D panel px per unit

type ConicType = 'circle' | 'ellipse' | 'parabola' | 'hyperbola';

function classify(beta: number, theta: number): ConicType {
  if (theta === 0) return 'circle';
  if (theta < beta) return 'ellipse';
  if (theta === beta) return 'parabola';
  return 'hyperbola';
}

/** Oblique projection: y goes back-left, z up. */
function proj(x: number, y: number, z: number): [number, number] {
  return [180 + (x - 0.45 * y) * S3, 200 - (z + 0.22 * y) * S3];
}

interface Setup {
  beta: number;
  theta: number;
  type: ConicType;
}

function makeSetups(): Setup[] {
  const types: ConicType[] = ['circle', 'ellipse', 'parabola', 'hyperbola'];
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = types[i];
    types[i] = types[j];
    types[j] = t;
  }
  const betas = [20, 25, 30, 35, 40];
  return types.map((type) => {
    const beta = betas[Math.floor(Math.random() * betas.length)];
    let theta: number;
    if (type === 'circle') theta = 0;
    else if (type === 'ellipse') theta = 5 + Math.floor(Math.random() * (beta - 10));
    else if (type === 'parabola') theta = beta;
    else theta = beta + 8 + Math.floor(Math.random() * (81 - beta));
    return { beta, theta, type };
  });
}

const TYPE_LABEL: Record<ConicType, string> = {
  circle: 'Circle',
  ellipse: 'Ellipse',
  parabola: 'Parabola',
  hyperbola: 'Hyperbola',
};

export function ConicSlicerLab(props: GameProps) {
  const [beta, setBeta] = useState(30);
  const [theta, setTheta] = useState(20);
  const [setups, setSetups] = useState<Setup[]>(() => makeSetups());
  const [idx, setIdx] = useState(0);
  const [typeOk, setTypeOk] = useState(false);
  const [eOk, setEOk] = useState(false);
  const [typeKey, setTypeKey] = useState(0);
  const [eKey, setEKey] = useState(0);
  const [verdict, setVerdict] = useState<'none' | 'ok' | 'retry'>('none');
  const [feedback, setFeedback] = useState('');
  const [solved, setSolved] = useState(0);

  // ---- Derived geometry (above all handlers/effects) ----------------------
  const betaRad = (beta * Math.PI) / 180;
  const thetaRad = (theta * Math.PI) / 180;
  const type = classify(beta, theta);
  const e = theta === 0 ? 0 : Math.sin(thetaRad) / Math.sin(betaRad);

  // Wireframe: generators + rings for both nappes.
  const generatorLines = Array.from({ length: 10 }, (_, i) => {
    const ar = (i * 36 + 10) * (Math.PI / 180);
    const dx = L * Math.sin(betaRad) * Math.cos(ar);
    const dy = L * Math.sin(betaRad) * Math.sin(ar);
    const dz = L * Math.cos(betaRad);
    const [ax, ay] = proj(0, 0, 0);
    const [tx, ty] = proj(dx, dy, dz);
    const [bx, by] = proj(dx, dy, -dz);
    return { ax, ay, tx, ty, bx, by };
  });
  const ringPts = (t: number, sign: number): string => {
    const r = t * Math.sin(betaRad);
    const z = sign * t * Math.cos(betaRad);
    const pts: string[] = [];
    for (let a = 0; a <= 360; a += 15) {
      const ar = (a * Math.PI) / 180;
      const [sx, sy] = proj(r * Math.cos(ar), r * Math.sin(ar), z);
      pts.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
    }
    return pts.join(' ');
  };
  const rings = [0.25, 0.5, 0.75, 1].flatMap((t) => [ringPts(t * L, 1), ringPts(t * L, -1)]);
  const axisLine = (() => {
    const [x1, y1] = proj(0, 0, -L * Math.cos(betaRad));
    const [x2, y2] = proj(0, 0, L * Math.cos(betaRad));
    return { x1, y1, x2, y2 };
  })();
  const planeCorners = [
    [-PLANE_W, -PLANE_W],
    [PLANE_W, -PLANE_W],
    [PLANE_W, PLANE_W],
    [-PLANE_W, PLANE_W],
  ]
    .map(([cu, cv]) => proj(cu, cv * Math.cos(thetaRad), PLANE_H + cv * Math.sin(thetaRad)))
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  // Canonical 2D parameters from e (honest derivations).
  const aFix = 4;
  const bEll = aFix * Math.sqrt(Math.max(0, 1 - e * e));
  const cEll = aFix * e;
  const bHyp = aFix * Math.sqrt(Math.max(0, e * e - 1));
  const cHyp = aFix * e;
  const aPar = 2;

  const equationLine = (() => {
    if (type === 'circle') {
      return `x² + y² = 9 · e = 0 · centre (0, 0) — a circle has no foci or directrix in the conic sense`;
    }
    if (type === 'ellipse') {
      return `x²/${(aFix * aFix).toFixed(0)} + y²/${(bEll * bEll).toFixed(2)} = 1 · e = ${e.toFixed(2)} · foci (±${cEll.toFixed(2)}, 0) · directrix x = ±${(aFix / e).toFixed(2)}`;
    }
    if (type === 'parabola') {
      return `y² = ${(4 * aPar).toFixed(0)}x · e = 1 · focus (${aPar.toFixed(2)}, 0) · directrix x = ${(-aPar).toFixed(2)}`;
    }
    return `x²/${(aFix * aFix).toFixed(0)} − y²/${(bHyp * bHyp).toFixed(2)} = 1 · e = ${e.toFixed(2)} · foci (±${cHyp.toFixed(2)}, 0) · directrix x = ±${(aFix / e).toFixed(2)}`;
  })();

  // 2D drawing helpers.
  const X2 = (x: number) => 170 + x * S2;
  const Y2 = (y: number) => 130 - y * S2;
  const parabolaPts = Array.from({ length: 53 }, (_, i) => {
    const y = -6.5 + i * 0.25;
    return `${X2((y * y) / (4 * aPar)).toFixed(1)},${Y2(y).toFixed(1)}`;
  }).join(' ');
  const hypPts = (sign: number): string => {
    const yMax = Math.min(bHyp * Math.sqrt(3), 7);
    const pts: string[] = [];
    for (let i = 0; i <= 48; i++) {
      const y = -yMax + (2 * yMax * i) / 48;
      const x = sign * aFix * Math.sqrt(1 + (y / bHyp) * (y / bHyp));
      pts.push(`${X2(x).toFixed(1)},${Y2(y).toFixed(1)}`);
    }
    return pts.join(' ');
  };
  const showDirectrices = type !== 'circle' && type !== 'parabola' && aFix / e <= 9;

  // ---- Challenge state ----------------------------------------------------
  const setup = setups[idx];
  const setupE = setup.theta === 0 ? 0 : Math.sin((setup.theta * Math.PI) / 180) / Math.sin((setup.beta * Math.PI) / 180);
  const setupDone = typeOk && eOk;

  const typeOptions: PredictOption[] = (['circle', 'ellipse', 'parabola', 'hyperbola'] as ConicType[]).map((t) => ({
    label: TYPE_LABEL[t],
    correct: t === setup.type,
  }));
  const eOptions: PredictOption[] = [
    { label: 'e < 1', correct: setupE < 1 },
    { label: 'e = 1', correct: setupE === 1 },
    { label: 'e > 1', correct: setupE > 1 },
  ];
  const typeExplain = (() => {
    if (setup.type === 'circle') return 'θ = 0° means the plane is horizontal, parallel to the base — every such cut is a circle.';
    if (setup.type === 'ellipse') return `0 < θ (${setup.theta}°) < β (${setup.beta}°), so the plane cuts one nappe at a slant gentler than the generators — an ellipse.`;
    if (setup.type === 'parabola') return `θ = β = ${setup.beta}° exactly, so the plane is parallel to a generator — the classic parabola cut.`;
    return `θ (${setup.theta}°) > β (${setup.beta}°), so the plane is steeper than the generators and cuts both nappes — a hyperbola.`;
  })();
  const eExplain = (() => {
    if (setup.type === 'circle') return 'A circular section has eccentricity 0, which is certainly less than 1.';
    if (setup.type === 'ellipse') return `e = sin θ / sin β = sin ${setup.theta}° / sin ${setup.beta}° ≈ ${setupE.toFixed(2)}, and every ellipse has e < 1.`;
    if (setup.type === 'parabola') return 'When θ = β the formula gives e = sin β / sin β = 1 — the parabola is exactly the e = 1 conic.';
    return `e = sin ${setup.theta}° / sin ${setup.beta}° ≈ ${setupE.toFixed(2)}, and every hyperbola has e > 1.`;
  })();

  function completeSetup() {
    const n = solved + 1;
    setSolved(n);
    setVerdict('ok');
    if (n >= 4) {
      setFeedback('All four setups identified — you can classify a cone cut by eye now.');
      props.onWin();
    } else {
      setFeedback(`Setup ${idx + 1} solved (${n} of 4). Take the next one when ready.`);
    }
  }

  function onTypeResolved(ok: boolean) {
    if (ok) {
      setTypeOk(true);
      if (eOk) {
        completeSetup();
      } else {
        setVerdict('none');
        setFeedback('Type locked in — now predict the eccentricity.');
      }
    } else {
      setTypeKey((k) => k + 1);
      setVerdict('retry');
      setFeedback('Not this one. Compare θ with β again: smaller, equal, or larger?');
    }
  }

  function onEResolved(ok: boolean) {
    if (ok) {
      setEOk(true);
      if (typeOk) {
        completeSetup();
      } else {
        setVerdict('none');
        setFeedback('Eccentricity locked in — now name the section.');
      }
    } else {
      setEKey((k) => k + 1);
      setVerdict('retry');
      setFeedback('Re-check: e = sin θ / sin β, and compare θ with β to place e against 1.');
    }
  }

  function nextSetup() {
    const nextIdx = idx + 1;
    setIdx(nextIdx);
    setTypeOk(false);
    setEOk(false);
    setTypeKey((k) => k + 1);
    setEKey((k) => k + 1);
    setVerdict('none');
    setFeedback('');
    setBeta(setups[nextIdx].beta);
    setTheta(setups[nextIdx].theta);
  }

  return (
    <GameShell
      title="Conic Slicer"
      blurb="Slice a double cone with a plane you can tilt. Circle, ellipse, parabola or hyperbola — which one appears depends only on how the tilt compares with the cone angle."
      modelNote="The 3D view is a simple oblique projection drawn with trigonometry (no 3D engine). The classical result e = sin θ / sin β is used exactly; canonical parameters use a = 4 for ellipse and hyperbola, a = 2 for the parabola and r = 3 for the circle."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------------- 3D wireframe + sliders ---------------- */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Slice className="size-4" aria-hidden="true" /> Cone and cutting plane
          </h3>
          <svg viewBox="0 0 360 400" className="w-full" role="img" aria-label={`Double cone with half angle ${beta} degrees cut by a plane tilted ${theta} degrees, giving a ${type}`}>
            <line x1={axisLine.x1} y1={axisLine.y1} x2={axisLine.x2} y2={axisLine.y2} className="stroke-border" strokeWidth="1.5" strokeDasharray="4 4" />
            {rings.map((pts, i) => (
              <polyline key={i} points={pts} fill="none" strokeWidth="1" className="stroke-muted-foreground" opacity="0.55" />
            ))}
            {generatorLines.map((g, i) => (
              <g key={i}>
                <line x1={g.ax} y1={g.ay} x2={g.tx} y2={g.ty} className="stroke-primary" strokeWidth="1.5" />
                <line x1={g.ax} y1={g.ay} x2={g.bx} y2={g.by} className="stroke-primary" strokeWidth="1.5" />
              </g>
            ))}
            <polygon points={planeCorners} className="fill-amber-500 opacity-20" />
            <polygon points={planeCorners} fill="none" strokeWidth="2" strokeDasharray="6 3" className="stroke-amber-600" />
            <text x="12" y="30" fontSize="12" className="fill-foreground">
              β = {beta}° · θ = {theta}°
            </text>
            <text x="12" y="390" fontSize="11" className="fill-muted-foreground">
              Section: {TYPE_LABEL[type]}
            </text>
          </svg>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Cone half-angle β: <b className="tabular-nums">{beta}°</b>
            </span>
            <input
              type="range"
              min={10}
              max={45}
              step={1}
              value={beta}
              onChange={(e2) => setBeta(Number(e2.target.value))}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Cone half angle beta, currently ${beta} degrees`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Plane tilt from horizontal θ: <b className="tabular-nums">{theta}°</b>
            </span>
            <input
              type="range"
              min={0}
              max={90}
              step={1}
              value={theta}
              onChange={(e2) => setTheta(Number(e2.target.value))}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Plane tilt from horizontal theta, currently ${theta} degrees`}
            />
          </label>
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            θ = 0° gives a circle; 0 &lt; θ &lt; β an ellipse; θ = β exactly a parabola; θ &gt; β a hyperbola. Here θ is{' '}
            <b>{theta === 0 ? '0° (circle case)' : theta < beta ? 'below β' : theta === beta ? 'exactly β' : 'above β'}</b>.
          </p>
        </div>

        {/* ---------------- 2D conic + equation ---------------- */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Shapes className="size-4" aria-hidden="true" /> The section in standard position
          </h3>
          <svg viewBox="0 0 340 260" className="w-full" role="img" aria-label={`Standard-position graph of the ${type} with its foci and directrix`}>
            <line x1="10" y1="130" x2="330" y2="130" className="stroke-border" strokeWidth="1" />
            <line x1="170" y1="10" x2="170" y2="250" className="stroke-border" strokeWidth="1" />
            {type === 'circle' && <circle cx={X2(0)} cy={Y2(0)} r={3 * S2} fill="none" strokeWidth="3" className="stroke-emerald-500" />}
            {type === 'ellipse' && <ellipse cx={X2(0)} cy={Y2(0)} rx={aFix * S2} ry={bEll * S2} fill="none" strokeWidth="3" className="stroke-emerald-500" />}
            {type === 'parabola' && <polyline points={parabolaPts} fill="none" strokeWidth="3" className="stroke-emerald-500" />}
            {type === 'hyperbola' && (
              <>
                <polyline points={hypPts(1)} fill="none" strokeWidth="3" className="stroke-emerald-500" />
                <polyline points={hypPts(-1)} fill="none" strokeWidth="3" className="stroke-emerald-500" />
              </>
            )}
            {type === 'ellipse' && (
              <>
                <circle cx={X2(cEll)} cy={Y2(0)} r="4" className="fill-sky-600" />
                <circle cx={X2(-cEll)} cy={Y2(0)} r="4" className="fill-sky-600" />
              </>
            )}
            {type === 'parabola' && <circle cx={X2(aPar)} cy={Y2(0)} r="4" className="fill-sky-600" />}
            {type === 'hyperbola' && (
              <>
                <circle cx={X2(cHyp)} cy={Y2(0)} r="4" className="fill-sky-600" />
                <circle cx={X2(-cHyp)} cy={Y2(0)} r="4" className="fill-sky-600" />
              </>
            )}
            {showDirectrices && (
              <>
                <line x1={X2(aFix / e)} y1="10" x2={X2(aFix / e)} y2="250" strokeWidth="1.5" strokeDasharray="5 4" className="stroke-amber-600" />
                <line x1={X2(-aFix / e)} y1="10" x2={X2(-aFix / e)} y2="250" strokeWidth="1.5" strokeDasharray="5 4" className="stroke-amber-600" />
              </>
            )}
            {type === 'parabola' && (
              <line x1={X2(-aPar)} y1="10" x2={X2(-aPar)} y2="250" strokeWidth="1.5" strokeDasharray="5 4" className="stroke-amber-600" />
            )}
            <text x="12" y="24" fontSize="12" className="fill-foreground">{TYPE_LABEL[type]} · e = {type === 'circle' ? '0' : e.toFixed(2)}</text>
            <text x="12" y="246" fontSize="11" className="fill-muted-foreground">blue: foci · dashed: directrix</text>
          </svg>
          <p className="rounded-xl border border-border bg-card p-3 text-sm font-semibold tabular-nums">{equationLine}</p>
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            Eccentricity from the geometry: e = sin θ / sin β{theta === 0 ? ' — with θ = 0 the section is a circle and we set e = 0.' : ` = sin ${theta}° / sin ${beta}° ≈ ${e.toFixed(2)}.`} For
            the ellipse and hyperbola the canonical a is fixed at 4 units and b, c follow from e; the parabola uses y² = 4ax with a = 2.
          </p>
        </div>
      </div>

      {/* ---------------- Challenge ---------------- */}
      <div className="mt-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">Cone challenge: identify 4 setups</h3>
          <p className="text-sm text-muted-foreground">
            Solved: <b className="tabular-nums">{Math.min(solved, 4)}/4</b>
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4" aria-hidden="true">
          {setups.map((s, i) => (
            <div key={`${s.type}-${i}`} className={cn('h-2 rounded-full', i < solved ? 'bg-emerald-500' : 'bg-muted')} />
          ))}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <PredictFirst
            key={`type-${idx}-${typeKey}`}
            prompt={`Setup ${idx + 1}: a cone with half-angle β = ${setup.beta}° is cut by a plane tilted θ = ${setup.theta}° from the horizontal. Which conic is the section?`}
            options={typeOptions}
            explain={typeExplain}
            onResolved={onTypeResolved}
          />
          <PredictFirst
            key={`e-${idx}-${eKey}`}
            prompt={`Same setup (β = ${setup.beta}°, θ = ${setup.theta}°): is the eccentricity e = sin θ / sin β less than 1, exactly 1, or greater than 1?`}
            options={eOptions}
            explain={eExplain}
            onResolved={onEResolved}
          />
        </div>
        <p
          role="status"
          aria-live="polite"
          className={cn('mt-3 text-sm font-semibold', verdict === 'ok' && 'text-emerald-600', verdict === 'retry' && 'text-amber-600')}
        >
          {feedback || 'Both predictions for a setup must be right to solve it — wrong picks just ask you to look again.'}
        </p>
        {setupDone && solved < 4 && (
          <button
            onClick={nextSetup}
            className="press mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Next setup ({idx + 2} of 4)
          </button>
        )}
        {solved >= 4 && (
          <p className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
            <Trophy className="size-4 shrink-0" aria-hidden="true" />
            Four setups classified — circle, ellipse, parabola and hyperbola are all yours.
          </p>
        )}
      </div>

      <ChapterRef
        className="mt-4"
        subject="Mathematics"
        chapter="Ch 11 — Conic Sections"
        topic="Sections of a cone: circle, ellipse, parabola, hyperbola"
      />
    </GameShell>
  );
}
