'use client';

import { useState } from 'react';
import { Ruler, RefreshCw, CheckCircle2, ScanLine } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Vernier calipers and screw gauge simulator. Each trial hides a random true
 * size and a random zero error; the scales are drawn so the reading and the
 * zero-mark offset can be read visually. Three fully correct readings ->
 * onWin().
 */

type Instrument = 'vernier' | 'screw';

interface Trial {
  trueSize: number;
  zeroErr: number;
}

const SIGNS = [1, -1] as const;

function randTrial(inst: Instrument): Trial {
  const n = [0, 1, 2, 3][Math.floor(Math.random() * 4)];
  const sign = n === 0 ? 1 : SIGNS[Math.floor(Math.random() * 2)];
  if (inst === 'vernier') {
    return { trueSize: Math.round((15 + Math.random() * 30) * 10) / 10, zeroErr: sign * n * 0.1 };
  }
  return { trueSize: Math.round((2 + Math.random() * 8) * 100) / 100, zeroErr: sign * n * 0.01 };
}

const LC_OPTIONS: Record<Instrument, Array<{ label: string; correct?: boolean }>> = {
  vernier: [
    { label: '1 mm' },
    { label: '0.5 mm' },
    { label: '0.1 mm', correct: true },
    { label: '0.05 mm' },
  ],
  screw: [
    { label: '0.1 mm' },
    { label: '0.05 mm' },
    { label: '0.01 mm', correct: true },
    { label: '0.005 mm' },
  ],
};

const LC_EXPLAIN: Record<Instrument, string> = {
  vernier: 'Least count = smallest main-scale division / number of vernier divisions = 1 mm / 10 = 0.1 mm.',
  screw: 'Least count = pitch / circular-scale divisions = 0.5 mm / 50 = 0.01 mm.',
};

interface LogRow {
  instrument: string;
  trueSize: string;
  entered: string;
  zeroErr: string;
  verdict: string;
}

/** Magnified closed-jaws view: read the zero-mark offset directly, sign included. */
function ZeroStrip({
  offset,
  pxPerMm,
  minor,
  span,
  majorEvery,
  minorLabel,
  ariaLabel,
}: {
  offset: number;
  pxPerMm: number;
  minor: number;
  span: number;
  majorEvery: number;
  minorLabel: string;
  ariaLabel: string;
}) {
  const count = Math.round(span / minor);
  const ticks: Array<{ x: number; major: boolean; v: number }> = [];
  for (let i = -count; i <= count; i++) {
    const v = i * minor;
    ticks.push({ x: 240 + v * pxPerMm, major: i % Math.round(majorEvery / minor) === 0, v });
  }
  const offX = 240 + offset * pxPerMm;
  const lo = Math.min(240, offX);
  const w = Math.abs(offX - 240);
  return (
    <svg viewBox="0 0 480 72" className="w-full" role="img" aria-label={ariaLabel}>
      <rect x={lo.toFixed(1)} y="8" width={w.toFixed(1)} height="30" className="fill-amber-500/20" />
      {ticks.map((tk, i) => (
        <g key={i}>
          <line
            x1={tk.x.toFixed(1)}
            y1={tk.major ? '10' : '18'}
            x2={tk.x.toFixed(1)}
            y2="38"
            className={tk.major ? 'stroke-foreground' : 'stroke-muted-foreground'}
            strokeWidth={tk.major ? 1.5 : 1}
          />
          {tk.major && (
            <text x={tk.x.toFixed(1)} y="54" textAnchor="middle" fontSize="9" className="fill-muted-foreground tabular-nums">
              {tk.v.toFixed(minor < 0.05 ? 2 : 1)}
            </text>
          )}
        </g>
      ))}
      <line x1="240" y1="4" x2="240" y2="44" className="stroke-foreground" strokeWidth="2" />
      <text x="240" y="68" textAnchor="middle" fontSize="10" className="fill-foreground">
        main zero
      </text>
      <line x1={offX.toFixed(1)} y1="4" x2={offX.toFixed(1)} y2="44" className="stroke-red-600" strokeWidth="2" />
      <text x={offX.toFixed(1)} y="68" textAnchor="middle" fontSize="10" className="fill-red-600">
        instrument zero
      </text>
      <text x="4" y="12" fontSize="9" className="fill-muted-foreground">
        {minorLabel}
      </text>
    </svg>
  );
}

