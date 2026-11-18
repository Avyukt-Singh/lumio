'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Coffee, Play, Square, Timer, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { tFor, type DictKey } from '@/lib/lumio/i18n';
import {
  FOCUS_BLOCK_XP,
  FOCUS_DAILY_BLOCK_CAP,
  FOCUS_PRESETS,
  addDays,
  dayKey,
  focusBlocksOn,
  focusPreset,
  focusXpBlocksLeft,
} from '@/lib/lumio/domain';
import type { LumioState } from '@/lib/lumio/types';
import { FocusSoundEngine, isSupported, type SoundKind } from '@/lib/lumio/focusSounds';

/**
 * Focus (chunk 4A): honest Pomodoro suite. ALL timing derives from Date.now()
 * timestamp deltas persisted in localStorage — closing the tab never loses a
 * running block, and completion is detected only by comparing timestamps
 * (1-second tick + mount recovery). No setTimeout scheduling anywhere.
 */

interface FocusRun {
  startedAt: number; // epoch ms — the single source of truth
  mode: 'work' | 'break' | 'long';
  presetId: string;
  blockInCycle: number; // 1..4
}

interface FocusPrefs {
  autoStart: boolean;
  strict: boolean;
}

const RUN_KEY = 'lumio-focus-run';
const PREFS_KEY = 'lumio-focus-prefs';
const SOUNDS: { kind: SoundKind; label: DictKey }[] = [
  { kind: 'brown', label: 'focus.brown' },
  { kind: 'rain', label: 'focus.rain' },
  { kind: 'pulse', label: 'focus.pulse' },
];

function targetMsFor(r: FocusRun): number {
  const p = focusPreset(r.presetId);
  const mins = r.mode === 'work' ? p.work : r.mode === 'break' ? p.breakMin : p.longBreak;
  return mins * 60_000;
}

/** Narrowing parse of the persisted run — corrupt data is discarded honestly. */
function loadRun(): FocusRun | null {
  try {
    const raw = window.localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const o: unknown = JSON.parse(raw);
    if (typeof o !== 'object' || o === null) return null;
    const r = o as Record<string, unknown>;
    const mode = r.mode === 'work' || r.mode === 'break' || r.mode === 'long' ? r.mode : null;
    if (
      typeof r.startedAt !== 'number' ||
      mode === null ||
      typeof r.presetId !== 'string' ||
      typeof r.blockInCycle !== 'number' ||
      r.blockInCycle < 1 ||
      r.blockInCycle > 4
    ) {
      return null;
    }
    return { startedAt: r.startedAt, mode, presetId: r.presetId, blockInCycle: r.blockInCycle };
  } catch {
    return null;
  }
}

function loadPrefs(): FocusPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { autoStart: false, strict: false };
    const o: unknown = JSON.parse(raw);
    if (typeof o !== 'object' || o === null) return { autoStart: false, strict: false };
    const p = o as Record<string, unknown>;
    return {
      autoStart: p.autoStart === true,
      strict: p.strict === true,
    };
  } catch {
    return { autoStart: false, strict: false };
  }
}

function weekdayLetter(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getUTCDay()];
}

