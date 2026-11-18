'use client';

import { useState } from 'react';
import { Dna } from 'lucide-react';
import { GameShell, type GameProps } from './GameShell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Genetics Lab: Punnett squares. Pick parent genotypes (AA / Aa / aa), watch
 * the 2x2 grid fill, then predict what percentage of offspring show the
 * dominant trait. 5 correct predictions -> onWin().
 */

type Genotype = 'AA' | 'Aa' | 'aa';
const GENOTYPES: Genotype[] = ['AA', 'Aa', 'aa'];

const norm = (x: string, y: string) => [x, y].sort().join('');

function cellsFor(a: Genotype, b: Genotype): string[][] {
  return a.split('').map((x) => b.split('').map((y) => norm(x, y)));
}

function dominantPercent(cells: string[][]): number {
  const withA = cells.flat().filter((g) => g.includes('A')).length;
  return (withA / 4) * 100;
}

const OPTIONS = [0, 25, 50, 75, 100];

export function GeneticsLabGame(props: GameProps) {
  const [mother, setMother] = useState<Genotype>('Aa');
  const [father, setFather] = useState<Genotype>('Aa');
  const [answer, setAnswer] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  // Derivations (plain consts, above any effects — there are none here).
  const cells = cellsFor(mother, father);
  const correct = dominantPercent(cells);
  const answered = answer !== null;
  const isCorrect = answer === correct;
  const won = streak >= 5;

  function predict(value: number) {
    if (answered) return;
    setAnswer(value);
    if (value === correct) {
      const next = streak + 1;
      setStreak(next);
      if (next >= 5) props.onWin();
    } else {
      setStreak(0);
    }
  }

  function nextCross(g: 'm' | 'f') {
    return () => {
      const pick = GENOTYPES[Math.floor(Math.random() * 3)];
      if (g === 'm') setMother(pick);
      else setFather(pick);
      setAnswer(null);
    };
  }

  return (
    <GameShell
      title="Genetics Lab"
      blurb="A is the dominant allele, a is recessive. Pick both parents, read the Punnett square, then predict what percentage of offspring show the dominant trait (at least one A)."
      modelNote="Simple dominant/recessive single-gene traits only — no linked genes, no incomplete dominance."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Dna className="size-4" aria-hidden="true" /> Parents
          </h3>
          <div className="mt-3 flex flex-col gap-2">
            {(['m', 'f'] as const).map((who) => {
              const value = who === 'm' ? mother : father;
              const setter = who === 'm' ? setMother : setFather;
              return (
                <div key={who} className="flex flex-wrap items-center gap-2">
                  <span className="w-20 text-sm font-medium">{who === 'm' ? 'Parent 1' : 'Parent 2'}</span>
                  {GENOTYPES.map((g) => (
                    <button
                      key={g}
                      className={cn(
                        'press min-h-[44px] min-w-[56px] rounded-xl border px-3 text-base font-bold',
                        value === g ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10',
                        answered && value === g && 'border-emerald-500 text-emerald-600'
                      )}
                      aria-pressed={value === g}
                      aria-label={`${who === 'm' ? 'Parent 1' : 'Parent 2'} genotype ${g}`}
                      onClick={() => {
                        if (!answered) setter(g);
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          <table className="mt-5 w-full max-w-xs border-collapse text-center" aria-label={`Punnett square for ${mother} × ${father}`}>
            <caption className="sr-only">
              Punnett square: parent 1 alleles as rows, parent 2 alleles as columns
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Parent 1 / Parent 2</span>
                </th>
                {father.split('').map((y, j) => (
                  <th key={`${y}-${j}`} scope="col" className="p-2 text-base font-bold">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mother.split('').map((x, i) => (
                <tr key={`${x}-${i}`}>
                  <th scope="row" className="p-2 text-base font-bold">
                    {x}
                  </th>
                  {cells[i].map((z, j) => (
                    <td
                      key={`${i}-${j}`}
                      className={cn(
                        'border border-border p-3 text-base font-bold',
                        answered && z.includes('A') && 'bg-emerald-500/10 text-emerald-700'
                      )}
                    >
                      {z}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-muted-foreground">
            Green cells carry at least one A — those offspring show the dominant trait.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="text-sm font-bold">Your prediction</h3>
          <p className="text-sm text-muted-foreground">
            What percentage of offspring show the <b>dominant trait</b>?
          </p>
          <div className="flex flex-wrap gap-2">
            {OPTIONS.map((v) => (
              <button
                key={v}
                className={cn(
                  'press min-h-[44px] min-w-[64px] rounded-xl border px-3 text-base font-bold',
                  answer === v
                    ? isCorrect
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                      : 'border-amber-500 bg-amber-500/10 text-amber-600'
                    : 'border-border bg-card hover:bg-accent/10'
                )}
                aria-pressed={answer === v}
                disabled={answered}
                onClick={() => predict(v)}
              >
                {v}%
              </button>
            ))}
          </div>
          <p role="status" aria-live="polite" className="text-sm font-semibold">
            {answer === null ? (
              <span className="text-muted-foreground">Count the green cells, then pick a percentage.</span>
            ) : isCorrect ? (
              <span className="text-emerald-600">
                Correct! {correct}% of the four cells carry an A ({cells.flat().filter((g) => g.includes('A')).length} of 4).
              </span>
            ) : (
              <span className="text-amber-600">
                Not quite — {cells.flat().filter((g) => g.includes('A')).length} of the 4 cells carry an A, so {correct}%.
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="press min-h-[44px]" onClick={nextCross('m')}>
              Random parent 1
            </Button>
            <Button variant="outline" className="press min-h-[44px]" onClick={nextCross('f')}>
              Random parent 2
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Correct in a row:</span>
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={cn('size-3 rounded-full', i < streak ? 'bg-emerald-500' : 'bg-muted')} />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">{streak}/5</span>
          </div>
          {won && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
              Five correct predictions — you can read a Punnett square!
            </p>
          )}
        </div>
      </div>
    </GameShell>
  );
}
