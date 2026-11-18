'use client';

import { Droplets, FlaskConical, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { GameShell, type GameProps } from '../GameShell';
import { ChapterRef, LabReport } from './shared';
import { cn } from '@/lib/utils';

/**
 * Titration Sim: 0.100 M NaOH runs from a burette into 25.00 mL of HCl with a
 * random unknown concentration (0.050-0.150 M). Live pH is computed
 * analytically for a strong acid + strong base pair (excess moles decide).
 * The learner watches the indicator, records the endpoint, back-calculates
 * the unknown via M1V1 = M2V2, and needs 2 passed trials to win.
 */

const V_ACID_ML = 25.0;
const M_NAOH = 0.1; // mol/L
const PLOT_MAX_ML = 60;
const ENDPOINT_TOL_ML = 0.3;
const OVERSHOOT_ML = 0.5;
const M_TOL = 0.02; // relative
const PASS_TARGET = 2;

type Indicator = 'phenolphthalein' | 'methyl orange';

interface Verdict {
  ok: boolean;
  overshoot: boolean;
  text: string;
}

function randomUnknown(): number {
  return Math.round((0.05 + Math.random() * 0.1) * 1000) / 1000;
}

/** Exact strong acid + strong base pH from the excess-moles balance. */
function phAt(mL: number, unknownM: number): number {
  const nHcl = (V_ACID_ML / 1000) * unknownM;
  const nNaoh = (mL / 1000) * M_NAOH;
  const totalL = (V_ACID_ML + mL) / 1000;
  const excess = nHcl - nNaoh;
  if (Math.abs(excess) < 1e-12) return 7;
  const raw =
    excess > 0
      ? -Math.log10(excess / totalL)
      : 14 + Math.log10(-excess / totalL);
  return Math.min(14, Math.max(0, raw));
}

function flaskFill(indicator: Indicator, pH: number): string {
  if (indicator === 'phenolphthalein') {
    if (pH < 8.2) return '#f8fafc';
    const t = Math.min(1, (pH - 8.2) / 1.8);
    return `hsl(330 75% ${88 - t * 42}%)`;
  }
  if (pH < 3.1) return '#dc2626';
  if (pH > 4.4) return '#eab308';
  const t = (pH - 3.1) / 1.3;
  return `hsl(${Math.round(5 + t * 40)} 90% ${48 + t * 16}%)`;
}

function flaskWord(indicator: Indicator, pH: number): string {
  if (indicator === 'phenolphthalein') {
    if (pH < 8.2) return 'colourless';
    if (pH < 10) return 'faint pink';
    return 'pink';
  }
  if (pH < 3.1) return 'red';
  if (pH < 4.4) return 'orange';
  return 'yellow';
}

const toX = (mL: number) => 50 + (mL / PLOT_MAX_ML) * 490;
const toY = (pH: number) => 250 - (pH / 14) * 230;

export function TitrationSimLab(props: GameProps) {
  const [indicator, setIndicator] = useState<Indicator>('phenolphthalein');
  const [unknownM, setUnknownM] = useState<number>(() => randomUnknown());
  const [added, setAdded] = useState(0);
  const [endpointMl, setEndpointMl] = useState<number | null>(null);
  const [calcM, setCalcM] = useState('');
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [rows, setRows] = useState<(string | number)[][]>([]);
  const [passed, setPassed] = useState(0);

  // Derived values (all above any effect; this lab uses none).
  const pH = phAt(added, unknownM);
  const veqMl = (V_ACID_ML * unknownM) / M_NAOH;
  const overshootLive = added > veqMl + OVERSHOOT_ML;
  const trialLocked = verdict !== null;
  const trialNo = rows.length + 1;
  const curve: { v: number; pH: number }[] = [];
  for (let v = 0; v <= PLOT_MAX_ML + 1e-9; v += 0.1) {
    curve.push({ v, pH: phAt(v, unknownM) });
  }
  const drawn = curve.filter((p) => p.v <= added + 1e-9);

  const statusText = verdict
    ? verdict.text
    : overshootLive
      ? 'You are more than 0.50 mL past the equivalence point. This trial is overshot — refill and take a new unknown.'
      : endpointMl !== null
        ? 'Endpoint recorded. Now enter the concentration you calculate and check the trial.'
        : 'Add NaOH slowly near the colour change, then record the endpoint.';

  function recordEndpoint() {
    if (trialLocked || endpointMl !== null) return;
    setEndpointMl(Number(added.toFixed(2)));
  }

  function checkTrial() {
    if (endpointMl === null || verdict !== null) return;
    const m = Number(calcM);
    if (!Number.isFinite(m) || m <= 0) return;
    const offV = endpointMl - veqMl;
    const offM = Math.abs(m - unknownM) / unknownM;
    let v: Verdict;
    if (offV > OVERSHOOT_ML) {
      v = {
        ok: false,
        overshoot: true,
        text: `Overshot: your recorded endpoint is ${offV.toFixed(2)} mL past the true equivalence point (${veqMl.toFixed(2)} mL). Refill and take a new unknown — this trial must be redone.`,
      };
    } else if (Math.abs(offV) <= ENDPOINT_TOL_ML && offM <= M_TOL) {
      v = {
        ok: true,
        overshoot: false,
        text: `Trial passed — endpoint within ${Math.abs(offV).toFixed(2)} mL of equivalence and concentration within ${(offM * 100).toFixed(1)}%. ${passed + 1 >= PASS_TARGET ? 'Two trials passed — titration mastered.' : 'Refill for the second trial.'}`,
      };
    } else {
      v = {
        ok: false,
        overshoot: false,
        text: `Not quite. Endpoint was ${Math.abs(offV).toFixed(2)} mL off (allowed 0.30 mL) and concentration ${(offM * 100).toFixed(1)}% off (allowed 2%). Refill and retry with a fresh unknown.`,
      };
    }
    setVerdict(v);
    setRows((r) => [
      ...r,
      [
        trialNo,
        indicator,
        endpointMl.toFixed(2),
        m.toFixed(4),
        unknownM.toFixed(3),
        v.ok ? 'Pass' : v.overshoot ? 'Overshoot — redo' : 'Retry',
      ],
    ]);
    if (v.ok) {
      const next = passed + 1;
      setPassed(next);
      if (next >= PASS_TARGET) props.onWin();
    }
  }

  function refill() {
    setUnknownM(randomUnknown());
    setAdded(0);
    setEndpointMl(null);
    setCalcM('');
    setVerdict(null);
  }

  const liquidTopY = 258 - Math.min(60, ((V_ACID_ML + added) / 70) * 60);

  return (
    <GameShell
      title="Titration Sim"
      blurb="Run 0.100 M NaOH into 25.00 mL of HCl with a hidden concentration. Watch the indicator, catch the endpoint, then work the unknown out from M1V1 = M2V2."
      modelNote="pH is computed analytically for a strong acid vs strong base (excess moles decide; pH = 7 exactly at equivalence). Both indicators land close to the true equivalence here: phenolphthalein flips a hair after pH 7 and methyl orange completes its change a hair before — the two bracket the endpoint differently, and for a weak acid vs strong base they would differ a lot. This sim keeps the strong-strong case."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Droplets className="size-4" aria-hidden="true" /> Bench controls
          </h3>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Indicator</span>
            <select
              value={indicator}
              onChange={(e) => setIndicator(e.target.value as Indicator)}
              aria-label="Choose the indicator"
              className="press min-h-[44px] rounded-xl border border-border bg-card px-3 text-sm"
            >
              <option value="phenolphthalein">Phenolphthalein (colourless to pink)</option>
              <option value="methyl orange">Methyl orange (red to yellow)</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              className="press inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10 disabled:opacity-50"
              onClick={() => setAdded((a) => Number((a + 0.05).toFixed(2)))}
              disabled={trialLocked}
            >
              Add drop (+0.05 mL)
            </button>
            <button
              className="press inline-flex min-h-[44px] items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10 disabled:opacity-50"
              onClick={() => setAdded((a) => Number((a + 1).toFixed(2)))}
              disabled={trialLocked}
            >
              Add 1.00 mL
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="press inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10 disabled:opacity-50"
              onClick={recordEndpoint}
              disabled={trialLocked || endpointMl !== null}
            >
              <FlaskConical className="size-4" aria-hidden="true" /> Record endpoint here
            </button>
            <button
              className="press inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
              onClick={refill}
            >
              <RotateCcw className="size-4" aria-hidden="true" /> Refill / new unknown
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-xl border border-border bg-card p-2">
              <p className="text-xs text-muted-foreground">Burette reading</p>
              <p className="tabular-nums font-bold">{added.toFixed(2)} mL</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              <p className="text-xs text-muted-foreground">Live pH</p>
              <p className="tabular-nums font-bold">{pH.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-2">
              <p className="text-xs text-muted-foreground">Endpoint</p>
              <p className="tabular-nums font-bold">
                {endpointMl === null ? '—' : `${endpointMl.toFixed(2)} mL`}
              </p>
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Your calculated M(HCl) = (0.100 × V endpoint) / 25.00, in mol/L
            </span>
            <input
              type="number"
              min={0}
              step={0.001}
              value={calcM}
              onChange={(e) => setCalcM(e.target.value)}
              aria-label="Your calculated unknown concentration in moles per litre"
              className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 text-sm tabular-nums"
              placeholder="e.g. 0.100"
            />
          </label>
          <button
            className="press inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            onClick={checkTrial}
            disabled={endpointMl === null || trialLocked || calcM === ''}
          >
            Check trial {trialNo}
          </button>

          <p
            role="status"
            aria-live="polite"
            className={cn(
              'text-sm font-semibold',
              verdict?.ok ? 'text-emerald-600' : 'text-amber-600'
            )}
          >
            {statusText}
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <svg
            viewBox="0 0 220 282"
            className="mx-auto w-full max-w-[220px]"
            role="img"
            aria-label={`Burette delivering NaOH and a conical flask whose solution looks ${flaskWord(indicator, pH)}`}
          >
            <rect x="96" y="8" width="20" height="150" rx="3" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x="98" y={10 + (added / PLOT_MAX_ML) * 146} width="16" height={Math.max(0, 156 - (10 + (added / PLOT_MAX_ML) * 146))} fill="#7dd3fc" opacity="0.7" />
            {[0, 10, 20, 30, 40, 50, 60].map((t) => (
              <g key={t}>
                <line x1="116" y1={10 + (t / PLOT_MAX_ML) * 146} x2="122" y2={10 + (t / PLOT_MAX_ML) * 146} stroke="#94a3b8" strokeWidth="1" />
                <text x="126" y={13 + (t / PLOT_MAX_ML) * 146} fontSize="8" fill="#64748b">
                  {t}
                </text>
              </g>
            ))}
            <rect x="100" y="158" width="12" height="6" fill="#64748b" />
            <polygon points="103,164 109,164 106,176" fill="#94a3b8" />
            <circle cx="106" cy="183" r="2.5" fill="#7dd3fc" />
            <rect x="99" y="188" width="14" height="18" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
            <defs>
              <clipPath id="flaskClip">
                <polygon points="92,206 120,206 138,258 74,258" />
              </clipPath>
            </defs>
            <rect x="70" y={liquidTopY} width="72" height={258 - liquidTopY} fill={flaskFill(indicator, pH)} clipPath="url(#flaskClip)" />
            <polygon points="92,206 120,206 138,258 74,258" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
            <text x="106" y="274" textAnchor="middle" fontSize="10" fill="#64748b">
              Flask looks {flaskWord(indicator, pH)}
            </text>
          </svg>

          <svg
            viewBox="0 0 560 280"
            className="w-full"
            role="img"
            aria-label={`pH curve versus volume of NaOH added, currently at ${added.toFixed(2)} mL and pH ${pH.toFixed(2)}`}
          >
            <line x1="50" y1="250" x2="540" y2="250" stroke="#94a3b8" strokeWidth="1" />
            <line x1="50" y1="20" x2="50" y2="250" stroke="#94a3b8" strokeWidth="1" />
            <line x1="50" y1={toY(7)} x2="540" y2={toY(7)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
            <text x="536" y={toY(7) - 4} textAnchor="end" fontSize="10" fill="#64748b">
              pH 7
            </text>
            {[0, 10, 20, 30, 40, 50, 60].map((t) => (
              <g key={t}>
                <line x1={toX(t)} y1="250" x2={toX(t)} y2="254" stroke="#94a3b8" />
                <text x={toX(t)} y="266" textAnchor="middle" fontSize="10" fill="#64748b">
                  {t}
                </text>
              </g>
            ))}
            {[0, 7, 14].map((p) => (
              <text key={p} x="44" y={toY(p) + 4} textAnchor="end" fontSize="10" fill="#64748b">
                {p}
              </text>
            ))}
            <text x="295" y="278" textAnchor="middle" fontSize="11" fill="#64748b">
              NaOH added (mL)
            </text>
            <text x="52" y="16" fontSize="11" fill="#64748b">
              pH
            </text>
            <polyline
              points={drawn.map((p) => `${toX(p.v).toFixed(1)},${toY(p.pH).toFixed(1)}`).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <circle cx={toX(added)} cy={toY(pH)} r="4" className="fill-primary" />
            {verdict !== null && (
              <g>
                <line x1={toX(veqMl)} y1="20" x2={toX(veqMl)} y2="250" stroke="#10b981" strokeWidth="1.5" strokeDasharray="5 4" />
                <text x={toX(veqMl)} y="30" textAnchor="middle" fontSize="10" className="fill-emerald-600">
                  true equivalence {veqMl.toFixed(2)} mL
                </text>
              </g>
            )}
          </svg>

          <p className="text-xs text-muted-foreground">
            The S-curve grows as you add titrant. Read the endpoint from the colour flip; the true equivalence is revealed only after you check the trial.
          </p>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Passed trials:</span>
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1].map((i) => (
                <span key={i} className={cn('size-3 rounded-full', i < passed ? 'bg-emerald-500' : 'bg-muted')} />
              ))}
            </div>
            <span className="text-sm tabular-nums text-muted-foreground">{passed}/{PASS_TARGET}</span>
          </div>
          {passed >= PASS_TARGET && (
            <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600">
              Two clean titrations — you can run an endpoint like a chemist.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <LabReport
          title="Titration log"
          columns={['Trial', 'Indicator', 'Endpoint mL', 'Calculated M', 'True M', 'Verdict']}
          rows={rows}
          note="The True M column is revealed per trial for checking; in a real practical you would not know it in advance."
        />
        <ChapterRef subject="Chemistry" chapter="Ch 7 — Equilibrium" topic="Ionic equilibrium, pH and titration" />
      </div>
    </GameShell>
  );
}
