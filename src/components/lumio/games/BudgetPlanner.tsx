'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { GameShell, type GameProps } from './GameShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Budget Planner: monthly income slider, editable needs amounts and a savings
 * goal. The planner computes needs / wants / savings percentages and checks
 * them against the 50-30-20 guideline with kind, honest feedback.
 * Pass for 3 different incomes -> onWin().
 */

interface NeedKey {
  key: 'food' | 'travel' | 'school';
  label: string;
}

const NEEDS: NeedKey[] = [
  { key: 'food', label: 'Food' },
  { key: 'travel', label: 'Travel' },
  { key: 'school', label: 'School supplies' },
];

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function BudgetPlannerGame(props: GameProps) {
  const [income, setIncome] = useState(12000);
  const [food, setFood] = useState(4000);
  const [travel, setTravel] = useState(1500);
  const [school, setSchool] = useState(1000);
  const [savings, setSavings] = useState(2000);
  const [passedIncomes, setPassedIncomes] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<null | { ok: boolean; lines: string[] }>(null);

  // Derivations (plain consts, above any effects — there are none here).
  const needsTotal = food + travel + school;
  const wantsTotal = income - needsTotal - savings;
  const needsPct = (needsTotal / income) * 100;
  const wantsPct = (wantsTotal / income) * 100;
  const savingsPct = (savings / income) * 100;
  const needsOk = needsPct <= 50;
  const savingsOk = savingsPct >= 20;
  const wantsOk = wantsTotal >= 0;
  const allOk = needsOk && savingsOk && wantsOk;
  const won = passedIncomes.length >= 3;

  const needInputs: Array<{ value: number; set: (n: number) => void; need: NeedKey }> = [
    { value: food, set: setFood, need: NEEDS[0] },
    { value: travel, set: setTravel, need: NEEDS[1] },
    { value: school, set: setSchool, need: NEEDS[2] },
  ];

  function submit() {
    const lines: string[] = [];
    if (wantsTotal < 0) {
      lines.push(
        `Your plan spends ${fmt(-wantsTotal)} more than you earn. Bring needs or savings down until the plan fits.`
      );
    }
    if (!needsOk) {
      lines.push(
        `Needs take ${needsPct.toFixed(0)}% of income — above the 50% guideline. Every need here is real, so look for the one you can trim a little.`
      );
    } else {
      lines.push(`Needs at ${needsPct.toFixed(0)}% — within the guideline.`);
    }
    if (!savingsOk) {
      lines.push(
        `Savings at ${savingsPct.toFixed(0)}% — below the 20% guideline. Even a small buffer helps when surprises come.`
      );
    } else {
      lines.push(`Savings at ${savingsPct.toFixed(0)}% — good buffer.`);
    }
    const ok = allOk;
    if (ok) {
      lines.push('This plan follows the 50-30-20 guideline for this income.');
      if (!passedIncomes.includes(income)) {
        const next = [...passedIncomes, income];
        setPassedIncomes(next);
        if (next.length >= 3) props.onWin();
      }
    }
    setFeedback({ ok, lines });
  }

  return (
    <GameShell
      title="Budget Planner"
      blurb="Set a monthly income, cover the needs, keep a savings buffer — then check your plan against the 50-30-20 guideline. Pass for 3 different incomes."
      modelNote="50-30-20 (needs 50%, wants 30%, savings 20%) is a guideline, not a rule — real families adjust it to their situation."
      xp={20}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Wallet className="size-4" aria-hidden="true" /> Your monthly plan
          </h3>
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span>
              Monthly income: <b className="text-base">{fmt(income)}</b>
            </span>
            <input
              type="range"
              min={8000}
              max={40000}
              step={500}
              value={income}
              onChange={(e) => {
                setIncome(Number(e.target.value));
                setFeedback(null);
              }}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Monthly income, currently ${income} rupees`}
            />
            <span className="text-xs text-muted-foreground">₹8,000 – ₹40,000</span>
          </label>

          {needInputs.map(({ value, set, need }) => (
            <label key={need.key} className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
              <span>
                {need.label} <span className="text-muted-foreground">({((value / income) * 100).toFixed(0)}% of income)</span>
              </span>
              <Input
                type="number"
                min={0}
                step={100}
                value={value}
                onChange={(e) => {
                  set(Math.max(0, Number(e.target.value) || 0));
                  setFeedback(null);
                }}
                className="w-36"
                aria-label={`${need.label} amount in rupees per month`}
              />
            </label>
          ))}

          <label className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
            <span>Savings</span>
            <Input
              type="number"
              min={0}
              step={100}
              value={savings}
              onChange={(e) => {
                setSavings(Math.max(0, Number(e.target.value) || 0));
                setFeedback(null);
              }}
              className="w-36"
              aria-label="Savings amount in rupees per month"
            />
          </label>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="text-sm font-bold">Where the money goes</h3>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, needsPct)}%` }} />
            <div className="h-full bg-amber-500" style={{ width: `${Math.max(0, Math.min(100, wantsPct))}%` }} />
            <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, savingsPct))}%` }} />
          </div>
          <ul className="flex flex-col gap-2 text-sm" aria-live="polite">
            <li className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
              <span>
                Needs <span className={cn('font-semibold', needsOk ? 'text-emerald-600' : 'text-amber-600')}>
                  {needsPct.toFixed(0)}%
                </span>
              </span>
              <span className="text-muted-foreground">{fmt(needsTotal)} · guideline ≤ 50%</span>
            </li>
            <li className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
              <span>
                Wants{' '}
                <span className={cn('font-semibold', wantsOk ? 'text-foreground' : 'text-red-600')}>
                  {wantsPct.toFixed(0)}%
                </span>
              </span>
              <span className="text-muted-foreground">
                {wantsOk ? `${fmt(wantsTotal)} · guideline ≤ 30%` : 'overspent'}
              </span>
            </li>
            <li className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
              <span>
                Savings <span className={cn('font-semibold', savingsOk ? 'text-emerald-600' : 'text-amber-600')}>
                  {savingsPct.toFixed(0)}%
                </span>
              </span>
              <span className="text-muted-foreground">{fmt(savings)} · guideline ≥ 20%</span>
            </li>
          </ul>
          <Button className="press min-h-[44px] self-start" onClick={submit}>
            Check my plan
          </Button>
          {feedback && (
            <div
              role="status"
              aria-live="polite"
              className={cn(
                'rounded-2xl border p-4 text-sm',
                feedback.ok ? 'border-emerald-500 bg-emerald-500/10' : 'border-amber-500 bg-amber-500/10'
              )}
            >
              <p className={cn('font-bold', feedback.ok ? 'text-emerald-600' : 'text-amber-600')}>
                {feedback.ok ? 'Plan passed for this income!' : 'Keep adjusting — you are close.'}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                {feedback.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Incomes passed: {passedIncomes.length}/3
            {passedIncomes.length > 0 && <> · {passedIncomes.map(fmt).join(', ')}</>}
          </p>
          {won && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
              Three different incomes balanced — you can plan a budget at any salary!
            </p>
          )}
        </div>
      </div>
    </GameShell>
  );
}
