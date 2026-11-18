'use client';

import { useState } from 'react';
import { Construction } from 'lucide-react';
import { GameShell, type GameProps } from './GameShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Engineering Lab: simply supported beam. Sliders set the load weight and its
 * position; the learner predicts the LEFT support reaction from moments
 * (R_left = W·(L − a)/L) before it is revealed. Within ±5% counts;
 * 3 successful predictions -> onWin().
 */

const L = 6; // span in metres

export function EngineeringLabGame(props: GameProps) {
  const [w, setW] = useState(10);
  const [a, setA] = useState(2);
  const [guess, setGuess] = useState('');
  const [result, setResult] = useState<null | { passed: boolean; said: number }>(null);
  const [successes, setSuccesses] = useState(0);

  // Derivations (plain consts, above any effects — there are none here).
  const rLeft = (w * (L - a)) / L;
  const rRight = (w * a) / L;
  const guessNum = guess.trim() === '' ? null : Number(guess);
  const arrowX = 20 + (a / L) * 300;
  const won = successes >= 3;

  function check() {
    if (guessNum === null || Number.isNaN(guessNum)) return;
    const passed = Math.abs(guessNum - rLeft) <= 0.05 * rLeft;
    setResult({ passed, said: guessNum });
    if (passed) {
      const next = successes + 1;
      setSuccesses(next);
      if (next >= 3) props.onWin();
    }
  }

  function nextBeam() {
    const nextW = 2 + Math.floor(Math.random() * 19); // 2..20 kN
    const nextA = 0.5 + Math.floor(Math.random() * 11) * 0.5; // 0.5..5.5 m
    setW(nextW);
    setA(nextA);
    setGuess('');
    setResult(null);
  }

  return (
    <GameShell
      title="Engineering Lab: beam supports"
      blurb={`A ${L} m beam rests on supports A (left end) and B (right end). A load sits a metres from A. Take moments about A or B, then predict the force at support A before revealing it.`}
      modelNote="Static point loads only, beam weight ignored. Moments: R_A × L = W × (L − a), and vertical forces balance: R_A + R_B = W."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Construction className="size-4" aria-hidden="true" /> The beam
          </h3>
          <svg
            viewBox="0 0 340 130"
            className="w-full max-w-lg self-center"
            role="img"
            aria-label={`Beam of ${L} metres with a ${w} kilonewton load ${a} metres from support A`}
          >
            <rect x="20" y="70" width="304" height="8" rx="2" className="fill-foreground" />
            <path d="M20 78l-12 22h24zM324 78l-12 22h24z" className="fill-muted-foreground" />
            <path d={`M${arrowX} 20v44`} className="stroke-red-600" strokeWidth="3" fill="none" />
            <path d={`M${arrowX - 7} 56l7 10 7-10z`} className="fill-red-600" />
            <text x={arrowX} y="14" textAnchor="middle" fontSize="13" fontWeight="700" className="fill-foreground">
              {w} kN
            </text>
            <text x="20" y="120" textAnchor="middle" fontSize="12" className="fill-foreground">
              A
            </text>
            <text x="324" y="120" textAnchor="middle" fontSize="12" className="fill-foreground">
              B
            </text>
            <text x="172" y="98" textAnchor="middle" fontSize="10" className="fill-muted-foreground">
              span {L} m · load {a} m from A
            </text>
          </svg>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Load weight: <b>{w} kN</b>
            </span>
            <input
              type="range"
              min={2}
              max={20}
              step={1}
              value={w}
              onChange={(e) => {
                setW(Number(e.target.value));
                setResult(null);
              }}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Load weight, currently ${w} kilonewtons`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Load distance from A: <b>{a} m</b>
            </span>
            <input
              type="range"
              min={0.5}
              max={L - 0.5}
              step={0.5}
              value={a}
              onChange={(e) => {
                setA(Number(e.target.value));
                setResult(null);
              }}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Load distance from support A, currently ${a} metres`}
            />
          </label>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="text-sm font-bold">Your prediction</h3>
          <p className="text-sm text-muted-foreground">
            Hint: moments about B. The closer the load is to A, the harder A pushes up.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Upward force at A (kN)</span>
              <Input
                type="number"
                step={0.1}
                value={guess}
                onChange={(e) => {
                  setGuess(e.target.value);
                  setResult(null);
                }}
                className="w-36"
                aria-label={`Predicted force at support A in kilonewtons`}
              />
            </label>
            <Button className="press min-h-[44px]" onClick={check} disabled={result !== null}>
              Reveal the answer
            </Button>
            {result && (
              <Button variant="outline" className="press min-h-[44px]" onClick={nextBeam}>
                Next beam
              </Button>
            )}
          </div>
          <p role="status" aria-live="polite" className="text-sm font-semibold">
            {result === null ? (
              <span className="text-muted-foreground">Predict first — no peeking at the working steps.</span>
            ) : result.passed ? (
              <span className="text-emerald-600">
                Within 5%! R_A = {rLeft.toFixed(2)} kN and R_B = {rRight.toFixed(2)} kN.
              </span>
            ) : (
              <span className="text-amber-600">
                You said {result.said} kN; the answer is {rLeft.toFixed(2)} kN. Check the working below.
              </span>
            )}
          </p>
          {result && (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              <h4 className="text-sm font-bold">Working steps</h4>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>
                  Moments about B: R_A × {L} = {w} × {L - a} (the load is {L - a} m from B)
                </li>
                <li>
                  R_A = ({w} × {L - a}) ÷ {L} = <b>{rLeft.toFixed(2)} kN</b>
                </li>
                <li>
                  Forces balance: R_B = {w} − {rLeft.toFixed(2)} = <b>{rRight.toFixed(2)} kN</b>
                </li>
              </ol>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Successful predictions:</span>
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn('size-3 rounded-full', i < successes ? 'bg-emerald-500' : 'bg-muted')} />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">{successes}/3</span>
          </div>
          {won && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
              Three beams predicted — torque balance holds!
            </p>
          )}
        </div>
      </div>
    </GameShell>
  );
}
