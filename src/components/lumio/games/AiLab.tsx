'use client';

import { useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import { GameShell, type GameProps } from './GameShell';
import { cn } from '@/lib/utils';

/**
 * AI Lab: train a one-rule classifier ("pass if study hours >= threshold")
 * on tiny made-up datasets. The clean dataset follows a simple rule; the
 * noisy dataset tempts the learner to fit mislabeled points (100% training
 * accuracy, poor test accuracy) — an honest first look at overfitting.
 * Mission: test accuracy >= 80% -> onWin().
 */

type Point = [number, number]; // [hours, passed 0/1]

const CLEAN: { tr: Point[]; te: Point[] } = {
  tr: [
    [1, 0], [2, 0], [2.5, 0], [3, 0], [3.5, 0], [4, 1],
    [4.5, 1], [5, 1], [5.5, 1], [6, 1], [7, 1], [8, 1],
  ],
  te: [[3.2, 0], [4.2, 1], [5, 1], [6.5, 1], [2, 0], [4.8, 1]],
};

// Labels here say some students who studied very little crammed and passed
// (and one solid student fluked a fail). A threshold CAN fit this perfectly —
// and learn the cramming instead of the studying.
const NOISY: { tr: Point[]; te: Point[] } = {
  tr: [
    [0.5, 0], [1, 0], [2, 0], [2.5, 1], [3.5, 1], [4, 1],
    [4.5, 1], [5, 1], [5.5, 1], [6, 1], [7, 1], [8, 1],
  ],
  te: [[2.8, 0], [3, 0], [3.2, 0], [3.8, 0], [4, 1], [4.6, 1], [5.2, 1], [6.2, 1]],
};

const DATASETS = [CLEAN, NOISY];

function evaluate(data: Point[], t: number) {
  const correct = data.filter(([h, y]) => (h >= t ? 1 : 0) === y).length;
  return (correct / data.length) * 100;
}

export function AiLabGame(props: GameProps) {
  const [datasetIdx, setDatasetIdx] = useState(0);
  const [threshold, setThreshold] = useState(4);

  const dataset = DATASETS[datasetIdx];
  // Derivations (plain consts, above any effects — there are none here).
  const trainAcc = evaluate(dataset.tr, threshold);
  const testAcc = evaluate(dataset.te, threshold);
  const confusion = dataset.te.reduce(
    (acc, [h, y]) => {
      const p = h >= threshold ? 1 : 0;
      if (p === 1 && y === 1) acc.tp++;
      else if (p === 1) acc.fp++;
      else if (y === 1) acc.fn++;
      else acc.tn++;
      return acc;
    },
    { tp: 0, fp: 0, fn: 0, tn: 0 }
  );
  const overfitGap = trainAcc - testAcc;
  const won = testAcc >= 80;

  function changeThreshold(value: number) {
    setThreshold(value);
    if (evaluate(dataset.te, value) >= 80) props.onWin();
  }

  const datasetTabs = [
    { label: 'Clean data', note: 'Passed students studied longer. One clean rule.' },
    { label: 'Noisy data', note: 'Some labels are wrong: a few crammers passed on luck. 100% training accuracy is possible here — watch what it does to the test set.' },
  ];

  return (
    <GameShell
      title="AI Lab: pass or fail?"
      blurb="Train a one-rule classifier: predict pass if study hours ≥ threshold. Tune it on the training data, then check it on unseen test data."
      modelNote="This is a decision stump — the simplest model that still learns. With a bigger model you could memorise every noisy training point (100% training accuracy) and still fail the test set; a stump that fits the noise perfectly shows the same lesson in miniature. Hours alone also ignore sleep, school and support at home — a model can be accurate and still unfair."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a dataset">
        {datasetTabs.map((d, i) => (
          <button
            key={d.label}
            className={cn(
              'press min-h-[44px] rounded-xl border px-3 text-sm font-medium',
              datasetIdx === i ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10'
            )}
            aria-pressed={datasetIdx === i}
            onClick={() => setDatasetIdx(i)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{datasetTabs[datasetIdx].note}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <BrainCircuit className="size-4" aria-hidden="true" /> Train
          </h3>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Threshold (hours): <b>{threshold}</b>
            </span>
            <input
              type="range"
              min={0}
              max={8}
              step={0.25}
              value={threshold}
              onChange={(e) => changeThreshold(Number(e.target.value))}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Threshold in study hours, currently ${threshold} hours`}
            />
          </label>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs font-semibold text-muted-foreground">Training data (hours → result)</p>
            <p className="mt-1 font-mono text-xs leading-5">
              {dataset.tr.map(([h, y]) => `${h}→${y === 1 ? 'P' : 'F'}`).join(', ')}
            </p>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            {dataset.tr.map(([h, y]) => {
              const predicted = h >= threshold ? 1 : 0;
              const ok = predicted === y;
              return (
                <div key={`${h}-${y}`} className="flex items-center gap-2" aria-hidden="true">
                  <span className="w-10 text-right font-mono text-xs">{h}</span>
                  <span className={cn('h-2.5 flex-1 rounded-full', predicted ? 'bg-emerald-500/70' : 'bg-muted')} />
                  <span className={cn('w-12 text-xs font-semibold', ok ? 'text-emerald-600' : 'text-amber-600')}>
                    {ok ? 'ok' : 'miss'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="text-sm font-bold">Evaluation</h3>
          <p className="text-lg" aria-live="polite">
            Training accuracy <b>{trainAcc.toFixed(0)}%</b> · Test accuracy{' '}
            <b className={testAcc >= 80 ? 'text-emerald-600' : ''}>{testAcc.toFixed(0)}%</b>
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            Confusion matrix (test): TP {confusion.tp} · FP {confusion.fp} · FN {confusion.fn} · TN {confusion.tn}
          </p>
          <p role="status" aria-live="polite" className="text-sm font-semibold">
            {testAcc >= 80 ? (
              <span className="text-emerald-600">Good generalisation — the rule works on unseen students.</span>
            ) : (
              <span className="text-amber-600">Test accuracy is below 80%. Try another threshold.</span>
            )}
            {overfitGap >= 25 && (
              <span className="mt-1 block text-amber-600">
                Big gap between training and test: you are fitting the noise, not the pattern. That is overfitting.
              </span>
            )}
          </p>
          <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            The test set is held out on purpose: it stands in for students the model has never met. A rule that
            only repeats the training labels has not really learned anything.
          </div>
          {won && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
              Test accuracy at or above 80% — the model generalises!
            </p>
          )}
        </div>
      </div>
    </GameShell>
  );
}
