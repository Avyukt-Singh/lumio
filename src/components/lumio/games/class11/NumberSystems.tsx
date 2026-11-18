'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Binary, Divide, Equal, PlusCircle, Sparkles, RefreshCw, ListChecks } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { cn } from '@/lib/utils';

/**
 * Number Systems Lab: base conversion with visible working (repeated
 * division, positional weights, bit grouping), 8-bit binary addition with
 * carries, 8-bit two's-complement negation, and a 5-problem practice round.
 */

const DIGITS = '0123456789ABCDEF';
const BASES = [2, 8, 16] as const;
type Base = (typeof BASES)[number];

/* ---------------- conversion engines (pure, above any component) ---------------- */

interface DivisionRow {
  dividend: number;
  quotient: number;
  remainder: number;
  digit: string;
}

function decToBaseSteps(n: number, base: number): DivisionRow[] {
  const rows: DivisionRow[] = [];
  let cur = n;
  if (cur === 0) {
    rows.push({ dividend: 0, quotient: 0, remainder: 0, digit: '0' });
    return rows;
  }
  while (cur > 0) {
    const q = Math.floor(cur / base);
    const r = cur % base;
    rows.push({ dividend: cur, quotient: q, remainder: r, digit: DIGITS[r] });
    cur = q;
  }
  return rows;
}

function toBaseString(n: number, base: number): string {
  return decToBaseSteps(n, base)
    .map((r) => r.digit)
    .reverse()
    .join('');
}

interface WeightRow {
  digit: string;
  value: number;
  weight: number;
  product: number;
}

function digitsToDecSteps(raw: string, base: number): { rows: WeightRow[]; value: number } {
  const s = raw.trim().toUpperCase();
  const rows: WeightRow[] = [];
  let value = 0;
  for (let i = 0; i < s.length; i++) {
    const d = DIGITS.indexOf(s[i]);
    const weight = Math.pow(base, s.length - 1 - i);
    const product = d * weight;
    rows.push({ digit: s[i], value: d, weight, product });
    value += product;
  }
  return { rows, value };
}

function splitGroups(bits: string, size: number): string[] {
  const padded = bits.length % size === 0 ? bits : '0'.repeat(size - (bits.length % size)) + bits;
  const groups: string[] = [];
  for (let i = 0; i < padded.length; i += size) groups.push(padded.slice(i, i + size));
  return groups;
}

function groupToDigit(group: string, base: 8 | 16): string {
  return DIGITS[parseInt(group, 2)].toString();
}

function digitToBits(d: string, size: number): string {
  return parseInt(d, 16).toString(2).padStart(size, '0');
}

/** octal/hex <-> anything: go through binary, then regroup. */
function baseViaBinarySteps(raw: string, from: 2 | 8 | 16, to: 2 | 8 | 16): { expand: string[]; groups: string[]; result: string } {
  const s = raw.trim().toUpperCase();
  const expand: string[] = [];
  if (from === 2) {
    expand.push(s);
  } else {
    const size = from === 8 ? 3 : 4;
    for (const d of s) expand.push(`${d} -> ${digitToBits(d, size)}`);
  }
  let bits = '';
  if (from === 2) bits = s;
  else for (const d of s) bits += digitToBits(d, from === 8 ? 3 : 4);
  bits = bits.replace(/^0+(?=\d)/, '') || '0';
  const result =
    to === 2
      ? bits
      : splitGroups(bits, to === 8 ? 3 : 4)
          .map((g) => groupToDigit(g, to))
          .join('');
  const groups = to === 2 ? [] : splitGroups(bits, to === 8 ? 3 : 4);
  return { expand, groups, result };
}

/* ---------------- binary addition + two's complement ---------------- */

interface AddRow {
  pos: number;
  carryIn: number;
  a: number;
  b: number;
  sum: number;
  carryOut: number;
}

function addBinary8(a: string, b: string): { rows: AddRow[]; result: string; carryOut: number } {
  const rows: AddRow[] = [];
  let carry = 0;
  for (let pos = 7; pos >= 0; pos--) {
    const ab = a.charCodeAt(pos) - 48;
    const bb = b.charCodeAt(pos) - 48;
    const sum = ab + bb + carry;
    rows.unshift({ pos, carryIn: carry, a: ab, b: bb, sum: sum % 2, carryOut: sum >= 2 ? 1 : 0 });
    carry = sum >= 2 ? 1 : 0;
  }
  return { rows, result: rows.map((r) => String(r.sum)).join(''), carryOut: carry };
}

