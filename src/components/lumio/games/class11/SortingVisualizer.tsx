'use client';

import { useEffect, useMemo, useState } from 'react';
import { Play, Pause, StepForward, RotateCcw, Dices, BarChart3, Search, Trophy, ListOrdered } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { cn } from '@/lib/utils';

/**
 * Sorting Visualizer: bubble / selection / insertion sort and linear /
 * binary search on an 8-16 value bar chart. The full step list is precomputed
 * from the chosen algorithm and data, then played back with a timer, so every
 * counter (comparisons, swaps, probes) is exact and every observation
 * challenge has a verifiable answer.
 */

type SortMode = 'bubble' | 'selection' | 'insertion';
type SearchMode = 'linear' | 'binary';
type Mode = SortMode | SearchMode;

type Step =
  | { k: 'compare'; i: number; j: number }
  | { k: 'swap'; i: number; j: number }
  | { k: 'mark'; i: number }
  | { k: 'probe'; i: number };

interface Run {
  steps: Step[];
  states: number[][];
  marked: boolean[][];
  comparisons: number[];
  swaps: number[];
  probes: number[];
  totalComparisons: number;
  totalSwaps: number;
  totalProbes: number;
  foundIndex: number;
}

class Recorder {
  a: number[];
  steps: Step[] = [];
  states: number[][] = [];
  marked: boolean[][] = [];
  comparisons: number[] = [];
  swaps: number[] = [];
  probes: number[] = [];
  comps = 0;
  swps = 0;
  prb = 0;
  marks: boolean[];

  constructor(data: number[]) {
    this.a = [...data];
    this.marks = data.map(() => false);
    this.snapshot();
  }

  private snapshot(): void {
    this.states.push([...this.a]);
    this.marked.push([...this.marks]);
    this.comparisons.push(this.comps);
    this.swaps.push(this.swps);
    this.probes.push(this.prb);
  }

  push(s: Step): void {
    if (s.k === 'compare') this.comps++;
    else if (s.k === 'swap') {
      this.swps++;
      const t = this.a[s.i];
      this.a[s.i] = this.a[s.j];
      this.a[s.j] = t;
    } else if (s.k === 'mark') this.marks[s.i] = true;
    else if (s.k === 'probe') this.prb++;
    this.steps.push(s);
    this.snapshot();
  }

  finish(): Run {
    return {
      steps: this.steps,
      states: this.states,
      marked: this.marked,
      comparisons: this.comparisons,
      swaps: this.swaps,
      probes: this.probes,
      totalComparisons: this.comps,
      totalSwaps: this.swps,
      totalProbes: this.prb,
      foundIndex: -1,
    };
  }
}

function buildSortRun(mode: SortMode, data: number[]): Run {
  const rec = new Recorder(data);
  const n = data.length;
  if (mode === 'bubble') {
    for (let pass = 0; pass < n - 1; pass++) {
      let swapped = false;
      for (let j = 0; j < n - 1 - pass; j++) {
        rec.push({ k: 'compare', i: j, j: j + 1 });
        if (rec.a[j] > rec.a[j + 1]) {
          rec.push({ k: 'swap', i: j, j: j + 1 });
          swapped = true;
        }
      }
      rec.push({ k: 'mark', i: n - 1 - pass });
      if (!swapped) {
        for (let m = n - 2 - pass; m >= 0; m--) rec.push({ k: 'mark', i: m });
        break;
      }
    }
  } else if (mode === 'selection') {
    for (let i = 0; i < n - 1; i++) {
      let min = i;
      for (let j = i + 1; j < n; j++) {
        rec.push({ k: 'compare', i: min, j });
        if (rec.a[j] < rec.a[min]) min = j;
      }
      if (min !== i) rec.push({ k: 'swap', i, j: min });
      rec.push({ k: 'mark', i });
    }
    rec.push({ k: 'mark', i: n - 1 });
  } else {
    for (let i = 1; i < n; i++) {
      let hole = i;
      while (hole > 0) {
        rec.push({ k: 'compare', i: hole - 1, j: hole });
        if (rec.a[hole - 1] > rec.a[hole]) {
          rec.push({ k: 'swap', i: hole - 1, j: hole });
          hole--;
        } else break;
      }
      for (let m = 0; m <= i; m++) if (!rec.marks[m]) rec.push({ k: 'mark', i: m });
    }
  }
  for (let m = 0; m < n; m++) if (!rec.marks[m]) rec.push({ k: 'mark', i: m });
  return rec.finish();
}

