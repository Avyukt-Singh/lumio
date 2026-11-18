'use client';

import { Atom, Pin } from 'lucide-react';
import { useState } from 'react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { cn } from '@/lib/utils';

/**
 * Periodic Trends: interactive periodic table for elements 1-36 (periods 1-4,
 * 18-column layout, He top right) with a four-property heatmap, detail card,
 * computed trend readouts and a period line graph. Win: 3 anomaly
 * PredictFirst questions answered correctly.
 */

interface El {
  z: number;
  sym: string;
  name: string;
  group: number;
  period: number;
  radius: number | null; // pm
  ie: number | null; // kJ/mol
  en: number | null; // Pauling
  ea: number | null; // kJ/mol, negative = exothermic
}

type PropKey = 'radius' | 'ie' | 'en' | 'ea';

const PROPS: Record<PropKey, { label: string; unit: string; short: string }> = {
  radius: { label: 'Atomic radius', unit: 'pm', short: 'r (pm)' },
  ie: { label: '1st ionisation enthalpy', unit: 'kJ/mol', short: 'IE1' },
  en: { label: 'Electronegativity', unit: 'Pauling', short: 'EN' },
  ea: { label: 'Electron gain enthalpy', unit: 'kJ/mol', short: 'EA' },
};

// Fixed heatmap ranges per property (min = green end, max = red end).
const PROP_RANGE: Record<PropKey, { min: number; max: number }> = {
  radius: { min: 30, max: 235 },
  ie: { min: 400, max: 2400 },
  en: { min: 0.8, max: 4 },
  ea: { min: -350, max: 250 },
};

// Standard approximate teaching values for elements 1-36.
const ELEMENTS: El[] = [
  { z: 1, sym: 'H', name: 'Hydrogen', group: 1, period: 1, radius: 37, ie: 1312, en: 2.2, ea: -73 },
  { z: 2, sym: 'He', name: 'Helium', group: 18, period: 1, radius: 50, ie: 2372, en: null, ea: null },
  { z: 3, sym: 'Li', name: 'Lithium', group: 1, period: 2, radius: 152, ie: 520, en: 0.98, ea: -60 },
  { z: 4, sym: 'Be', name: 'Beryllium', group: 2, period: 2, radius: 111, ie: 899, en: 1.57, ea: 240 },
  { z: 5, sym: 'B', name: 'Boron', group: 13, period: 2, radius: 88, ie: 801, en: 2.04, ea: -27 },
  { z: 6, sym: 'C', name: 'Carbon', group: 14, period: 2, radius: 77, ie: 1086, en: 2.55, ea: -122 },
  { z: 7, sym: 'N', name: 'Nitrogen', group: 15, period: 2, radius: 75, ie: 1402, en: 3.04, ea: 7 },
  { z: 8, sym: 'O', name: 'Oxygen', group: 16, period: 2, radius: 73, ie: 1314, en: 3.44, ea: -141 },
  { z: 9, sym: 'F', name: 'Fluorine', group: 17, period: 2, radius: 72, ie: 1681, en: 3.98, ea: -328 },
  { z: 10, sym: 'Ne', name: 'Neon', group: 18, period: 2, radius: 69, ie: 2081, en: null, ea: null },
  { z: 11, sym: 'Na', name: 'Sodium', group: 1, period: 3, radius: 186, ie: 496, en: 0.93, ea: -53 },
  { z: 12, sym: 'Mg', name: 'Magnesium', group: 2, period: 3, radius: 160, ie: 738, en: 1.31, ea: 230 },
  { z: 13, sym: 'Al', name: 'Aluminium', group: 13, period: 3, radius: 143, ie: 578, en: 1.61, ea: -43 },
  { z: 14, sym: 'Si', name: 'Silicon', group: 14, period: 3, radius: 118, ie: 787, en: 1.9, ea: -134 },
  { z: 15, sym: 'P', name: 'Phosphorus', group: 15, period: 3, radius: 110, ie: 1012, en: 2.19, ea: -72 },
  { z: 16, sym: 'S', name: 'Sulfur', group: 16, period: 3, radius: 104, ie: 1000, en: 2.58, ea: -200 },
  { z: 17, sym: 'Cl', name: 'Chlorine', group: 17, period: 3, radius: 99, ie: 1251, en: 3.16, ea: -349 },
  { z: 18, sym: 'Ar', name: 'Argon', group: 18, period: 3, radius: 71, ie: 1521, en: null, ea: null },
  { z: 19, sym: 'K', name: 'Potassium', group: 1, period: 4, radius: 227, ie: 419, en: 0.82, ea: -48 },
  { z: 20, sym: 'Ca', name: 'Calcium', group: 2, period: 4, radius: 197, ie: 590, en: 1.0, ea: 186 },
  { z: 21, sym: 'Sc', name: 'Scandium', group: 3, period: 4, radius: 144, ie: 633, en: 1.36, ea: -50 },
  { z: 22, sym: 'Ti', name: 'Titanium', group: 4, period: 4, radius: 132, ie: 659, en: 1.54, ea: -48 },
  { z: 23, sym: 'V', name: 'Vanadium', group: 5, period: 4, radius: 122, ie: 651, en: 1.63, ea: -51 },
  { z: 24, sym: 'Cr', name: 'Chromium', group: 6, period: 4, radius: 118, ie: 653, en: 1.66, ea: -64 },
  { z: 25, sym: 'Mn', name: 'Manganese', group: 7, period: 4, radius: 117, ie: 717, en: 1.55, ea: 0 },
  { z: 26, sym: 'Fe', name: 'Iron', group: 8, period: 4, radius: 117, ie: 762, en: 1.83, ea: -16 },
  { z: 27, sym: 'Co', name: 'Cobalt', group: 9, period: 4, radius: 116, ie: 760, en: 1.88, ea: -64 },
  { z: 28, sym: 'Ni', name: 'Nickel', group: 10, period: 4, radius: 115, ie: 737, en: 1.91, ea: -112 },
  { z: 29, sym: 'Cu', name: 'Copper', group: 11, period: 4, radius: 117, ie: 745, en: 1.9, ea: -119 },
  { z: 30, sym: 'Zn', name: 'Zinc', group: 12, period: 4, radius: 125, ie: 906, en: 1.65, ea: 0 },
  { z: 31, sym: 'Ga', name: 'Gallium', group: 13, period: 4, radius: 122, ie: 579, en: 1.81, ea: -29 },
  { z: 32, sym: 'Ge', name: 'Germanium', group: 14, period: 4, radius: 122, ie: 762, en: 2.01, ea: -119 },
  { z: 33, sym: 'As', name: 'Arsenic', group: 15, period: 4, radius: 120, ie: 947, en: 2.18, ea: -78 },
  { z: 34, sym: 'Se', name: 'Selenium', group: 16, period: 4, radius: 119, ie: 941, en: 2.55, ea: -195 },
  { z: 35, sym: 'Br', name: 'Bromine', group: 17, period: 4, radius: 114, ie: 1140, en: 2.96, ea: -325 },
  { z: 36, sym: 'Kr', name: 'Krypton', group: 18, period: 4, radius: 88, ie: 1351, en: 3.0, ea: null },
];

