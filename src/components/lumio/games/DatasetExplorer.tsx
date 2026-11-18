'use client';

import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { GameShell, type GameProps } from './GameShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Dataset Explorer: a made-up 12-village dataset (clearly labelled sample
 * data). Toggle water access and slide the maximum distance to explore, then
 * answer mean/median questions. Answer within ±1; 3 correct -> onWin().
 */

interface Village {
  name: string;
  households: number;
  school: boolean;
  water: boolean;
  distance: number;
}

// MADE-UP SAMPLE DATA — invented for practice, not real villages.
const VILLAGES: Village[] = [
  { name: 'Kharipur', households: 142, school: true, water: true, distance: 8 },
  { name: 'Bhawanipur', households: 98, school: true, water: false, distance: 14 },
  { name: 'Sundarpur', households: 210, school: true, water: true, distance: 6 },
  { name: 'Lalgunj', households: 64, school: false, water: true, distance: 22 },
  { name: 'Devpur', households: 175, school: true, water: true, distance: 11 },
  { name: 'Rampur', households: 120, school: false, water: false, distance: 18 },
  { name: 'Chandpur', households: 88, school: true, water: true, distance: 9 },
  { name: 'Mohanpur', households: 156, school: true, water: false, distance: 25 },
  { name: 'Haripur', households: 132, school: false, water: true, distance: 15 },
  { name: 'Sitapur', households: 101, school: true, water: true, distance: 7 },
  { name: 'Govindpur', households: 190, school: true, water: false, distance: 20 },
  { name: 'Nayaganj', households: 77, school: false, water: true, distance: 28 },
];

type WaterFilter = 'any' | 'yes' | 'no';
type Column = 'households' | 'distance';
type Stat = 'mean' | 'median';

interface Question {
  col: Column;
  stat: Stat;
  water: WaterFilter;
  maxDist: number;
}

function filteredBy(water: WaterFilter, maxDist: number): Village[] {
  return VILLAGES.filter((v) => (water === 'any' || v.water === (water === 'yes')) && v.distance <= maxDist);
}

function statOf(rows: Village[], col: Column, stat: Stat): number {
  const values = rows.map((r) => r[col]).sort((a, b) => a - b);
  const n = values.length;
  if (stat === 'mean') return values.reduce((s, x) => s + x, 0) / n;
  return n % 2 === 1 ? values[(n - 1) / 2] : (values[n / 2 - 1] + values[n / 2]) / 2;
}

function makeQuestion(): Question {
  for (let tries = 0; tries < 50; tries++) {
    const col: Column = Math.random() < 0.5 ? 'households' : 'distance';
    const stat: Stat = Math.random() < 0.5 ? 'mean' : 'median';
    const water: WaterFilter = (['any', 'yes', 'no'] as WaterFilter[])[Math.floor(Math.random() * 3)];
    const maxDist = [10, 15, 20, 25][Math.floor(Math.random() * 4)];
    if (filteredBy(water, maxDist).length > 0) return { col, stat, water, maxDist };
  }
  return { col: 'households', stat: 'mean', water: 'any', maxDist: 25 };
}

const colName = (col: Column) => (col === 'households' ? 'number of households' : 'distance to town (km)');

