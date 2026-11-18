'use client';

import { useState } from 'react';
import { Zap, Lightbulb } from 'lucide-react';
import { GameShell, type GameProps } from './GameShell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Circuit Lab: build a series or parallel circuit with sliders for battery
 * voltage and two resistors. Live values from Ohm's law: series R adds,
 * parallel adds as 1/R. Hit the target current in BOTH modes -> onWin().
 */

type Mode = 'series' | 'parallel';

const TARGETS: Record<Mode, number> = { series: 0.5, parallel: 2.0 };
const TOLERANCE = 0.05;

function circuit(mode: Mode, v: number, r1: number, r2: number) {
  const rt = mode === 'series' ? r1 + r2 : (r1 * r2) / (r1 + r2);
  const I = v / rt;
  return mode === 'series'
    ? { rt, I, i1: I, i2: I, v1: I * r1, v2: I * r2 }
    : { rt, I, i1: v / r1, i2: v / r2, v1: v, v2: v };
}

const fmt = (x: number) => String(Math.round(x * 100) / 100);

export function CircuitLabGame(props: GameProps) {
  const [mode, setMode] = useState<Mode>('series');
  const [v, setV] = useState(6);
  const [r1, setR1] = useState(10);
  const [r2, setR2] = useState(10);
  const [passed, setPassed] = useState<Mode[]>([]);
  const [msg, setMsg] = useState('');

  // Derivations (plain consts, above any effects — there are none here).
  const c = circuit(mode, v, r1, r2);
  const target = TARGETS[mode];
  const hit = Math.abs(c.I - target) <= TOLERANCE;
  // Bulb brightness by current class (0 = dim .. 1 = bright).
  const brightness = Math.max(0.12, Math.min(1, c.I / 2.5));
  const won = passed.length >= 2;

  function check() {
    if (hit) {
      setMsg(
        `Correct! ${mode === 'series' ? 'Series' : 'Parallel'} with ${v} V and R = ${fmt(c.rt)} Ω gives ${fmt(c.I)} A — the bulb glows as aimed.`
      );
      if (!passed.includes(mode)) {
        const next = [...passed, mode];
        setPassed(next);
        if (next.length >= 2) props.onWin();
      }
    } else {
      setMsg(
        `Your circuit gives ${fmt(c.I)} A, not ${fmt(target)} A. ${
          c.I < target
            ? 'Lower the total resistance or raise the voltage.'
            : 'Raise the total resistance or lower the voltage.'
        }`
      );
    }
  }

  const sliders: Array<{ label: string; value: number; set: (n: number) => void; min: number; max: number; step: number; unit: string }> = [
    { label: 'Battery voltage', value: v, set: setV, min: 1.5, max: 12, step: 0.5, unit: 'V' },
    { label: 'Resistor 1', value: r1, set: setR1, min: 1, max: 100, step: 1, unit: 'Ω' },
    { label: 'Resistor 2', value: r2, set: setR2, min: 1, max: 100, step: 1, unit: 'Ω' },
  ];

  return (
    <GameShell
      title="Circuit Lab"
      blurb="Build a circuit and read it with Ohm's law: V = I × R. In series the resistances add and the same current flows through both; in parallel each resistor gets the full voltage and the currents add."
      modelNote="Ohm's law with ideal battery and wires — no internal resistance, no heating effects."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <div className="flex gap-2" role="group" aria-label="Circuit mode">
            {(['series', 'parallel'] as Mode[]).map((m) => (
              <button
                key={m}
                className={cn(
                  'press min-h-[44px] flex-1 rounded-xl border px-3 text-sm font-bold capitalize',
                  mode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10',
                  passed.includes(m) && 'border-emerald-500 text-emerald-600'
                )}
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                  setMsg('');
                }}
              >
                {m}
                {passed.includes(m) ? ' ✓' : ''}
              </button>
            ))}
          </div>

          <svg
            viewBox="0 0 300 120"
            role="img"
            aria-label={`${mode} circuit with a ${v} volt battery and resistors of ${r1} and ${r2} ohms`}
            className="w-full max-w-sm self-center"
          >
            <g fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M30 20V100M25 40h10M20 55h20" />
              {mode === 'series' ? (
                <path d="M30 20H90M130 20H170M210 20H270V100H30" />
              ) : (
                <path d="M30 20H270V100H30M120 20V45M120 75V100M200 20V45M200 75V100" />
              )}
              <rect x="90" y="10" width="40" height="20" />
              <rect x={mode === 'series' ? '170' : '180'} y={mode === 'series' ? '10' : '45'} width="40" height={mode === 'series' ? '20' : '30'} />
            </g>
            <g fill="currentColor" fontSize="11">
              <text x="38" y="60">{v} V</text>
              <text x={mode === 'series' ? '95' : '105'} y={mode === 'series' ? '48' : '64'}>{r1} Ω</text>
              <text x={mode === 'series' ? '175' : '185'} y={mode === 'series' ? '48' : '64'}>{r2} Ω</text>
            </g>
            <circle cx="150" cy="105" r="10" fill="#f59e0b" fillOpacity={brightness} stroke="currentColor" />
            <text x="150" y="122" textAnchor="middle" fontSize="10" fill="currentColor">
              bulb
            </text>
          </svg>

          {sliders.map((s) => (
            <label key={s.label} className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                {s.label}: <b>{s.value} {s.unit}</b>
              </span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={s.value}
                onChange={(e) => {
                  s.set(Number(e.target.value));
                  setMsg('');
                }}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`${s.label}, currently ${s.value} ${s.unit}`}
              />
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Lightbulb className="size-4" aria-hidden="true" /> Live readings
          </h3>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <th scope="row" className="py-1 text-left font-medium">Total resistance</th>
                <td className="py-1 text-right font-mono">{fmt(c.rt)} Ω</td>
              </tr>
              <tr>
                <th scope="row" className="py-1 text-left font-medium">Total current</th>
                <td className="py-1 text-right font-mono">{fmt(c.I)} A</td>
              </tr>
              <tr>
                <th scope="row" className="py-1 text-left font-medium">Resistor 1: current / voltage</th>
                <td className="py-1 text-right font-mono">{fmt(c.i1)} A / {fmt(c.v1)} V</td>
              </tr>
              <tr>
                <th scope="row" className="py-1 text-left font-medium">Resistor 2: current / voltage</th>
                <td className="py-1 text-right font-mono">{fmt(c.i2)} A / {fmt(c.v2)} V</td>
              </tr>
            </tbody>
          </table>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h4 className="flex items-center gap-2 text-sm font-bold">
              <Zap className="size-4" aria-hidden="true" /> Challenge
            </h4>
            <p className="mt-1 text-sm">
              Hit a total current of <b>{fmt(target)} A (± {TOLERANCE})</b> in <b>{mode}</b> mode, then check.
              Pass in both modes to win.
            </p>
            <Button className="press mt-3 min-h-[44px]" onClick={check}>
              Check my circuit
            </Button>
          </div>

          <p role="status" aria-live="polite" className={cn('text-sm font-semibold', msg && (hit ? 'text-emerald-600' : 'text-amber-600'))}>
            {msg || 'Adjust the sliders, watch the bulb, then check.'}
          </p>

          <p className="text-sm text-muted-foreground">
            Modes passed: {passed.length}/2 {passed.length > 0 && `(${passed.join(', ')})`}
          </p>
          {won && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
              Both modes passed — Ohm's law is yours!
            </p>
          )}
        </div>
      </div>
    </GameShell>
  );
}
