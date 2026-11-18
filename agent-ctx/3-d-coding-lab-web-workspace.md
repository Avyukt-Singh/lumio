# Task 3-d — Coding Lab + Web Workspace games

Agent: 3-d
Date: (session)
Status: DONE

## Files written (exactly two, nothing else modified)

1. `/home/z/my-project/src/components/lumio/games/CodingLab.tsx`
   - `export function CodingLabGame(props: GameProps)` — xp 25, wrapped in shared `GameShell`.
   - 9 exercises from `CODING_EXERCISES` verbatim; chip bar with `aria-pressed`, Check icon on session-completed chips, JS/Py badge.
   - JS execution in a Web Worker built from a Blob URL (created lazily per run, terminated after use, `URL.revokeObjectURL` immediately after `new Worker`; guarded `typeof Worker === 'undefined'` with an honest message). 2000 ms hard timeout in the parent → `worker.terminate()` + honest "infinite loop" message.
   - Python exercises: Pyodide v0.26.4 loaded via dynamic `<script data-lumio-pyodide>` injection ONLY when a `lang === 'py'` exercise is selected (idempotent — reuses an existing tag). `loadPyodide` failure → honest offline message, never faked results. Real run: `py.runPython(code)` defines the fn, `globals.set('_lumio_tests_json', ...)` passes tests, `runPythonAsync(harness)` returns a JSON string built inside Python (compares with `==`); stdout captured via `setStdout({batched})` and shown. 3 s limit via `Promise.race`. Honest UI note that a Python infinite loop can freeze the tab (main-thread execution limitation).
   - Hint ladders: 3 progressive hints for ALL exercises; `average`/`maxOf`/`total_even` ported verbatim from the prototype `EXH` map (found at upload/extracted/project/lumio/lumio.html:457), the other six written in the same voice from each exercise's intent.
   - Drafts persist to `localStorage['lumio-code-drafts']` (utility storage); Reset deletes the draft and restores the starter. Results list (pass/fail, expected vs got, per-test errors) with `aria-live="polite"` summary "N of M tests pass". First-time full pass of any exercise → `onWin()` + celebration line (repeat calls deduped by the app).
   - modelNote verbatim per spec.

2. `/home/z/my-project/src/components/lumio/games/WebWorkspace.tsx`
   - `export function WebWorkspaceGame(props: GameProps)` — xp 25, wrapped in `GameShell`.
   - Left: HTML + CSS textareas (labelled, `font-mono`). Right: live preview `<iframe sandbox="allow-same-origin" title="Preview">` with `srcDoc` derived as a plain const; preview state updated on a 400 ms debounce (setTimeout cleaned up on every change and unmount). Learner HTML is NEVER rendered via `dangerouslySetInnerHTML` into the React tree — the iframe is the isolation boundary.
   - Real checker: reads `iframe.contentDocument`, TreeWalker for the deepest element containing "Lumio", computed style: bold = `fontWeight >= 700` (numeric parse), reddish = `r >= 150 && r > g*1.5 && r > b*1.5` after parsing computed `rgb(...)`. Kind progressive feedback for each failing step; pass → `onWin()`.
   - Stretch ideas are plain text under "Ideas to try — not checked" (no dead buttons). Reset restores starter HTML (`<p>Welcome to <b>Lumio</b>!</p>`) + empty CSS. Drafts persist to `localStorage['lumio-web-drafts']`.
   - modelNote verbatim per spec.

## Worker protocol (CodingLab)

- Parent → worker (`WorkerRequest`): `{ code: string, fnName: string, tests: Array<[unknown[], unknown]> }`.
- Worker → parent (`WorkerResponse`): `{ results: Array<{ pass, got, expected, error? }>, durationMs }`.
- Inside the worker: primary evaluation is `new Function('return (' + code + ')')()` per spec; fallback wraps the code in an IIFE + `eval` and picks up the function by `fnName` (always our own exercise id, never user input) for multi-statement code. Deep-equal compares arrays and objects (sorted keys), treats `NaN === NaN` as equal; `got`/`expected` are JSON-formatted strings for display. All worker messages are narrowed with type guards (`isWorkerResponse`/`isTestResult`) — no `any`.

## Python fallback behaviour

- `py.runPython(code)` first (a syntax/definition error surfaces honestly as a run error), then a Python-built harness that parses `_lumio_tests_json`, calls the function named by the exercise id with each arg tuple, compares with `==` (bool-wrapped), and `json.dumps` the results; the JS side parses and type-narrows that JSON string. Promise.race gives the 3 s cap for anything awaitable; an honest UI note explains that a hard main-thread infinite Python loop cannot be interrupted mid-run (refresh recovers; drafts persist).

## Assumptions

- `CODING_EXERCISES.lang` is typed `?: string` in content.ts; compared with `=== 'py'`.
- Session "completed" set is intentionally in-memory only (per spec: "session state"), not persisted to localStorage or the event log; drafts are persisted separately as utility storage.
- Pyodide download is not raced at 3 s (it routinely exceeds that); the 3 s limit applies to test execution only, per spec.
- Colors: expected computed `color` to be `rgb()/rgba()` form; if unparseable, an honest "could not read its colour" message is shown instead of guessing.
- Export names match `games/registry.ts` (`CodingLabGame`, `WebWorkspaceGame`) — no registry change needed.

## Compliance notes

- `'use client'`, strict TS, no `any`, no `useMemo`, all derivations are consts above effects, workers/timers/debounce cleaned up on unmount, object URL revoked.
- Accessibility: labelled textareas, `min-h-[44px]` buttons, `aria-pressed` chips, `aria-live="polite"` results, visible focus rings, `press` utility class.
- No new npm packages; Pyodide only via CDN script. No TODOs/stubs; every visible element works or shows an honest failure state. Emerald accents, no indigo/blue.