function heat(v: number, key: PropKey): string {
  const { min, max } = PROP_RANGE[key];
  const t = Math.min(1, Math.max(0, (v - min) / (max - min)));
  return `hsl(${Math.round(120 - 120 * t)} 65% 62%)`;
}

function fmtProp(key: PropKey, v: number): string {
  return key === 'en' ? v.toFixed(2) : String(Math.round(v));
}

function valText(el: El, key: PropKey): string {
  const v = el[key];
  return v === null ? 'not listed' : fmtProp(key, v);
}

function periodTrend(p: number, key: PropKey): string {
  const list: { sym: string; v: number }[] = [];
  for (const e of ELEMENTS) {
    if (e.period !== p) continue;
    const v = e[key];
    if (v !== null) list.push({ sym: e.sym, v });
  }
  if (list.length < 2) return 'Not enough data for this period.';
  const first = list[0];
  const last = list[list.length - 1];
  const min = list.reduce((a, b) => (b.v < a.v ? b : a));
  const max = list.reduce((a, b) => (b.v > a.v ? b : a));
  return `Across period ${p}, ${PROPS[key].label.toLowerCase()} runs from ${first.sym} (${fmtProp(key, first.v)} ${PROPS[key].unit}) to ${last.sym} (${fmtProp(key, last.v)} ${PROPS[key].unit}) — lowest at ${min.sym} (${fmtProp(key, min.v)}), highest at ${max.sym} (${fmtProp(key, max.v)}).`;
}

function groupTrend(g: number, key: PropKey): string {
  const list: { sym: string; v: number }[] = [];
  for (const e of ELEMENTS) {
    if (e.group !== g) continue;
    const v = e[key];
    if (v !== null) list.push({ sym: e.sym, v });
  }
  if (list.length < 2) return 'Not enough data for this group.';
  const first = list[0];
  const last = list[list.length - 1];
  return `Down group ${g}, ${PROPS[key].label.toLowerCase()} goes from ${first.sym} (${fmtProp(key, first.v)} ${PROPS[key].unit}) to ${last.sym} (${fmtProp(key, last.v)} ${PROPS[key].unit}).`;
}

const toGX = (z: number, zMin: number, zMax: number) => 45 + ((z - zMin) / Math.max(1, zMax - zMin)) * 260;
const toGY = (key: PropKey, v: number) => 205 - ((v - PROP_RANGE[key].min) / (PROP_RANGE[key].max - PROP_RANGE[key].min)) * 185;