function twosNegSteps(n: number): { bits: string; inverted: string; result: string } {
  const bits = toBaseString(n, 2).padStart(8, '0').slice(-8);
  const inverted = bits
    .split('')
    .map((b) => (b === '0' ? '1' : '0'))
    .join('');
  const plus1 = addBinary8(inverted, '00000001');
  return { bits, inverted, result: plus1.result };
}

/* ---------------- validation helpers ---------------- */

function isBin(s: string): boolean {
  return /^[01]+$/.test(s);
}

function isHex(s: string): boolean {
  return /^[0-9A-Fa-f]+$/.test(s);
}

function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/* ---------------- practice problems ---------------- */

type PKind = 'dec-bin' | 'bin-dec' | 'dec-hex' | 'bin-add' | 'twoscomp';

const KIND_LABEL: Record<PKind, string> = {
  'dec-bin': 'decimal to binary',
  'bin-dec': 'binary to decimal',
  'dec-hex': 'decimal to hexadecimal',
  'bin-add': 'binary addition',
  twoscomp: "two's complement",
};

interface Problem {
  kind: PKind;
  prompt: string;
  answer: string;
  working: string[];
}

function makeProblem(): Problem {
  const kinds: PKind[] = ['dec-bin', 'bin-dec', 'dec-hex', 'bin-add', 'twoscomp'];
  const kind = kinds[randInt(0, kinds.length - 1)];
  if (kind === 'dec-bin') {
    const n = randInt(5, 255);
    const rows = decToBaseSteps(n, 2);
    return {
      kind,
      prompt: `Convert ${n} to binary.`,
      answer: toBaseString(n, 2),
      working: [
        'Repeated division by 2 (read remainders bottom-up):',
        ...rows.map((r) => `${r.dividend} / 2 = ${r.quotient} remainder ${r.remainder}`),
        `Reading remainders bottom-up: ${toBaseString(n, 2)}`,
      ],
    };
  }
  if (kind === 'bin-dec') {
    const bits = Array.from({ length: 8 }, () => String(randInt(0, 1))).join('');
    const value = parseInt(bits, 2);
    const { rows } = digitsToDecSteps(bits, 2);
    return {
      kind,
      prompt: `Convert ${bits} (binary) to decimal.`,
      answer: String(value),
      working: [
        'Positional weights (bit x weight):',
        ...rows.map((r) => `${r.digit} x ${r.weight} = ${r.product}`),
        `Sum: ${value}`,
      ],
    };
  }
  if (kind === 'dec-hex') {
    const n = randInt(16, 255);
    const rows = decToBaseSteps(n, 16);
    return {
      kind,
      prompt: `Convert ${n} to hexadecimal.`,
      answer: toBaseString(n, 16),
      working: [
        'Repeated division by 16 (read remainders bottom-up):',
        ...rows.map((r) => `${r.dividend} / 16 = ${r.quotient} remainder ${r.remainder} (digit ${r.digit})`),
        `Reading remainders bottom-up: ${toBaseString(n, 16)}`,
      ],
    };
  }
  if (kind === 'bin-add') {
    const a = randInt(20, 120);
    const b = randInt(20, 120);
    const ab = toBaseString(a, 2).padStart(8, '0');
    const bb = toBaseString(b, 2).padStart(8, '0');
    const { rows, result, carryOut } = addBinary8(ab, bb);
    return {
      kind,
      prompt: `Add the 8-bit binary numbers ${ab} + ${bb}. Give the 8-bit sum.`,
      answer: result,
      working: [
        'Column-by-column from the right, carrying into the next column:',
        ...rows.map(
          (r) =>
            `pos ${r.pos}: ${r.a} + ${r.b} + carry ${r.carryIn} = ${r.a + r.b + r.carryIn} -> write ${r.sum}, carry ${r.carryOut}`
        ),
        `Sum: ${result}${carryOut ? ` (final carry ${carryOut} overflows 8 bits)` : ''}`,
      ],
    };
  }
  const n = randInt(1, 127);
  const { bits, inverted, result } = twosNegSteps(n);
  return {
    kind,
    prompt: `Write the 8-bit two's complement of -${n}.`,
    answer: result,
    working: [
      `+${n} in 8-bit binary: ${bits}`,
      `Invert every bit: ${inverted}`,
      `Add 1: ${inverted} + 00000001 = ${result}`,
      `So -${n} is stored as ${result}.`,
    ],
  };
}

