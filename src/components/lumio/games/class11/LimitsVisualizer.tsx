'use client';

import { useState } from 'react';
import { LineChart, Table as TableIcon, Trophy } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef } from './shared';
import { cn } from '@/lib/utils';

/**
 * LimitsVisualizer: four curated functions around a point a. A slider walks
 * h down in log steps; the secant through (a, f(a)) and (a+h, f(a+h)) visibly
 * flattens onto the tangent. The learner commits a limit value (tolerance
 * 0.05), then the true tangent and the converging column are revealed.
 * Three functions solved wins.
 */

interface FnDef {
  id: string;
  label: string;
  a: number;
  /** The removed value at a for hole functions (f(a) as first principles needs it). */
  fa: number;
  limit: number;
  deriv: number;
  hole: boolean;
  win: { x0: number; x1: number; y0: number; y1: number };
  f: (x: number) => number;
  note: string;
}

const FNS: FnDef[] = [
  {
    id: 'quad',
    label: 'f(x) = x²',
    a: 2,
    fa: 4,
    limit: 4,
    deriv: 4,
    hole: false,
    win: { x0: -1, x1: 5, y0: -2, y1: 18 },
    f: (x) => x * x,
    note: 'A smooth polynomial — the point at a = 2 sits right on the curve.',
  },
  {
    id: 'hole1',
    label: 'f(x) = (x² − 1)/(x − 1)',
    a: 1,
    fa: 2,
    limit: 2,
    deriv: 2,
    hole: true,
    win: { x0: -1.5, x1: 3.5, y0: -1, y1: 6 },
    f: (x) => (x * x - 1) / (x - 1),
    note: 'The formula is undefined at x = 1 (open circle at height 2), but values around it approach 2 — a removable discontinuity.',
  },
  {
    id: 'sinc',
    label: 'f(x) = sin(x)/x',
    a: 0,
    fa: 1,
    limit: 1,
    deriv: 0,
    hole: true,
    win: { x0: -4, x1: 4, y0: -0.6, y1: 1.6 },
    f: (x) => Math.sin(x) / x,
    note: 'The formula is undefined at x = 0 (open circle at height 1). The curve approaches 1 while the secant slopes approach 0 — the limit of f and the slope of its tangent are genuinely different numbers here.',
  },
  {
    id: 'cube',
    label: 'f(x) = (x³ − 8)/(x − 2)',
    a: 2,
    fa: 12,
    limit: 12,
    deriv: 12,
    hole: true,
    win: { x0: -1, x1: 5, y0: -4, y1: 24 },
    f: (x) => (x * x * x - 8) / (x - 2),
    note: 'The formula is undefined at x = 2 (open circle at height 12); nearby values approach 12, which is also the slope of x³ at 2.',
  },
];

const H_STEPS = [1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001];
const TOL = 0.05;

