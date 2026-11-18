'use client';

import { useState } from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { GameShell, type GameProps } from './GameShell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Virtual Chemistry Lab: balance real equations with LIVE atom counts.
 * Conservation of mass: every element's atom count must match on both sides.
 * Coefficients cycle 1-4 per molecule; a balanced equation turns green and
 * counts toward the win. Balance 3 of the 6 equations -> onWin().
 */

type Atoms = Record<string, number>;

interface Molecule {
  formula: string;
  atoms: Atoms;
}

interface Reaction {
  name: string;
  left: Molecule[];
  right: Molecule[];
}

const RXNS: Reaction[] = [
  {
    name: 'Water synthesis',
    left: [{ formula: 'H₂', atoms: { H: 2 } }, { formula: 'O₂', atoms: { O: 2 } }],
    right: [{ formula: 'H₂O', atoms: { H: 2, O: 1 } }],
  },
  {
    name: 'Methane combustion',
    left: [{ formula: 'CH₄', atoms: { C: 1, H: 4 } }, { formula: 'O₂', atoms: { O: 2 } }],
    right: [{ formula: 'CO₂', atoms: { C: 1, O: 2 } }, { formula: 'H₂O', atoms: { H: 2, O: 1 } }],
  },
  {
    name: 'Rusting of iron',
    left: [{ formula: 'Fe', atoms: { Fe: 1 } }, { formula: 'O₂', atoms: { O: 2 } }],
    right: [{ formula: 'Fe₂O₃', atoms: { Fe: 2, O: 3 } }],
  },
  {
    name: 'Aluminium + acid',
    left: [{ formula: 'Al', atoms: { Al: 1 } }, { formula: 'HCl', atoms: { H: 1, Cl: 1 } }],
    right: [{ formula: 'AlCl₃', atoms: { Al: 1, Cl: 3 } }, { formula: 'H₂', atoms: { H: 2 } }],
  },
  {
    name: 'Neutralisation',
    left: [{ formula: 'NaOH', atoms: { Na: 1, O: 1, H: 1 } }, { formula: 'HCl', atoms: { H: 1, Cl: 1 } }],
    right: [{ formula: 'NaCl', atoms: { Na: 1, Cl: 1 } }, { formula: 'H₂O', atoms: { H: 2, O: 1 } }],
  },
  {
    name: 'Limestone decomposition',
    left: [{ formula: 'CaCO₃', atoms: { Ca: 1, C: 1, O: 3 } }],
    right: [{ formula: 'CaO', atoms: { Ca: 1, O: 1 } }, { formula: 'CO₂', atoms: { C: 1, O: 2 } }],
  },
];

function tally(rx: Reaction, coeffs: number[]) {
  const left: Atoms = {};
  const right: Atoms = {};
  rx.left.forEach((m, k) => {
    for (const [a, n] of Object.entries(m.atoms)) left[a] = (left[a] ?? 0) + n * coeffs[k];
  });
  rx.right.forEach((m, k) => {
    for (const [a, n] of Object.entries(m.atoms)) right[a] = (right[a] ?? 0) + n * coeffs[rx.left.length + k];
  });
  return { left, right };
}

