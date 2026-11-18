'use client';

import { useState } from 'react';
import { Rocket } from 'lucide-react';
import { GameShell, type GameProps } from './GameShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Build Your Own Spaceship: pick an engine, size the rocket with sliders,
 * PREDICT the delta-v from the rocket equation, then fly the mission.
 * Δv = Isp·g₀·ln(m₀/m_dry)/1000 (km/s), tanks weigh 8% of fuel,
 * TWR = thrust·n/(m₀·9.81). Two successful missions -> onWin().
 */

interface Engine {
  name: string;
  thrust: number; // kN per engine
  isp: number; // s
  mass: number; // t per engine
}

const ENGINES: Engine[] = [
  { name: 'Solid booster', thrust: 500, isp: 250, mass: 3 },
  { name: 'Liquid core', thrust: 900, isp: 340, mass: 6 },
  { name: 'Ion drive', thrust: 60, isp: 3000, mass: 2 },
];

interface Mission {
  name: string;
  dv: number; // km/s needed
  twr: number; // minimum thrust-to-weight
  note: string;
  stretch?: boolean;
}

// Targets include gravity/drag losses (folded in — no drag model in-flight).
const MISSIONS: Mission[] = [
  {
    name: 'Low orbit (from the ground)',
    dv: 9.4,
    twr: 1.2,
    note: 'Real launches need about 9.3-9.5 km/s including losses — and use several stages. A single stage with these engines cannot reach orbit; fly it to see how close you get, then try the missions a single stage can do.',
    stretch: true,
  },
  {
    name: 'Moon transfer (starting in orbit)',
    dv: 3.2,
    twr: 0.3,
    note: 'In space, low thrust is fine — only the burn time grows. The Ion drive shines here.',
  },
  {
    name: 'Heavy satellite deployment',
    dv: 6.0,
    twr: 0.8,
    note: 'A chunky payload with a TWR above 0.8: trim dead weight and carry just enough fuel.',
  },
];

const G0 = 9.81;