function weekdayLong(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function Focus({
  state,
  now,
  onFinishBlock,
}: {
  state: LumioState;
  now: Date;
  onFinishBlock: (mins: number) => void;
}) {
  // ---- state ----
  const [presetId, setPresetId] = useState<string>('classic');
  const [run, setRun] = useState<FocusRun | null>(() => loadRun());
  const [prefs, setPrefs] = useState<FocusPrefs>(() => loadPrefs());
  const [status, setStatus] = useState<string | null>(null);
  const [, setTick] = useState(0); // 1-second re-render while a block runs

  const [soundKind, setSoundKind] = useState<SoundKind>('brown');
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [volume, setVolume] = useState(25); // percent 0..100
  const soundRef = useRef<FocusSoundEngine | null>(null);

  // ---- derived consts (declared ABOVE every effect, per project rule) ----
  const tr = tFor(state.profile?.lang);
  const tz = state.profile?.tz ?? 'Asia/Kolkata';
  const today = dayKey(now, tz);
  const blocksToday = focusBlocksOn(state.focusLog, today);
  const xpLeft = focusXpBlocksLeft(state.focusLog, today);
  const xpEarned = Math.min(blocksToday, FOCUS_DAILY_BLOCK_CAP) * FOCUS_BLOCK_XP;
  const capped = blocksToday >= FOCUS_DAILY_BLOCK_CAP;
  const running = run !== null;
  const preset = focusPreset(run ? run.presetId : presetId);
  const cyclePos = run ? run.blockInCycle : 1;
  const nextPause =
    cyclePos >= 4 ? `${preset.longBreak} min long break` : `${preset.breakMin} min break`;
  const modeLabel = run
    ? run.mode === 'work'
      ? tr('focus.focusing')
      : run.mode === 'break'
        ? tr('focus.shortBreak')
        : tr('focus.longBreak')
    : tr('focus.idle');
  const remainingMs = run ? Math.max(0, targetMsFor(run) - (Date.now() - run.startedAt)) : 0;
  const clock = `${pad(Math.floor(remainingMs / 60_000))}:${pad(Math.floor((remainingMs % 60_000) / 1000))}`;
  const soundSupported = useMemo(() => isSupported(), []);

  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, idx) => {
        const i = 6 - idx; // oldest first: i = 6..0
        const date = addDays(today, -i);
        const day = state.focusLog[date];
        return {
          date,
          mins: day?.mins ?? 0,
          blocks: day?.blocks ?? 0,
          isToday: date === today,
        };
      }),
    [state.focusLog, today]
  );
  const totalMins = week.reduce((s, d) => s + d.mins, 0);
  const totalBlocks = week.reduce((s, d) => s + d.blocks, 0);
  const maxMins = Math.max(...week.map((d) => d.mins), 1);

  // ---- refs for one-shot completion and cleanup ----
  const firedRef = useRef<number | null>(null); // startedAt of the block already fired/voided
  const completeRef = useRef<(r: FocusRun, away: boolean) => void>(() => {});
  const voidRef = useRef<(r: FocusRun) => void>(() => {});

  // ---- handlers (used by effects through refs to keep deps honest) ----

  function clearRun(): void {
    try {
      window.localStorage.removeItem(RUN_KEY);
    } catch {
      // Storage may be unavailable — state still clears below.
    }
    setRun(null);
  }

  function startRun(mode: FocusRun['mode'], pid: string, blockInCycle: number): void {
    const r: FocusRun = { startedAt: Date.now(), mode, presetId: pid, blockInCycle };
    try {
      window.localStorage.setItem(RUN_KEY, JSON.stringify(r));
    } catch {
      // Private mode: the block still runs for this tab session.
    }
    setRun(r);
  }

  function handleComplete(r: FocusRun, away: boolean): void {
    if (firedRef.current === r.startedAt) return; // tick + recovery must not double-fire
    firedRef.current = r.startedAt;
    clearRun();
    if (r.mode === 'work') {
      const p = focusPreset(r.presetId);
      onFinishBlock(p.work); // exactly once per completed block
      const awayMsg = away
        ? 'Completed while you were away — credited honestly from timestamps. '
        : '';
      if (prefs.autoStart) {
        startRun(r.blockInCycle >= 4 ? 'long' : 'break', r.presetId, r.blockInCycle);
        setStatus(
          `${awayMsg}Block ${r.blockInCycle} done (+${FOCUS_BLOCK_XP} XP if under the daily cap) — your ${
            r.blockInCycle >= 4 ? 'long break' : 'break'
          } started automatically.`
        );
      } else {
        setStatus(`${awayMsg}Block done. Take your break when ready.`);
      }
    } else {
      // A break finished.
      if (prefs.autoStart && r.mode === 'break' && r.blockInCycle < 4) {
        startRun('work', r.presetId, r.blockInCycle + 1);
        setStatus(`Break over — block ${r.blockInCycle + 1} of 4 started automatically.`);
      } else if (r.mode === 'long' || r.blockInCycle >= 4) {
        setStatus('Cycle complete — 4 blocks and a long break. Nice work.');
      } else {
        setStatus('Break done. Start your next block when ready.');
      }
    }
  }

  function voidRun(r: FocusRun): void {
    if (firedRef.current === r.startedAt) return;
    firedRef.current = r.startedAt;
    clearRun();
    setStatus('You left the tab — strict mode voided the block. Nothing was credited.');
  }

  completeRef.current = handleComplete;
  voidRef.current = voidRun;

  // ---- effects ----

  // The ONLY completion path: a 1-second tick comparing timestamps, plus the
  // same comparison run once when a run is (re)mounted (closed-app recovery).
  useEffect(() => {
    if (!run) return;
    const target = targetMsFor(run);
    // Mount / run-change recovery: if the timestamps say the block already
    // finished (tab was closed or the device slept), complete it immediately.
    if (Date.now() - run.startedAt >= target) {
      completeRef.current(run, true);
      return;
    }
    const id = window.setInterval(() => {
      if (Date.now() - run.startedAt >= target) {
        completeRef.current(run, false);
      } else {
        setTick((t) => t + 1);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [run]);

  // Strict mode: leaving the tab while a WORK block runs voids it immediately.
  useEffect(() => {
    if (!prefs.strict || !run || run.mode !== 'work') return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') voidRef.current(run);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [prefs.strict, run]);

  // Persist the toggles whenever they change.
  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Storage may be unavailable; toggles still work for this session.
    }
  }, [prefs]);

  // Sounds run independently of the timer; stop them on unmount.
  useEffect(
    () => () => {
      const eng = soundRef.current;
      if (eng) {
        eng.stop();
        eng.dispose();
        soundRef.current = null;
      }
    },
    []
  );

  // ---- UI handlers ----

  function startBlock(): void {
    if (running) return;
    startRun('work', presetId, 1);
    setStatus(`Block started — ${focusPreset(presetId).work} minutes of focus.`);
  }

  function abandon(): void {
    if (!run) return;
    firedRef.current = run.startedAt; // abandoning must never later credit this block
    clearRun();
    setStatus('Block abandoned — nothing was credited. That is the honest outcome.');
  }

  function toggleSound(): void {
    if (soundPlaying) {
      soundRef.current?.stop();
      setSoundPlaying(false);
      return;
    }
    if (!soundSupported) return;
    try {
      if (!soundRef.current) soundRef.current = new FocusSoundEngine();
      const eng = soundRef.current;
      eng.setVolume(volume / 100);
      setSoundPlaying(true);
      void eng.start(soundKind).catch(() => {
        setSoundPlaying(false);
        setStatus('The browser refused to start audio. Try pressing start again.');
      });
    } catch {
      setSoundPlaying(false);
      setStatus('Audio could not start in this browser.');
    }
  }

  function pickSound(kind: SoundKind): void {
    setSoundKind(kind);
    if (soundPlaying && soundRef.current) {
      void soundRef.current.start(kind).catch(() => setSoundPlaying(false));
    }
  }

  // ---- render ----

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <section aria-labelledby="focus-head" data-tour="focus-root" className="rounded-2xl border border-border bg-card p-5">
        <h1 id="focus-head" className="flex items-center gap-2 font-heading text-2xl font-bold">
          <Timer className="size-6 text-primary" aria-hidden="true" /> {tr('focus.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr('focus.subtitle')}
        </p>
        {status && (
          <p role="status" className="mt-3 rounded-xl border border-border bg-muted/50 p-3 text-sm">
            {status}
          </p>
        )}
      </section>

      {/* Preset selector */}
      <section aria-labelledby="focus-presets" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="focus-presets" className="mb-3 font-heading text-lg font-semibold">
          {tr('focus.preset')}
        </h2>
        <div
          role="radiogroup"
          aria-label="Focus preset"
          className="flex flex-wrap gap-2"
        >
          {FOCUS_PRESETS.map((p) => {
            const selected = run ? run.presetId === p.id : presetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={running}
                onClick={() => setPresetId(p.id)}
                className={cn(
                  'press inline-flex min-h-[44px] flex-col items-start justify-center rounded-xl border px-3 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60',
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground hover:bg-accent/10'
                )}
              >
                <span>{p.label}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {p.work} min work · {p.breakMin} min break · {p.longBreak} min long
                </span>
              </button>
            );
          })}
        </div>
        {running && (
          <p className="mt-2 text-xs text-muted-foreground">
            Presets lock while a block is running — abandon it first to change.
          </p>
        )}

        {/* Cycle strip */}
        <div className="mt-4">
          <p className="text-sm font-medium">
            {tr('focus.blockOf')} {cyclePos} {tr('focus.of')} {FOCUS_DAILY_BLOCK_CAP} · {tr('focus.nextPause')} {nextPause}
          </p>
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className={cn(
                  'h-2 flex-1 rounded-full',
                  n < cyclePos
                    ? 'bg-primary'
                    : n === cyclePos && running
                      ? 'bg-primary/60'
                      : 'bg-muted'
                )}
              />
            ))}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coffee className="size-3.5" aria-hidden="true" />
            Block 4 is followed by the {preset.longBreak}-minute long break, then the cycle restarts.
          </p>
        </div>
      </section>

      {/* Timer */}
      <section aria-labelledby="focus-timer" data-tour="focus-timer" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="focus-timer" className="sr-only">
          {tr('focus.timer')}
        </h2>
        <div className="flex flex-col items-center gap-1 py-2">
          <p className="text-sm font-semibold text-muted-foreground">{modeLabel}</p>
          <p
            className={cn(
              'font-heading text-6xl font-bold tabular-nums',
              running ? 'text-foreground' : 'text-muted-foreground'
            )}
            aria-live="off"
          >
            {running ? clock : `${pad(preset.work)}:00`}
          </p>
          <p className="text-xs text-muted-foreground">
            {running
              ? `${focusPreset(run.presetId).label} preset · ${run.mode === 'work' ? 'work block' : 'break'}`
              : `${preset.label} preset ready`}
          </p>
          {running && (
            <p className="mt-1 text-center text-xs text-muted-foreground">
              {tr('focus.timestampNote')}
            </p>
          )}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button onClick={startBlock} disabled={running} className="min-h-[44px]">
            <Play className="size-4" aria-hidden="true" /> {tr('focus.startBlock')}
          </Button>
          {running && (
            <Button variant="outline" onClick={abandon} className="min-h-[44px]">
              <Square className="size-4" aria-hidden="true" /> {tr('focus.abandon')}
            </Button>
          )}
        </div>
      </section>

      {/* Toggles */}
      <section aria-labelledby="focus-toggles" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="focus-toggles" className="mb-3 font-heading text-lg font-semibold">
          {tr('focus.rules')}
        </h2>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-pressed={prefs.autoStart}
            disabled={running}
            onClick={() => setPrefs((p) => ({ ...p, autoStart: !p.autoStart }))}
            className={cn(
              'press flex min-h-[44px] items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60',
              prefs.autoStart
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card hover:bg-accent/10'
            )}
          >
            <span>{tr('focus.autoStart')}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {prefs.autoStart ? 'On' : 'Off'}
            </span>
          </button>
          <button
            type="button"
            aria-pressed={prefs.strict}
            disabled={running}
            onClick={() => {
              if (!prefs.strict) {
                setStatus(
                  'Strict mode is on: if you leave the tab during a work block, the block is voided and nothing is credited. There is no grace period.'
                );
              }
              setPrefs((p) => ({ ...p, strict: !p.strict }));
            }}
            className={cn(
              'press flex min-h-[44px] items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60',
              prefs.strict
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card hover:bg-accent/10'
            )}
          >
            <span>{tr('focus.strict')}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {prefs.strict ? 'On' : 'Off'}
            </span>
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {prefs.strict
            ? 'Strict mode is active: leaving the tab during a work block voids it — nothing is credited.'
            : tr('focus.strictWarn')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {tr('focus.togglesLocked')}
        </p>
      </section>

      {/* XP status */}
      <section aria-labelledby="focus-xp" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="focus-xp" className="mb-1 font-heading text-lg font-semibold">
          {tr('focus.todayXp')}
        </h2>
        <p className="text-sm">
          Today: <span className="font-semibold tabular-nums">{blocksToday}</span>/
          {FOCUS_DAILY_BLOCK_CAP} blocks ·{' '}
          <span className="font-semibold tabular-nums">+{xpEarned} XP</span> earned
        </p>
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
          {xpLeft} {tr('focus.xpBlocksLeft')}
        </p>
        {capped && (
          <p className="mt-2 rounded-xl bg-gold-soft px-3 py-2 text-sm font-medium" style={{ color: 'var(--gold)' }}>
            {tr('focus.capReached')}
          </p>
        )}
      </section>

      {/* Ambient sound */}
      <section aria-labelledby="focus-sound" data-tour="focus-sound" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="focus-sound" className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold">
          <Volume2 className="size-5 text-primary" aria-hidden="true" /> {tr('focus.sound')}
        </h2>
        {soundSupported ? (
          <>
            <div role="group" aria-label="Choose an ambient sound" className="flex flex-wrap gap-2">
              {SOUNDS.map((s) => (
                <button
                  key={s.kind}
                  type="button"
                  aria-pressed={soundKind === s.kind}
                  onClick={() => pickSound(s.kind)}
                  className={cn(
                    'press inline-flex min-h-[44px] items-center rounded-full border px-3 text-sm font-medium',
                    soundKind === s.kind
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:bg-accent/10'
                  )}
                >
                  {tr(s.label)}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label htmlFor="focus-volume" className="text-sm text-muted-foreground">
                {tr('focus.volume')}
              </label>
              <input
                id="focus-volume"
                type="range"
                min={0}
                max={100}
                value={volume}
                aria-label="Sound volume"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setVolume(v);
                  soundRef.current?.setVolume(v / 100);
                }}
                className="h-2 min-w-0 flex-1 cursor-pointer accent-primary"
              />
              <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                {volume}%
              </span>
            </div>
            <div className="mt-3">
              <Button variant="secondary" onClick={toggleSound} className="min-h-[44px]">
                {soundPlaying ? tr('focus.stopSound') : tr('focus.startSound')}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            This browser does not support the Web Audio API, so live ambient sounds are unavailable.
            The timer itself works fine.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {tr('focus.soundNote')}
        </p>
      </section>

      {/* This week */}
      <section aria-labelledby="focus-week" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="focus-week" className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold">
          <BarChart3 className="size-5 text-primary" aria-hidden="true" /> {tr('focus.weekChart')}
        </h2>
        <div
          role="img"
          aria-label={`Focus minutes over the last 7 days: ${week
            .map((d) => `${weekdayLong(d.date)} ${d.mins} minutes`)
            .join(', ')}. Total ${totalMins} minutes across ${totalBlocks} blocks.`}
          className="flex items-end justify-between gap-1.5"
        >
          {week.map((d) => (
            <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-xs tabular-nums text-muted-foreground">{d.mins}</span>
              <div className="flex h-24 w-full items-end justify-center">
                <div
                  className={cn(
                    'w-full max-w-[28px] rounded-t-md bg-primary/70',
                    d.isToday && 'ring-2 ring-primary'
                  )}
                  style={{ height: `${d.mins > 0 ? Math.max((d.mins / maxMins) * 100, 6) : 3}%` }}
                />
              </div>
              <span
                className={cn(
                  'text-xs font-semibold',
                  d.isToday ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {weekdayLetter(d.date)}
              </span>
            </div>
          ))}
        </div>
        <ul className="sr-only">
          {week.map((d) => (
            <li key={d.date}>
              {weekdayLong(d.date)}: {d.mins} minutes, {d.blocks} block{d.blocks === 1 ? '' : 's'}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground tabular-nums">
          {totalMins} focused minutes across 7 days · {totalBlocks} blocks
        </p>
      </section>
    </div>
  );
}
