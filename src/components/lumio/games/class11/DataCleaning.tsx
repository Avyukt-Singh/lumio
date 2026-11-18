'use client';

import { useMemo, useState } from 'react';
import { BrushCleaning, CheckCircle2, Lock, RotateCcw } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Data Cleaning lab (Class 11 AI / Applied Maths): a seeded, messy
 * study-hours vs test-score dataset with missing values, duplicates,
 * outliers and minutes-recorded-as-hours rows. Four cleaning steps feed a
 * live scatter plot with a least-squares line, then a verifiable
 * interpretation quiz computes its answers from the real before/after data.
 */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGauss(rand: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = rand();
    if (u < 1e-12) u = 1e-12;
    const v = rand();
    const m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  };
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

interface DataRow {
  id: number;
  hours: number | null; // as recorded (minutes rows store minutes here)
  score: number | null;
}

// Module-level dataset (41 rows), generated once with a fixed seed.
const randData = mulberry32(42);
const gaussData = makeGauss(randData);
const VALID: [number, number][] = [];
const seenValid = new Set<string>();
while (VALID.length < 28) {
  const h = Math.round((0.5 + randData() * 8) * 2) / 2;
  const s = clamp(Math.round(35 + 4.5 * h + 8 * gaussData()), 0, 100);
  const k = `${h}|${s}`;
  if (seenValid.has(k)) continue;
  seenValid.add(k);
  VALID.push([h, s]);
}
const MINUTES_ROWS: [number, number][] = [
  [90, 42], // 90 min = 1.5 h
  [150, 47], // 150 min = 2.5 h
];
const MISSING_ROWS: [number | null, number | null][] = [
  [3, null],
  [5.5, null],
  [7, null],
  [null, 58],
  [null, 66],
];
const DUPLICATED = [VALID[2], VALID[9], VALID[15]];
const OUTLIER_ROWS: [number, number][] = [
  [9.5, 10],
  [0.5, 93],
  [-4, -6],
];

const RAW_ROWS: DataRow[] = [];
{
  let id = 0;
  for (const [h, s] of VALID) RAW_ROWS.push({ id: id++, hours: h, score: s });
  for (const [h, s] of MINUTES_ROWS) RAW_ROWS.push({ id: id++, hours: h, score: s });
  for (const [h, s] of MISSING_ROWS) RAW_ROWS.push({ id: id++, hours: h, score: s });
  for (const [h, s] of DUPLICATED) RAW_ROWS.push({ id: id++, hours: h, score: s });
  for (const [h, s] of OUTLIER_ROWS) RAW_ROWS.push({ id: id++, hours: h, score: s });
}

interface Fit {
  n: number;
  r: number | null;
  slope: number | null;
  intercept: number;
  meanH: number;
}

function fit(rows: DataRow[]): Fit | null {
  const pts = rows.filter((r) => r.hours !== null && r.score !== null) as { hours: number; score: number }[];
  if (pts.length < 2) return null;
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.hours, 0) / n;
  const my = pts.reduce((s, p) => s + p.score, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const p of pts) {
    sxy += (p.hours - mx) * (p.score - my);
    sxx += (p.hours - mx) * (p.hours - mx);
    syy += (p.score - my) * (p.score - my);
  }
  const slope = sxx > 0 ? sxy / sxx : null;
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
  return { n, r, slope, intercept: my - (slope ?? 0) * mx, meanH: mx };
}

function quartiles(values: number[]): [number, number] {
  const s = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const i = (s.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return s[lo] + (s[hi] - s[lo]) * (i - lo);
  };
  return [q(0.25), q(0.75)];
}

type MissingMode = 'drop' | 'fill';
type OutlierMode = 'remove' | 'keep';

interface Chain {
  stages: DataRow[][]; // raw, after 1, after 2, after 3, after 4
  fences: [number, number];
  flagged: DataRow[];
  convertedCount: number;
}

