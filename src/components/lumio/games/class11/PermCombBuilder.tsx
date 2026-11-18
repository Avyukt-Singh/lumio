'use client';

import { useState } from 'react';
import { ListOrdered, Shuffle, Trophy } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { ChapterRef, LabReport } from './shared';
import { cn } from '@/lib/utils';

/**
 * PermCombBuilder: three builder modes (anagrams of a word, seating at a
 * table, choosing k from n) with honest formula panels, brute-force outcome
 * enumeration whenever the total is 120 or fewer (cross-checked against the
 * formula), and a five-question scenario quiz with an observation report.
 */

const ENUM_CAP = 120;
const CHIP_LIMIT = 60;
const QUIZ_GOAL = 5;

function fact(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

type Mode = 'word' | 'table' | 'pick';
type Restriction = 'none' | 'together' | 'first';

// ---- Enumeration helpers (only called when the count is <= ENUM_CAP) -------

function permuteAll(items: string[]): string[][] {
  const out: string[][] = [];
  const used = new Array(items.length).fill(false);
  const cur: string[] = [];
  const rec = () => {
    if (cur.length === items.length) {
      out.push(cur.slice());
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(items[i]);
      rec();
      cur.pop();
      used[i] = false;
    }
  };
  rec();
  return out;
}

function permutationsK(items: string[], k: number): string[][] {
  const out: string[][] = [];
  const used = new Array(items.length).fill(false);
  const cur: string[] = [];
  const rec = () => {
    if (cur.length === k) {
      out.push(cur.slice());
      return;
    }
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(items[i]);
      rec();
      cur.pop();
      used[i] = false;
    }
  };
  rec();
  return out;
}