function checkAnswer(p: Problem, raw: string): boolean {
  const s = raw.trim().replace(/\s+/g, '').toUpperCase();
  if (s.length === 0) return false;
  switch (p.kind) {
    case 'dec-bin':
      return isBin(s) && s.replace(/^0+(?=[01])/, '') === p.answer;
    case 'bin-dec': {
      if (!/^\d+$/.test(s)) return false;
      return parseInt(s, 10) === parseInt(p.answer, 10);
    }
    case 'dec-hex':
      return isHex(s) && s.replace(/^0X/, '').replace(/^0+(?=[0-9A-F])/, '') === p.answer;
    case 'bin-add':
      return isBin(s) && parseInt(s, 2) === parseInt(p.answer, 2) && s.replace(/^0+(?=[01])/, '').length <= 8;
    case 'twoscomp':
      return isBin(s) && s.replace(/^0+(?=[01])/, '') === p.answer.replace(/^0+(?=[01])/, '');
  }
}

/* ---------------- component ---------------- */

interface ReportRow {
  problem: string;
  mine: string;
  correct: string;
  verdict: string;
}

export function NumberSystemsLab(props: GameProps) {
  /* --- converter state --- */
  const [convMode, setConvMode] = useState<'div' | 'weights' | 'group'>('div');
  const [decIn, setDecIn] = useState(45);
  const [divBase, setDivBase] = useState<Base>(2);
  const [reveal, setReveal] = useState(1);
  const [autoReveal, setAutoReveal] = useState(false);
  const [srcVal, setSrcVal] = useState('1101');
  const [srcBase, setSrcBase] = useState<2 | 8 | 16>(2);
  const [grpFrom, setGrpFrom] = useState<2 | 8 | 16>(2);
  const [grpTo, setGrpTo] = useState<2 | 8 | 16>(8);
  const [grpVal, setGrpVal] = useState('1101011');
  const revealTimer = useRef<number | null>(null);

  /* --- binary addition + two's complement state --- */
  const [addA, setAddA] = useState('01101010');
  const [addB, setAddB] = useState('01011100');
  const [twosN, setTwosN] = useState(45);

  /* --- practice state --- */
  const [problem, setProblem] = useState<Problem | null>(null);
  const [answerIn, setAnswerIn] = useState('');
  const [verdict, setVerdict] = useState<'none' | 'right' | 'wrong'>('none');
  const [tries, setTries] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [report, setReport] = useState<ReportRow[]>([]);

  /* --- derived (above effects) --- */
  const divRows = useMemo(() => decToBaseSteps(Math.max(0, Math.min(65535, Math.floor(decIn) || 0)), divBase), [decIn, divBase]);
  const divResult = useMemo(() => toBaseString(Math.max(0, Math.min(65535, Math.floor(decIn) || 0)), divBase), [decIn, divBase]);
  const srcOk = srcBase === 16 ? isHex(srcVal) : srcBase === 2 ? isBin(srcVal) : /^[0-7]+$/.test(srcVal.trim());
  const srcDecoded = useMemo(
    () => (srcOk ? digitsToDecSteps(srcVal, srcBase) : { rows: [] as WeightRow[], value: 0 }),
    [srcVal, srcBase, srcOk]
  );
  const grpOk = grpFrom === 16 ? isHex(grpVal) : grpFrom === 2 ? isBin(grpVal) : /^[0-7]+$/.test(grpVal.trim());
  const grpSteps = useMemo(
    () => (grpOk ? baseViaBinarySteps(grpVal, grpFrom, grpTo) : { expand: [], groups: [], result: '' }),
    [grpVal, grpFrom, grpTo, grpOk]
  );
  const addInputsOk = addA.length === 8 && addB.length === 8 && isBin(addA) && isBin(addB);
  const addRes = useMemo(
    () => (addInputsOk ? addBinary8(addA, addB) : { rows: [] as AddRow[], result: '', carryOut: 0 }),
    [addA, addB, addInputsOk]
  );
  const twos = useMemo(() => twosNegSteps(Math.max(1, Math.min(127, twosN))), [twosN]);

  /* --- auto reveal timer (cleaned up on every change + unmount) --- */
  useEffect(() => {
    if (!autoReveal) return;
    const id = window.setInterval(() => {
      const next = Math.min(reveal + 1, divRows.length);
      setReveal(next);
      // Stop auto-reveal from inside the timer callback (async, never in the
      // effect body) once every division row is on screen.
      if (next >= divRows.length) setAutoReveal(false);
    }, 700);
    revealTimer.current = id;
    return () => {
      window.clearInterval(id);
      revealTimer.current = null;
    };
  }, [autoReveal, reveal, divRows.length]);

  function randomizeAddends() {
    setAddA(toBaseString(randInt(20, 120), 2).padStart(8, '0'));
    setAddB(toBaseString(randInt(20, 120), 2).padStart(8, '0'));
  }

  function newProblem() {
    setProblem(makeProblem());
    setAnswerIn('');
    setVerdict('none');
    setTries(0);
  }

  function submitAnswer() {
    if (!problem) return;
    const ok = checkAnswer(problem, answerIn);
    setVerdict(ok ? 'right' : 'wrong');
    setTries((t) => t + 1);
    setReport((rows) => [
      ...rows,
      {
        problem: KIND_LABEL[problem.kind] + ': ' + problem.prompt,
        mine: answerIn.trim() || '(blank)',
        correct: problem.answer,
        verdict: ok ? 'Correct' : 'Not yet',
      },
    ]);
    if (ok) {
      const next = correctCount + 1;
      setCorrectCount(next);
      if (next >= 5) props.onWin();
    }
  }

  return (
    <GameShell
      title="Number Systems Lab"
      blurb="Convert between decimal, binary, octal and hexadecimal with every step shown, add binary numbers column-by-column, and practise until five problems are correct."
      modelNote="All arithmetic here is exact integer arithmetic on non-negative values up to 65535; two's complement is shown for 8-bit words, the size used for a byte in the NCERT text."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <ChapterRef
        subject="Computer Science"
        chapter="Ch 2 — Encoding Schemes and Number System"
        topic="Binary, octal, hexadecimal, two's complement"
      />

      {/* ---------- converter ---------- */}
      <section className="mt-4 rounded-2xl border border-border bg-background/50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Divide className="size-4" aria-hidden="true" /> Step-by-step converter
        </h3>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Converter mode">
          {(
            [
              ['div', 'Decimal → base (division)'],
              ['weights', 'Base → decimal (weights)'],
              ['group', 'Grouping (binary ↔ octal ↔ hex)'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setConvMode(m)}
              aria-pressed={convMode === m}
              className={cn(
                'press inline-flex min-h-[44px] items-center rounded-xl border px-3 text-sm font-medium',
                convMode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {convMode === 'div' && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                <span>
                  Decimal number: <b className="tabular-nums">{decIn}</b>
                </span>
                <input
                  type="range"
                  min={0}
                  max={255}
                  step={1}
                  value={Math.min(255, decIn)}
                  onChange={(e) => {
                    setDecIn(Number(e.target.value));
                    setReveal(1);
                    setAutoReveal(false);
                  }}
                  className="press min-h-[44px] w-full accent-primary"
                  aria-label={`Decimal number to convert, currently ${decIn}`}
                />
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Target base">
                {BASES.map((b) => (
                  <button
                    key={b}
                    onClick={() => setDivBase(b)}
                    aria-pressed={divBase === b}
                    className={cn(
                      'press inline-flex min-h-[44px] items-center rounded-xl border px-3 text-sm font-medium',
                      divBase === b ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10'
                    )}
                  >
                    base {b}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
                  onClick={() => setReveal((r) => Math.min(r + 1, divRows.length))}
                >
                  Reveal next step
                </button>
                <button
                  className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
                  onClick={() => setAutoReveal(true)}
                >
                  Auto-reveal all
                </button>
                <button
                  className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
                  onClick={() => {
                    setReveal(1);
                    setAutoReveal(false);
                  }}
                >
                  <RefreshCw className="size-4" aria-hidden="true" /> Restart
                </button>
              </div>
              <p className="rounded-xl bg-primary/5 p-3 text-sm tabular-nums">
                {decIn} in base {divBase} = <b>{divResult}</b> ({divResult.length} digits)
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Repeated division: keep dividing by {divBase} until the quotient is 0; the remainders read bottom-up are the
                answer.
              </p>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border">
                <table className="w-full text-sm tabular-nums">
                  <caption className="sr-only">Repeated division working for {decIn} to base {divBase}</caption>
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th scope="col" className="px-2 py-1.5 font-semibold">Division</th>
                      <th scope="col" className="px-2 py-1.5 font-semibold">Quotient</th>
                      <th scope="col" className="px-2 py-1.5 font-semibold">Remainder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {divRows.map((r, i) => (
                      <tr
                        key={i}
                        className={cn(
                          'border-b border-border/60 last:border-0 transition-opacity',
                          i < reveal ? 'opacity-100' : 'opacity-25'
                        )}
                      >
                        <td className="px-2 py-1.5">{r.dividend} / {divBase}</td>
                        <td className="px-2 py-1.5">{r.quotient}</td>
                        <td className="px-2 py-1.5 font-bold text-primary">{r.remainder} → {r.digit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {convMode === 'weights' && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                <span>Value in the chosen base:</span>
                <input
                  type="text"
                  value={srcVal}
                  onChange={(e) => setSrcVal(e.target.value)}
                  className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 font-mono text-sm"
                  aria-label={`Value to convert to decimal, in base ${srcBase}`}
                />
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Source base">
                {([2, 8, 16] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setSrcBase(b)}
                    aria-pressed={srcBase === b}
                    className={cn(
                      'press inline-flex min-h-[44px] items-center rounded-xl border px-3 text-sm font-medium',
                      srcBase === b ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10'
                    )}
                  >
                    base {b}
                  </button>
                ))}
              </div>
              <p
                role="status"
                aria-live="polite"
                className={cn('text-sm font-semibold tabular-nums', srcOk ? 'text-emerald-600' : 'text-amber-600')}
              >
                {srcOk ? (
                  <>
                    <Equal className="mr-1 inline size-4" aria-hidden="true" />
                    {srcVal.trim().toUpperCase()} (base {srcBase}) = {srcDecoded.value} in decimal
                  </>
                ) : (
                  `That is not a valid base ${srcBase} number.`
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Each digit is multiplied by its positional weight (base to the power of its place), then the products are
                added.
              </p>
              {srcOk && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border">
                  <table className="w-full text-sm tabular-nums">
                    <caption className="sr-only">Positional weights for {srcVal}</caption>
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th scope="col" className="px-2 py-1.5 font-semibold">Digit</th>
                        <th scope="col" className="px-2 py-1.5 font-semibold">Weight</th>
                        <th scope="col" className="px-2 py-1.5 font-semibold">Product</th>
                      </tr>
                    </thead>
                    <tbody>
                      {srcDecoded.rows.map((r, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                          <td className="px-2 py-1.5">{r.digit} (value {r.value})</td>
                          <td className="px-2 py-1.5">{r.weight}</td>
                          <td className="px-2 py-1.5 font-bold text-primary">{r.product}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="px-2 py-1.5 font-semibold" colSpan={2}>Sum</td>
                        <td className="px-2 py-1.5 font-bold text-emerald-600">{srcDecoded.value}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {convMode === 'group' && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                <span>Value to regroup:</span>
                <input
                  type="text"
                  value={grpVal}
                  onChange={(e) => setGrpVal(e.target.value)}
                  className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 font-mono text-sm"
                  aria-label={`Value to regroup, in base ${grpFrom}`}
                />
              </label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Source base for grouping">
                {([2, 8, 16] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setGrpFrom(b)}
                    aria-pressed={grpFrom === b}
                    className={cn(
                      'press inline-flex min-h-[44px] items-center rounded-xl border px-3 text-sm font-medium',
                      grpFrom === b ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10'
                    )}
                  >
                    from {b}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Target base for grouping">
                {([2, 8, 16] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setGrpTo(b)}
                    aria-pressed={grpTo === b}
                    className={cn(
                      'press inline-flex min-h-[44px] items-center rounded-xl border px-3 text-sm font-medium',
                      grpTo === b ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10'
                    )}
                  >
                    to {b}
                  </button>
                ))}
              </div>
              <p
                role="status"
                aria-live="polite"
                className={cn('text-sm font-semibold tabular-nums', grpOk ? 'text-emerald-600' : 'text-amber-600')}
              >
                {grpOk ? (
                  <>
                    {grpVal.trim().toUpperCase()} (base {grpFrom}) = <b>{grpSteps.result}</b> in base {grpTo}
                  </>
                ) : (
                  `That is not a valid base ${grpFrom} number.`
                )}
              </p>
            </div>
            <div className="text-sm">
              <p className="text-xs text-muted-foreground">
                Route through binary: 3 bits make one octal digit, 4 bits make one hexadecimal digit. Leading zeros pad the
                leftmost group.
              </p>
              {grpOk && (
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border p-3 font-mono text-sm">
                  {grpSteps.expand.map((line, i) => (
                    <p key={i} className="tabular-nums">{line}</p>
                  ))}
                  {grpSteps.groups.length > 0 && (
                    <>
                      <p className="mt-2 text-muted-foreground">Groups of {grpTo === 8 ? 3 : 4} bits:</p>
                      {grpSteps.groups.map((g, i) => (
                        <p key={i} className="tabular-nums">
                          {g} → {groupToDigit(g, grpTo as 8 | 16)}
                        </p>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ---------- binary addition + two's complement ---------- */}
      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background/50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <PlusCircle className="size-4" aria-hidden="true" /> 8-bit binary addition
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Operand A</span>
              <input
                type="text"
                value={addA}
                onChange={(e) => setAddA(e.target.value)}
                className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 font-mono text-sm"
                aria-label="First 8-bit binary operand"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>Operand B</span>
              <input
                type="text"
                value={addB}
                onChange={(e) => setAddB(e.target.value)}
                className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 font-mono text-sm"
                aria-label="Second 8-bit binary operand"
              />
            </label>
          </div>
          <button
            className="press mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
            onClick={randomizeAddends}
          >
            <Sparkles className="size-4" aria-hidden="true" /> Random operands
          </button>
          <p
            role="status"
            aria-live="polite"
            className={cn('mt-2 text-sm font-semibold tabular-nums', addInputsOk ? 'text-emerald-600' : 'text-amber-600')}
          >
            {addInputsOk
              ? `${addA} + ${addB} = ${addRes.result}${addRes.carryOut ? ` with a final carry of 1 (needs 9 bits)` : ''}`
              : 'Both operands must be exactly 8 bits of 0 and 1.'}
          </p>
          {addInputsOk && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-sm tabular-nums">
                <caption className="sr-only">Column-by-column binary addition with carries</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="px-2 py-1.5 font-semibold">Pos</th>
                    <th scope="col" className="px-2 py-1.5 font-semibold">Carry in</th>
                    <th scope="col" className="px-2 py-1.5 font-semibold">A</th>
                    <th scope="col" className="px-2 py-1.5 font-semibold">B</th>
                    <th scope="col" className="px-2 py-1.5 font-semibold">Sum</th>
                    <th scope="col" className="px-2 py-1.5 font-semibold">Carry out</th>
                  </tr>
                </thead>
                <tbody>
                  {addRes.rows.map((r) => (
                    <tr key={r.pos} className="border-b border-border/60 last:border-0">
                      <td className="px-2 py-1.5">{r.pos}</td>
                      <td className="px-2 py-1.5">{r.carryIn}</td>
                      <td className="px-2 py-1.5">{r.a}</td>
                      <td className="px-2 py-1.5">{r.b}</td>
                      <td className="px-2 py-1.5 font-bold text-primary">{r.sum}</td>
                      <td className="px-2 py-1.5">{r.carryOut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-background/50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Binary className="size-4" aria-hidden="true" /> Two&apos;s complement negation (8-bit)
          </h3>
          <label className="mt-3 flex flex-col gap-1.5 text-sm font-medium">
            <span>
              Number to negate: <b className="tabular-nums">{twosN}</b>
            </span>
            <input
              type="range"
              min={1}
              max={127}
              step={1}
              value={twosN}
              onChange={(e) => setTwosN(Number(e.target.value))}
              className="press min-h-[44px] w-full accent-primary"
              aria-label={`Number to negate, currently ${twosN}`}
            />
          </label>
          <p className="mt-2 text-sm text-muted-foreground">Rule: invert every bit of +{twosN}, then add 1.</p>
          <div className="mt-2 rounded-xl border border-border p-3 font-mono text-sm">
            <p className="tabular-nums">
              +{twosN} = <b>{twos.bits}</b>
            </p>
            <p className="mt-1 tabular-nums">
              invert → <b>{twos.inverted}</b>
            </p>
            <p className="mt-1 tabular-nums">
              {twos.inverted} + 00000001 = <b className="text-primary">{twos.result}</b>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              So −{twosN} is stored as {twos.result}. Check: adding {twos.bits} and {twos.result} gives 100000000 — the 1
              overflows the byte and the byte reads 00000000.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- practice ---------- */}
      <section className="mt-4 rounded-2xl border border-border bg-background/50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <ListChecks className="size-4" aria-hidden="true" /> Practice: 5 correct answers wins
        </h3>
        <div className="mt-3">
          <PredictFirst
            key="ns-predict"
            prompt="how many division steps will converting 45 to binary take?"
            options={[
              { label: '5 steps' },
              { label: '6 steps', correct: true },
              { label: '7 steps' },
            ]}
            explain="45 → 22 → 11 → 5 → 2 → 1 → 0: six divisions, so six remainders — 45 = 101101 in binary."
            className="max-w-2xl"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
            onClick={newProblem}
          >
            {problem ? 'New problem' : 'Start practising'}
          </button>
          <span className="text-sm text-muted-foreground tabular-nums">Correct: {correctCount}/5</span>
        </div>
        {problem && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold">{problem.prompt}</p>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                <span>Your answer</span>
                <input
                  type="text"
                  value={answerIn}
                  onChange={(e) => setAnswerIn(e.target.value)}
                  disabled={verdict === 'right'}
                  className="press min-h-[44px] w-full rounded-xl border border-border bg-card px-3 font-mono text-sm"
                  aria-label="Your answer to the practice problem"
                />
              </label>
              <button
                className="press inline-flex min-h-[44px] items-center self-start rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
                onClick={submitAnswer}
                disabled={verdict === 'right' || answerIn.trim().length === 0}
              >
                Check answer
              </button>
              <p
                role="status"
                aria-live="polite"
                className={cn(
                  'text-sm font-semibold',
                  verdict === 'right' && 'text-emerald-600',
                  verdict === 'wrong' && 'text-amber-600'
                )}
              >
                {verdict === 'none' && 'Type your answer and check it — the full working appears after you answer.'}
                {verdict === 'right' && 'Correct! The full working is on the right.'}
                {verdict === 'wrong' && `Not yet (try ${tries}). Compare with the working on the right, then take a new problem.`}
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-3 font-mono text-xs">
              {verdict === 'none' ? (
                <p className="text-muted-foreground">Working appears here after you answer.</p>
              ) : (
                problem.working.map((line, i) => (
                  <p key={i} className="tabular-nums">{line}</p>
                ))
              )}
            </div>
          </div>
        )}
        {correctCount >= 5 && (
          <p className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
            Five problems correct — you can move between number systems fluently now.
          </p>
        )}
        <div className="mt-4">
          <LabReport
            title="Practice report"
            columns={['Problem', 'My answer', 'Correct', 'Verdict']}
            rows={report.map((r) => [r.problem, r.mine, r.correct, r.verdict])}
            note="One row per submitted answer. Leading zeros are accepted where the column width allows them."
            className="max-w-3xl"
          />
        </div>
      </section>
    </GameShell>
  );
}
