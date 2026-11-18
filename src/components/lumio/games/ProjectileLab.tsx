'use client';

import { useState } from 'react';
import { Target } from 'lucide-react';
import { GameShell, type GameProps } from './GameShell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Projectile Lab: sliders for launch speed and angle, live trajectory SVG,
 * and a target at a random distance. Land within ±2 m of the target; 3 hits
 * -> onWin(). R = v²·sin(2θ)/g, H = v²·sin²θ/(2g), g = 9.8 m/s².
 */

const G = 9.8;

interface Attempt {
  v: number;
  angle: number;
  R: number;
  H: number;
  T: number;
  target: number;
}

function newTarget(prev?: number): number {
  let t = prev;
  do {
    t = 10 + Math.floor(Math.random() * 131); // 10..140 m
  } while (prev !== undefined && Math.abs(t - prev) < 15);
  return t;
}

// SVG scale: 0-170 m maps to 40-540 px, 0-90 m maps to 240-16 px (y down).
const SX = 500 / 170;
const SY = 224 / 90;
const toX = (m: number) => 40 + m * SX;
const toY = (m: number) => 240 - m * SY;

export function ProjectileLabGame(props: GameProps) {
  const [v, setV] = useState(20);
  const [angle, setAngle] = useState(45);
  const [target, setTarget] = useState(() => newTarget());
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [msg, setMsg] = useState('');
  const [hits, setHits] = useState(0);

  // Derivations (plain consts, above any effects — there are none here).
  const rad = (angle * Math.PI) / 180;
  const vx = v * Math.cos(rad);
  const vy = v * Math.sin(rad);
  const flight = (2 * vy) / G;
  const range = vx * flight;
  const height = (vy * vy) / (2 * G);
  const pathPoints =
    flight > 0
      ? Array.from({ length: 41 }, (_, i) => {
          const t = (flight * i) / 40;
          return `${toX(vx * t).toFixed(1)},${toY(vy * t - 0.5 * G * t * t).toFixed(1)}`;
        }).join(' ')
      : '';
  const won = hits >= 3;

  function launch() {
    const next: Attempt = { v, angle, R: range, H: height, T: flight, target };
    setAttempt(next);
    const d = next.R - target;
    if (Math.abs(d) <= 2) {
      const nextHits = hits + 1;
      setHits(nextHits);
      setMsg(`Hit! You landed ${next.R.toFixed(1)} m from the launch — within 2 m of the ${target} m target.`);
      if (nextHits >= 3) {
        props.onWin();
      } else {
        setTarget(newTarget(target));
      }
    } else {
      setMsg(
        `${d < 0 ? 'Too short' : 'Too long'} by ${Math.abs(d).toFixed(1)} m. ${
          d < 0 ? 'Try more speed or an angle closer to 45°.' : 'Try less speed.'
        }`
      );
    }
  }

  return (
    <GameShell
      title="Projectile Lab"
      blurb="Choose a launch speed and angle, then try to land the ball on the target. Horizontal speed stays constant; gravity changes only the vertical speed."
      modelNote="No air resistance, flat ground, g = 9.8 m/s². R = v²·sin(2θ)/g and H = v²·sin²θ/(2g)."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Target className="size-4" aria-hidden="true" /> Launch controls
          </h3>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Launch speed: <b>{v} m/s</b>
            </span>
            <input
              type="range"
              min={5}
              max={40}
              step={1}
              value={v}
              onChange={(e) => setV(Number(e.target.value))}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Launch speed, currently ${v} metres per second`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Launch angle: <b>{angle}°</b>
            </span>
            <input
              type="range"
              min={5}
              max={85}
              step={1}
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Launch angle, currently ${angle} degrees`}
            />
          </label>
          <Button className="press min-h-[44px] self-start" onClick={launch}>
            Launch
          </Button>
          <p role="status" aria-live="polite" className={cn('text-sm font-semibold', msg && (msg.startsWith('Hit') ? 'text-emerald-600' : 'text-amber-600'))}>
            {msg || 'Aim, launch, and see how close you land.'}
          </p>
          {attempt && (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              <p>
                Range <b>{attempt.R.toFixed(1)} m</b> · Maximum height <b>{attempt.H.toFixed(1)} m</b> · Time in air{' '}
                <b>{attempt.T.toFixed(2)} s</b>
              </p>
              <p className="mt-1 text-muted-foreground">Target was at {attempt.target} m.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <svg viewBox="0 0 560 262" className="w-full" role="img" aria-label={`Trajectory preview with a target at ${target} metres`}>
            <rect x="0" y="240" width="560" height="14" className="fill-border" />
            <rect
              x={toX(Math.max(0, target - 2)).toFixed(0)}
              y="234"
              width={(4 * SX).toFixed(0)}
              height="6"
              className="fill-emerald-600"
            />
            <text x={toX(target).toFixed(0)} y="228" textAnchor="middle" fontSize="12" className="fill-foreground">
              Target {target} m
            </text>
            {pathPoints && <polyline points={pathPoints} fill="none" stroke="currentColor" strokeWidth="3" />}
            <text x="42" y="256" fontSize="10" className="fill-muted-foreground">
              0 m
            </text>
            <text x="530" y="256" fontSize="10" className="fill-muted-foreground">
              170 m
            </text>
          </svg>
          <p className="text-sm text-muted-foreground">
            The curve previews your current speed and angle; launch to see the real numbers.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Hits:</span>
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn('size-3 rounded-full', i < hits ? 'bg-emerald-500' : 'bg-muted')} />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">{hits}/3</span>
          </div>
          {won && (
            <p className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
              Three hits — you can read a trajectory like a physicist!
            </p>
          )}
        </div>
      </div>
    </GameShell>
  );
}