function combinations(items: string[], k: number): string[][] {
  const out: string[][] = [];
  const rec = (start: number, cur: string[]) => {
    if (cur.length === k) {
      out.push(cur.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      cur.push(items[i]);
      rec(i + 1, cur);
      cur.pop();
    }
  };
  rec(0, []);
  return out;
}

function sequencesRep(items: string[], k: number): string[][] {
  const out: string[][] = [];
  const rec = (cur: string[]) => {
    if (cur.length === k) {
      out.push(cur.slice());
      return;
    }
    for (const it of items) {
      cur.push(it);
      rec(cur);
      cur.pop();
    }
  };
  rec([]);
  return out;
}

function multisets(items: string[], k: number): string[][] {
  const out: string[][] = [];
  const rec = (start: number, cur: string[]) => {
    if (cur.length === k) {
      out.push(cur.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      cur.push(items[i]);
      rec(i, cur);
      cur.pop();
    }
  };
  rec(0, []);
  return out;
}

/** Unique permutations of a multiset (e.g. the letters of LEVEL). */
function uniquePerms(multiset: string[]): string[][] {
  const out: string[][] = [];
  const used = new Array(multiset.length).fill(false);
  const cur: string[] = [];
  const rec = () => {
    if (cur.length === multiset.length) {
      out.push(cur.slice());
      return;
    }
    const seen = new Set<string>();
    for (let i = 0; i < multiset.length; i++) {
      if (used[i] || seen.has(multiset[i])) continue;
      seen.add(multiset[i]);
      used[i] = true;
      cur.push(multiset[i]);
      rec();
      cur.pop();
      used[i] = false;
    }
  };
  rec();
  return out;
}

function shuffleTo<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

// ---- Quiz pool -------------------------------------------------------------

interface Scenario {
  prompt: string;
  answer: number;
  distract: number[];
  explain: string;
}

const SCENARIOS: Scenario[] = [
  { prompt: 'How many 3-letter codes from A-F if letters may repeat?', answer: 216, distract: [120, 20, 720], explain: '6 × 6 × 6 = 216 — with repetition every position has all 6 choices.' },
  { prompt: 'How many committees of 2 can be chosen from 5 people?', answer: 10, distract: [20, 25, 5], explain: 'A committee has no order: 5C2 = 10.' },
  { prompt: 'How many distinct arrangements of the letters of LEVEL?', answer: 30, distract: [120, 60, 20], explain: '5! ÷ (2! × 2!) = 30 — divide out the repeats of E and L.' },
  { prompt: 'In how many ways can 4 people sit in a row?', answer: 24, distract: [16, 12, 6], explain: '4! = 24.' },
  { prompt: 'In how many ways can 5 people sit at a round table?', answer: 24, distract: [120, 60, 16], explain: '(5 − 1)! = 24 — rotations of the same circle are the same seating.' },
  { prompt: 'How many 2-letter codes from A, B, C, D, E without repeating a letter?', answer: 20, distract: [10, 25, 15], explain: '5P2 = 5 × 4 = 20.' },
  { prompt: 'From 6 people, how many ways to pick a president and a secretary?', answer: 30, distract: [15, 36, 12], explain: 'The two roles differ, so order matters: 6P2 = 30.' },
  { prompt: 'How many 4-symbol codes from 3 symbols if symbols may repeat?', answer: 81, distract: [27, 64, 12], explain: '3⁴ = 81.' },
  { prompt: 'How many distinct arrangements of the letters of CAT?', answer: 6, distract: [12, 3, 9], explain: '3! = 6 — no repeated letters, so nothing to divide by.' },
  { prompt: '6 people in a row; two named people must sit together. How many seatings?', answer: 240, distract: [720, 120, 480], explain: 'Glue the pair into one block: 5! × 2 = 240.' },
];

interface QuizState {
  scen: Scenario;
  options: string[];
}

function makeQuiz(prevPrompt: string): QuizState {
  let scen = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  let guard = 0;
  while (scen.prompt === prevPrompt && guard < 20) {
    scen = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    guard++;
  }
  const options = shuffleTo([scen.answer, ...scen.distract]).map(String);
  return { scen, options };
}

export function PermCombBuilderLab(props: GameProps) {
  const [mode, setMode] = useState<Mode>('word');
  const [word, setWord] = useState('LEVEL');
  const [n, setN] = useState(5);
  const [k, setK] = useState(2);
  const [orderMatters, setOrderMatters] = useState(true);
  const [repetition, setRepetition] = useState(false);
  const [restriction, setRestriction] = useState<Restriction>('none');
  const [roundTable, setRoundTable] = useState(false);

  const [quiz, setQuiz] = useState<QuizState>(() => makeQuiz(''));
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [verdict, setVerdict] = useState<'none' | 'ok' | 'retry'>('none');
  const [feedback, setFeedback] = useState('');
  const [reportRows, setReportRows] = useState<(string | number)[][]>([]);

  // ---- Derived counts (no effects in this lab) ----------------------------
  const effRestriction: Restriction =
    mode === 'table' ? restriction : restriction === 'first' ? 'first' : 'none';

  // Word mode.
  const letters = word.toUpperCase().replace(/[^A-Z]/g, '').split('');
  const L = letters.length;
  const counts = new Map<string, number>();
  for (const ch of letters) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const repeatSizes = [...counts.values()].filter((c) => c > 1);
  const denom = repeatSizes.reduce((acc, c) => acc * fact(c), 1);
  const firstCh = letters[0] ?? '';
  const denomFirst = (() => {
    const m = new Map(counts);
    if (firstCh) m.set(firstCh, Math.max(0, (m.get(firstCh) ?? 1) - 1));
    return [...m.values()].reduce((acc, c) => acc * fact(c), 1);
  })();
  const wordTotal = L === 0 ? 0 : fact(L) / denom;
  const wordFirst = L === 0 ? 0 : fact(L - 1) / denomFirst;
  const wordCount = effRestriction === 'first' ? wordFirst : wordTotal;

  // Table mode.
  const effN = mode === 'table' ? Math.min(Math.max(n, 3), 6) : n;
  const people = Array.from({ length: effN }, (_, i) => `P${i + 1}`);
  const round = mode === 'table' && roundTable;
  const tableTotal = round ? fact(effN - 1) : fact(effN);
  const tableTogether = round ? 2 * fact(effN - 2) : 2 * fact(effN - 1);
  const tableFirst = fact(effN - 1); // same value either way; the note explains why
  const tableCount =
    effRestriction === 'together' ? tableTogether : effRestriction === 'first' ? tableFirst : tableTotal;

  // Pick mode.
  const effK = Math.min(Math.max(k, 0), Math.min(Math.max(n, 1), 8));
  const items = Array.from({ length: Math.min(Math.max(n, 1), 8) }, (_, i) => String.fromCharCode(65 + i));
  let pickTotal = 0;
  let pickFirstTotal = 0;
  if (orderMatters && repetition) {
    pickTotal = Math.pow(n, effK);
    pickFirstTotal = Math.pow(n, Math.max(0, effK - 1));
  } else if (orderMatters && !repetition) {
    pickTotal = fact(n) / fact(Math.max(0, n - effK));
    pickFirstTotal = fact(n - 1) / fact(Math.max(0, n - effK));
  } else if (!orderMatters && !repetition) {
    pickTotal = fact(n) / (fact(effK) * fact(Math.max(0, n - effK)));
    pickFirstTotal = pickTotal; // restriction not meaningful without order
  } else {
    pickTotal = fact(n + effK - 1) / (fact(effK) * fact(n - 1));
    pickFirstTotal = pickTotal; // restriction not meaningful without order
  }
  const restrictionUsable = mode === 'table' || (mode === 'pick' && orderMatters) || mode === 'word';
  const pickCount = effRestriction === 'first' && orderMatters ? pickFirstTotal : pickTotal;

  // Which total + formula text applies.
  const total = mode === 'word' ? wordCount : mode === 'table' ? tableCount : pickCount;
  const formulaText = (() => {
    if (mode === 'word') {
      if (L === 0) return 'Type a word to count its anagrams.';
      const divPart = repeatSizes.length > 0 ? repeatSizes.map((c) => `${c}!`).join(' × ') : 'no repeats';
      if (effRestriction === 'first') {
        return `Fix the first letter (${firstCh}) and arrange the rest: (${L - 1})! ÷ ${divPart === 'no repeats' ? '1' : divPart} = ${wordCount}. The fixed letter removes one copy from its own repeat group.`;
      }
      return `Anagrams of a ${L}-letter word: ${L}! ÷ ${divPart === 'no repeats' ? '1' : divPart} = ${wordCount}. Every swap of identical letters spells the same word, so we divide those swaps out.`;
    }
    if (mode === 'table') {
      if (effRestriction === 'together') {
        return round
          ? `Glue P1 and P2 into one block on the circle: (effN − 2)! × 2 with n = ${effN} gives 2 × ${fact(effN - 2)} = ${tableTogether}. The block can be flipped two ways.`
          : `Glue P1 and P2 into one block in the row: (n − 1)! × 2 with n = ${effN} gives 2 × ${fact(effN - 1)} = ${tableTogether}.`;
      }
      if (effRestriction === 'first') {
        return round
          ? `Fixing P1 at a named seat is exactly how round table counting already works: (${effN} − 1)! = ${tableFirst}. The restriction changes nothing here — rotations were never counted separately.`
          : `Fix P1 in the first seat, arrange the remaining ${effN - 1}: (${effN} − 1)! = ${tableFirst}.`;
      }
      return round
        ? `Round table with n = ${effN}: rotations are the same seating, so (n − 1)! = ${tableTotal}.`
        : `Row of n = ${effN} labelled seats: every order is different, so n! = ${tableTotal}.`;
    }
    if (orderMatters && repetition) {
      return effRestriction === 'first'
        ? `Sequences of length ${effK} from ${n} symbols with repetition, first fixed: n^(k − 1) = ${n}^${effK - 1} = ${pickFirstTotal}.`
        : `Sequences of length ${effK} from ${n} symbols with repetition: every position has n choices, so n^k = ${n}^${effK} = ${pickTotal}.`;
    }
    if (orderMatters && !repetition) {
      return effRestriction === 'first'
        ? `Fix the named item first, then arrange ${effK - 1} more from the remaining ${n - 1}: (n − 1)!/(n − k)! = ${pickFirstTotal}.`
        : `Ordered picks without repetition: nPr = n!/(n − k)! = ${n}!/${n - effK}! = ${pickTotal}.`;
    }
    if (!orderMatters && !repetition) {
      return `Unordered picks without repetition: nCr = n!/(k!(n − k)!) = ${pickTotal}. The restriction toggle needs an order to act on, so it is idle here.`;
    }
    return `Unordered picks with repetition allowed: C(n + k − 1, k) = ${pickTotal} (multisets). The restriction toggle needs an order to act on, so it is idle here.`;
  })();

  // ---- Enumeration (honest brute-force cross-check) -----------------------
  const canEnumerate = total > 0 && total <= ENUM_CAP && (mode !== 'word' || L <= 7);
  const outcomes: string[] = (() => {
    if (!canEnumerate) return [];
    if (mode === 'word') {
      let perms = uniquePerms(letters).map((p) => p.join(''));
      if (effRestriction === 'first') perms = perms.filter((p) => p.startsWith(firstCh));
      return perms;
    }
    if (mode === 'table') {
      if (round) {
        const rest = people.slice(1);
        let arrs = permuteAll(rest).map((p) => ['P1', ...p]);
        if (effRestriction === 'together') {
          arrs = arrs.filter((a) => {
            const p2 = a.indexOf('P2');
            return p2 === 1 || p2 === a.length - 1;
          });
        }
        return arrs.map((a) => a.join('-'));
      }
      let perms = permuteAll(people);
      if (effRestriction === 'together') {
        perms = perms.filter((p) => Math.abs(p.indexOf('P1') - p.indexOf('P2')) === 1);
      }
      if (effRestriction === 'first') perms = perms.filter((p) => p[0] === 'P1');
      return perms.map((p) => p.join('-'));
    }
    // pick mode
    let outs: string[][] = [];
    if (orderMatters && repetition) outs = sequencesRep(items, effK);
    else if (orderMatters && !repetition) outs = permutationsK(items, effK);
    else if (!orderMatters && !repetition) outs = combinations(items, effK);
    else outs = multisets(items, effK);
    if (effRestriction === 'first' && orderMatters) outs = outs.filter((o) => o[0] === 'A');
    return outs.map((o) => o.join(''));
  })();
  const enumCount = mode === 'word' ? new Set(outcomes).size : outcomes.length;
  const match = canEnumerate && enumCount === total;
  const shown = outcomes.slice(0, CHIP_LIMIT);

  // ---- Quiz ---------------------------------------------------------------
  function pick(label: string) {
    const ok = Number(label) === quiz.scen.answer;
    setPicked(label);
    setReportRows((r) => [...r, [quiz.scen.prompt, label, String(quiz.scen.answer), ok ? 'Correct' : 'Retry']]);
    if (ok) {
      const ns = score + 1;
      setScore(ns);
      setVerdict('ok');
      setFeedback(`Correct — ${quiz.scen.explain}`);
      if (ns >= QUIZ_GOAL) {
        props.onWin();
      } else {
        setQuiz(makeQuiz(quiz.scen.prompt));
        setPicked(null);
      }
    } else {
      setVerdict('retry');
      setFeedback('Not this one. Ask yourself: does order matter? may items repeat? Then try again.');
      setQuiz({ scen: quiz.scen, options: shuffleTo(quiz.options) });
    }
  }

  function changeMode(m: Mode) {
    setMode(m);
    if (m !== 'table' && restriction === 'together') setRestriction('none');
    if (m === 'pick') {
      setOrderMatters(true);
      setRepetition(false);
    }
    if (m === 'table' && n < 3) setN(3);
  }

  return (
    <GameShell
      title="Permutation & Combination Builder"
      blurb="Arrange letters, seat people, choose k from n. Watch which formula applies and why — then check the count against a brute-force listing of every outcome."
      modelNote="Counts come from closed-form formulas and are cross-checked by enumeration whenever the total is 120 or fewer; if the two ever disagree, the lab says so loudly. Enumeration is capped at 7 letters and 120 outcomes for performance."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------------- Controls ---------------- */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <ListOrdered className="size-4" aria-hidden="true" /> Builder
          </h3>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Builder mode">
            {([
              ['word', 'Arrange a word'],
              ['table', 'Seat a table'],
              ['pick', 'Choose k from n'],
            ] as Array<[Mode, string]>).map(([m, label]) => (
              <button
                key={m}
                onClick={() => changeMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  'press inline-flex min-h-[44px] items-center rounded-xl border px-3 text-sm font-medium',
                  mode === m ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent/10'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'word' && (
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Word to arrange (up to 8 letters)</span>
              <input
                type="text"
                value={word}
                maxLength={8}
                onChange={(e) => setWord(e.target.value)}
                className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 text-sm uppercase"
                aria-label="Word to arrange"
              />
            </label>
          )}

          {mode === 'table' && (
            <>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                <span>
                  People at the table: <b className="tabular-nums">{n}</b>
                </span>
              <input
                type="range"
                min={3}
                max={6}
                step={1}
                value={n}
                onChange={(e) => setN(Number(e.target.value))}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Number of people, currently ${n}`}
              />
              </label>
              <button
                onClick={() => setRoundTable((v) => !v)}
                aria-pressed={roundTable}
                className="press inline-flex min-h-[44px] self-start items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
              >
                Round table: {roundTable ? 'on — rotations count once' : 'off — a straight row'}
              </button>
            </>
          )}

          {mode === 'pick' && (
            <>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                <span>
                  Pool size n: <b className="tabular-nums">{n}</b>
                </span>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={n}
                  onChange={(e) => setN(Number(e.target.value))}
                  className="press min-h-[44px] w-full accent-primary"
                  aria-label={`Pool size n, currently ${n}`}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                <span>
                  Choose k: <b className="tabular-nums">{effK}</b>
                </span>
                <input
                  type="range"
                  min={0}
                  max={n}
                  step={1}
                  value={effK}
                  onChange={(e) => setK(Number(e.target.value))}
                  className="press min-h-[44px] w-full accent-primary"
                  aria-label={`Choose k, currently ${effK}`}
                />
              </label>
            </>
          )}

          <div className="flex flex-wrap gap-2" role="group" aria-label="Toggles">
            {mode === 'pick' ? (
              <>
                <button
                  onClick={() => setOrderMatters((v) => !v)}
                  aria-pressed={orderMatters}
                  className="press inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
                >
                  <Shuffle className="size-4" aria-hidden="true" /> Order matters: {orderMatters ? 'on' : 'off'}
                </button>
                <button
                  onClick={() => setRepetition((v) => !v)}
                  aria-pressed={repetition}
                  className="press inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
                >
                  Repetition allowed: {repetition ? 'on' : 'off'}
                </button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {mode === 'word'
                  ? 'Anagram counting has order built in and divides repeats; the toggles would not change the formula, so they are locked.'
                  : 'Seating always has order built in and people are never repeated, so the toggles are locked here.'}
              </p>
            )}
          </div>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span>Restriction</span>
            <select
              value={mode === 'table' ? restriction : restriction === 'first' ? 'first' : 'none'}
              onChange={(e) => setRestriction(e.target.value as Restriction)}
              className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 text-sm"
              aria-label="Restriction"
            >
              <option value="none">No restriction</option>
              {mode === 'table' && <option value="together">P1 and P2 must sit together</option>}
              {mode === 'table' && <option value="first">P1 must take the first seat</option>}
              {mode !== 'table' && <option value="first">A named item must be first</option>}
            </select>
          </label>
          {!restrictionUsable && (
            <p className="text-xs text-amber-600">
              The restriction toggle needs an order to act on — switch on Order matters, or leave it off.
            </p>
          )}

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm font-semibold">Total: <span className="tabular-nums">{total}</span></p>
            <p className="mt-1 text-xs text-foreground/80">{formulaText}</p>
          </div>
        </div>

        {/* ---------------- Enumeration ---------------- */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
          <h3 className="text-sm font-bold">Outcome listing (the honest check)</h3>
          {canEnumerate ? (
            <>
              <p className="text-sm text-muted-foreground">
                {outcomes.length} raw outcomes generated; {enumCount} distinct
                {mode === 'word' && L < new Set(letters).size ? ' (identical letters collapse to one word)' : ''}.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {shown.map((o, i) => (
                  <span key={`${o}-${i}`} className="rounded-lg border border-border bg-card px-2 py-1 font-mono text-xs">
                    {o}
                  </span>
                ))}
              </div>
              {outcomes.length > CHIP_LIMIT && (
                <p className="text-xs text-muted-foreground">and {outcomes.length - CHIP_LIMIT} more…</p>
              )}
              <p
                role="status"
                aria-live="polite"
                className={cn('text-sm font-semibold', match ? 'text-emerald-600' : 'text-amber-600')}
              >
                {match
                  ? `Verified: all ${total} outcomes enumerated by hand — they match the formula exactly.`
                  : `Mismatch: enumeration found ${enumCount} but the formula says ${total}. Check the restriction settings.`}
              </p>
            </>
          ) : (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {total === 0
                ? 'Nothing to list yet — set a word or a pool size first.'
                : `Too many outcomes to list (${total} is over the ${ENUM_CAP} cap) — the formula is the only practical tool here, which is exactly why it exists.`}
            </p>
          )}
        </div>
      </div>

      {/* ---------------- Quiz ---------------- */}
      <div className="mt-4 rounded-2xl border border-border bg-background/50 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">Scenario check: {QUIZ_GOAL} correct answers wins</h3>
          <p className="text-sm text-muted-foreground">
            Score: <b className="tabular-nums">{Math.min(score, QUIZ_GOAL)}/{QUIZ_GOAL}</b>
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-5" aria-hidden="true">
          {Array.from({ length: QUIZ_GOAL }, (_, i) => (
            <div key={i} className={cn('h-2 rounded-full', i < score ? 'bg-emerald-500' : 'bg-muted')} />
          ))}
        </div>
        <p className="mt-3 text-sm font-semibold">{quiz.scen.prompt}</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Answer options for: ${quiz.scen.prompt}`}>
          {quiz.options.map((opt) => (
            <button
              key={opt}
              onClick={() => pick(opt)}
              aria-pressed={picked === opt}
              className={cn(
                'press inline-flex min-h-[44px] min-w-[72px] items-center justify-center rounded-xl border px-3 text-sm font-medium tabular-nums',
                picked !== opt && 'border-border bg-card hover:bg-accent/10',
                picked === opt && verdict === 'ok' && 'border-emerald-500 bg-emerald-500/10 text-emerald-600',
                picked === opt && verdict === 'retry' && 'border-amber-500 bg-amber-500/10 text-amber-600'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
        <p
          role="status"
          aria-live="polite"
          className={cn('mt-3 text-sm font-semibold', verdict === 'ok' && 'text-emerald-600', verdict === 'retry' && 'text-amber-600')}
        >
          {feedback || 'Pick a number — a wrong pick is feedback, not a penalty.'}
        </p>
        {score >= QUIZ_GOAL && (
          <p className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
            <Trophy className="size-4 shrink-0" aria-hidden="true" />
            Five scenarios solved — you know when to multiply, divide and choose.
          </p>
        )}
        <LabReport
          className="mt-4"
          title="Scenario report"
          columns={['Scenario', 'My answer', 'Correct', 'Verdict']}
          rows={reportRows}
          note="Every answered question is recorded here, including retries — practical-exam style."
        />
      </div>

      <ChapterRef
        className="mt-4"
        subject="Mathematics"
        chapter="Ch 7 — Permutations and Combinations"
        topic="nPr vs nCr, factorials, repetition"
      />
    </GameShell>
  );
}
