'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Scale, ShieldAlert } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Bias & Fairness Explorer (Class 11 AI): a synthetic college-admissions pool
 * (seeded PRNG, so every number is stable), a toy threshold model calibrated
 * on historical approvals, and learner controls for the historical data mix
 * and the decision threshold. Goal: reach the four-fifths fairness band
 * (selection-rate ratio 0.80-1.25) while keeping accuracy at 0.70+.
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

interface Applicant {
  group: 'A' | 'B';
  academic: number;
  access: number;
  qualified: boolean;
}

// Module-level pool (240 applicants) — generated once, stable across renders.
const randPool = mulberry32(20241105);
const gaussPool = makeGauss(randPool);
const POOL: Applicant[] = [];
for (let i = 0; i < 120; i++) {
  POOL.push({
    group: 'A',
    academic: clamp(Math.round(62 + 14 * gaussPool()), 0, 100),
    access: clamp(Math.round(70 + 12 * gaussPool()), 0, 100),
    qualified: false,
  });
}
for (let i = 0; i < 120; i++) {
  POOL.push({
    group: 'B',
    academic: clamp(Math.round(58 + 14 * gaussPool()), 0, 100),
    access: clamp(Math.round(48 + 12 * gaussPool()), 0, 100),
    qualified: false,
  });
}
for (const p of POOL) p.qualified = p.academic + p.access >= 115;

// Historical approved-score records per group (seeded, stable).
const randHist = mulberry32(90210);
const gaussHist = makeGauss(randHist);
const HIST_A: number[] = [];
const HIST_B: number[] = [];
for (let i = 0; i < 200; i++) HIST_A.push(clamp(Math.round(62 + 14 * gaussHist()), 0, 100));
for (let i = 0; i < 200; i++) HIST_B.push(clamp(Math.round(58 + 14 * gaussHist()), 0, 100));
const MEAN_A = HIST_A.reduce((s, x) => s + x, 0) / HIST_A.length;
const MEAN_B = HIST_B.reduce((s, x) => s + x, 0) / HIST_B.length;

function calibratedFor(nA: number, nB: number): number {
  return (nA * MEAN_A + nB * MEAN_B) / (nA + nB);
}

const roundHalf = (x: number) => Math.round(x * 2) / 2;

type Tone = 'ok' | 'warn' | 'info';