export function DatasetExplorerGame(props: GameProps) {
  const [water, setWater] = useState<WaterFilter>('any');
  const [maxDist, setMaxDist] = useState(30);
  const [question, setQuestion] = useState<Question>(() => makeQuestion());
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<null | { passed: boolean }>(null);
  const [score, setScore] = useState(0);

  // Derivations (plain consts, above any effects — there are none here).
  const rows = filteredBy(water, maxDist);
  const qRows = filteredBy(question.water, question.maxDist);
  const qAnswer = qRows.length > 0 ? statOf(qRows, question.col, question.stat) : 0;
  const answerNum = answer.trim() === '' ? null : Number(answer);
  const won = score >= 3;

  function check() {
    if (answerNum === null || Number.isNaN(answerNum)) return;
    const passed = Math.abs(answerNum - qAnswer) <= 1;
    setResult({ passed });
    if (passed) {
      const next = score + 1;
      setScore(next);
      if (next >= 3) props.onWin();
    }
  }

  function nextQuestion() {
    setQuestion(makeQuestion());
    setAnswer('');
    setResult(null);
  }

  const waterOptions: Array<{ value: WaterFilter; label: string }> = [
    { value: 'any', label: 'All villages' },
    { value: 'yes', label: 'Water access: yes' },
    { value: 'no', label: 'Water access: no' },
  ];

  return (
    <GameShell
      title="Dataset Explorer"
      blurb="Filter a table of villages, then work out a mean or median yourself and check it. Explore first — the numbers you need are in the table."
      modelNote="All data is invented for practice — this is clearly labelled sample data, not real villages. Small samples can mislead, and correlation is not causation."
      xp={20}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <BarChart3 className="size-4" aria-hidden="true" /> Made-up sample data: 12 villages
          </h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by water access">
            {waterOptions.map((o) => (
              <button
                key={o.value}
                className={cn(
                  'press min-h-[44px] rounded-xl border px-3 text-sm font-medium',
                  water === o.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10'
                )}
                aria-pressed={water === o.value}
                onClick={() => setWater(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Show villages within <b>{maxDist} km</b> of town
            </span>
            <input
              type="range"
              min={5}
              max={30}
              step={1}
              value={maxDist}
              onChange={(e) => setMaxDist(Number(e.target.value))}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Maximum distance to town, currently ${maxDist} kilometres`}
            />
          </label>
          <div className="max-h-96 overflow-y-auto rounded-xl border border-border" style={{ scrollbarWidth: 'thin' }}>
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-card">
                <tr>
                  {['Village', 'Households', 'School', 'Water', 'Distance (km)'].map((h) => (
                    <th key={h} scope="col" className="border-b border-border px-3 py-2 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.name} className="odd:bg-muted/40">
                    <td className="px-3 py-1.5">{v.name}</td>
                    <td className="px-3 py-1.5">{v.households}</td>
                    <td className="px-3 py-1.5">{v.school ? 'yes' : 'no'}</td>
                    <td className="px-3 py-1.5">{v.water ? 'yes' : 'no'}</td>
                    <td className="px-3 py-1.5">{v.distance}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-muted-foreground">
                      No villages match the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {rows.length} of {VILLAGES.length} villages shown.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="text-sm font-bold">Question</h3>
          <p className="text-base font-semibold">
            What is the <b>{question.stat}</b> {colName(question.col)} of villages{' '}
            {question.water === 'any' ? '' : question.water === 'yes' ? 'with water access ' : 'without water access '}
            within {question.maxDist} km of town?
          </p>
          <p className="text-xs text-muted-foreground">
            Tip: set the filters above to match the question, read the matching rows, then compute by hand.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Your answer</span>
              <Input
                type="number"
                step={0.1}
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  setResult(null);
                }}
                disabled={result?.passed ?? false}
                className="w-36"
                aria-label={`Your computed ${question.stat} ${colName(question.col)}`}
              />
            </label>
            <Button className="press min-h-[44px]" onClick={check} disabled={result?.passed ?? false}>
              Check
            </Button>
            {result && (
              <Button variant="outline" className="press min-h-[44px]" onClick={nextQuestion}>
                Next question
              </Button>
            )}
          </div>
          <p role="status" aria-live="polite" className="text-sm font-semibold">
            {result === null ? (
              <span className="text-muted-foreground">Compute it yourself — the lab checks within ±1.</span>
            ) : result.passed ? (
              <span className="text-emerald-600">
                Correct! The {question.stat} is {qAnswer.toFixed(1)}.
              </span>
            ) : (
              <span className="text-amber-600">
                Not quite — the {question.stat} is {qAnswer.toFixed(1)}.{' '}
                {question.stat === 'mean'
                  ? 'Add the values and divide by how many rows match.'
                  : 'Sort the matching values and take the middle one (average the middle two if there is an even count).'}
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Correct:</span>
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn('size-3 rounded-full', i < score ? 'bg-emerald-500' : 'bg-muted')} />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">{score}/3</span>
          </div>
          {won && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
              Three statistics computed — you can interrogate a dataset!
            </p>
          )}
        </div>
      </div>
    </GameShell>
  );
}