export function VernierGaugeLab(props: GameProps) {
  const [inst, setInst] = useState<Instrument>('vernier');
  const [trials, setTrials] = useState<Record<Instrument, Trial>>(() => ({ vernier: randTrial('vernier'), screw: randTrial('screw') }));
  const [inputs, setInputs] = useState({ msr: '', div: '', zero: '', corr: '' });
  const [lcPick, setLcPick] = useState<Record<Instrument, number | null>>({ vernier: null, screw: null });
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [rows, setRows] = useState<LogRow[]>([]);

  const trial = trials[inst];
  const isVernier = inst === 'vernier';
  const LC = isVernier ? 0.1 : 0.01;
  const divs = isVernier ? 10 : 50;
  const R = trial.trueSize + trial.zeroErr;
  const totalUnits = Math.round(R / LC);
  const msrUnits = isVernier ? Math.floor(totalUnits / 10) * 10 : Math.floor(totalUnits / 50) * 50;
  const MSR = msrUnits * LC;
  const coincDiv = totalUnits - msrUnits;
  const corrected = MSR + coincDiv * LC - trial.zeroErr;

  const correctIdx = LC_OPTIONS[inst].findIndex((o) => o.correct);

  function switchInstrument(next: Instrument) {
    setInst(next);
    setInputs({ msr: '', div: '', zero: '', corr: '' });
    setFb(null);
  }

  function newTrial() {
    setTrials((t) => ({ ...t, [inst]: randTrial(inst) }));
    setInputs({ msr: '', div: '', zero: '', corr: '' });
    setFb(null);
  }

  function checkReading() {
    if (lcPick[inst] === null) {
      setFb({ ok: false, text: 'Answer the least-count question first — it unlocks the reading check.' });
      return;
    }
    const msr = Number(inputs.msr);
    const div = Number(inputs.div);
    const ze = Number(inputs.zero);
    const corr = Number(inputs.corr);
    if ([inputs.msr, inputs.div, inputs.zero, inputs.corr].some((s) => s.trim() === '') || [msr, div, ze, corr].some((n) => Number.isNaN(n))) {
      setFb({ ok: false, text: 'Enter all four values: main-scale reading, coinciding division, zero error and the corrected reading.' });
      return;
    }
    let verdict = 'Correct';
    let text = `Fully correct reading: ${corrected.toFixed(isVernier ? 1 : 2)} mm against a true size of ${trial.trueSize.toFixed(isVernier ? 1 : 2)} mm. Nicely done.`;
    if (Math.abs(msr - MSR) > 1e-9) {
      verdict = 'Retry';
      text = isVernier
        ? 'Check the main-scale reading: take the last whole millimetre mark to the left of the vernier zero.'
        : 'Check the main-scale reading: take the last visible half-millimetre mark to the left of the thimble edge.';
    } else if (Math.abs(div - coincDiv) > 1e-9 || div < 0 || div >= divs) {
      verdict = 'Retry';
      text = isVernier
        ? 'Check the coinciding division: find the vernier mark whose line lines up best with a main-scale millimetre mark.'
        : 'Check the circular-scale division: count which division sits exactly on the reference line at the top of the dial.';
    } else if (Math.abs(ze - trial.zeroErr) > LC / 2 + 1e-9) {
      verdict = 'Retry';
      text = `Check the zero error, sign included: on the zero strip, count how far the instrument zero sits from the main zero (right is positive, left is negative), each tick being ${LC} mm.`;
    } else if (Math.abs(corr - corrected) > LC / 2 + 1e-9) {
      verdict = 'Retry';
      text = 'The corrected reading should be (main-scale reading + coinciding division × least count) − zero error. Re-compute and try again.';
    }
    setFb({ ok: verdict === 'Correct', text });
    setRows((old) => [
      ...old,
      {
        instrument: isVernier ? 'Vernier calipers' : 'Screw gauge',
        trueSize: trial.trueSize.toFixed(isVernier ? 1 : 2),
        entered: corr.toFixed(isVernier ? 1 : 2),
        zeroErr: `${ze >= 0 ? '+' : ''}${ze.toFixed(isVernier ? 1 : 2)}`,
        verdict,
      },
    ]);
    if (verdict === 'Correct') {
      const nextCount = correctCount + 1;
      setCorrectCount(nextCount);
      if (nextCount >= 3) props.onWin();
    }
  }

  // Geometry: vernier view
  const vx0 = 60;
  const pxV = 10; // px per mm
  const xRV = vx0 + R * pxV;
  const mainTicksV: number[] = [];
  for (let mm = 0; mm <= 49; mm++) mainTicksV.push(mm);
  const vernierTicks = Array.from({ length: divs }, (_, n) => n);

  // Geometry: screw view
  const sx0 = 60;
  const pxS = 30; // px per mm
  const xRS = sx0 + R * pxS;
  const dialCx = Math.min(xRS + 65, 495);
  const dialCy = 78;
  const dialR = 42;
  const f = (R - MSR) / 0.5;

  return (
    <GameShell
      title="Vernier & Screw Gauge"
      blurb="Read a vernier calipers and a screw gauge the way the practical exam expects: main scale, coinciding division, zero error with its sign, then the corrected reading."
      modelNote="Vernier: 9 main-scale mm over 10 vernier divisions, least count 0.1 mm. Screw gauge: pitch 0.5 mm over 50 circular divisions, least count 0.01 mm. Zero errors are drawn honestly as a zero-mark offset on a magnified strip; corrected reading = MSR + coinciding division × LC − zero error."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={inst === 'vernier' ? 'default' : 'outline'}
            className="press min-h-[44px]"
            onClick={() => switchInstrument('vernier')}
          >
            <Ruler className="size-4" aria-hidden="true" /> Vernier calipers
          </Button>
          <Button
            variant={inst === 'screw' ? 'default' : 'outline'}
            className="press min-h-[44px]"
            onClick={() => switchInstrument('screw')}
          >
            <ScanLine className="size-4" aria-hidden="true" /> Screw gauge
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">Correct readings: {correctCount}/3</span>
        </div>

        {lcPick[inst] === null && (
          <PredictFirst
            key={inst}
            prompt={`What is the least count of this instrument (${isVernier ? 'vernier calipers' : 'screw gauge'})?`}
            options={LC_OPTIONS[inst]}
            explain={LC_EXPLAIN[inst]}
            onResolved={() => setLcPick((p) => ({ ...p, [inst]: correctIdx }))}
          />
        )}

        <div className="rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          {isVernier ? (
            <svg
              viewBox="0 0 560 130"
              className="w-full"
              role="img"
              aria-label="Vernier calipers scale: main scale in millimetres with a sliding vernier scale of 10 divisions"
            >
              <rect x={vx0} y="34" width="470" height="10" className="fill-muted" />
              {mainTicksV.map((mm) => (
                <g key={mm}>
                  <line
                    x1={(vx0 + mm * pxV).toFixed(1)}
                    y1={mm % 5 === 0 ? '20' : '26'}
                    x2={(vx0 + mm * pxV).toFixed(1)}
                    y2="34"
                    className="stroke-foreground"
                    strokeWidth="1.5"
                  />
                  {mm % 5 === 0 && (
                    <text x={(vx0 + mm * pxV).toFixed(1)} y="14" textAnchor="middle" fontSize="10" className="fill-muted-foreground tabular-nums">
                      {mm}
                    </text>
                  )}
                </g>
              ))}
              <rect x={(xRV - 6).toFixed(1)} y="44" width={9 * divs * pxV + 12} height="26" rx="3" className="fill-primary/15" />
              {vernierTicks.map((n) => (
                <g key={n}>
                  <line
                    x1={(xRV + n * 0.9 * pxV).toFixed(1)}
                    y1="44"
                    x2={(xRV + n * 0.9 * pxV).toFixed(1)}
                    y2="58"
                    className="stroke-foreground"
                    strokeWidth="1.5"
                  />
                  <text
                    x={(xRV + n * 0.9 * pxV).toFixed(1)}
                    y="70"
                    textAnchor="middle"
                    fontSize="10"
                    className="fill-foreground tabular-nums"
                  >
                    {n}
                  </text>
                </g>
              ))}
              <line x1={xRV.toFixed(1)} y1="30" x2={xRV.toFixed(1)} y2="78" className="stroke-red-600" strokeWidth="2" />
              <text x={xRV.toFixed(1)} y="90" textAnchor="middle" fontSize="10" className="fill-red-600">
                vernier zero
              </text>
              <text x={vx0} y="112" fontSize="10" className="fill-muted-foreground">
                mm marks every 1 mm — the vernier spans 9 mm in 10 divisions (LC 0.1 mm)
              </text>
            </svg>
          ) : (
            <svg
              viewBox="0 0 560 130"
              className="w-full"
              role="img"
              aria-label="Screw gauge: main scale with half-millimetre marks and a rotating circular scale of 50 divisions"
            >
              <rect x={sx0} y="44" width="440" height="10" className="fill-muted" />
              {Array.from({ length: 27 }, (_, i) => i * 0.5).map((mm) => (
                <g key={mm}>
                  <line
                    x1={(sx0 + mm * pxS).toFixed(1)}
                    y1={mm % 1 === 0 ? '30' : '37'}
                    x2={(sx0 + mm * pxS).toFixed(1)}
                    y2="44"
                    className="stroke-foreground"
                    strokeWidth="1.5"
                  />
                  {mm % 1 === 0 && (
                    <text x={(sx0 + mm * pxS).toFixed(1)} y="24" textAnchor="middle" fontSize="10" className="fill-muted-foreground tabular-nums">
                      {mm.toFixed(0)}
                    </text>
                  )}
                </g>
              ))}
              <rect x={(xRS - 5).toFixed(1)} y="18" width="10" height="66" rx="2" className="fill-amber-600" />
              <line x1={xRS.toFixed(1)} y1="14" x2={xRS.toFixed(1)} y2="90" className="stroke-red-600" strokeWidth="2" />
              <text x={xRS.toFixed(1)} y="102" textAnchor="middle" fontSize="10" className="fill-red-600">
                thimble edge
              </text>
              <g transform={`rotate(${(-f * 360).toFixed(2)} ${dialCx} ${dialCy})`}>
                <circle cx={dialCx} cy={dialCy} r={dialR} className="fill-background stroke-foreground" strokeWidth="2" />
                {Array.from({ length: divs }, (_, n) => {
                  const a = (n * 7.2 * Math.PI) / 180;
                  const x1 = dialCx + Math.sin(a) * (dialR - 3);
                  const y1 = dialCy - Math.cos(a) * (dialR - 3);
                  const x2 = dialCx + Math.sin(a) * (dialR - 12);
                  const y2 = dialCy - Math.cos(a) * (dialR - 12);
                  const lx = dialCx + Math.sin(a) * (dialR - 20);
                  const ly = dialCy - Math.cos(a) * (dialR - 20);
                  return (
                    <g key={n}>
                      <line x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} className="stroke-foreground" strokeWidth="1.2" />
                      {n % 5 === 0 && (
                        <text
                          x={lx.toFixed(1)}
                          y={(ly + 3).toFixed(1)}
                          textAnchor="middle"
                          fontSize="8"
                          className="fill-foreground tabular-nums"
                          transform={`rotate(${(f * 360).toFixed(2)} ${lx.toFixed(1)} ${ly.toFixed(1)})`}
                        >
                          {n}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
              <line
                x1={dialCx}
                y1={dialCy - dialR - 10}
                x2={dialCx}
                y2={dialCy - dialR + 4}
                className="stroke-red-600"
                strokeWidth="2"
              />
              <text x={dialCx + 8} y={dialCy - dialR - 2} fontSize="9" className="fill-red-600">
                reference
              </text>
              <text x={sx0} y="122" fontSize="10" className="fill-muted-foreground">
                pitch 0.5 mm, 50 divisions on the circular scale (LC 0.01 mm)
              </text>
            </svg>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <p className="text-sm font-bold">Zero check (jaws closed / screw fully closed)</p>
          {isVernier ? (
            <ZeroStrip
              offset={trial.zeroErr}
              pxPerMm={48}
              minor={0.1}
              span={5}
              majorEvery={1}
              minorLabel="small tick = 0.1 mm"
              ariaLabel={`Magnified zero check strip with the instrument zero offset by ${trial.zeroErr.toFixed(1)} millimetres`}
            />
          ) : (
            <ZeroStrip
              offset={trial.zeroErr}
              pxPerMm={380}
              minor={0.01}
              span={0.6}
              majorEvery={0.1}
              minorLabel="small tick = 0.01 mm"
              ariaLabel={`Magnified zero check strip with the instrument zero offset by ${trial.zeroErr.toFixed(2)} millimetres`}
            />
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Read the zero error directly: how many ticks is the instrument zero from the main zero, and to which side? Right
            of the main zero counts positive, left counts negative. For the screw gauge, one tick is one circular-scale
            division.
          </p>
        </div>

        <div className="grid gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6 md:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Main-scale reading (mm)</span>
            <input
              type="number"
              step={isVernier ? 1 : 0.5}
              value={inputs.msr}
              onChange={(e) => setInputs((s) => ({ ...s, msr: e.target.value }))}
              className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 tabular-nums"
              aria-label="Main-scale reading in millimetres"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Coinciding division</span>
            <input
              type="number"
              step={1}
              min={0}
              max={divs - 1}
              value={inputs.div}
              onChange={(e) => setInputs((s) => ({ ...s, div: e.target.value }))}
              className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 tabular-nums"
              aria-label={`Coinciding ${isVernier ? 'vernier' : 'circular scale'} division number`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Zero error (mm, with sign)</span>
            <input
              type="number"
              step={LC}
              value={inputs.zero}
              onChange={(e) => setInputs((s) => ({ ...s, zero: e.target.value }))}
              className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 tabular-nums"
              aria-label="Zero error in millimetres, negative allowed"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Corrected reading (mm)</span>
            <input
              type="number"
              step={LC}
              value={inputs.corr}
              onChange={(e) => setInputs((s) => ({ ...s, corr: e.target.value }))}
              className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 tabular-nums"
              aria-label="Final corrected reading in millimetres"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button className="press min-h-[44px]" onClick={checkReading}>
            <CheckCircle2 className="size-4" aria-hidden="true" /> Check reading
          </Button>
          <Button variant="outline" className="press min-h-[44px]" onClick={newTrial}>
            <RefreshCw className="size-4" aria-hidden="true" /> New trial
          </Button>
        </div>

        <p
          role="status"
          aria-live="polite"
          className={cn('text-sm font-semibold', fb ? (fb.ok ? 'text-emerald-600' : 'text-amber-600') : 'text-muted-foreground')}
        >
          {fb
            ? fb.text
            : 'Enter the four values for the current trial, then check. Three fully correct readings complete the lab.'}
        </p>

        <LabReport
          title="Measurement log"
          columns={['Instrument', 'True size (mm)', 'Entered (mm)', 'Zero error (mm)', 'Verdict']}
          rows={rows.map((r) => [r.instrument, r.trueSize, r.entered, r.zeroErr, r.verdict])}
          note="True size is revealed only after a check, so treat earlier rows as your answer key when you compare later trials."
        />

        <ChapterRef subject="Physics" chapter="Ch 2 — Units and Measurements" topic="Measurement of length, least count and errors" />
      </div>
    </GameShell>
  );
}