export function BiasFairnessExplorerLab(props: GameProps) {
  const [mixA, setMixA] = useState(120);
  const [mixB, setMixB] = useState(120);
  const [threshold, setThreshold] = useState(() => roundHalf(calibratedFor(120, 120)));
  const [touched, setTouched] = useState(false);
  const [report, setReport] = useState<(string | number)[][]>([]);
  const [msg, setMsg] = useState('Inspect the outcomes, then adjust the data mix and threshold.');
  const [tone, setTone] = useState<Tone>('info');

  const calibrated = calibratedFor(mixA, mixB);

  function changeMix(which: 'A' | 'B', v: number) {
    const nA = which === 'A' ? v : mixA;
    const nB = which === 'B' ? v : mixB;
    if (which === 'A') setMixA(v);
    else setMixB(v);
    // Until the learner takes manual control, the threshold follows history.
    if (!touched) setThreshold(roundHalf(calibratedFor(nA, nB)));
  }

  function syncToCalibrated() {
    setThreshold(roundHalf(calibrated));
    setTouched(false);
  }

  const outcomes = useMemo(() => {
    const selA = POOL.filter((p) => p.group === 'A' && p.academic >= threshold).length / 120;
    const selB = POOL.filter((p) => p.group === 'B' && p.academic >= threshold).length / 120;
    const ratio = selA > 0 ? selB / selA : selB > 0 ? 2 : 1;
    const accuracy = POOL.filter((p) => (p.academic >= threshold) === p.qualified).length / POOL.length;
    return { selA, selB, ratio, accuracy };
  }, [threshold]);

  const qualifiedA = POOL.filter((p) => p.group === 'A' && p.qualified).length / 120;
  const qualifiedB = POOL.filter((p) => p.group === 'B' && p.qualified).length / 120;

  const ratioOk = outcomes.ratio >= 0.8 && outcomes.ratio <= 1.25;
  const accOk = outcomes.accuracy >= 0.7;

  function checkFairness() {
    setReport((r) => [
      ...r,
      [r.length + 1, `${mixA} : ${mixB}`, threshold.toFixed(1), outcomes.ratio.toFixed(2), `${(outcomes.accuracy * 100).toFixed(0)}%`],
    ]);
    if (ratioOk && accOk) {
      props.onWin();
      setTone('ok');
      setMsg(
        `Fair and accurate: selection-rate ratio ${outcomes.ratio.toFixed(2)} (four-fifths band met) and accuracy ${(outcomes.accuracy * 100).toFixed(0)}%. Win!`
      );
    } else if (!ratioOk) {
      setTone('warn');
      setMsg(
        `Not yet: Group B is selected ${(outcomes.ratio * 100).toFixed(0)}% as often as Group A — outside the 80-125% band. Try lowering the bar or rebalancing the historical mix.`
      );
    } else {
      setTone('warn');
      setMsg(
        `Fairness band met, but accuracy is ${(outcomes.accuracy * 100).toFixed(0)}% — too many unqualified approvals or missed qualified applicants. Raise the bar a little.`
      );
    }
  }

  const barW = 120;
  const barMax = 170;

  return (
    <GameShell
      title="Bias and Fairness Explorer"
      blurb="A toy admissions model approves applicants whose academic score clears a threshold — but the threshold is calibrated on historical approvals. Tune the data mix and the bar, and watch selection rates diverge."
      modelNote="Synthetic data (240 seeded applicants) and a toy threshold rule. The numbers are invented and stable; the point is the pattern of how historical skew becomes model skew, not exact sociology."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="flex flex-col gap-4">
        <ChapterRef subject="Artificial Intelligence" chapter="Class 11 AI curriculum" topic="AI ethics: bias and fairness" />
        <PredictFirst
          prompt="If history approved mostly Group A, what happens to Group B under the same model?"
          options={[
            { label: 'Group B gets approved just as often' },
            { label: 'The bar shifts toward Group A scores, so Group B clears it less often', correct: true },
            { label: 'Past approvals cannot affect a new model' },
          ]}
          explain="The calibrated threshold is a weighted mean of past approved scores. Weight that mean with Group A examples and it lands near Group A numbers — Group B, whose access scores are historically lower, gets selected less. Bias entered through the data, not the code."
        />
        <PredictFirst
          prompt="Where is the fairness knob in a system like this?"
          options={[
            { label: 'There is none — the model is unfair forever' },
            { label: 'Who ends up in the training data, and where the decision bar sits', correct: true },
            { label: 'Deleting Group B from the data fixes it' },
          ]}
          explain="Fairness here is a data-plus-design question: rebalance the historical mix and move the threshold, and the outcomes move too. Removing the disadvantaged group would only hide the problem."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Scale className="size-4" aria-hidden="true" /> Controls
            </h3>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Historical approved examples — Group A: <b>{mixA}</b>
              </span>
              <input
                type="range"
                min={10}
                max={200}
                step={5}
                value={mixA}
                onChange={(e) => changeMix('A', Number(e.target.value))}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Historical approved examples for Group A, currently ${mixA}`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Historical approved examples — Group B: <b>{mixB}</b>
              </span>
              <input
                type="range"
                min={10}
                max={200}
                step={5}
                value={mixB}
                onChange={(e) => changeMix('B', Number(e.target.value))}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Historical approved examples for Group B, currently ${mixB}`}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Decision threshold (approve if academic score is at or above): <b className="tabular-nums">{threshold.toFixed(1)}</b>
              </span>
              <input
                type="range"
                min={40}
                max={80}
                step={0.5}
                value={threshold}
                onChange={(e) => {
                  setThreshold(Number(e.target.value));
                  setTouched(true);
                }}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Decision threshold, currently ${threshold.toFixed(1)} academic score`}
              />
            </label>
            <Button variant="outline" className="press min-h-[44px] self-start" onClick={syncToCalibrated}>
              Reset threshold to calibrated value
            </Button>
            <div className="rounded-xl border border-border bg-card p-3 text-sm">
              <p className="font-semibold">Calibration formula (shown honestly)</p>
              <p className="mt-1 tabular-nums text-xs">
                threshold = (nA × {MEAN_A.toFixed(1)} + nB × {MEAN_B.toFixed(1)}) / (nA + nB) = {calibrated.toFixed(1)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The model approves by academic score alone. It never sees the access score — the resource gap that pushed
                Group B scores down is invisible to it. {touched ? 'You have overridden the calibrated bar manually.' : 'The bar currently follows history.'}
              </p>
            </div>
            <Button className="press min-h-[44px] self-start" onClick={checkFairness}>
              <ShieldAlert className="size-4" aria-hidden="true" /> Check fairness
            </Button>
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

          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="text-sm font-bold">Outcomes (240-applicant pool, 120 per group)</h3>
            <svg viewBox="0 0 320 210" className="w-full" role="img" aria-label="Selection rates for Group A and Group B">
              <rect x="0" y="190" width="320" height="2" className="fill-border" />
              {(
                [
                  ['Group A', outcomes.selA, 70, 'fill-primary'],
                  ['Group B', outcomes.selB, 190, 'fill-emerald-500'],
                ] as const
              ).map(([label, rate, x, fill]) => (
                <g key={label}>
                  <rect x={x} y={190 - rate * barMax} width={barW} height={rate * barMax} rx="6" className={fill} />
                  <text x={x + barW / 2} y={182 - rate * barMax} textAnchor="middle" fontSize="12" className="fill-foreground">
                    {(rate * 100).toFixed(0)}%
                  </text>
                  <text x={x + barW / 2} y="204" textAnchor="middle" fontSize="11" className="fill-muted-foreground">
                    {label}
                  </text>
                </g>
              ))}
            </svg>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p className="rounded-xl border border-border bg-card p-2 tabular-nums">
                Selection rate A: <b>{(outcomes.selA * 100).toFixed(1)}%</b>
              </p>
              <p className="rounded-xl border border-border bg-card p-2 tabular-nums">
                Selection rate B: <b>{(outcomes.selB * 100).toFixed(1)}%</b>
              </p>
              <p className="rounded-xl border border-border bg-card p-2 tabular-nums">
                Accuracy vs true qualification: <b>{(outcomes.accuracy * 100).toFixed(1)}%</b>
              </p>
              <p className="rounded-xl border border-border bg-card p-2 tabular-nums">
                Selection-rate ratio (disparate impact): <b>{outcomes.ratio.toFixed(2)}</b>
              </p>
            </div>
            <p
              role="status"
              aria-live="polite"
              className={cn(
                'text-sm font-semibold',
                ratioOk ? 'text-emerald-600' : 'text-amber-600'
              )}
            >
              Group B is selected {(outcomes.ratio * 100).toFixed(0)}% as often as Group A.{' '}
              {ratioOk
                ? 'Within the four-fifths fairness band.'
                : outcomes.ratio < 0.8
                  ? 'Below 80% — disparate impact against Group B.'
                  : 'Above 125% — the bar now favours Group B.'}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              Ground truth for comparison: {(qualifiedA * 100).toFixed(0)}% of Group A and {(qualifiedB * 100).toFixed(0)}% of
              Group B are truly qualified. Group B is not less able — its access scores (a mock of resources) run lower, which
              drags its academic scores down.
            </p>
          </div>
        </div>

        <LabReport
          title="Fairness checks"
          columns={['Check', 'History mix (A : B)', 'Threshold', 'Ratio', 'Accuracy']}
          rows={report}
          note="Appended every time you press Check fairness. Ratios inside 0.80-1.25 with accuracy of at least 70% count as a win."
        />
        {ratioOk && accOk && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Fairness band met and accuracy holds — you compensated for a biased starting point.
          </p>
        )}
      </div>
    </GameShell>
  );
}