function buildChain(missing: MissingMode, dedupe: boolean, outliers: OutlierMode, units: boolean): Chain {
  const s1 =
    missing === 'drop'
      ? RAW_ROWS.filter((r) => r.hours !== null && r.score !== null)
      : (() => {
          const hv = RAW_ROWS.filter((r) => r.hours !== null).map((r) => r.hours as number);
          const sv = RAW_ROWS.filter((r) => r.score !== null).map((r) => r.score as number);
          const mh = hv.reduce((a, b) => a + b, 0) / hv.length;
          const ms = sv.reduce((a, b) => a + b, 0) / sv.length;
          return RAW_ROWS.map((r) => ({
            ...r,
            hours: r.hours === null ? Math.round(mh * 10) / 10 : r.hours,
            score: r.score === null ? Math.round(ms * 10) / 10 : r.score,
          }));
        })();
  const s2 = dedupe
    ? (() => {
        const seen = new Set<string>();
        const out: DataRow[] = [];
        for (const r of s1) {
          const k = `${r.hours}|${r.score}`;
          if (seen.has(k)) continue;
          seen.add(k);
          out.push(r);
        }
        return out;
      })()
    : s1;
  const scores = s2.map((r) => r.score as number);
  const [q1, q3] = quartiles(scores);
  const lo = q1 - 1.5 * (q3 - q1);
  const hi = q3 + 1.5 * (q3 - q1);
  const flagged = s2.filter((r) => (r.score as number) < lo || (r.score as number) > hi);
  const s3 =
    outliers === 'remove'
      ? s2.filter((r) => !((r.score as number) < lo || (r.score as number) > hi))
      : s2;
  const convertedCount = s3.filter((r) => (r.hours as number) > 24).length;
  const s4 = units
    ? s3.map((r) => ({ ...r, hours: (r.hours as number) > 24 ? Math.round((r.hours as number) / 6) / 10 : r.hours }))
    : s3;
  return { stages: [RAW_ROWS, s1, s2, s3, s4], fences: [lo, hi], flagged, convertedCount };
}

const STEP_NAMES = ['1 Missing values', '2 Duplicates', '3 Outliers (IQR)', '4 Units (minutes to hours)'];

const X_MIN = 0;
const X_MAX = 12;
const Y_MAX = 100;
const toX = (h: number) => 44 + ((h - X_MIN) / (X_MAX - X_MIN)) * 500;
const toY = (s: number) => 260 - (s / Y_MAX) * 240;

type Tone = 'ok' | 'warn' | 'info';

