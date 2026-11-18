'use client';

import { Eye, FlaskConical, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { GameShell, type GameProps } from '../GameShell';
import { ChapterRef, LabReport } from './shared';
import { cn } from '@/lib/utils';

/**
 * Salt Analysis: a virtual bench for qualitative analysis of an unknown
 * inorganic salt. Tests append honest observations to a notebook; the learner
 * then picks a cation and an anion and submits. Win: 2 salts fully identified.
 */

type Cation = 'Na+' | 'K+' | 'Ca2+' | 'Al3+' | 'Fe2+' | 'Fe3+' | 'Cu2+' | 'NH4+' | 'Zn2+';
type Anion = 'Cl-' | 'Br-' | 'I-' | 'NO3-' | 'SO4^2-' | 'CO3^2-';

interface Salt {
  name: string;
  cation: Cation;
  anion: Anion;
}

interface Observation {
  test: string;
  obs: string;
  pointsTo: string;
}

interface TestDef {
  id: string;
  label: string;
  run: (s: Salt) => Omit<Observation, 'test'>;
}

const CATIONS: Cation[] = ['Na+', 'K+', 'Ca2+', 'Al3+', 'Fe2+', 'Fe3+', 'Cu2+', 'NH4+', 'Zn2+'];
const ANIONS: Anion[] = ['Cl-', 'Br-', 'I-', 'NO3-', 'SO4^2-', 'CO3^2-'];

// Curated, chemically consistent (cation, anion) pairs. Pairs that are not
// isolable in water (Cu2+/I-, Fe3+/I-, Al3+/CO3^2-, Fe3+/CO3^2-) are excluded.
const SALTS: Salt[] = [
  { name: 'NaCl', cation: 'Na+', anion: 'Cl-' },
  { name: 'NaBr', cation: 'Na+', anion: 'Br-' },
  { name: 'NaI', cation: 'Na+', anion: 'I-' },
  { name: 'NaNO3', cation: 'Na+', anion: 'NO3-' },
  { name: 'Na2SO4', cation: 'Na+', anion: 'SO4^2-' },
  { name: 'Na2CO3', cation: 'Na+', anion: 'CO3^2-' },
  { name: 'KCl', cation: 'K+', anion: 'Cl-' },
  { name: 'KBr', cation: 'K+', anion: 'Br-' },
  { name: 'KI', cation: 'K+', anion: 'I-' },
  { name: 'KNO3', cation: 'K+', anion: 'NO3-' },
  { name: 'K2SO4', cation: 'K+', anion: 'SO4^2-' },
  { name: 'K2CO3', cation: 'K+', anion: 'CO3^2-' },
  { name: 'CaCl2', cation: 'Ca2+', anion: 'Cl-' },
  { name: 'CaBr2', cation: 'Ca2+', anion: 'Br-' },
  { name: 'CaI2', cation: 'Ca2+', anion: 'I-' },
  { name: 'Ca(NO3)2', cation: 'Ca2+', anion: 'NO3-' },
  { name: 'CaSO4', cation: 'Ca2+', anion: 'SO4^2-' },
  { name: 'CaCO3', cation: 'Ca2+', anion: 'CO3^2-' },
  { name: 'AlCl3', cation: 'Al3+', anion: 'Cl-' },
  { name: 'AlBr3', cation: 'Al3+', anion: 'Br-' },
  { name: 'Al(NO3)3', cation: 'Al3+', anion: 'NO3-' },
  { name: 'Al2(SO4)3', cation: 'Al3+', anion: 'SO4^2-' },
  { name: 'FeCl2', cation: 'Fe2+', anion: 'Cl-' },
  { name: 'FeBr2', cation: 'Fe2+', anion: 'Br-' },
  { name: 'FeI2', cation: 'Fe2+', anion: 'I-' },
  { name: 'Fe(NO3)2', cation: 'Fe2+', anion: 'NO3-' },
  { name: 'FeSO4', cation: 'Fe2+', anion: 'SO4^2-' },
  { name: 'FeCO3', cation: 'Fe2+', anion: 'CO3^2-' },
  { name: 'FeCl3', cation: 'Fe3+', anion: 'Cl-' },
  { name: 'FeBr3', cation: 'Fe3+', anion: 'Br-' },
  { name: 'Fe(NO3)3', cation: 'Fe3+', anion: 'NO3-' },
  { name: 'Fe2(SO4)3', cation: 'Fe3+', anion: 'SO4^2-' },
  { name: 'CuCl2', cation: 'Cu2+', anion: 'Cl-' },
  { name: 'CuBr2', cation: 'Cu2+', anion: 'Br-' },
  { name: 'Cu(NO3)2', cation: 'Cu2+', anion: 'NO3-' },
  { name: 'CuSO4', cation: 'Cu2+', anion: 'SO4^2-' },
  { name: 'NH4Cl', cation: 'NH4+', anion: 'Cl-' },
  { name: 'NH4Br', cation: 'NH4+', anion: 'Br-' },
  { name: 'NH4I', cation: 'NH4+', anion: 'I-' },
  { name: 'NH4NO3', cation: 'NH4+', anion: 'NO3-' },
  { name: '(NH4)2SO4', cation: 'NH4+', anion: 'SO4^2-' },
  { name: '(NH4)2CO3', cation: 'NH4+', anion: 'CO3^2-' },
  { name: 'ZnCl2', cation: 'Zn2+', anion: 'Cl-' },
  { name: 'ZnBr2', cation: 'Zn2+', anion: 'Br-' },
  { name: 'ZnI2', cation: 'Zn2+', anion: 'I-' },
  { name: 'Zn(NO3)2', cation: 'Zn2+', anion: 'NO3-' },
  { name: 'ZnSO4', cation: 'Zn2+', anion: 'SO4^2-' },
  { name: 'ZnCO3', cation: 'Zn2+', anion: 'CO3^2-' },
];

function randomSalt(prev?: Salt): Salt {
  let s = SALTS[Math.floor(Math.random() * SALTS.length)];
  while (prev !== undefined && s.name === prev.name) {
    s = SALTS[Math.floor(Math.random() * SALTS.length)];
  }
  return s;
}

const TESTS: TestDef[] = [
  {
    id: 'colour',
    label: 'Look at the solution colour',
    run: (s) => {
      if (s.cation === 'Fe2+') return { obs: 'Solution is pale green.', pointsTo: 'Fe2+' };
      if (s.cation === 'Fe3+') return { obs: 'Solution is yellow-brown.', pointsTo: 'Fe3+' };
      if (s.cation === 'Cu2+') return { obs: 'Solution is blue.', pointsTo: 'Cu2+' };
      return { obs: 'Solution is colourless.', pointsTo: 'not Fe2+, Fe3+ or Cu2+' };
    },
  },
  {
    id: 'flame',
    label: 'Flame test',
    run: (s) => {
      if (s.cation === 'Na+') return { obs: 'Golden yellow flame.', pointsTo: 'Na+' };
      if (s.cation === 'K+') return { obs: 'Lilac flame, viewed through cobalt glass.', pointsTo: 'K+' };
      if (s.cation === 'Ca2+') return { obs: 'Brick red flame.', pointsTo: 'Ca2+' };
      if (s.cation === 'Cu2+') return { obs: 'Blue-green flame.', pointsTo: 'Cu2+' };
      return { obs: 'No characteristic flame colour.', pointsTo: 'not Na+, K+, Ca2+ or Cu2+' };
    },
  },
  {
    id: 'naoh-warm',
    label: 'Warm with dilute NaOH (ammonium test)',
    run: (s) =>
      s.cation === 'NH4+'
        ? { obs: 'Pungent gas released on warming; turns moist red litmus blue.', pointsTo: 'NH4+' }
        : { obs: 'No pungent gas on warming.', pointsTo: 'not NH4+' },
  },
  {
    id: 'naoh',
    label: 'Add NaOH solution dropwise, then in excess',
    run: (s) => {
      if (s.cation === 'Cu2+') return { obs: 'Pale blue precipitate, insoluble in excess NaOH.', pointsTo: 'Cu2+' };
      if (s.cation === 'Fe2+') return { obs: 'Dirty green precipitate.', pointsTo: 'Fe2+' };
      if (s.cation === 'Fe3+') return { obs: 'Reddish brown precipitate.', pointsTo: 'Fe3+' };
      if (s.cation === 'Al3+') return { obs: 'White precipitate, dissolves in excess NaOH.', pointsTo: 'Al3+ or Zn2+' };
      if (s.cation === 'Zn2+') return { obs: 'White precipitate, dissolves in excess NaOH.', pointsTo: 'Al3+ or Zn2+' };
      if (s.cation === 'Ca2+')
        return {
          obs: 'No precipitate with dilute NaOH (a faint white ppt appears only in concentrated NaOH).',
          pointsTo: 'Ca2+ (faint) or a group-1 / ammonium cation',
        };
      return { obs: 'No precipitate.', pointsTo: 'Na+, K+ or NH4+' };
    },
  },
  {
    id: 'nh4oh',
    label: 'Add ammonium hydroxide solution in excess',
    run: (s) => {
      if (s.cation === 'Cu2+')
        return { obs: 'Pale blue ppt at first, dissolving in excess NH4OH to a deep blue solution.', pointsTo: 'Cu2+' };
      if (s.cation === 'Zn2+') return { obs: 'White ppt, dissolves in excess NH4OH.', pointsTo: 'Zn2+' };
      if (s.cation === 'Al3+') return { obs: 'White ppt, insoluble in excess NH4OH.', pointsTo: 'Al3+' };
      if (s.cation === 'Fe2+') return { obs: 'Dirty green ppt, insoluble in excess.', pointsTo: 'Fe2+' };
      if (s.cation === 'Fe3+') return { obs: 'Reddish brown ppt, insoluble in excess.', pointsTo: 'Fe3+' };
      return { obs: 'No precipitate or colour change.', pointsTo: 'no transition-metal cation' };
    },
  },
  {
    id: 'hcl',
    label: 'Add dilute HCl',
    run: (s) =>
      s.anion === 'CO3^2-'
        ? { obs: 'Brisk effervescence; the gas turns limewater milky.', pointsTo: 'CO3^2-' }
        : { obs: 'No effervescence.', pointsTo: 'not CO3^2-' },
  },
  {
    id: 'bacl2',
    label: 'Add barium chloride solution',
    run: (s) =>
      s.anion === 'SO4^2-'
        ? { obs: 'White precipitate, insoluble in dilute HCl.', pointsTo: 'SO4^2-' }
        : { obs: 'No white precipitate.', pointsTo: 'not SO4^2-' },
  },
  {
    id: 'agno3',
    label: 'Add silver nitrate solution',
    run: (s) => {
      if (s.anion === 'Cl-') return { obs: 'White precipitate, soluble in NH4OH.', pointsTo: 'Cl-' };
      if (s.anion === 'Br-') return { obs: 'Cream precipitate, sparingly soluble in NH4OH.', pointsTo: 'Br-' };
      if (s.anion === 'I-') return { obs: 'Yellow precipitate, insoluble in NH4OH.', pointsTo: 'I-' };
      if (s.anion === 'CO3^2-')
        return {
          obs: 'Pale yellow ppt of silver carbonate, soluble in dilute HNO3 — acidify with dilute HNO3 before testing halides.',
          pointsTo: 'CO3^2- interferes here',
        };
      return { obs: 'No marked precipitate under these conditions.', pointsTo: 'Cl-, Br- and I- unlikely' };
    },
  },
  {
    id: 'nitrate',
    label: 'Copper turnings + concentrated H2SO4, warmed (simplified nitrate test)',
    run: (s) =>
      s.anion === 'NO3-'
        ? { obs: 'Brown fumes appear around the turnings.', pointsTo: 'NO3-' }
        : { obs: 'No brown fumes.', pointsTo: 'not NO3-' },
  },
];

export function SaltAnalysisLab(props: GameProps) {
  const [salt, setSalt] = useState<Salt>(() => randomSalt());
  const [notebook, setNotebook] = useState<Observation[]>([]);
  const [cationPick, setCationPick] = useState<Cation | ''>('');
  const [anionPick, setAnionPick] = useState<Anion | ''>('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [solved, setSolved] = useState(0);

  // Derived values (above any effect; this lab uses none).
  const runIds = new Set(notebook.map((n) => n.test));
  const wonAll = solved >= 2;

  function runTest(def: TestDef) {
    const res = def.run(salt);
    setNotebook((n) => [...n, { test: def.label, obs: res.obs, pointsTo: res.pointsTo }]);
  }

  function newUnknown() {
    setSalt((s) => randomSalt(s));
    setNotebook([]);
    setCationPick('');
    setAnionPick('');
    setFeedback(null);
  }

  function cationContradiction(picked: Cation | ''): string {
    const row = notebook.find((n) => n.pointsTo.includes(salt.cation));
    if (row) {
      return `Your cation pick (${picked || 'none'}) does not fit: the ${row.test.toLowerCase()} observation reads ${row.obs} That points to ${salt.cation}. `;
    }
    return 'No observation yet pins down the cation — run the NaOH, NH4OH and flame tests first. ';
  }

  function anionContradiction(picked: Anion | ''): string {
    const row = notebook.find((n) => n.pointsTo.includes(salt.anion));
    if (row) {
      return `Your anion pick (${picked || 'none'}) does not fit: the ${row.test.toLowerCase()} observation reads ${row.obs} That points to ${salt.anion}.`;
    }
    return 'No observation yet pins down the anion — run the dilute HCl, BaCl2 and AgNO3 tests first.';
  }

  function submit() {
    if (cationPick === '' || anionPick === '' || feedback?.ok) return;
    const cationOk = cationPick === salt.cation;
    const anionOk = anionPick === salt.anion;
    if (cationOk && anionOk) {
      const n = solved + 1;
      setSolved(n);
      setFeedback({
        ok: true,
        text: `Correct — the unknown was ${salt.name} (${salt.cation}, ${salt.anion}). ${n >= 2 ? 'Two salts fully identified.' : 'Take a new unknown salt and identify it too.'}`,
      });
      if (n >= 2) props.onWin();
      return;
    }
    const parts: string[] = [];
    if (!cationOk) parts.push(cationContradiction(cationPick));
    if (!anionOk) parts.push(anionContradiction(anionPick));
    setFeedback({ ok: false, text: parts.join('') });
  }

  return (
    <GameShell
      title="Salt Analysis Bench"
      blurb="An unknown salt sits on the bench. Run the classic wet tests, build your observation notebook, then name the cation and the anion."
      modelNote="Simplified scheme — real salt analysis has more preliminary and confirmatory steps. Every colour is written in words as well as shown, for screen-reader and colour-blind users. The nitrate test here is a simplified copper-turnings version, honestly labelled."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <FlaskConical className="size-4" aria-hidden="true" /> Tests on the unknown sample
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TESTS.map((def) => (
              <button
                key={def.id}
                onClick={() => runTest(def)}
                disabled={runIds.has(def.label)}
                aria-label={`Run test: ${def.label}`}
                className="press inline-flex min-h-[44px] items-center rounded-xl border border-border bg-card px-3 text-left text-sm font-medium hover:bg-accent/10 disabled:opacity-50"
              >
                {def.label}
              </button>
            ))}
          </div>
          <button
            className="press inline-flex min-h-[44px] items-center gap-2 self-start rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
            onClick={newUnknown}
          >
            <RotateCcw className="size-4" aria-hidden="true" /> New unknown salt
          </button>
          <p className="text-sm text-muted-foreground">
            Tests already run are greyed out — one honest observation per test, like a real notebook.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Eye className="size-4" aria-hidden="true" /> Your identification
          </h3>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Cation</span>
            <select
              value={cationPick}
              onChange={(e) => setCationPick(e.target.value as Cation | '')}
              aria-label="Choose the cation"
              className="press min-h-[44px] rounded-xl border border-border bg-card px-3 text-sm"
            >
              <option value="">— select a cation —</option>
              {CATIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Anion</span>
            <select
              value={anionPick}
              onChange={(e) => setAnionPick(e.target.value as Anion | '')}
              aria-label="Choose the anion"
              className="press min-h-[44px] rounded-xl border border-border bg-card px-3 text-sm"
            >
              <option value="">— select an anion —</option>
              {ANIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <button
            className="press inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            onClick={submit}
            disabled={cationPick === '' || anionPick === '' || (feedback?.ok ?? false)}
          >
            Submit identification
          </button>
          <p
            role="status"
            aria-live="polite"
            className={cn(
              'text-sm font-semibold',
              feedback ? (feedback.ok ? 'text-emerald-600' : 'text-amber-600') : 'text-muted-foreground'
            )}
          >
            {feedback
              ? feedback.text
              : 'Run tests, then commit to a cation and an anion. Wrong picks get a pointer to the contradicting observation.'}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Salts identified:</span>
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1].map((i) => (
                <span key={i} className={cn('size-3 rounded-full', i < solved ? 'bg-emerald-500' : 'bg-muted')} />
              ))}
            </div>
            <span className="text-sm tabular-nums text-muted-foreground">{solved}/2</span>
          </div>
          {wonAll && (
            <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600">
              Two unknowns cracked, ion by ion — solid practical skills.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <LabReport
          title="Observation notebook"
          columns={['Test', 'Observation', 'Points to']}
          rows={notebook.map((n) => [n.test, n.obs, n.pointsTo])}
          note="Each row is the honest result of one test on the current unknown. The notebook clears when you take a new salt."
        />
        <ChapterRef
          subject="Chemistry"
          chapter="Class 11 practical syllabus"
          topic="Qualitative analysis of inorganic salts"
        />
      </div>
    </GameShell>
  );
}