export function ChemistryLabGame(props: GameProps) {
  const [active, setActive] = useState(0);
  const [coeffs, setCoeffs] = useState<number[][]>(() => RXNS.map((r) => [...r.left, ...r.right].map(() => 1)));
  const [solved, setSolved] = useState<number[]>([]);

  const rx = RXNS[active];
  const current = coeffs[active];
  const { left, right } = tally(rx, current);
  const elements = Array.from(new Set([...Object.keys(left), ...Object.keys(right)]));
  const balanced = elements.every((a) => (left[a] ?? 0) === (right[a] ?? 0));
  const molecules = [...rx.left, ...rx.right];

  function setCoefficient(moleculeIndex: number, value: number) {
    if (solved.includes(active)) return;
    setCoeffs((prev) => {
      const next = prev.map((row) => [...row]);
      next[active][moleculeIndex] = value;
      return next;
    });
    // Balance check runs against the new coefficients below (derived consts re-render).
    const nextCoeffs = coeffs.map((row, i) => (i === active ? row.map((v, k) => (k === moleculeIndex ? value : v)) : row));
    const t = tally(rx, nextCoeffs[active]);
    const els = Array.from(new Set([...Object.keys(t.left), ...Object.keys(t.right)]));
    const isBalanced = els.every((a) => (t.left[a] ?? 0) === (t.right[a] ?? 0));
    if (isBalanced && !solved.includes(active)) {
      const nextSolved = [...solved, active];
      setSolved(nextSolved);
      if (nextSolved.length >= 3) props.onWin();
    }
  }

  function resetCoefficients() {
    setCoeffs((prev) => {
      const next = prev.map((row) => [...row]);
      next[active] = molecules.map(() => 1);
      return next;
    });
  }

  return (
    <GameShell
      title="Virtual Chemistry Lab"
      blurb="Balance each equation. The law of conservation of mass says atoms are only rearranged — so every element's count must match on both sides."
      modelNote="Conservation of mass: the atom counts on both sides update live as you pick coefficients. Use the smallest whole numbers that balance."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Choose an equation">
        {RXNS.map((r, i) => (
          <button
            key={r.name}
            className={cn(
              'press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-sm font-medium',
              i === active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10',
              solved.includes(i) && 'border-emerald-500 text-emerald-600'
            )}
            aria-pressed={i === active}
            onClick={() => setActive(i)}
          >
            {r.name}
            {solved.includes(i) && <span aria-hidden="true">✓</span>}
            <span className="sr-only">{solved.includes(i) ? ' (balanced)' : ''}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <FlaskConical className="size-4" aria-hidden="true" /> {rx.name}: pick coefficients (1-4)
          </h3>
          <p className="rounded-xl bg-card p-3 text-center text-lg font-bold" aria-live="polite">
            {rx.left.map((m, k) => (
              <span key={m.formula}>
                <span className={cn(current[k] > 1 && 'text-primary')}>{current[k]}</span> {m.formula}
                {k < rx.left.length - 1 ? ' + ' : ''}
              </span>
            ))}
            <span className="mx-2">→</span>
            {rx.right.map((m, k) => (
              <span key={m.formula}>
                <span className={cn(current[rx.left.length + k] > 1 && 'text-primary')}>
                  {current[rx.left.length + k]}
                </span>{' '}
                {m.formula}
                {k < rx.right.length - 1 ? ' + ' : ''}
              </span>
            ))}
          </p>
          <div className="flex flex-col gap-2">
            {molecules.map((m, k) => (
              <div key={m.formula} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-lg font-bold">{m.formula}</span>
                <div className="flex gap-1.5" role="group" aria-label={`Coefficient for ${m.formula}`}>
                  {[1, 2, 3, 4].map((v) => (
                    <button
                      key={v}
                      className={cn(
                        'press size-11 rounded-xl border text-base font-bold',
                        current[k] === v ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10',
                        solved.includes(active) && current[k] === v && 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                      )}
                      aria-pressed={current[k] === v}
                      aria-label={`Coefficient ${v} for ${m.formula}`}
                      onClick={() => setCoefficient(k, v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="press min-h-[44px]" onClick={resetCoefficients}>
              <RotateCcw className="size-4" aria-hidden="true" /> Reset to 1s
            </Button>
          </div>
          <p role="status" aria-live="polite" className="text-sm font-semibold">
            {solved.includes(active) ? (
              <span className="text-emerald-600">Balanced! Every atom is accounted for on both sides.</span>
            ) : balanced ? (
              <span className="text-emerald-600">Balanced!</span>
            ) : (
              <span className="text-muted-foreground">
                Not balanced yet — compare the atom counts on the right.
              </span>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="text-sm font-bold">Live atom count (left → right)</h3>
          <div className="mt-3 flex flex-col gap-2">
            {elements.map((a) => {
              const l = left[a] ?? 0;
              const r = right[a] ?? 0;
              const ok = l === r;
              return (
                <div
                  key={a}
                  className={cn(
                    'flex items-center justify-between rounded-xl border px-3 py-2',
                    ok ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-card'
                  )}
                >
                  <span className="font-bold">{a}</span>
                  <span className="font-mono text-sm" aria-label={`${a}: ${l} atoms left, ${r} atoms right`}>
                    {l} → {r}{' '}
                    <span className={ok ? 'text-emerald-600' : 'text-amber-600'} aria-hidden="true">
                      {ok ? '✓' : '✗'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Balanced {solved.length}/3 needed · {solved.length}/{RXNS.length} equations solved.
          </p>
          {solved.length >= 3 && (
            <p className="mt-2 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
              Three equations balanced — conservation of mass confirmed!
            </p>
          )}
        </div>
      </div>
    </GameShell>
  );
}