export function DataCleaningLab(props: GameProps) {
  const [missing, setMissing] = useState<MissingMode>('drop');
  const [dedupe, setDedupe] = useState(true);
  const [outliers, setOutliers] = useState<OutlierMode>('remove');
  const [units, setUnits] = useState(true);
  const [applied, setApplied] = useState<boolean[]>([false, false, false, false]);
  const [report, setReport] = useState<(string | number)[][]>([]);
  const [quizOk, setQuizOk] = useState<(boolean | null)[]>([null, null, null]);
  const [resetCount, setResetCount] = useState(0);
  const [msg, setMsg] = useState('Work through the four cleaning steps, then take the quiz.');
  const [tone, setTone] = useState<Tone>('info');

  // Derived pipeline (depends only on the option states; declared above any effects).
  const chain = useMemo(() => buildChain(missing, dedupe, outliers, units), [missing, dedupe, outliers, units]);
  const appliedCount = applied.filter(Boolean).length;
  const current = chain.stages[appliedCount];
  const currentFit = useMemo(() => fit(current), [current]);
  const rawFit = useMemo(() => fit(RAW_ROWS), []);
  const allApplied = applied.every(Boolean);

  function say(text: string, t: Tone) {
    setMsg(text);
    setTone(t);
  }

  function applyStep(i: number) {
    if (applied[i]) return;
    if (i > 0 && !applied[i - 1]) return;
    const before = chain.stages[i];
    const after = chain.stages[i + 1];
    const fBefore = fit(before);
    const fAfter = fit(after);
    const rB = fBefore?.r;
    const rA = fAfter?.r;
    const rChange = rB !== null && rB !== undefined && rA !== null && rA !== undefined ? rA - rB : null;
    const detail =
      i === 0
        ? missing === 'drop'
          ? 'dropped rows with gaps'
          : 'filled gaps with column means'
        : i === 1
          ? dedupe
            ? 'removed exact duplicate rows'
            : 'kept all rows'
          : i === 2
            ? outliers === 'remove'
              ? `IQR on marks flagged ${chain.flagged.length} rows; removed`
              : 'outliers kept'
            : units
              ? `converted ${chain.convertedCount} minutes rows to hours`
              : 'units left as recorded';
    setReport((r) => [
      ...r,
      [STEP_NAMES[i], before.length, after.length, rChange === null ? 'n/a' : `${rChange >= 0 ? '+' : ''}${rChange.toFixed(3)}`],
    ]);
    const nextApplied = [...applied];
    nextApplied[i] = true;
    setApplied(nextApplied);
    if (nextApplied.every(Boolean)) {
      say(`Step ${i + 1} done (${detail}). All four steps complete — take the interpretation quiz below.`, 'ok');
    } else {
      say(`Step ${i + 1} done (${detail}). ${after.length} rows remain.`, 'ok');
    }
  }

  function resetLab() {
    setMissing('drop');
    setDedupe(true);
    setOutliers('remove');
    setUnits(true);
    setApplied([false, false, false, false]);
    setReport([]);
    setQuizOk([null, null, null]);
    setResetCount((c) => c + 1);
    say('Lab reset — the dataset is messy again.', 'info');
  }

  function answerQuiz(i: number, ok: boolean) {
    const next = quizOk.map((v, idx) => (idx === i ? ok : v));
    setQuizOk(next);
    if (next.every((v) => v === true)) props.onWin();
  }

  const rRaw = rawFit?.r ?? null;
  const rFinal = currentFit?.r ?? null;
  const slopeRaw = rawFit?.slope ?? null;
  const slopeFinal = currentFit?.slope ?? null;
  const rDelta = rRaw !== null && rFinal !== null ? rFinal - rRaw : 0;

  const q1Options = [
    {
      label: `r increased — cleaning strengthened the correlation (about ${(rRaw ?? 0).toFixed(2)} to ${(rFinal ?? 0).toFixed(2)})`,
      correct: rDelta > 0.05,
    },
    { label: 'r decreased — cleaning weakened the correlation', correct: rDelta < -0.05 },
    { label: 'r stayed about the same', correct: Math.abs(rDelta) <= 0.05 },
  ];

  const buckets = [
    { label: 'Less than 2 marks per extra hour', lo: -Infinity, hi: 2 },
    { label: 'Between 3 and 8 marks per extra hour', lo: 3, hi: 8 },
    { label: 'More than 12 marks per extra hour', lo: 12, hi: Infinity },
  ];
  const slopeFinalSafe = slopeFinal ?? 0;
  const q2Options = buckets.map((b) => ({
    label: b.label,
    correct: slopeFinalSafe >= b.lo && slopeFinalSafe <= b.hi,
  }));

  const q3Options = [
    {
      label: `After cleaning, more study hours clearly go with higher marks (r about ${(rFinal ?? 0).toFixed(2)}, slope about ${slopeFinalSafe.toFixed(1)} marks per hour)`,
      correct: (rFinal ?? 0) > 0.5,
    },
    {
      label: `Even after cleaning, the data shows no clear relationship (r about ${(rFinal ?? 0).toFixed(2)})`,
      correct: (rFinal ?? 0) <= 0.5,
    },
    { label: 'The high r proves that studying causes high marks', correct: false },
  ];

  const plotPoints = (rows: DataRow[]) =>
    rows.filter(
      (r) => r.hours !== null && r.score !== null && r.hours >= X_MIN && r.hours <= X_MAX && r.score >= 0 && r.score <= Y_MAX
    );
  const rawGhost = plotPoints(RAW_ROWS);
  const nowPoints = plotPoints(current);

  const linePts =
    currentFit && currentFit.slope !== null
      ? [
          `${toX(X_MIN).toFixed(1)},${toY(clamp(currentFit.intercept, -20, 120)).toFixed(1)}`,
          `${toX(X_MAX).toFixed(1)},${toY(clamp(currentFit.intercept + currentFit.slope * X_MAX, -20, 120)).toFixed(1)}`,
        ].join(' ')
      : '';

  return (
    <GameShell
      title="Data Cleaning Lab"
      blurb="A messy study-hours vs test-score dataset is full of gaps, duplicates, outliers and mixed-up units. Clean it step by step and watch the regression line recover the real trend."
      modelNote="Synthetic dataset (41 rows, seeded so it never shuffles). Filling missing values uses the mean of the still-messy column — filling before fixing units inflates the mean, exactly as in real pipelines."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="flex flex-col gap-4">
        <ChapterRef
          subject="Artificial Intelligence"
          chapter="Class 11 AI / Applied Maths"
          topic="Data cleaning, correlation and regression"
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <BrushCleaning className="size-4" aria-hidden="true" /> Cleaning steps
            </h3>

            <div className={cn('rounded-xl border p-3', applied[0] ? 'border-emerald-500/50' : 'border-border')}>
              <p className="text-sm font-semibold">
                1. Missing values (5 rows affected) {applied[0] && <CheckCircle2 className="inline size-4 text-emerald-600" aria-hidden="true" />}
              </p>
              {(
                [
                  ['drop', 'Drop rows with missing values'],
                  ['fill', 'Fill with the column mean'],
                ] as const
              ).map(([mode, label]) => (
                <label key={mode} className="flex min-h-[44px] items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="missing-mode"
                    checked={missing === mode}
                    onChange={() => setMissing(mode)}
                    disabled={applied[0]}
                    className="accent-primary"
                    aria-label={label}
                  />
                  {label}
                </label>
              ))}
              <Button className="press min-h-[44px] w-full" onClick={() => applyStep(0)} disabled={applied[0]}>
                Apply step 1
              </Button>
            </div>

            <div className={cn('rounded-xl border p-3', applied[1] ? 'border-emerald-500/50' : 'border-border')}>
              <p className="text-sm font-semibold">
                2. Duplicates {applied[1] && <CheckCircle2 className="inline size-4 text-emerald-600" aria-hidden="true" />}
              </p>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dedupe}
                  onChange={(e) => setDedupe(e.target.checked)}
                  disabled={applied[1]}
                  className="accent-primary"
                  aria-label="Remove exact duplicate rows"
                />
                Remove exact duplicates (identical hours + marks pairs)
              </label>
              <Button className="press min-h-[44px] w-full" onClick={() => applyStep(1)} disabled={applied[1] || !applied[0]}>
                Apply step 2
              </Button>
            </div>

            <div className={cn('rounded-xl border p-3', applied[2] ? 'border-emerald-500/50' : 'border-border')}>
              <p className="text-sm font-semibold">
                3. Outliers {applied[2] && <CheckCircle2 className="inline size-4 text-emerald-600" aria-hidden="true" />}
              </p>
              {(
                [
                  ['remove', 'Remove via the IQR rule'],
                  ['keep', 'Keep the outliers'],
                ] as const
              ).map(([mode, label]) => (
                <label key={mode} className="flex min-h-[44px] items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="outlier-mode"
                    checked={outliers === mode}
                    onChange={() => setOutliers(mode)}
                    disabled={applied[2]}
                    className="accent-primary"
                    aria-label={label}
                  />
                  {label}
                </label>
              ))}
              <p className="text-xs text-muted-foreground tabular-nums">
                The IQR rule here runs on the marks column: rows outside [{chain.fences[0].toFixed(1)},{' '}
                {chain.fences[1].toFixed(1)}] would be flagged — {chain.flagged.length} row(s) right now.
              </p>
              <Button className="press min-h-[44px] w-full" onClick={() => applyStep(2)} disabled={applied[2] || !applied[1]}>
                Apply step 3
              </Button>
            </div>

            <div className={cn('rounded-xl border p-3', applied[3] ? 'border-emerald-500/50' : 'border-border')}>
              <p className="text-sm font-semibold">
                4. Unit standardisation {applied[3] && <CheckCircle2 className="inline size-4 text-emerald-600" aria-hidden="true" />}
              </p>
              <label className="flex min-h-[44px] items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={units}
                  onChange={(e) => setUnits(e.target.checked)}
                  disabled={applied[3]}
                  className="accent-primary"
                  aria-label="Convert values above 24 recorded as minutes into hours"
                />
                Convert minutes to hours (values above 24 divided by 60)
              </label>
              <p className="text-xs text-muted-foreground tabular-nums">
                {chain.convertedCount} row(s) would be converted at this point.
              </p>
              <Button className="press min-h-[44px] w-full" onClick={() => applyStep(3)} disabled={applied[3] || !applied[2]}>
                Apply step 4
              </Button>
            </div>

            <Button variant="outline" className="press min-h-[44px] w-full" onClick={resetLab}>
              <RotateCcw className="size-4" aria-hidden="true" /> Reset lab
            </Button>
            {applied.some(Boolean) && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden="true" /> Applied steps are locked; reset the lab to change a choice.
              </p>
            )}
            <p
              role="status"
              aria-live="polite"
              className={cn(
                'text-sm font-semibold',
                tone === 'ok' && 'text-emerald-600',
                tone === 'warn' && 'text-amber-600',
                tone === 'info' && 'text-muted-foreground'
              )}
            >
              {msg}
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="text-sm font-bold">Dataset preview</h3>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm tabular-nums">
                <caption className="sr-only">Current dataset preview</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="px-2 py-1.5 font-semibold">Row</th>
                    <th scope="col" className="px-2 py-1.5 font-semibold">Hours (recorded)</th>
                    <th scope="col" className="px-2 py-1.5 font-semibold">Score (marks)</th>
                  </tr>
                </thead>
                <tbody>
                  {current.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="px-2 py-1">{r.id + 1}</td>
                      <td className="px-2 py-1">{r.hours === null ? '—' : r.hours}</td>
                      <td className="px-2 py-1">{r.score === null ? '—' : r.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="text-sm font-bold">Stats (current state vs raw)</h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p className="rounded-xl border border-border bg-card p-2 tabular-nums">
                Rows: <b>{current.length}</b> (raw {RAW_ROWS.length})
              </p>
              <p className="rounded-xl border border-border bg-card p-2 tabular-nums">
                Rows usable for fit: <b>{currentFit?.n ?? 0}</b>
              </p>
              <p className="rounded-xl border border-border bg-card p-2 tabular-nums">
                r now: <b>{rFinal === null ? 'n/a' : rFinal.toFixed(3)}</b> (raw {rRaw === null ? 'n/a' : rRaw.toFixed(3)})
              </p>
              <p className="rounded-xl border border-border bg-card p-2 tabular-nums">
                Slope now: <b>{slopeFinal === null ? 'n/a' : `${slopeFinal.toFixed(2)} marks/h`}</b> (raw{' '}
                {slopeRaw === null ? 'n/a' : `${slopeRaw.toFixed(2)}`})
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Ghost points are the raw data; bright points are the current cleaned rows. Values outside the plotted window
              (such as minutes recorded as hours) stay hidden until the units step fixes them.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/50 p-4">
          <svg viewBox="0 0 560 300" className="w-full" role="img" aria-label="Scatter plot of hours studied versus test score with fitted regression line">
            <rect x="44" y="20" width="500" height="240" className="fill-card stroke-border" strokeWidth="1" />
            {[2, 4, 6, 8, 10].map((h) => (
              <g key={`x${h}`}>
                <line x1={toX(h)} y1="20" x2={toX(h)} y2="260" className="stroke-border" strokeWidth="0.5" />
                <text x={toX(h)} y="276" textAnchor="middle" fontSize="10" className="fill-muted-foreground">
                  {h} h
                </text>
              </g>
            ))}
            {[0, 20, 40, 60, 80, 100].map((s) => (
              <g key={`y${s}`}>
                <line x1="44" y1={toY(s)} x2="544" y2={toY(s)} className="stroke-border" strokeWidth="0.5" />
                <text x="38" y={toY(s) + 3} textAnchor="end" fontSize="10" className="fill-muted-foreground">
                  {s}
                </text>
              </g>
            ))}
            {rawGhost.map((r) => (
              <circle key={`g${r.id}`} cx={toX(r.hours as number)} cy={toY(r.score as number)} r="4" className="fill-muted opacity-45" />
            ))}
            {nowPoints.map((r) => (
              <circle key={`c${r.id}`} cx={toX(r.hours as number)} cy={toY(r.score as number)} r="4" className="fill-primary" />
            ))}
            {linePts && <polyline points={linePts} fill="none" className="stroke-emerald-500" strokeWidth="2.5" />}
            <text x="294" y="296" textAnchor="middle" fontSize="10" className="fill-muted-foreground">
              Hours studied
            </text>
          </svg>
        </div>

        <LabReport
          title="Cleaning log"
          columns={['Step', 'Rows before', 'Rows after', 'r change']}
          rows={report}
          note="Appended per applied step. A negative r change is possible — removing outliers before fixing units can look worse before it looks better."
        />

        {allApplied && (
          <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <h3 className="text-sm font-bold">Interpretation quiz — answer all three correctly to win</h3>
            <PredictFirst
              key={`q1-${resetCount}`}
              prompt="How did the cleaning change the correlation r?"
              options={q1Options}
              explain="Compare the raw and cleaned r in the stats panel. The junk rows (gaps, duplicates, outliers, minutes-as-hours) were crushing the linear association."
              onResolved={(ok) => answerQuiz(0, ok)}
            />
            <PredictFirst
              key={`q2-${resetCount}`}
              prompt="After cleaning, the regression slope (marks per extra hour of study) is closest to which bucket?"
              options={q2Options}
              explain="The cleaned least-squares slope estimates marks gained per extra study hour; check the slope readout in the stats panel."
              onResolved={(ok) => answerQuiz(1, ok)}
            />
            <PredictFirst
              key={`q3-${resetCount}`}
              prompt="Which conclusion does your cleaned data support?"
              options={q3Options}
              explain="A high r is strong association, not causation — cleaning recovered the trend, but only a controlled experiment could prove causation."
              onResolved={(ok) => answerQuiz(2, ok)}
            />
            <p role="status" aria-live="polite" className={cn('text-sm font-semibold', 'text-emerald-600')}>
              {quizOk.every((v) => v === true)
                ? 'Three for three — you can defend a cleaned dataset like a scientist.'
                : `Score so far: ${quizOk.filter((v) => v === true).length}/3.`}
            </p>
          </div>
        )}
      </div>
    </GameShell>
  );
}