export function SpaceshipGame(props: GameProps) {
  const [engineIdx, setEngineIdx] = useState(0);
  const [n, setN] = useState(2);
  const [fuel, setFuel] = useState(80);
  const [hull, setHull] = useState(8);
  const [payload, setPayload] = useState(5);
  const [missionIdx, setMissionIdx] = useState(0);
  const [pred, setPred] = useState('');
  const [result, setResult] = useState<null | { ok: boolean; dv: number; twr: number; m0: number; pred: number | null; predOk: boolean }>(null);
  const [successes, setSuccesses] = useState<number[]>([]);

  const engine = ENGINES[engineIdx];
  const mission = MISSIONS[missionIdx];

  // Rocket equation (plain consts, above any effects — there are none here).
  const tanks = 0.08 * fuel;
  const dry = hull + engine.mass * n + payload + tanks;
  const m0 = dry + fuel;
  const dv = (engine.isp * G0 * Math.log(m0 / dry)) / 1000;
  const twr = (engine.thrust * n) / (m0 * G0);
  const predNum = pred.trim() === '' ? null : Number(pred);
  const predOk = predNum !== null && !Number.isNaN(predNum) && Math.abs(predNum - dv) <= 0.1 * dv;
  const missionOk = dv >= mission.dv && twr >= mission.twr && predOk;
  const won = successes.length >= 2;

  function fly() {
    const ok = missionOk;
    setResult({ ok, dv, twr, m0, pred: predNum, predOk: predOk });
    if (ok && !successes.includes(missionIdx)) {
      const next = [...successes, missionIdx];
      setSuccesses(next);
      if (next.length >= 2) props.onWin();
    }
  }

  const sliders: Array<{ label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; unit: string }> = [
    { label: 'Number of engines', value: n, set: setN, min: 1, max: 6, step: 1, unit: '' },
    { label: 'Fuel', value: fuel, set: setFuel, min: 5, max: 400, step: 5, unit: 't' },
    { label: 'Hull & structure', value: hull, set: setHull, min: 2, max: 20, step: 1, unit: 't' },
    { label: 'Payload', value: payload, set: setPayload, min: 1, max: 20, step: 1, unit: 't' },
  ];

  return (
    <GameShell
      title="Build Your Own Spaceship"
      blurb="Pick an engine, size the rocket, predict your Δv with the rocket equation Δv = Isp × g₀ × ln(m₀ / m_dry), then fly. Get the prediction within 10% AND meet the mission targets."
      modelNote="One stage, no drag model (losses are folded into the mission targets), tanks weigh 8% of the fuel they hold."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Rocket className="size-4" aria-hidden="true" /> Design
          </h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Engine type">
            {ENGINES.map((e, i) => (
              <button
                key={e.name}
                className={cn(
                  'press min-h-[44px] rounded-xl border px-3 text-left text-sm font-medium',
                  engineIdx === i ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10'
                )}
                aria-pressed={engineIdx === i}
                onClick={() => {
                  setEngineIdx(i);
                  setResult(null);
                }}
              >
                <b>{e.name}</b>
                <br />
                <span className="text-xs text-muted-foreground">
                  {e.thrust} kN · Isp {e.isp} s · {e.mass} t
                </span>
              </button>
            ))}
          </div>
          {sliders.map((s) => (
            <label key={s.label} className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                {s.label}: <b>{s.value}{s.unit && ` ${s.unit}`}</b>
              </span>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={s.value}
                onChange={(e) => {
                  s.set(Number(e.target.value));
                  setResult(null);
                }}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`${s.label}, currently ${s.value} ${s.unit}`}
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Mission">
            {MISSIONS.map((m, i) => (
              <button
                key={m.name}
                className={cn(
                  'press min-h-[44px] rounded-xl border px-3 text-sm font-medium',
                  missionIdx === i ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10',
                  successes.includes(i) && 'border-emerald-500 text-emerald-600'
                )}
                aria-pressed={missionIdx === i}
                onClick={() => {
                  setMissionIdx(i);
                  setResult(null);
                }}
              >
                {m.name}
                {successes.includes(i) ? ' ✓' : ''}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Predict your Δv (km/s) before flying</span>
              <Input
                type="number"
                step={0.1}
                value={pred}
                onChange={(e) => {
                  setPred(e.target.value);
                  setResult(null);
                }}
                className="w-40"
                aria-label="Predicted delta-v in kilometres per second"
              />
            </label>
            <Button className="press min-h-[44px]" onClick={fly}>
              Fly mission
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="text-sm font-bold">Mission: {mission.name}</h3>
          <p className="text-sm text-muted-foreground">
            Needs Δv ≥ <b>{mission.dv} km/s</b> and TWR ≥ <b>{mission.twr}</b>. {mission.note}
          </p>
          <p className="text-sm" aria-live="polite">
            Live estimate: Δv <b>{dv.toFixed(2)} km/s</b> · TWR <b>{twr.toFixed(2)}</b> · launch mass{' '}
            <b>{m0.toFixed(1)} t</b> (dry {dry.toFixed(1)} t)
          </p>
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'rounded-2xl border p-4 text-sm',
              result === null
                ? 'border-border bg-card'
                : result.ok
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-amber-500 bg-amber-500/10'
            )}
          >
            {result === null ? (
              <p className="text-muted-foreground">No flight yet. Design, predict, then fly.</p>
            ) : (
              <>
                <p className={cn('font-bold', result.ok ? 'text-emerald-600' : 'text-amber-600')}>
                  {result.ok ? 'Mission success!' : 'Mission failed'}
                </p>
                <p className="mt-1">
                  Δv available <b>{result.dv.toFixed(2)} km/s</b> (needed {mission.dv}) · TWR{' '}
                  <b>{result.twr.toFixed(2)}</b> (needed {mission.twr}) · launch mass {result.m0.toFixed(1)} t
                </p>
                <p className="mt-1">
                  {result.pred === null && 'You skipped the prediction. Try one next time.'}
                  {result.pred !== null && (
                    <>
                      Your prediction was {result.pred} km/s: off by <b>{Math.abs(result.pred - result.dv).toFixed(2)}</b>
                      {!result.predOk ? ' — more than the 10% allowed.' : ' — within the 10% allowed.'}
                    </>
                  )}
                </p>
                {!result.ok && (
                  <p className="mt-1 text-muted-foreground">
                    {(result.dv < mission.dv
                      ? 'Not enough Δv: more fuel, a higher-Isp engine, or less dead weight. '
                      : '') + (result.twr < mission.twr ? 'Too little thrust for this mass. ' : '')}
                    {result.pred !== null && !result.predOk
                      ? 'Prediction more than 10% off — compute Isp × 9.81 × ln(m₀/dry) ÷ 1000 by hand next time.'
                      : ''}
                  </p>
                )}
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Missions succeeded: {successes.length}/2{successes.length > 0 && ` (${successes.map((i) => MISSIONS[i].name).join(', ')})`}
          </p>
          {won && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
              Two missions flown with honest predictions — rocket science unlocked!
            </p>
          )}
        </div>
      </div>
    </GameShell>
  );
}
