'use client';

import { useState } from 'react';
import { Scale } from 'lucide-react';
import { GameShell, type GameProps } from './GameShell';
import { cn } from '@/lib/utils';

/**
 * AI Fairness Lab: a score-threshold "model" approves made-up loan
 * applications. Two groups have different score patterns, so one neutral
 * threshold treats them differently — the learner watches the approval gap
 * appear and then finds a fairer threshold. Mission: approval rates within
 * 10 percentage points AND overall accuracy >= 60% -> onWin().
 */

interface Applicant {
  group: 'A' | 'B';
  score: number;
  wouldRepay: boolean;
}

// MADE-UP DATA, invented for teaching. Group B applicants scored lower on
// average (fewer study/coaching resources), though repayment behaviour is
// just as real. Not real people, not real credit scores.
const APPLICANTS: Applicant[] = [
  ...[90, 85, 80, 78, 75, 72, 70, 68].map((s) => ({ group: 'A' as const, score: s, wouldRepay: true })),
  ...[64, 62, 60, 55, 50, 45].map((s) => ({ group: 'A' as const, score: s, wouldRepay: false })),
  ...[66, 62, 60, 58].map((s) => ({ group: 'B' as const, score: s, wouldRepay: true })),
  ...[50, 45].map((s) => ({ group: 'B' as const, score: s, wouldRepay: false })),
];

interface GroupMetrics {
  n: number;
  approvals: number;
  approvalRate: number;
  correct: number;
  accuracy: number;
  qualifiedApproved: number;
  qualifiedTotal: number;
}

function metricsFor(group: 'A' | 'B', t: number): GroupMetrics {
  const rows = APPLICANTS.filter((a) => a.group === group);
  const approved = rows.filter((a) => a.score >= t);
  const correct = rows.filter((a) => (a.score >= t) === a.wouldRepay).length;
  const qualified = rows.filter((a) => a.wouldRepay);
  const qualifiedApproved = qualified.filter((a) => a.score >= t).length;
  return {
    n: rows.length,
    approvals: approved.length,
    approvalRate: (approved.length / rows.length) * 100,
    correct,
    accuracy: (correct / rows.length) * 100,
    qualifiedApproved,
    qualifiedTotal: qualified.length,
  };
}

export function AiFairnessLabGame(props: GameProps) {
  const [threshold, setThreshold] = useState(65);
  const [celebrated, setCelebrated] = useState(false);

  // Derivations (plain consts, above any effects — there are none here).
  const a = metricsFor('A', threshold);
  const b = metricsFor('B', threshold);
  const gap = Math.abs(a.approvalRate - b.approvalRate);
  const overallCorrect = a.correct + b.correct;
  const overallN = a.n + b.n;
  const overallAcc = (overallCorrect / overallN) * 100;
  const missionMet = gap < 10 && overallAcc >= 60;

  function changeThreshold(value: number) {
    setThreshold(value);
    const na = metricsFor('A', value);
    const nb = metricsFor('B', value);
    const ngap = Math.abs(na.approvalRate - nb.approvalRate);
    const nacc = ((na.correct + nb.correct) / (na.n + nb.n)) * 100;
    if (ngap < 10 && nacc >= 60 && !celebrated) {
      setCelebrated(true);
      props.onWin();
    }
  }

  const rows: Array<{ label: string; m: GroupMetrics }> = [
    { label: 'Group A', m: a },
    { label: 'Group B', m: b },
  ];

  return (
    <GameShell
      title="AI Fairness Lab"
      blurb="A one-rule 'model' approves loans: approve if the score is at least the threshold. Both groups' repayment behaviour is equally real — but their score patterns differ, so one neutral threshold treats them differently."
      modelNote="Made-up data; real fairness is a deep topic — this is a first look. In real life you must also ask WHY the scores differ, whether adjusting thresholds is acceptable, and who should be consulted."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Scale className="size-4" aria-hidden="true" /> The approval rule
          </h3>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Score threshold: <b>{threshold}</b>
            </span>
            <input
              type="range"
              min={40}
              max={90}
              step={1}
              value={threshold}
              onChange={(e) => changeThreshold(Number(e.target.value))}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Score threshold, currently ${threshold}`}
            />
            <span className="text-xs text-muted-foreground">40 – 90 · approve if score ≥ threshold</span>
          </label>
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'rounded-2xl border p-4 text-sm',
              missionMet ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-card'
            )}
          >
            <p className={cn('font-bold', missionMet ? 'text-emerald-600' : 'text-foreground')}>
              Approval-rate gap: {gap.toFixed(1)} percentage points {missionMet ? '✓ (below 10)' : '(mission wants below 10)'}
            </p>
            <p className="mt-1 text-muted-foreground">
              Overall accuracy: {overallAcc.toFixed(0)}% ({overallCorrect} of {overallN} decisions correct){' '}
              {overallAcc >= 60 ? '✓' : '(mission wants 60% or more)'}
            </p>
            {missionMet && (
              <p className="mt-1 text-emerald-600">
                A single threshold can be fair here — but the real question is why the scores differed in the first place.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            “Qualified approved” shows how many people who would have repaid got the loan. A big gap there means one
            group is being missed more often.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="text-sm font-bold">Side by side (made-up data)</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {['Group', 'Approved', 'Approval rate', 'Correct decisions', 'Qualified approved'].map((h) => (
                    <th key={h} scope="col" className="border-b border-border px-2 py-2 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody aria-live="polite">
                {rows.map(({ label, m }) => (
                  <tr key={label}>
                    <td className="px-2 py-2 font-bold">{label}</td>
                    <td className="px-2 py-2 font-mono">{m.approvals} of {m.n}</td>
                    <td className="px-2 py-2 font-mono">{m.approvalRate.toFixed(0)}%</td>
                    <td className="px-2 py-2 font-mono">{m.accuracy.toFixed(0)}%</td>
                    <td className="px-2 py-2 font-mono">
                      {m.qualifiedApproved} of {m.qualifiedTotal} ({m.n > 0 ? ((m.qualifiedApproved / m.qualifiedTotal) * 100).toFixed(0) : 0}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs font-semibold text-muted-foreground">Approval rates (same scale)</p>
            <div className="mt-2 flex flex-col gap-2">
              {rows.map(({ label, m }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-16 text-xs font-bold">{label}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${m.approvalRate}%` }} />
                  </div>
                  <span className="w-12 text-right font-mono text-xs">{m.approvalRate.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
            <b className="text-foreground">What to think about:</b> a single threshold looked neutral, but it treated
            the groups very differently because their score patterns differ. Could you find a threshold that closes
            the gap while staying accurate? Then ask the harder question: is a threshold enough?
          </div>
        </div>
      </div>
    </GameShell>
  );
}