function buildSearchRun(mode: SearchMode, data: number[], target: number): Run {
  const sorted = [...data].sort((x, y) => x - y);
  const rec = new Recorder(sorted);
  let found = -1;
  if (mode === 'linear') {
    for (let i = 0; i < sorted.length; i++) {
      rec.push({ k: 'probe', i });
      if (sorted[i] === target) {
        rec.push({ k: 'mark', i });
        found = i;
        break;
      }
    }
  } else {
    let lo = 0;
    let hi = sorted.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      rec.push({ k: 'probe', i: mid });
      if (sorted[mid] === target) {
        rec.push({ k: 'mark', i: mid });
        found = mid;
        break;
      }
      if (sorted[mid] < target) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  const run = rec.finish();
  return { ...run, foundIndex: found };
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function randomArray(): number[] {
  const n = 8 + Math.floor(Math.random() * 5); // 8..12 values
  return Array.from({ length: n }, () => 2 + Math.floor(Math.random() * 19)); // 2..20
}

const MODE_LABEL: Record<Mode, string> = {
  bubble: 'Bubble sort',
  selection: 'Selection sort',
  insertion: 'Insertion sort',
  linear: 'Linear search',
  binary: 'Binary search',
};

const SORT_MODES: Mode[] = ['bubble', 'selection', 'insertion', 'linear', 'binary'];

const CH1_ARRAY = [16, 14, 12, 10, 8, 6, 4, 2]; // reversed (worst case for bubble)
const CH2_ARRAY = [2, 4, 6, 8, 10, 12, 14, 16]; // already sorted
const CH2_TARGET = 10;

interface NumChallenge {
  loaded: boolean;
  answer: number;
  attempts: number;
  done: boolean;
  revealed: boolean;
  input: string;
}

const emptyNumChallenge: NumChallenge = { loaded: false, answer: 0, attempts: 0, done: false, revealed: false, input: '' };

interface ReportRow {
  challenge: string;
  mine: string;
  correct: string;
  verdict: string;
}

export function SortingVisualizerLab(props: GameProps) {
  const { won, onWin, onBack } = props;
  const [mode, setMode] = useState<Mode>('bubble');
  const [data, setData] = useState<number[]>([12, 5, 19, 3, 8, 15, 6, 10]);
  const [target, setTarget] = useState(10);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [customInput, setCustomInput] = useState('');
  const [status, setStatus] = useState('Pick an algorithm and press play, or step one comparison at a time.');
  const [statusOk, setStatusOk] = useState<boolean | null>(null);
  const [ch1, setCh1] = useState<NumChallenge>(emptyNumChallenge);
  const [ch2, setCh2] = useState<NumChallenge>(emptyNumChallenge);
  const [ch3, setCh3] = useState({ done: false, tries: 0, revealed: false });
  const [raceActive, setRaceActive] = useState(false);
  const [sharedData, setSharedData] = useState<number[]>([]);
  const [raceSwaps, setRaceSwaps] = useState<Partial<Record<SortMode, number>>>({});
  const [report, setReport] = useState<ReportRow[]>([]);

  /* --- derived (above all effects) --- */
  const isSearch = mode === 'linear' || mode === 'binary';
  const run = useMemo(
    () => (isSearch ? buildSearchRun(mode, data, target) : buildSortRun(mode, data)),
    [mode, data, target, isSearch]
  );
  const atStart = idx === 0;
  const atEnd = idx >= run.steps.length;
  const bars = run.states[Math.min(idx, run.states.length - 1)];
  const marks = run.marked[Math.min(idx, run.marked.length - 1)];
  const highlight = idx > 0 ? run.steps[idx - 1] : null;
  const liveComparisons = run.comparisons[Math.min(idx, run.comparisons.length - 1)];
  const liveSwaps = run.swaps[Math.min(idx, run.swaps.length - 1)];
  const liveProbes = run.probes[Math.min(idx, run.probes.length - 1)];
  const raceCount = (['bubble', 'selection', 'insertion'] as SortMode[]).filter((m) => raceSwaps[m] !== undefined).length;
  const raceWinner = useMemo(() => {
    const entries = (['bubble', 'selection', 'insertion'] as SortMode[])
      .filter((m) => raceSwaps[m] !== undefined)
      .map((m) => ({ mode: m, swaps: raceSwaps[m] as number }));
    if (entries.length < 3) return [];
    const min = Math.min(...entries.map((e) => e.swaps));
    return entries.filter((e) => e.swaps === min).map((e) => e.mode);
  }, [raceSwaps]);
  const allDone = ch1.done && ch2.done && ch3.done;

  /* --- race helper: record a finished sort on the shared race array.
       Takes the playhead index that just reached the end (the closure `idx`
       is stale inside timer callbacks). --- */
  function recordRaceSort(finishedIdx: number) {
    if (finishedIdx < run.steps.length) return;
    if (mode !== 'bubble' && mode !== 'selection' && mode !== 'insertion') return;
    if (!raceActive) return;
    if (!arraysEqual(data, sharedData)) return;
    setRaceSwaps((prev) => (prev[mode] === run.totalSwaps ? prev : { ...prev, [mode]: run.totalSwaps }));
  }

  /* --- playback timer (cleaned up on every change and unmount) --- */
  useEffect(() => {
    if (!playing) return;
    const delay = Math.max(100, 1050 - speed * 95);
    const last = run.steps.length;
    const id = window.setInterval(() => {
      if (idx >= last) {
        // Already at the end: stop auto-play from the timer callback (async,
        // never synchronously inside the effect body).
        setPlaying(false);
        return;
      }
      const next = idx + 1;
      setIdx(next);
      if (next >= last) {
        setPlaying(false);
        recordRaceSort(next);
      }
    }, delay);
    return () => window.clearInterval(id);
  }, [playing, speed, run, idx]);

  /** Manual step: advance one comparison and record a finished race sort. */
  function stepOnce() {
    const next = Math.min(idx + 1, run.steps.length);
    setIdx(next);
    if (next >= run.steps.length) recordRaceSort(next);
  }

  function say(msg: string, ok: boolean | null = null) {
    setStatus(msg);
    setStatusOk(ok);
  }

  /** Every scenario change resets playback in the same batched update. */
  function changeMode(m: Mode) {
    setMode(m);
    setIdx(0);
    setPlaying(false);
  }

  function changeTarget(n: number) {
    setTarget(n);
    setIdx(0);
    setPlaying(false);
  }

  function recordRow(challenge: string, mine: string, correct: string, verdict: string) {
    setReport((rows) => [...rows, { challenge, mine, correct, verdict }]);
  }

  function maybeWin(next: { ch1: boolean; ch2: boolean; ch3: boolean }) {
    if (next.ch1 && next.ch2 && next.ch3) onWin();
  }

  /* --- data controls --- */
  function applyRandom() {
    setData(randomArray());
    say('New random array loaded. Playback reset to the start.');
  }

  function applyCustom() {
    const parts = customInput.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    if (parts.length < 4 || parts.length > 16) {
      say('Enter between 4 and 16 comma-separated integers.', false);
      return;
    }
    const values: number[] = [];
    for (const p of parts) {
      const n = Number(p);
      if (!Number.isInteger(n) || n < 1 || n > 99) {
        say(`'${p}' is not an integer between 1 and 99.`, false);
        return;
      }
      values.push(n);
    }
    setData(values);
    say('Custom array loaded. Playback reset to the start.');
  }

  function loadCh1() {
    const expected = buildSortRun('bubble', CH1_ARRAY).totalComparisons;
    setCh1({ ...emptyNumChallenge, loaded: true, answer: expected });
    setData([...CH1_ARRAY]);
    setMode('bubble');
    say('Reversed array loaded with bubble sort. Run it to the end, count the amber comparisons, then answer.');
  }

  function loadCh2() {
    const expected = buildSearchRun('binary', CH2_ARRAY, CH2_TARGET).totalProbes;
    setCh2({ ...emptyNumChallenge, loaded: true, answer: expected });
    setData([...CH2_ARRAY]);
    setTarget(CH2_TARGET);
    setMode('binary');
    say('Sorted array loaded with binary search. Run it, count the probes, then answer.');
  }

  function startRace() {
    const arr = randomArray();
    setSharedData(arr);
    setData([...arr]);
    setMode('bubble');
    setRaceActive(true);
    setRaceSwaps({});
    say('Shared random array ready. Run bubble, selection AND insertion sort to the end on this exact array (switch the algorithm between runs), then answer the question.');
  }

  function submitNum(ch: NumChallenge, setter: (c: NumChallenge) => void, which: 1 | 2) {
    if (!ch.loaded || ch.done) return;
    const guess = Number(ch.input);
    if (!Number.isInteger(guess) || guess < 0) {
      say('Enter a whole number of 0 or more.', false);
      return;
    }
    const label = which === 1 ? '1. Bubble comparisons on the reversed array' : '2. Binary search probes for the target';
    if (guess === ch.answer) {
      setter({ ...ch, done: true });
      recordRow(label, String(guess), String(ch.answer), 'Correct');
      say(`Correct — the exact count is ${ch.answer}, verified from the precomputed steps.`, true);
      maybeWin({
        ch1: which === 1 ? true : ch1.done,
        ch2: which === 2 ? true : ch2.done,
        ch3: ch3.done,
      });
    } else {
      const attempts = ch.attempts + 1;
      const revealed = attempts >= 2;
      setter({ ...ch, attempts, revealed });
      recordRow(label, String(guess), String(ch.answer), revealed ? 'Revealed after 2 tries' : 'Not yet');
      say(
        revealed
          ? `Not quite. The exact count is ${ch.answer} — run the steps again and watch the counter to see why.`
          : `Not yet (try ${attempts}). Watch the counter during playback and try again.`,
        false
      );
    }
  }

  function answerRace(guess: SortMode) {
    if (ch3.done) return;
    if (raceCount < 3) {
      say(`Run all three sorts to the end on the shared array first — recorded ${raceCount}/3.`, false);
      return;
    }
    if (raceWinner.includes(guess)) {
      setCh3({ ...ch3, done: true });
      recordRow('3. Fewest swaps on the shared random data', MODE_LABEL[guess], raceWinner.map((m) => MODE_LABEL[m]).join(' or '), 'Correct');
      say(`Correct — ${MODE_LABEL[guess]} recorded ${raceSwaps[guess]} swaps, the fewest of the three runs.`, true);
      maybeWin({ ch1: ch1.done, ch2: ch2.done, ch3: true });
    } else {
      const tries = ch3.tries + 1;
      const revealed = tries >= 2;
      setCh3({ ...ch3, tries, revealed });
      recordRow('3. Fewest swaps on the shared random data', MODE_LABEL[guess], raceWinner.map((m) => MODE_LABEL[m]).join(' or '), revealed ? 'Revealed after 2 tries' : 'Not yet');
      say(
        revealed
          ? `Not quite. The fewest swaps came from ${raceWinner.map((m) => MODE_LABEL[m]).join(' and ')} — check the recorded counters.`
          : `Not yet (try ${tries}). Compare the recorded swap counters for the shared array.`,
        false
      );
    }
  }

  /* --- bar chart geometry --- */
  const W = 560;
  const H = 240;
  const maxVal = Math.max(...bars, 1);
  const slot = 520 / bars.length;
  const showLabels = bars.length <= 12;

  function stepDescription(s: Step | null): string {
    if (!s) return 'Ready.';
    if (s.k === 'compare') return `Comparing positions ${s.i} and ${s.j} (amber).`;
    if (s.k === 'swap') return `Swapping positions ${s.i} and ${s.j} (rose).`;
    if (s.k === 'mark') return `Position ${s.i} is in its final place (emerald).`;
    return `Probing position ${s.i} (primary).`;
  }

  return (
    <GameShell
      title="Sorting Visualizer Lab"
      blurb="Watch bubble, selection and insertion sort work bar by bar, probe with linear and binary search, then answer three observation challenges."
      modelNote="Bubble sort here exits early when a pass makes no swaps, so an already-sorted array costs only n-1 comparisons while this reversed array costs the full n(n-1)/2 — a best/worst-case discussion in one click. Binary search is only run on a sorted copy of the array (the lab sorts it for you) and every probe is counted honestly."
      xp={25}
      won={won}
      onBack={onBack}
    >
      <ChapterRef
        subject="Computer Science"
        chapter="Ch 4 — Introduction to Problem Solving"
        topic="Algorithms: sorting and searching"
      />

      <div className="mt-4">
        <PredictFirst
          key="sv-predict"
          prompt="binary search on 8 sorted values needs at most how many probes?"
          options={[
            { label: '3' },
            { label: '4', correct: true },
            { label: '8' },
          ]}
          explain="Each probe halves the range: 8 to 4 to 2 to 1, so 4 probes in the worst case."
          className="max-w-2xl"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* left: canvas + playback */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Algorithm">
            {SORT_MODES.map((m) => (
              <button
                key={m}
                onClick={() => changeMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  'press inline-flex min-h-[44px] items-center rounded-xl border px-3 text-sm font-medium',
                  mode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:bg-accent/10'
                )}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full rounded-xl border border-border bg-card"
            role="img"
            aria-label={`Bar chart with ${bars.length} values; ${MODE_LABEL[mode]} ${atEnd ? 'finished' : playing ? 'playing' : 'paused'} at step ${idx} of ${run.steps.length}`}
          >
            {bars.map((v, i) => {
              const isSwap = highlight?.k === 'swap' && (highlight.i === i || highlight.j === i);
              const isCompare = highlight?.k === 'compare' && (highlight.i === i || highlight.j === i);
              const isProbe = highlight?.k === 'probe' && highlight.i === i;
              const fillCls = isSwap
                ? 'fill-rose-500'
                : isCompare
                  ? 'fill-amber-400'
                  : isProbe
                    ? 'fill-primary'
                    : marks[i]
                      ? 'fill-emerald-500'
                      : 'fill-primary/30';
              const h = (v / maxVal) * 190;
              const x = 20 + i * slot;
              return (
                <g key={i}>
                  <rect x={x + 2} y={220 - h} width={Math.max(6, slot - 4)} height={h} rx="3" className={cn(fillCls, 'stroke-foreground/20')} />
                  {showLabels && (
                    <text x={x + slot / 2} y={214 - h} textAnchor="middle" fontSize="10" className="fill-foreground tabular-nums">
                      {v}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <p className="text-sm text-muted-foreground">{stepDescription(highlight)}</p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (playing) setPlaying(false);
                else if (!atEnd) setPlaying(true);
              }}
              disabled={!playing && atEnd}
              className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10 disabled:opacity-50"
            >
              {playing ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={stepOnce}
              disabled={atEnd}
              className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10 disabled:opacity-50"
            >
              <StepForward className="size-4" aria-hidden="true" /> Step
            </button>
            <button
              onClick={() => {
                setIdx(0);
                setPlaying(false);
              }}
              className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
            >
              <RotateCcw className="size-4" aria-hidden="true" /> Reset
            </button>
            <label className="flex min-w-[220px] flex-1 items-center gap-2 text-sm font-medium">
              <span className="shrink-0">Speed: <b className="tabular-nums">{speed}</b></span>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Playback speed, currently ${speed} of 10`}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-4 text-sm tabular-nums">
            <span>Comparisons: <b>{liveComparisons}</b></span>
            <span>Swaps: <b>{liveSwaps}</b></span>
            {isSearch && <span>Probes: <b>{liveProbes}</b></span>}
            <span className="text-muted-foreground">step {idx}/{run.steps.length}</span>
          </div>

          <p
            role="status"
            aria-live="polite"
            className={cn('text-sm font-semibold', statusOk === true && 'text-emerald-600', statusOk === false && 'text-amber-600', statusOk === null && 'text-muted-foreground')}
          >
            {status ||
              (isSearch && atEnd
                ? run.foundIndex >= 0
                  ? `Target ${target} found at index ${run.foundIndex} after ${run.totalProbes} probes.`
                  : `Target ${target} is not in the array — ${run.totalProbes} probes used.`
                : '')}
          </p>

          {atEnd && isSearch && (
            <p className="text-sm tabular-nums">
              {run.foundIndex >= 0
                ? `Target ${target} found at index ${run.foundIndex} after ${run.totalProbes} probes.`
                : `Target ${target} is not in the array — ${run.totalProbes} probes used.`}
            </p>
          )}
          {atEnd && !isSearch && (
            <p className="text-sm tabular-nums">
              Sorted in {run.totalComparisons} comparisons and {run.totalSwaps} swaps.
            </p>
          )}

          {/* data controls */}
          <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <button
                onClick={applyRandom}
                className="press inline-flex min-h-[44px] items-center gap-1.5 self-start rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
              >
                <Dices className="size-4" aria-hidden="true" /> Random array
              </button>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                <span>Custom array (4-16 integers, comma-separated)</span>
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="e.g. 12, 5, 9, 20, 3, 7"
                  className="press min-h-[44px] w-full rounded-xl border border-border bg-background/50 px-3 text-sm"
                  aria-label="Custom array input, comma-separated integers"
                />
              </label>
              <button
                onClick={applyCustom}
                className="press inline-flex min-h-[44px] items-center self-start rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
              >
                Apply custom array
              </button>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              <span>
                Search target (search modes): <b className="tabular-nums">{target}</b>
              </span>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={Math.min(30, target)}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="press min-h-[44px] w-full accent-primary"
                aria-label={`Search target, currently ${target}`}
              />
              <span className="text-xs text-muted-foreground">
                Search modes sort a copy of the array ascending first; a target that is missing is handled honestly with a not-found result.
              </span>
            </label>
          </div>
        </div>

        {/* right: challenges + report */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Trophy className="size-4" aria-hidden="true" /> Observation challenges (win = 3 correct)
            </h3>

            {/* challenge 1 */}
            <div className={cn('mt-3 rounded-xl border p-3 text-sm', ch1.done ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-card')}>
              <p className="font-semibold">1. How many comparisons will bubble sort need for the exact reversed array below?</p>
              <p className="mt-1 font-mono text-xs">{CH1_ARRAY.join(', ')}</p>
              <button
                onClick={loadCh1}
                className="press mt-2 inline-flex min-h-[44px] items-center rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
              >
                <ListOrdered className="size-4" aria-hidden="true" /> Load reversed array + bubble sort
              </button>
              {ch1.loaded && !ch1.done && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={ch1.input}
                    onChange={(e) => setCh1({ ...ch1, input: e.target.value })}
                    className="press min-h-[44px] w-28 rounded-xl border border-border bg-background/50 px-3 text-sm tabular-nums"
                    aria-label="Your answer: number of bubble sort comparisons on the reversed array"
                  />
                  <button
                    onClick={() => submitNum(ch1, (c) => setCh1(c), 1)}
                    className="press inline-flex min-h-[44px] items-center rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
                  >
                    Check
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums">tries: {ch1.attempts}</span>
                </div>
              )}
              {ch1.revealed && !ch1.done && <p className="mt-2 text-xs text-amber-600">Correct count: {ch1.answer}.</p>}
              {ch1.done && <p className="mt-2 text-sm font-semibold text-emerald-600">Done — {ch1.answer} comparisons, verified from the precomputed steps.</p>}
            </div>

            {/* challenge 2 */}
            <div className={cn('mt-3 rounded-xl border p-3 text-sm', ch2.done ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-card')}>
              <p className="font-semibold">2. How many probes will binary search make for target {CH2_TARGET} in this array?</p>
              <p className="mt-1 font-mono text-xs">{CH2_ARRAY.join(', ')}</p>
              <button
                onClick={loadCh2}
                className="press mt-2 inline-flex min-h-[44px] items-center rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
              >
                <Search className="size-4" aria-hidden="true" /> Load sorted array + binary search
              </button>
              {ch2.loaded && !ch2.done && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={ch2.input}
                    onChange={(e) => setCh2({ ...ch2, input: e.target.value })}
                    className="press min-h-[44px] w-28 rounded-xl border border-border bg-background/50 px-3 text-sm tabular-nums"
                    aria-label="Your answer: number of binary search probes for the target"
                  />
                  <button
                    onClick={() => submitNum(ch2, (c) => setCh2(c), 2)}
                    className="press inline-flex min-h-[44px] items-center rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
                  >
                    Check
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums">tries: {ch2.attempts}</span>
                </div>
              )}
              {ch2.revealed && !ch2.done && <p className="mt-2 text-xs text-amber-600">Correct count: {ch2.answer}.</p>}
              {ch2.done && <p className="mt-2 text-sm font-semibold text-emerald-600">Done — {ch2.answer} probes, verified from the precomputed steps.</p>}
            </div>

            {/* challenge 3 */}
            <div className={cn('mt-3 rounded-xl border p-3 text-sm', ch3.done ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-card')}>
              <p className="font-semibold">3. Which sort made the fewest swaps on the shared random data?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Run bubble, selection AND insertion sort to the end on the same shared random array, then answer. The lab verifies against its recorded counters.
              </p>
              <button
                onClick={startRace}
                className="press mt-2 inline-flex min-h-[44px] items-center rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
              >
                <BarChart3 className="size-4" aria-hidden="true" /> Start the swap race with a fresh random array
              </button>
              {raceActive && (
                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                  Recorded swap totals — bubble: {raceSwaps.bubble ?? 'not run'}, selection: {raceSwaps.selection ?? 'not run'}, insertion: {raceSwaps.insertion ?? 'not run'} ({raceCount}/3 recorded)
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {(['bubble', 'selection', 'insertion'] as SortMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => answerRace(m)}
                    disabled={ch3.done || !raceActive}
                    className="press inline-flex min-h-[44px] items-center rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10 disabled:opacity-50"
                  >
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
              {ch3.revealed && !ch3.done && (
                <p className="mt-2 text-xs text-amber-600">
                  The fewest swaps came from {raceWinner.map((m) => MODE_LABEL[m]).join(' and ')}.
                </p>
              )}
              {ch3.done && <p className="mt-2 text-sm font-semibold text-emerald-600">Done — graded against the honestly recorded counters.</p>}
            </div>

            {allDone && (
              <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
                Three observation challenges correct — you can now predict sorting behaviour before you run it.
              </p>
            )}
          </div>

          <LabReport
            title="Observation report"
            columns={['Challenge', 'My answer', 'Correct', 'Verdict']}
            rows={report.map((r) => [r.challenge, r.mine, r.correct, r.verdict])}
            note="Counts are computed from the same precomputed step lists the animation plays, so they are always verifiable."
          />
        </div>
      </div>
    </GameShell>
  );
}
