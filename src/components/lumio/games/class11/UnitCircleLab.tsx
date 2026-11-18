'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { CircleDot, MousePointer2, Trophy, Waves } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, type PredictOption } from './shared';
import { cn } from '@/lib/utils';

/**
 * Unit Circle Lab: drag a point around a unit circle (or use the accessible
 * angle slider), watch sin / cos / tan and a pi-based radians readout, trace
 * the sine and cosine waves, and answer six sign / value questions to win.
 * All values are exact trigonometry — nothing here is approximated beyond
 * ordinary float rounding.
 */

const CX = 170;
const CY = 170;
const R = 125;
const GOAL = 6;

const COMMON_ANGLES: Array<{ deg: number; label: string }> = [
  { deg: 0, label: '0' },
  { deg: 30, label: 'π/6' },
  { deg: 45, label: 'π/4' },
  { deg: 60, label: 'π/3' },
  { deg: 90, label: 'π/2' },
  { deg: 120, label: '2π/3' },
  { deg: 135, label: '3π/4' },
  { deg: 150, label: '5π/6' },
  { deg: 180, label: 'π' },
  { deg: 210, label: '7π/6' },
  { deg: 225, label: '5π/4' },
  { deg: 240, label: '4π/3' },
  { deg: 270, label: '3π/2' },
  { deg: 300, label: '5π/3' },
  { deg: 315, label: '7π/4' },
  { deg: 330, label: '11π/6' },
  { deg: 360, label: '2π' },
];

/** Question angles: never on an axis, so every sign question is unambiguous. */
const QUIZ_DEG = [30, 45, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330];

const ARC_PATHS = [
  'M 295 170 A 125 125 0 0 0 170 45',
  'M 170 45 A 125 125 0 0 0 45 170',
  'M 45 170 A 125 125 0 0 0 170 295',
  'M 170 295 A 125 125 0 0 0 295 170',
];
const QUAD_COLORS = ['stroke-emerald-500', 'stroke-sky-500', 'stroke-amber-500', 'stroke-rose-500'];
const QUAD_FILL = ['fill-emerald-500', 'fill-sky-500', 'fill-amber-500', 'fill-rose-500'];
const QUAD_LABEL_POS: Array<[number, number]> = [
  [278, 62],
  [58, 62],
  [58, 282],
  [278, 282],
];

// Wave panel: 0-360 deg maps to x 24-544; value -1..1 maps to y 147-23 (centre 85, amplitude 62).
const WX = (d: number) => 24 + (d * 520) / 360;
const WY = (v: number) => 85 - v * 62;

function quadrantOf(deg: number): 1 | 2 | 3 | 4 {
  const d = ((deg % 360) + 360) % 360;
  return ((Math.floor(d / 90) % 4) + 1) as 1 | 2 | 3 | 4;
}

function sinSign(q: number): '+' | '-' {
  return q <= 2 ? '+' : '-';
}
function cosSign(q: number): '+' | '-' {
  return q === 1 || q === 4 ? '+' : '-';
}
function tanSign(q: number): '+' | '-' {
  return q === 1 || q === 3 ? '+' : '-';
}

