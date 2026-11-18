# Task 4-b — Focus (Lock-In) screen + procedural sound engine

## Files written (no other files touched)

1. `src/lib/lumio/focusSounds.ts` (208 lines)
   - `FocusSoundEngine` class: lazy single AudioContext (webkit prefix via
     `window as unknown as { webkitAudioContext?: typeof AudioContext }`, no `any`),
     `start(kind)` / `stop()` / `setVolume()` / `dispose()`, all try/catch-safe.
   - `SoundKind = 'brown' | 'rain' | 'pulse'`; `isSupported()` exported.
   - brown: 5s looped buffer, integration `out[i]=(last+0.02*white)/1.02; last=out[i]; out[i]*=3.5`.
   - rain: noise -> bandpass 1200 Hz Q 0.6 -> breath gain (0.15 Hz LFO, +/-0.25 around 0.75).
   - pulse: sine 200 Hz pan -1 + sine 204 Hz pan 1, shared gain pulsed by 0.1 Hz LFO.
   - Everything routes through one master GainNode (default volume 0.25).

2. `src/components/lumio/screens/Focus.tsx` (656 lines)
   - Props: `{ state, now, onFinishBlock }` exactly per contract.
   - Timing: 100% `Date.now()` deltas. Run persisted at localStorage
     `lumio-focus-run` (`{startedAt, mode, presetId, blockInCycle}`); 1 s
     setInterval only recomputes `remainingMs = targetMs - (Date.now() - startedAt)`.
   - Completion paths: mount/run-change recovery check (fires
     `onFinishBlock` once with the preset's work minutes, message
     "Completed while you were away — credited honestly from timestamps")
     and the interval tick. Guarded by `firedRef` (startedAt) so tick and
     recovery cannot double-fire; localStorage entry removed before any
     credit fires. No setTimeout scheduling.
   - autoStart: work -> break/long (block 4), break -> next work block while
     blockInCycle < 4, else cycle-complete message.
   - Strict mode: `visibilitychange` handler voids a running work block with
     the exact honest message; warning shown before enabling. Abandon clears
     the run with no credit.
   - UI: header card, preset chips (radiogroup/radio, aria-checked, 44px),
     4-segment cycle strip, big tabular-nums timer card, two aria-pressed
     toggles (`lumio-focus-prefs`), XP card with cap note + `focusXpBlocksLeft`,
     Web Audio ambient sound card (chips + range slider + start/stop, honest
     unsupported text), 7-day bar chart (role="img" + sr-only list, today ring).
   - Ordering: state -> derived consts -> refs -> handlers -> effects -> UI
     handlers -> render (TDZ rule honoured).

## Verification

- `bunx tsc --noEmit` filtered for my files: **zero errors**. One unrelated
  pre-existing error in `src/components/lumio/LumioApp.tsx:353` (Home props
  wiring for chunk-4A props; not my files, not modified per task rules).
- `bun run lint`: **clean** (no output).

## Deviations

- Sound engine keeps running independently of the timer (per "keep simple"),
  only stopped/disposed on unmount.
- Fresh idle "Start block" always begins a cycle at block 1 of 4.
- `agent-ctx` lives at `/home/z/my-project/agent-ctx` (root `/` is not writable).
