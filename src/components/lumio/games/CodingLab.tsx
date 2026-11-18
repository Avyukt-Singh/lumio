'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  Check,
  X,
  Play,
  RotateCcw,
  Lightbulb,
  Loader2,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GameShell, type GameProps } from './GameShell';
import { CODING_EXERCISES } from '@/lib/lumio/content';
import { aiApi, type AiApiCode } from '@/lib/lumio/aiClient';
import { t, type UiLang } from '@/lib/lumio/i18n';
import { AiLabel, AiMarkdown, aiErrKey } from '../ai/AiMarkdown';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types (no `any` anywhere; harness output is unknown until narrowed)
// ---------------------------------------------------------------------------

/** One per-test outcome, exactly what the Python harness returns. */
interface TestResult {
  pass: boolean;
  got: string;
  expected: string;
  error?: string;
}

/** Minimal Pyodide surface we rely on (kept honest and narrow). */
interface PyodideInterface {
  runPython: (code: string) => unknown;
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: { set: (key: string, value: unknown) => void };
  setStdout: (options: { batched?: (line: string) => void }) => void;
}
type LoadPyodideFn = (options?: { indexURL?: string }) => Promise<PyodideInterface>;

function getPyodideLoader(): LoadPyodideFn | undefined {
  return (window as unknown as { loadPyodide?: LoadPyodideFn }).loadPyodide;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const EXERCISES = CODING_EXERCISES;
const DRAFTS_KEY = 'lumio-code-drafts';
const PYODIDE_SCRIPT_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const PY_TIMEOUT_MS = 3000;

const PY_FAIL_MESSAGE =
  'Python needs to download its runtime (Pyodide) once — it looks like this device is offline right now.';
const PY_TIMEOUT_MESSAGE =
  'Your Python code took longer than 3 seconds — check for a very slow or infinite loop.';

/**
 * Progressive hint ladders, 3 levels each. The "Debug:" ladders (average /
 * max_of / total_even) are ported from the prototype's EXH map in lumio.html
 * (translated to Python); the others follow each exercise's intent.
 */
const HINTS: Record<string, string[]> = {
  is_even: [
    'Run the tests and read the result. Is it True or False?',
    'In Python, % gives the remainder: 4 % 2 is 0, so even numbers have n % 2 == 0.',
    'return n % 2 == 0',
  ],
  sum_list: [
    'Run it and read the result. What does the empty-list test expect? Zero.',
    'Start a total at 0 and add every number in the list with a loop.',
    'total = 0; for n in nums: total += n — then return total.',
  ],
  reverse_text: [
    'What should reverse_text("") return? The empty string.',
    'A string is a sequence: list(s) gives its characters, and "".join(...) glues them back together.',
    'return s[::-1]',
  ],
  count_vowels: [
    'Run the tests and see which one fails first.',
    'Lowercase the text first (text.lower()), then check each character against the vowels "aeiou".',
    'return sum(1 for ch in text.lower() if ch in "aeiou")',
  ],
  factorial: [
    'What should factorial(0) return? The tests say 1.',
    'Start a result at 1 and multiply it by every number from 1 up to and including n.',
    'result = 1; for i in range(1, n + 1): result *= i — then return result.',
  ],
  average: [
    'Run it and read the error. The last valid index is len(nums) − 1.',
    'range(len(nums) + 1) goes one step too far: nums[3] does not exist when there are only 3 numbers.',
    'Use range(len(nums)) instead.',
  ],
  max_of: [
    'Try the second test by hand: all numbers are negative.',
    'What is best at the start? Is 0 bigger than every number in that list?',
    'Start with best = nums[0] instead of 0.',
  ],
  total_even: [
    'Run the tests and see which one fails first.',
    'Your loop adds every number. Which numbers should it skip?',
    'Add an if check: if n % 2 == 0: before adding.',
  ],
};

// ---------------------------------------------------------------------------
// Python harness (runs inside Pyodide on the main thread). The learner's code
// is executed first so it defines the function, then this harness calls it
// once per test, compares with ==, and returns a JSON string we parse here.
// ---------------------------------------------------------------------------

function pythonHarness(fnName: string): string {
  return [
    'import json',
    '_lumio_in = json.loads(_lumio_tests_json)',
    '_lumio_out = []',
    'for _args, _expected in _lumio_in:',
    '    try:',
    '        _got = ' + fnName + '(*_args)',
    '        _lumio_out.append({"pass": bool(_got == _expected), "got": repr(_got), "expected": repr(_expected)})',
    '    except Exception as _e:',
    '        _lumio_out.append({"pass": False, "got": "threw an error: " + str(_e), "expected": repr(_expected)})',
    'json.dumps(_lumio_out)',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Narrowing helpers (strict TS: everything crossing a boundary is unknown)
// ---------------------------------------------------------------------------

function isTestResult(v: unknown): v is TestResult {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.pass !== 'boolean') return false;
  if (typeof o.got !== 'string' || typeof o.expected !== 'string') return false;
  if (o.error !== undefined && typeof o.error !== 'string') return false;
  return true;
}

type PyStatus = 'idle' | 'loading' | 'ready' | 'failed';
type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; results: TestResult[]; durationMs: number };

interface CheckFeedback {
  kind: 'info' | 'fail' | 'success';
  text: string;
}

// ---------------------------------------------------------------------------
// CodingLabGame
// ---------------------------------------------------------------------------

export function CodingLabGame(props: GameProps) {
  const lang: UiLang = props.lang ?? 'en';
  // ---- plain state ----
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Saved drafts restore via a lazy initialiser (no setState in effects).
  // This screen only mounts client-side after the app's hydration gate, so
  // localStorage is safe to read during the first render.
  function loadDrafts(): Record<string, string> {
    try {
      const raw = window.localStorage.getItem(DRAFTS_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
    } catch {
      // Corrupt or missing storage: start fresh with starters. Honest default.
    }
    return {};
  }
  const [drafts, setDrafts] = useState<Record<string, string>>(loadDrafts);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [hintsShown, setHintsShown] = useState(0);
  const [run, setRun] = useState<RunState>({ kind: 'idle' });
  const [printOutput, setPrintOutput] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [pyStatus, setPyStatus] = useState<PyStatus>('idle');
  // ---- chunk 5B Tier 2: AI nudge (per-exercise session cache; explains only, never XP) ----
  const [nudges, setNudges] = useState<Record<string, string>>({});
  const [nudgeState, setNudgeState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [nudgeErr, setNudgeErr] = useState<AiApiCode | null>(null);

  // ---- refs for cleanup ----
  const pyTimerRef = useRef<number | null>(null);
  const pyodideRef = useRef<PyodideInterface | null>(null);
  const pyLoadingRef = useRef(false); // guards double-start across re-renders
  const pyUnmountedRef = useRef(false);

  // ---- derivations (consts ABOVE all effects, per project rule) ----
  const ex = EXERCISES[selectedIndex];
  const isPython = ex.lang === 'py';
  const code = drafts[ex.id] ?? ex.starter;
  const hints = HINTS[ex.id] ?? [];
  const passCount =
    run.kind === 'done' ? run.results.filter((r) => r.pass).length : 0;
  const summary =
    run.kind === 'done'
      ? `${passCount} of ${run.results.length} tests pass`
      : run.kind === 'running'
        ? 'Running…'
        : run.kind === 'error'
          ? 'Could not run the tests'
          : 'Press “Run tests” to check your code.';

  // ---- effects ----

  // Persist drafts whenever they change (skip the initial empty state so we
  // never wipe saved work before it has loaded).
  useEffect(() => {
    if (Object.keys(drafts).length === 0) return;
    try {
      window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    } catch {
      // Storage may be unavailable (private mode); the app still works.
    }
  }, [drafts]);

  // Lazily load Pyodide ONLY when a Python exercise is first opened. The
  // start is guarded by a ref (not pyStatus state) so a re-render can never
  // cancel an in-flight load; the status change runs in a microtask so no
  // setState happens synchronously inside the effect body.
  useEffect(() => {
    if (!isPython || pyLoadingRef.current) return;
    pyLoadingRef.current = true;
    queueMicrotask(() => {
      setPyStatus('loading');

      const finish = () => {
        const load = getPyodideLoader();
        if (typeof load !== 'function') {
          setPyStatus('failed');
          return;
        }
        load({ indexURL: PYODIDE_INDEX_URL })
          .then((py) => {
            if (pyUnmountedRef.current) return;
            pyodideRef.current = py;
            setPyStatus('ready');
          })
          .catch(() => {
            if (pyUnmountedRef.current) return;
            setPyStatus('failed');
          });
      };

      const existing = document.querySelector(
        'script[data-lumio-pyodide]'
      ) as HTMLScriptElement | null;
      if (existing) {
        if (getPyodideLoader()) {
          finish();
        } else {
          existing.addEventListener('load', finish, { once: true });
          existing.addEventListener(
            'error',
            () => {
              if (!pyUnmountedRef.current) setPyStatus('failed');
            },
            { once: true }
          );
        }
      } else {
        const script = document.createElement('script');
        script.src = PYODIDE_SCRIPT_URL;
        script.async = true;
        script.dataset.lumioPyodide = 'true';
        script.addEventListener('load', finish, { once: true });
        script.addEventListener(
          'error',
          () => {
            if (!pyUnmountedRef.current) setPyStatus('failed');
          },
          { once: true }
        );
        document.head.appendChild(script);
      }
    });
  }, [isPython]);

  // Unmount cleanup: clear every timer.
  useEffect(() => {
    return () => {
      pyUnmountedRef.current = true;
      if (pyTimerRef.current !== null) window.clearTimeout(pyTimerRef.current);
    };
  }, []);

  // ---- handlers ----

  function selectExercise(i: number) {
    setSelectedIndex(i);
    setHintsShown(0);
    setRun({ kind: 'idle' });
    setPrintOutput(null);
    setCelebrate(null);
    setNudgeState('idle');
    setNudgeErr(null);
  }

  function editCode(ev: ChangeEvent<HTMLTextAreaElement>) {
    const value = ev.target.value;
    setDrafts((prev) => ({ ...prev, [ex.id]: value }));
  }

  function resetCode() {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[ex.id];
      return next;
    });
    setRun({ kind: 'idle' });
    setPrintOutput(null);
    setCelebrate(null);
  }

  /** Shared finish: record results, celebrate + onWin on first full pass. */
  function finishRun(results: TestResult[], durationMs: number) {
    setRun({ kind: 'done', results, durationMs });
    const allPass = results.length > 0 && results.every((r) => r.pass);
    if (allPass && !completed.has(ex.id)) {
      setCompleted((prev) => {
        const next = new Set(prev);
        next.add(ex.id);
        return next;
      });
      setCelebrate(
        `Brilliant — every test passes for “${ex.title}”. That is real code you wrote.`
      );
      props.onWin();
    } else if (allPass) {
      setCelebrate(`All tests still pass for “${ex.title}” — nice and clean.`);
    } else {
      setCelebrate(null);
    }
  }

  async function runPythonTests() {
    if (run.kind === 'running') return;
    if (pyStatus === 'failed') {
      setRun({ kind: 'error', message: PY_FAIL_MESSAGE });
      return;
    }
    const py = pyodideRef.current;
    if (pyStatus !== 'ready' || !py) {
      setRun({
        kind: 'error',
        message:
          'Python is still downloading its runtime (Pyodide). Give it a few seconds, then press “Run tests” again.',
      });
      return;
    }

    setRun({ kind: 'running' });
    setCelebrate(null);
    setPrintOutput(null);

    if (pyTimerRef.current !== null) window.clearTimeout(pyTimerRef.current);

    // Promise.race: the honest 3-second limit on the Python run.
    const exec = (async () => {
      const outs: string[] = [];
      py.setStdout({ batched: (line: string) => { outs.push(line); } });
      // 1) The learner's code defines the function (a syntax error here is
      //    reported honestly, never faked).
      py.runPython(code);
      // 2) The harness calls the function with each test's JSON-serialised
      //    args and compares with == inside Python.
      py.globals.set('_lumio_tests_json', JSON.stringify(ex.tests));
      const raw = await py.runPythonAsync(pythonHarness(ex.id));
      if (typeof raw !== 'string') {
        throw new Error('the test harness returned something unexpected');
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(isTestResult)) {
        throw new Error('the test results were not in the expected shape');
      }
      if (outs.length > 0) setPrintOutput(outs.join('\n'));
      return parsed as TestResult[];
    })();

    const timeout = new Promise<never>((_, reject) => {
      pyTimerRef.current = window.setTimeout(
        () => reject(new Error(PY_TIMEOUT_MESSAGE)),
        PY_TIMEOUT_MS
      );
    });

    try {
      const results = await Promise.race([exec, timeout]);
      if (pyTimerRef.current !== null) window.clearTimeout(pyTimerRef.current);
      pyTimerRef.current = null;
      finishRun(results, 0);
    } catch (err) {
      if (pyTimerRef.current !== null) window.clearTimeout(pyTimerRef.current);
      pyTimerRef.current = null;
      setRun({
        kind: 'error',
        message: `Python could not run your code: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    }
  }

  function runTests() {
    void runPythonTests();
  }

  /** chunk 5B: ask the AI helper for a nudge on this exercise. The nudge
   *  explains the next step — it never grants XP and never writes code for
   *  the learner. Cached per exercise id in component state. */
  async function askNudge() {
    const cached = nudges[ex.id];
    if (cached || nudgeState === 'loading') return;
    setNudgeState('loading');
    setNudgeErr(null);
    const statement =
      `${ex.title} — Write a function that passes these tests: ` +
      ex.tests
        .map(([args, expected]) => `${ex.id}(${(args as unknown[]).map((a) => JSON.stringify(a)).join(', ')}) should return ${JSON.stringify(expected)}`)
        .join('; ');
    const res = await aiApi.nudge({
      exerciseTitle: ex.title,
      statement,
      code: drafts[ex.id] ?? ex.starter,
      failingTests:
        run.kind === 'done'
          ? run.results
              .filter((r) => !r.pass)
              .map((r) => ({
                expected: String(r.expected),
                got: String(r.got),
                ...(r.error ? { error: r.error } : {}),
              }))
          : [],
      lang,
    });
    if (res.ok && typeof res.data.data === 'string' && res.data.data.trim()) {
      setNudges((prev) => ({ ...prev, [ex.id]: res.data.data }));
      setNudgeState('idle');
    } else {
      setNudgeErr(res.ok ? 'INVALID_RESPONSE' : res.code);
      setNudgeState('error');
    }
  }

  // ---- render ----

  return (
    <GameShell
      title="Coding Lab"
      blurb="Write real Python, run it against automated tests, and fix the bugs. Debug exercises come with a hint ladder."
      modelNote="Python runs locally via Pyodide (WebAssembly) and needs internet the first time only. No code ever leaves this device."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="flex flex-col gap-4">
        {/* Exercise chip bar */}
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Choose an exercise"
        >
          {EXERCISES.map((e, i) => {
            const done = completed.has(e.id);
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={i === selectedIndex}
                onClick={() => selectExercise(i)}
                className={cn(
                  'press inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-sm font-medium',
                  i === selectedIndex
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground hover:bg-accent/10'
                )}
              >
                {done && <Check className="size-3.5 text-emerald-600" aria-hidden="true" />}
                {e.title}
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                  Py
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Editor column */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-bold">{ex.title}</h2>
              <button
                type="button"
                onClick={resetCode}
                className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
              >
                <RotateCcw className="size-4" aria-hidden="true" /> Reset
              </button>
            </div>
            <textarea
              value={code}
              onChange={editCode}
              spellCheck={false}
              aria-label="Code editor"
              className="min-h-[280px] w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-sm leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {isPython && (
              <p className="text-xs text-muted-foreground">
                Honest note: Python runs on this page, so a truly infinite loop
                cannot be interrupted mid-run — if the tab freezes, refresh the
                page and your draft will still be here.
              </p>
            )}
            <button
              type="button"
              onClick={runTests}
              disabled={run.kind === 'running'}
              className="press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {run.kind === 'running' ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              Run tests
            </button>
          </div>

          {/* Results / hints column */}
          <div className="flex flex-col gap-4">
            <div
              aria-live="polite"
              className="rounded-xl border border-border bg-background p-3 text-sm"
            >
              <p className="font-semibold">{summary}</p>
              {run.kind === 'error' && (
                <p className="mt-2 flex items-start gap-1.5 text-rose-600">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{run.message}</span>
                </p>
              )}
              {run.kind === 'done' && (
                <ul className="mt-2 flex flex-col gap-2">
                  {run.results.map((r, i) => (
                    <li
                      key={i}
                      className={cn(
                        'rounded-lg border p-2',
                        r.pass
                          ? 'border-emerald-500/40 bg-emerald-500/10'
                          : 'border-rose-500/40 bg-rose-500/10'
                      )}
                    >
                      <p className="flex items-center gap-1.5 font-medium">
                        {r.pass ? (
                          <Check className="size-4 text-emerald-600" aria-hidden="true" />
                        ) : (
                          <X className="size-4 text-rose-600" aria-hidden="true" />
                        )}
                        Test {i + 1} {r.pass ? 'passes' : 'fails'}
                      </p>
                      <p className="mt-1 font-mono text-xs">
                        expected {r.expected} · got {r.got}
                      </p>
                      {r.error && (
                        <p className="mt-1 text-xs text-rose-600">{r.error}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {run.kind === 'done' && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Ran in local Python (Pyodide, WebAssembly).
                </p>
              )}
              {printOutput !== null && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Printed output
                  </p>
                  <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted p-2 font-mono text-xs">
                    {printOutput}
                  </pre>
                </div>
              )}
            </div>

            {celebrate && (
              <p
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700"
                role="status"
              >
                {celebrate}
              </p>
            )}

            {/* Hint ladder (3 progressive levels, honest) */}
            {hints.length > 0 && (
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Lightbulb className="size-4" aria-hidden="true" /> Hints
                </p>
                <ol className="mt-2 flex flex-col gap-1.5 text-sm">
                  {hints.slice(0, hintsShown).map((h, i) => (
                    <li key={i}>
                      <span className="font-medium">Hint {i + 1}:</span> {h}
                    </li>
                  ))}
                </ol>
                {hintsShown < hints.length && (
                  <button
                    type="button"
                    onClick={() => setHintsShown((n) => n + 1)}
                    className="press mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
                  >
                    Show hint {hintsShown + 1} of {hints.length}
                  </button>
                )}
              </div>
            )}

            {/* AI nudge (chunk 5B Tier 2): offered only after the authored
                3-level hint ladder is fully shown. Explains, never grants XP. */}
            {hints.length === 3 && hintsShown === 3 && (
              <div className="rounded-xl border border-border bg-background p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles className="size-4 text-primary" aria-hidden="true" /> {t(lang, 'ai.nudgeTitle')}
                </p>
                {nudges[ex.id] ? (
                  <div className="mt-2">
                    <AiMarkdown text={nudges[ex.id]} />
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      {t(lang, 'ai.noXp')}
                    </p>
                    <AiLabel
                      feature="codelab"
                      output={nudges[ex.id]}
                      lang={lang}
                      demo={props.demo}
                    />
                  </div>
                ) : !props.aiAvailable ? null : nudgeState === 'loading' ? (
                  <div role="status" aria-live="polite" className="mt-2 flex flex-col gap-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <p className="text-xs text-muted-foreground">{t(lang, 'ai.thinking')}</p>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void askNudge()}
                      className="press mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
                    >
                      <Sparkles className="size-4 text-primary" aria-hidden="true" />
                      {t(lang, 'ai.nudgeBtn')}
                    </button>
                    {nudgeState === 'error' && (
                      <p role="status" className="mt-2 rounded-lg bg-muted/60 p-2 text-sm text-muted-foreground">
                        {t(lang, nudgeErr ? aiErrKey(nudgeErr) : 'ai.err.UNAVAILABLE')}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Pyodide status (honest, never faked) */}
            {isPython && pyStatus !== 'ready' && (
              <p className="flex items-start gap-1.5 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
                {pyStatus === 'loading' ? (
                  <>
                    <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" aria-hidden="true" />
                    <span>
                      Downloading the Python runtime (Pyodide, about 10 MB, one
                      time only).
                    </span>
                  </>
                ) : (
                  <span>{PY_FAIL_MESSAGE}</span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </GameShell>
  );
}