const PROP_KEYS: PropKey[] = ['radius', 'ie', 'en', 'ea'];

export function PeriodicTrendsLab(props: GameProps) {
  const [propKey, setPropKey] = useState<PropKey>('ie');
  const [graphPeriod, setGraphPeriod] = useState(3);
  const [selected, setSelected] = useState<El | null>(null);
  const [rows, setRows] = useState<(string | number)[][]>([]);
  const [answers, setAnswers] = useState<(boolean | null)[]>([null, null, null]);
  const [predKey, setPredKey] = useState(0);

  // Derived values (above any effect; this lab uses none).
  const across = periodTrend(graphPeriod, propKey);
  const down = groupTrend(1, propKey);
  const gPts: { z: number; sym: string; v: number }[] = [];
  for (const e of ELEMENTS) {
    if (e.period !== graphPeriod) continue;
    const v = e[propKey];
    if (v !== null) gPts.push({ z: e.z, sym: e.sym, v });
  }
  const zMin = gPts.length > 0 ? gPts[0].z : 1;
  const zMax = gPts.length > 0 ? gPts[gPts.length - 1].z : 18;
  const prop = PROPS[propKey];

  function answer(i: number, ok: boolean) {
    const next = answers.map((a, j) => (j === i ? ok : a));
    setAnswers(next);
    if (next.every((a) => a === true)) props.onWin();
  }

  function resetPredictions() {
    setAnswers([null, null, null]);
    setPredKey((k) => k + 1);
  }

  function pinSelected() {
    if (!selected) return;
    setRows((r) => [...r, [selected.sym, selected.z, prop.label, valText(selected, propKey)]]);
  }

  const wonAll = answers.every((a) => a === true);

  return (
    <GameShell
      title="Periodic Trends"
      blurb="Colour the first 36 elements by any property, click cells for details, and plot a whole period at once. Then explain the three famous anomalies every exam loves."
      modelNote="Values are standard teaching approximations, rounded for clarity; published data differ slightly depending on the radii scale used (covalent, metallic or van der Waals) and on sign conventions for electron gain enthalpy. Noble-gas electron affinities are left unlisted where measurement is impractical. Heatmap: green = low end of the scale, red = high end (for electron gain enthalpy, green = more negative = more energy released)."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Property</span>
            <select
              value={propKey}
              onChange={(e) => setPropKey(e.target.value as PropKey)}
              aria-label="Choose the property to visualise on the table"
              className="press min-h-[44px] rounded-xl border border-border bg-card px-3 text-sm"
            >
              {PROP_KEYS.map((k) => (
                <option key={k} value={k}>
                  {PROPS[k].label} ({PROPS[k].unit})
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">
            Across period 3 and down group 1 readouts update with the chosen property.
          </p>
        </div>

        <div className="overflow-x-auto pb-1">
          <div
            className="grid min-w-[660px] gap-[3px]"
            style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))' }}
            role="grid"
            aria-label="Periodic table, elements 1 to 36"
          >
            {ELEMENTS.map((el) => {
              const v = el[propKey];
              const bg = v === null ? '#d4d4d8' : heat(v, propKey);
              return (
                <button
                  key={el.z}
                  onClick={() => setSelected(el)}
                  aria-label={`${el.name}, Z = ${el.z}, ${prop.label} ${valText(el, propKey)}`}
                  aria-pressed={selected?.z === el.z}
                  className={cn(
                    'flex h-[44px] min-w-[30px] flex-col items-center justify-center rounded-md border text-black',
                    selected?.z === el.z ? 'border-foreground ring-2 ring-primary' : 'border-black/10'
                  )}
                  style={{ gridColumn: el.group, gridRow: el.period, background: bg }}
                >
                  <span className="text-[11px] font-bold leading-none">{el.sym}</span>
                  <span className="text-[9px] leading-none opacity-80">{el.z}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Atom className="size-4" aria-hidden="true" /> Trend readouts
            </h3>
            <p className="text-sm">{across}</p>
            <p className="text-sm">{down}</p>
            {selected ? (
              <div className="rounded-xl border border-border bg-card p-3 text-sm">
                <p className="font-bold">
                  {selected.name} ({selected.sym}) — Z = {selected.z}
                </p>
                <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                  {PROP_KEYS.map((k) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">{PROPS[k].short}</dt>
                      <dd className="tabular-nums font-medium">{valText(selected, k)}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  className="press mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium hover:bg-accent/10"
                  onClick={pinSelected}
                >
                  <Pin className="size-4" aria-hidden="true" /> Pin to report
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Click any element to inspect its values.</p>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="text-sm font-bold">{prop.label} across period {graphPeriod}</h3>
            <div className="flex gap-2" role="group" aria-label="Choose the period to plot">
              {[1, 2, 3, 4].map((p) => (
                <button
                  key={p}
                  onClick={() => setGraphPeriod(p)}
                  aria-pressed={graphPeriod === p}
                  className={cn(
                    'press inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border px-3 text-sm font-medium',
                    graphPeriod === p ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <svg
              viewBox="0 0 320 240"
              className="w-full"
              role="img"
              aria-label={`Line graph of ${prop.label} across period ${graphPeriod}`}
            >
              <line x1="45" y1="205" x2="305" y2="205" stroke="#94a3b8" />
              <line x1="45" y1="20" x2="45" y2="205" stroke="#94a3b8" />
              {gPts.length > 1 && (
                <polyline
                  points={gPts.map((p) => `${toGX(p.z, zMin, zMax).toFixed(1)},${toGY(propKey, p.v).toFixed(1)}`).join(' ')}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              )}
              {gPts.map((p) => (
                <circle key={p.z} cx={toGX(p.z, zMin, zMax)} cy={toGY(propKey, p.v)} r="4" className="fill-primary">
                  <title>{`${p.sym}: ${fmtProp(propKey, p.v)} ${prop.unit}`}</title>
                </circle>
              ))}
              <text x="175" y="232" textAnchor="middle" fontSize="11" fill="#64748b">
                atomic number (Z), period {graphPeriod}
              </text>
              <text x="48" y="16" fontSize="11" fill="#64748b">
                {prop.short}
              </text>
              {gPts[0] && (
                <text x={toGX(zMin, zMin, zMax)} y="220" textAnchor="middle" fontSize="10" fill="#64748b">
                  {gPts[0].sym}
                </text>
              )}
              {gPts[gPts.length - 1] && (
                <text x={toGX(zMax, zMin, zMax)} y="220" textAnchor="middle" fontSize="10" fill="#64748b">
                  {gPts[gPts.length - 1].sym}
                </text>
              )}
            </svg>
            <p className="text-xs text-muted-foreground">
              Green = low end of the scale, red = high end. Watch the line dip exactly where the anomalies sit.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-bold">Predict first — three anomalies</h3>
          <PredictFirst
            key={`be-b-${predKey}`}
            prompt="Beryllium has a higher 1st ionisation enthalpy than boron. Why does the trend dip from Be to B?"
            options={[
              { label: 'B loses a 2p electron, which is higher in energy and easier to remove than the 2s pair in Be', correct: true },
              { label: 'B has a weaker nucleus because it is a metalloid' },
              { label: 'B atoms are smaller, so electrons escape more easily' },
            ]}
            explain="The electron removed from boron is a 2p electron, higher in energy and shielded by the 2s pair, so less energy is needed than for the 2s electron of Be."
            onResolved={(ok) => answer(0, ok)}
          />
          <PredictFirst
            key={`n-o-${predKey}`}
            prompt="Why does the 1st ionisation enthalpy dip from nitrogen to oxygen?"
            options={[
              { label: 'O pairs a 2p electron; repulsion inside the pair makes that electron easier to remove', correct: true },
              { label: 'O is heavier, so its electrons fly off more easily' },
              { label: 'O has a smaller nuclear charge than N' },
            ]}
            explain="Nitrogen enjoys a stable half-filled 2p shell; the fourth 2p electron in oxygen is paired, and the inter-electronic repulsion lowers its ionisation enthalpy."
            onResolved={(ok) => answer(1, ok)}
          />
          <PredictFirst
            key={`cl-f-${predKey}`}
            prompt="Chlorine releases more energy on gaining an electron than fluorine. Why is the electron gain enthalpy of Cl more negative than that of F?"
            options={[
              { label: 'F is so small that the incoming electron feels strong repulsion in its compact 2p shell', correct: true },
              { label: 'Cl is more electronegative than F' },
              { label: 'F already has a full octet, so it refuses electrons' },
            ]}
            explain="Fluorine is tiny; the added electron enters the crowded 2p shell where repulsions are large, so its electron gain enthalpy is less negative than that of the bigger chlorine atom."
            onResolved={(ok) => answer(2, ok)}
          />
          {answers.some((a) => a === false) && (
            <button
              className="press inline-flex min-h-[44px] items-center gap-2 self-start rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
              onClick={resetPredictions}
            >
              Reset the three anomaly questions
            </button>
          )}
          {wonAll && (
            <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600">
              All three anomalies explained — you read the periodic table like a chemist.
            </p>
          )}
        </div>

        <LabReport
          title="Pinned elements"
          columns={['Element', 'Z', 'Property', 'Value']}
          rows={rows}
          note="Rows appear when you pin elements from the detail card, so you can compare side by side."
        />

        <ChapterRef
          subject="Chemistry"
          chapter="Ch 3 — Classification of Elements and Periodicity"
          topic="Periodic trends"
        />
      </div>
    </GameShell>
  );
}