/** Pointer position -> angle in degrees, via the SVG screen transform matrix. */
function angleFromPointer(svg: SVGSVGElement | null, clientX: number, clientY: number): number | null {
  if (!svg) return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  const dx = pt.x - CX;
  const dy = CY - pt.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return null;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

interface QuizQuestion {
  prompt: string;
  options: PredictOption[];
  explain: string;
}

function makeQuestion(prevPrompt: string): QuizQuestion {
  const kinds: Array<'sin' | 'cos' | 'tan' | 'quad'> = ['sin', 'cos', 'tan', 'quad'];
  let out: QuizQuestion;
  do {
    const deg = QUIZ_DEG[Math.floor(Math.random() * QUIZ_DEG.length)];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const q = quadrantOf(deg);
    if (kind === 'quad') {
      out = {
        prompt: `Which quadrant does ${deg}° lie in?`,
        options: ([1, 2, 3, 4] as const).map((n) => ({ label: `Quadrant ${n}`, correct: n === q })),
        explain: `${deg}° sits between ${(q - 1) * 90}° and ${q * 90}°, so it lies in quadrant ${q}.`,
      };
    } else {
      const sign = kind === 'sin' ? sinSign(q) : kind === 'cos' ? cosSign(q) : tanSign(q);
      out = {
        prompt: `What is the sign of ${kind} ${deg}°?`,
        options: [
          { label: 'Positive', correct: sign === '+' },
          { label: 'Negative', correct: sign === '-' },
        ],
        explain: `${deg}° lies in quadrant ${q}, where ${kind} is ${sign === '+' ? 'positive' : 'negative'}.`,
      };
    }
  } while (out.prompt === prevPrompt);
  return out;
}

export function UnitCircleLabGame(props: GameProps) {
  const [angleDeg, setAngleDeg] = useState(60);
  const [showPi, setShowPi] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [question, setQuestion] = useState<QuizQuestion>(() => makeQuestion(''));
  const [quizKey, setQuizKey] = useState(0);
  const [score, setScore] = useState(0);
  const [verdict, setVerdict] = useState<'none' | 'ok' | 'retry'>('none');
  const [feedback, setFeedback] = useState('');
  const svgRef = useRef<SVGSVGElement | null>(null);

  // ---- Derived values (declared above any effect) -------------------------
  const rad = (angleDeg * Math.PI) / 180;
  const sinV = Math.sin(rad);
  const cosV = Math.cos(rad);
  const normDeg = ((Math.round(angleDeg) % 360) + 360) % 360;
  const onAxis = normDeg % 90 === 0;
  const tanUndefined = normDeg === 90 || normDeg === 270;
  const tanV = tanUndefined ? null : sinV / cosV;
  const quad = quadrantOf(normDeg);
  const common = COMMON_ANGLES.find((c) => Math.abs(normDeg - c.deg) <= 1);
  const radDec = rad.toFixed(3);
  const radLabel = showPi ? (common ? common.label : radDec) : radDec;
  const px = CX + R * cosV;
  const py = CY - R * sinV;
  const won = score >= GOAL;

  const sinPts = Array.from({ length: 121 }, (_, i) => {
    const d = i * 3;
    return `${WX(d).toFixed(1)},${WY(Math.sin((d * Math.PI) / 180)).toFixed(1)}`;
  }).join(' ');
  const cosPts = Array.from({ length: 121 }, (_, i) => {
    const d = i * 3;
    return `${WX(d).toFixed(1)},${WY(Math.cos((d * Math.PI) / 180)).toFixed(1)}`;
  }).join(' ');

  // ---- Drag: window listeners while dragging, always cleaned up -----------
  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) {
      const a = angleFromPointer(svgRef.current, e.clientX, e.clientY);
      if (a !== null) setAngleDeg(Math.round(a));
    }
    function onEnd() {
      setDragging(false);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [dragging]);

  function onCirclePointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    setDragging(true);
    const a = angleFromPointer(e.currentTarget, e.clientX, e.clientY);
    if (a !== null) setAngleDeg(Math.round(a));
  }

  function resolveQuiz(ok: boolean) {
    if (ok) {
      const s = score + 1;
      setScore(s);
      setVerdict('ok');
      if (s >= GOAL) {
        setFeedback('All six questions correct — the unit circle is yours.');
        props.onWin();
      } else {
        setFeedback(`Correct. ${s} of ${GOAL} so far — next question coming up.`);
        setQuestion(makeQuestion(question.prompt));
        setQuizKey((k) => k + 1);
      }
    } else {
      setVerdict('retry');
      setFeedback('Not quite — find the quadrant first, then read the sign off the table. Same question, try again.');
      setQuizKey((k) => k + 1);
    }
  }

  return (
    <GameShell
      title="Unit Circle Lab"
      blurb="Drag the point around the circle and watch sin, cos and tan change. Trace the waves, read the radians, then prove you can call the signs in every quadrant."
      modelNote="All readouts are computed from the exact trigonometric functions; the wave panel is sampled every 3° for drawing only. The pi display snaps to a common angle when the pointer lands within 1° of one."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------------- Circle + readouts ---------------- */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <CircleDot className="size-4" aria-hidden="true" /> The unit circle
          </h3>
          <svg
            ref={svgRef}
            viewBox="0 0 340 340"
            className={cn('w-full touch-none select-none', dragging ? 'cursor-grabbing' : 'cursor-grab')}
            role="img"
            aria-label={`Unit circle with the point at ${normDeg} degrees, in quadrant ${quad}`}
            onPointerDown={onCirclePointerDown}
          >
            {/* axes */}
            <line x1="28" y1="170" x2="312" y2="170" className="stroke-border" strokeWidth="1.5" />
            <line x1="170" y1="28" x2="170" y2="312" className="stroke-border" strokeWidth="1.5" />
            {/* quadrant arcs */}
            {ARC_PATHS.map((d, i) => (
              <path
                key={d}
                d={d}
                fill="none"
                strokeLinecap="round"
                strokeWidth={quad === i + 1 && !onAxis ? 6 : 3}
                className={cn(QUAD_COLORS[i], onAxis || quad === i + 1 ? '' : 'opacity-40')}
              />
            ))}
            {[1, 2, 3, 4].map((q) => (
              <text
                key={q}
                x={QUAD_LABEL_POS[q - 1][0]}
                y={QUAD_LABEL_POS[q - 1][1]}
                textAnchor="middle"
                fontSize="13"
                fontWeight="bold"
                className={cn('fill-muted-foreground', quad === q && !onAxis && 'fill-foreground')}
              >
                {['I', 'II', 'III', 'IV'][q - 1]}
              </text>
            ))}
            {/* radius and dropped lines */}
            <line x1={CX} y1={CY} x2={px} y2={py} className="stroke-primary" strokeWidth="2.5" />
            <line x1={px} y1={py} x2={px} y2={CY} className="stroke-emerald-500" strokeWidth="1.5" strokeDasharray="4 3" />
            <line x1={px} y1={py} x2={CX} y2={py} className="stroke-sky-500" strokeWidth="1.5" strokeDasharray="4 3" />
            {/* the draggable point (always clamped to radius 1) */}
            <circle cx={px} cy={py} r="9" className="fill-primary stroke-background" strokeWidth="2.5" />
          </svg>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MousePointer2 className="size-3.5 shrink-0" aria-hidden="true" />
            Drag anywhere on the circle to move the point — it always snaps back to radius 1. The slider below is the keyboard-friendly way.
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Angle θ: <b className="tabular-nums">{normDeg}°</b> · radians <b className="tabular-nums">{radLabel}</b>
            </span>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={Math.min(360, Math.max(0, Math.round(angleDeg)))}
              onChange={(e) => setAngleDeg(Number(e.target.value))}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Angle theta in degrees, currently ${normDeg} degrees`}
            />
          </label>
          <button
            onClick={() => setShowPi((v) => !v)}
            aria-pressed={showPi}
            className="press inline-flex min-h-[44px] self-start items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
          >
            π-style radians: {showPi ? 'on' : 'off'}
          </button>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl border border-border p-2 text-center">
              <span className="block text-xs text-muted-foreground">sin θ</span>
              <b className="tabular-nums">{sinV.toFixed(4)}</b>
            </div>
            <div className="rounded-xl border border-border p-2 text-center">
              <span className="block text-xs text-muted-foreground">cos θ</span>
              <b className="tabular-nums">{cosV.toFixed(4)}</b>
            </div>
            <div className="rounded-xl border border-border p-2 text-center">
              <span className="block text-xs text-muted-foreground">tan θ</span>
              <b className="tabular-nums">{tanV === null ? 'undefined' : tanV.toFixed(4)}</b>
            </div>
          </div>
          <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
            {tanUndefined
              ? `tan ${normDeg}° is undefined — tan is sin divided by cos, and cos ${normDeg}° = 0, so the division has no value. That is the honest answer, not an error.`
              : `θ = ${normDeg}° is ${onAxis ? 'on an axis (the boundary of quadrant ' + quad + ')' : 'in quadrant ' + quad}: sin is ${sinSign(quad) === '+' ? 'positive' : 'negative'}, cos is ${cosSign(quad) === '+' ? 'positive' : 'negative'}, tan is ${tanSign(quad) === '+' ? 'positive' : 'negative'}.`}
            {!common && ` ${normDeg}° is not one of the common angles, so radians are shown as a decimal (${radDec}).`}
          </p>
        </div>

        {/* ---------------- Waves + sign table ---------------- */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Waves className="size-4" aria-hidden="true" /> Sine and cosine waves
          </h3>
          <svg viewBox="0 0 560 170" className="w-full" role="img" aria-label={`Sine and cosine traced from 0 to 360 degrees with the current angle at ${normDeg} degrees`}>
            {[0, 90, 180, 270].map((d, i) => (
              <rect key={d} x={WX(d)} y="14" width={WX(90) - WX(0)} height="142" className={cn(QUAD_FILL[i], 'opacity-10')} />
            ))}
            <line x1="24" y1="85" x2="544" y2="85" className="stroke-border" strokeWidth="1" />
            {[0, 90, 180, 270, 360].map((d) => (
              <text key={d} x={WX(d)} y="165" textAnchor="middle" fontSize="10" className="fill-muted-foreground">
                {d}°
              </text>
            ))}
            <polyline points={cosPts} fill="none" strokeWidth="2" strokeDasharray="5 4" className="stroke-sky-500" />
            <polyline points={sinPts} fill="none" strokeWidth="2.5" className="stroke-emerald-500" />
            <line x1={WX(normDeg)} y1="14" x2={WX(normDeg)} y2="156" className="stroke-foreground" strokeWidth="1" opacity="0.5" />
            <circle cx={WX(normDeg)} cy={WY(sinV)} r="5" className="fill-emerald-500" />
            <circle cx={WX(normDeg)} cy={WY(cosV)} r="5" className="fill-sky-500" />
            <text x="28" y="24" fontSize="11" className="fill-emerald-600">sin</text>
            <text x="60" y="24" fontSize="11" className="fill-sky-600">cos</text>
          </svg>

          <h4 className="mt-1 text-sm font-bold">Signs by quadrant</h4>
          <table className="w-full max-w-sm text-sm tabular-nums">
            <caption className="sr-only">Signs of sin, cos and tan in each quadrant</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-2 py-1 font-semibold">Quadrant</th>
                <th scope="col" className="px-2 py-1 font-semibold">sin</th>
                <th scope="col" className="px-2 py-1 font-semibold">cos</th>
                <th scope="col" className="px-2 py-1 font-semibold">tan</th>
              </tr>
            </thead>
            <tbody>
              {([1, 2, 3, 4] as const).map((q) => (
                <tr key={q} className={cn('border-b border-border/60 last:border-0', quad === q && !onAxis && 'bg-primary/5')}>
                  <td className="px-2 py-1 font-semibold">{['I', 'II', 'III', 'IV'][q - 1]}</td>
                  <td className="px-2 py-1">{sinSign(q)}</td>
                  <td className="px-2 py-1">{cosSign(q)}</td>
                  <td className="px-2 py-1">{tanSign(q)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">
            Mnemonic — Add Sugar To Coffee: walk anticlockwise from quadrant I and the letters A, S, T, C tell you what is positive there — All in I, Sin in II, Tan in III, Cos in IV.
          </p>
        </div>
      </div>

      {/* ---------------- Quiz ---------------- */}
      <div className="mt-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">Sign check: {GOAL} correct answers wins</h3>
          <p className="text-sm text-muted-foreground">
            Score: <b className="tabular-nums">{Math.min(score, GOAL)}/{GOAL}</b>
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-6" aria-hidden="true">
          {Array.from({ length: GOAL }, (_, i) => (
            <div key={i} className={cn('h-2 rounded-full', i < score ? 'bg-emerald-500' : 'bg-muted')} />
          ))}
        </div>
        <PredictFirst
          key={quizKey}
          prompt={question.prompt}
          options={question.options}
          explain={question.explain}
          onResolved={resolveQuiz}
          className="mt-3"
        />
        <p
          role="status"
          aria-live="polite"
          className={cn('mt-3 text-sm font-semibold', verdict === 'ok' && 'text-emerald-600', verdict === 'retry' && 'text-amber-600')}
        >
          {feedback || 'Answer six questions — a wrong pick just asks you to look again, it never costs progress.'}
        </p>
        {won && (
          <p className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
            <Trophy className="size-4 shrink-0" aria-hidden="true" />
            Six for six — you can read every quadrant like a trigonometer.
          </p>
        )}
      </div>

      <ChapterRef
        className="mt-4"
        subject="Mathematics"
        chapter="Ch 3 — Trigonometric Functions"
        topic="Unit circle, signs of trig functions"
      />
    </GameShell>
  );
}