export function LimitsVisualizerLab(props: GameProps) {
  const [fnId, setFnId] = useState(FNS[0].id);
  const [hIdx, setHIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const [committed, setCommitted] = useState<Record<string, boolean>>({});
  const [showTan, setShowTan] = useState(false);
  const [verdict, setVerdict] = useState<'none' | 'ok' | 'retry'>('none');
  const [feedback, setFeedback] = useState('');

  // ---- Derived (above all handlers; no effects in this lab) ---------------
  const fn = FNS.find((f) => f.id === fnId) ?? FNS[0];
  const h = H_STEPS[Math.min(hIdx, H_STEPS.length - 1)];
  const fa2 = fn.f(fn.a + h);
  const slope = (fa2 - fn.fa) / h;
  const committedHere = committed[fn.id] === true;
  const isSolved = solved[fn.id] === true;
  const solvedCount = Object.values(solved).filter(Boolean).length;
  const rows = H_STEPS.map((hs) => ({ hs, s: (fn.f(fn.a + hs) - fn.fa) / hs }));

  // Graph mapping: viewBox 560x320, plot area x 30-540, y 20-290.
  const X = (x: number) => 30 + ((x - fn.win.x0) / (fn.win.x1 - fn.win.x0)) * 510;
  const Y = (y: number) => 290 - ((y - fn.win.y0) / (fn.win.y1 - fn.win.y0)) * 270;
  const segments: string[] = (() => {
    const segs: string[] = [];
    let cur: string[] = [];
    for (let i = 0; i <= 240; i++) {
      const x = fn.win.x0 + ((fn.win.x1 - fn.win.x0) * i) / 240;
      const y = fn.f(x);
      if (!Number.isFinite(y) || Math.abs(x - fn.a) < (fn.win.x1 - fn.win.x0) / 400) {
        if (cur.length > 1) segs.push(cur.join(' '));
        cur = [];
      } else {
        cur.push(`${X(x).toFixed(1)},${Y(y).toFixed(1)}`);
      }
    }
    if (cur.length > 1) segs.push(cur.join(' '));
    return segs;
  })();
  const secY0 = fn.fa + slope * (fn.win.x0 - fn.a);
  const secY1 = fn.fa + slope * (fn.win.x1 - fn.a);
  const tanY0 = fn.fa + fn.deriv * (fn.win.x0 - fn.a);
  const tanY1 = fn.fa + fn.deriv * (fn.win.x1 - fn.a);

  function changeFn(id: string) {
    setFnId(id);
    setAnswer('');
    setShowTan(false);
    setVerdict('none');
    setFeedback('');
  }

  function submit() {
    const val = Number(answer);
    if (answer.trim() === '' || !Number.isFinite(val)) {
      setVerdict('retry');
      setFeedback('Type a number first, then commit.');
      return;
    }
    setCommitted((c) => ({ ...c, [fn.id]: true }));
    const ok = Math.abs(val - fn.limit) <= TOL;
    if (ok) {
      setSolved((s) => ({ ...s, [fn.id]: true }));
      setVerdict('ok');
      setFeedback(`Within 0.05 of the true limit — and the difference-quotient column was indeed settling toward one number. The tangent is now revealed.`);
      const already = solved[fn.id] === true;
      const total = Object.values(solved).filter(Boolean).length + (already ? 0 : 1);
      if (total >= 3) props.onWin();
    } else {
      setVerdict('retry');
      setFeedback(
        'Not within 0.05 of the limit. Walk h down the table, watch where the y-values on the graph settle as x closes in on a, and commit again.'
      );
    }
  }

  return (
    <GameShell
      title="Limits Visualizer — First Principles"
      blurb="Slide h toward 0 and watch the secant line through (a, f(a)) and (a + h, f(a + h)) flatten onto the tangent. Commit the limit value, then compare with the true tangent."
      modelNote="Secant slopes are computed numerically from the formulas; the 6th decimal may wobble by tiny rounding — that is floating-point behaviour, not a maths error. For f(x) = sin(x)/x the limit of the curve (1) and the tangent slope (0) are intentionally different ideas."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Function selector">
        {FNS.map((f) => (
          <button
            key={f.id}
            onClick={() => changeFn(f.id)}
            aria-pressed={fnId === f.id}
            className={cn(
              'press inline-flex min-h-[44px] items-center rounded-xl border px-3 text-sm font-medium tabular-nums',
              fnId === f.id ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent/10'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">
        {fn.note}
      </p>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {/* ---------------- Graph ---------------- */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <LineChart className="size-4" aria-hidden="true" /> Graph near a = {fn.a}
          </h3>
          <svg
            viewBox="0 0 560 320"
            className="w-full"
            role="img"
            aria-label={`Graph of ${fn.label} near a = ${fn.a} with a secant for h = ${h}`}
          >
            {fn.win.y0 <= 0 && fn.win.y1 >= 0 && (
              <line x1="30" y1={Y(0).toFixed(1)} x2="540" y2={Y(0).toFixed(1)} className="stroke-border" strokeWidth="1" />
            )}
            {fn.win.x0 <= 0 && fn.win.x1 >= 0 && (
              <line x1={X(0).toFixed(1)} y1="20" x2={X(0).toFixed(1)} y2="290" className="stroke-border" strokeWidth="1" />
            )}
            {segments.map((pts, i) => (
              <polyline key={i} points={pts} fill="none" strokeWidth="2.5" className="stroke-primary" />
            ))}
            {committedHere && showTan && (
              <line
                x1={X(fn.win.x0).toFixed(1)}
                y1={tanY0.toFixed(1)}
                x2={X(fn.win.x1).toFixed(1)}
                y2={tanY1.toFixed(1)}
                strokeWidth="2"
                strokeDasharray="7 5"
                className="stroke-emerald-600"
              />
            )}
            <line
              x1={X(fn.win.x0).toFixed(1)}
              y1={secY0.toFixed(1)}
              x2={X(fn.win.x1).toFixed(1)}
              y2={secY1.toFixed(1)}
              strokeWidth="2"
              className="stroke-amber-600"
            />
            {fn.hole ? (
              <circle cx={X(fn.a).toFixed(1)} cy={Y(fn.fa).toFixed(1)} r="6" strokeWidth="2.5" className="fill-background stroke-foreground" />
            ) : (
              <circle cx={X(fn.a).toFixed(1)} cy={Y(fn.fa).toFixed(1)} r="6" className="fill-foreground" />
            )}
            <circle cx={X(fn.a + h).toFixed(1)} cy={Y(fa2).toFixed(1)} r="5" className="fill-amber-600" />
            <text x="36" y="34" fontSize="12" className="fill-foreground">amber: secant{committedHere && showTan ? ' · green dashed: true tangent' : ''}</text>
            <text x="36" y="50" fontSize="11" className="fill-muted-foreground">
              open/fixed point at a = {fn.a}, sliding point at a + h
            </text>
          </svg>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Step h: <b className="tabular-nums">{h}</b>
            </span>
            <input
              type="range"
              min={0}
              max={H_STEPS.length - 1}
              step={1}
              value={Math.min(hIdx, H_STEPS.length - 1)}
              onChange={(e) => setHIdx(Number(e.target.value))}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`h step index, currently h = ${h}`}
            />
          </label>
          <p className="text-sm">
            Secant slope for this h: <b className="tabular-nums">{slope.toFixed(6)}</b>
            {committedHere && showTan && (
              <>
                {' '}· true tangent slope: <b className="tabular-nums">{fn.deriv}</b>
              </>
            )}
          </p>
          {committedHere && (
            <button
              onClick={() => setShowTan((v) => !v)}
              aria-pressed={showTan}
              className="press inline-flex min-h-[44px] self-start items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
            >
              <LineChart className="size-4" aria-hidden="true" /> {showTan ? 'Hide true tangent' : 'Show true tangent'}
            </button>
          )}
        </div>

        {/* ---------------- Commit + table ---------------- */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <TableIcon className="size-4" aria-hidden="true" /> Difference quotient
          </h3>
          <PredictFirst
            key={`pf-${fn.id}`}
            prompt="As h approaches 0, what does the secant slope approach?"
            options={[
              { label: 'One fixed finite number', correct: true },
              { label: 'It grows without bound' },
              { label: 'Different values from the left and the right' },
              { label: 'It always approaches 0' },
            ]}
            explain="For all four functions here the secant slopes settle onto a single finite number — the derivative of f at a. That is exactly the number the difference-quotient column is converging to."
          />
          <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-sm tabular-nums">
              <caption className="sr-only">Difference quotient (f(a+h) − f(a))/h for each h step</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="px-2 py-1.5 font-semibold">h</th>
                  <th scope="col" className={cn('px-2 py-1.5 font-semibold', committedHere && isSolved && 'bg-emerald-500/10')}>(f(a+h) − f(a))/h</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.hs}
                    className={cn(
                      'border-b border-border/60 last:border-0',
                      i === hIdx && 'bg-primary/5',
                      committedHere && isSolved && 'bg-emerald-500/10'
                    )}
                  >
                    <td className="px-2 py-1.5">{r.hs}</td>
                    <td className="px-2 py-1.5">{r.s.toFixed(6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm font-semibold">Your commit: what value does f(x) approach as x → a?</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              step={0.01}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="press min-h-[44px] w-40 rounded-xl border border-border bg-card px-3 text-sm tabular-nums"
              aria-label="Your limit value guess"
              placeholder="e.g. 4"
            />
            <button
              onClick={submit}
              className="press inline-flex min-h-[44px] items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Commit answer
            </button>
          </div>
          <p
            role="status"
            aria-live="polite"
            className={cn('text-sm font-semibold', verdict === 'ok' && 'text-emerald-600', verdict === 'retry' && 'text-amber-600')}
          >
            {feedback || 'Commit the limit value (tolerance 0.05) — the tangent is revealed after your first commit.'}
          </p>
          <p className="text-sm text-muted-foreground">
            Solved: <b className="tabular-nums">{solvedCount}/3</b> — any three of the four functions wins.
          </p>
          {solvedCount >= 3 && (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
              <Trophy className="size-4 shrink-0" aria-hidden="true" />
              Three limits nailed — you have watched a secant become a tangent by first principles.
            </p>
          )}
        </div>
      </div>

      <ChapterRef
        className="mt-4"
        subject="Mathematics"
        chapter="Ch 13 — Limits and Derivatives"
        topic="Derivative by first principles"
      />
    </GameShell>
  );
}
