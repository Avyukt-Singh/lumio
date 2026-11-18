'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle, Download, Languages, MoonStar, Palette, RefreshCw, ShieldCheck, Sparkles, Sun, Upload, Sunset,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Mascot } from '../Mascot';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { t, tFor, type DictKey, type UiLang } from '@/lib/lumio/i18n';
import { BANDS, type Band } from '@/lib/lumio/content';
import { exportBlob } from '@/lib/lumio/storage';
import { fillVars, useAiBudget } from '../ai/AiMarkdown';
import type { LumioState, Settings as SettingsData, ThemeOverride } from '@/lib/lumio/types';

/**
 * Settings (chunk 2): theme override, calm mode, schedule tweaks, the full
 * learning-profile wizard (pre-filled), export/import (v2 or legacy lumio-s1),
 * reset. The privacy dashboard grows in later chunks.
 */

const THEME_OPTIONS: Array<{ value: ThemeOverride; label: DictKey; icon: typeof Sun }> = [
  { value: 'auto', label: 'settings.themeAuto', icon: RefreshCw },
  { value: 'morning', label: 'settings.themeMorning', icon: Sun },
  { value: 'evening', label: 'settings.themeEvening', icon: Sunset },
  { value: 'night', label: 'settings.themeNight', icon: MoonStar },
];

const LANG_OPTIONS: Array<{ value: 'en' | 'hi' | 'hinglish'; label: DictKey }> = [
  { value: 'en', label: 'settings.lang.en' },
  { value: 'hi', label: 'settings.lang.hi' },
  { value: 'hinglish', label: 'settings.lang.hinglish' },
];

export function SettingsScreen({
  state,
  onSettings,
  onPlan,
  onImport,
  onReset,
  onEditProfile,
  saveError,
  onLang,
  accountSlot,
  aiMode,
  onReplayTour,
}: {
  state: LumioState;
  onSettings: (patch: Partial<SettingsData>) => void;
  onPlan: (patch: Partial<NonNullable<LumioState['plan']>>) => void;
  onImport: (json: string) => { ok: true; message: string } | { ok: false; error: string };
  onReset: () => void;
  onEditProfile: () => void;
  saveError?: string;
  onLang: (lang: 'en' | 'hi' | 'hinglish') => void;
  /** chunk 5A: the Account card rendered right after Language */
  accountSlot?: ReactNode;
  aiMode?: 'unknown' | 'off' | 'fake' | 'zai' | 'openai-compatible';
  /** guided product tour: restart the walkthrough any time */
  onReplayTour?: () => void;
}) {
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const profile = state.profile;
  const plan = state.plan;
  const lang = state.profile?.lang ?? 'en';
  const tr = tFor(lang);

  const download = () => {
    const blob = exportBlob(state);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lumio-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    const result = onImport(text);
    setImportMsg(result.ok
      ? { ok: true, text: result.message }
      : { ok: false, text: result.error });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="font-heading text-2xl font-bold">{tr('settings.title')}</h1>

      {saveError && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          <AlertCircle className="size-4" aria-hidden="true" /> {saveError}
        </p>
      )}

      {/* Appearance */}
      <section aria-labelledby="set-appearance" data-tour="settings-appearance" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="set-appearance" className="mb-1 flex items-center gap-2 font-heading text-lg font-semibold">
          <Palette className="size-5 text-primary" aria-hidden="true" /> {tr('settings.appearance')}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Lumio follows the time of day: Morning 06:00–16:59, Evening 17:00–18:59, Night 19:00–05:59.
        </p>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              role="radio"
              aria-checked={state.settings.theme === value}
              onClick={() => onSettings({ theme: value })}
              className={cn(
                'press flex min-h-[44px] flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm font-medium',
                state.settings.theme === value ? 'border-primary bg-primary/5' : 'border-border'
              )}
            >
              <Icon className="size-4 text-primary" aria-hidden="true" />
              {tr(label)}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">{tr('settings.calm')}</p>
            <p className="text-xs text-muted-foreground">Turns off animation. Also honours your device reduced-motion setting.</p>
          </div>
          <Switch
            checked={state.settings.calm}
            onCheckedChange={(v) => onSettings({ calm: v })}
            aria-label={tr('settings.calm')}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">{tr('settings.sounds')}</p>
            <p className="text-xs text-muted-foreground">Reward sounds are always opt-in and off by default.</p>
          </div>
          <Switch
            checked={state.settings.soundOn}
            onCheckedChange={(v) => onSettings({ soundOn: v })}
            aria-label={tr('settings.sounds')}
          />
        </div>
      </section>

      {/* Language */}
      <section aria-labelledby="set-language" data-tour="settings-language" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="set-language" className="mb-1 flex items-center gap-2 font-heading text-lg font-semibold">
          <Languages className="size-5 text-primary" aria-hidden="true" /> {tr('settings.language')}
        </h2>
        <div role="radiogroup" aria-label={tr('settings.language')} className="flex flex-wrap gap-2">
          {LANG_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              role="radio"
              aria-checked={lang === value}
              onClick={() => onLang(value)}
              className={cn(
                'press flex min-h-[44px] items-center rounded-xl border-2 px-4 text-sm font-medium',
                lang === value ? 'border-primary bg-primary/5' : 'border-border'
              )}
            >
              {tr(label)}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{tr('settings.langNote')}</p>
      </section>

      {accountSlot}

      {/* Guided product tour replay */}
      <section aria-labelledby="set-tour" data-tour="tour-replay" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="set-tour" className="mb-1 flex items-center gap-2 font-heading text-lg font-semibold">
          <Sparkles className="size-5 text-primary" aria-hidden="true" /> {tr('tour.tour-replay.t')}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{tr('tour.tour-replay.b')}</p>
        {onReplayTour && (
          <Button variant="secondary" onClick={onReplayTour}>
            <RefreshCw className="size-4" aria-hidden="true" /> {tr('tour.tour-replay.t')}
          </Button>
        )}
      </section>

      {/* AI help (chunk 5B Tier 2) — honest: hidden while the capability probe says off */}
      {aiMode && aiMode !== 'off' && <AiHelpSection lang={lang} aiMode={aiMode} />}

      {/* Learning profile */}
      <section aria-labelledby="set-profile" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="set-profile" className="mb-1 font-heading text-lg font-semibold">{tr('settings.profile')}</h2>
        {profile ? (
          <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Name</dt><dd className="font-medium">{profile.name || '—'}</dd>
            <dt className="text-muted-foreground">Learner type</dt><dd className="font-medium">{profile.cat}</dd>
            <dt className="text-muted-foreground">Band</dt><dd className="font-medium">{BANDS[profile.band].name}</dd>
            {profile.board && (
              <><dt className="text-muted-foreground">Board</dt><dd className="font-medium">{profile.board}</dd></>
            )}
            {profile.state && (
              <><dt className="text-muted-foreground">State</dt><dd className="font-medium">{profile.state}</dd></>
            )}
            {profile.className && (
              <><dt className="text-muted-foreground">Class</dt><dd className="font-medium">{profile.className}</dd></>
            )}
            {profile.exam && (
              <><dt className="text-muted-foreground">Target exam</dt><dd className="font-medium">{profile.exam}{profile.examDate ? ` · ${profile.examDate}` : ''}</dd></>
            )}
            {profile.goalText && (
              <><dt className="text-muted-foreground">Goal</dt><dd className="font-medium">{profile.goalText}</dd></>
            )}
            <dt className="text-muted-foreground">Time zone</dt><dd className="font-medium">{profile.tz}</dd>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No profile yet.</p>
        )}
        {plan && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <NumField label="Sessions per day" value={plan.sessions} min={1} max={6}
              onChange={(v) => onPlan({ sessions: v })} />
            <NumField label="Minutes per session" value={plan.sessionLen} min={10} max={120} step={5}
              onChange={(v) => onPlan({ sessionLen: v })} />
          </div>
        )}
        {profile && (
          <Button variant="secondary" className="mt-3" onClick={onEditProfile}>
            <RefreshCw className="size-4" aria-hidden="true" /> {tr('settings.editProfile')}
          </Button>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          The wizard reopens pre-filled with every answer — your progress is kept.
        </p>
      </section>

      {/* Data */}
      <section aria-labelledby="set-data" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="set-data" className="mb-1 font-heading text-lg font-semibold">{tr('settings.data')}</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Everything lives in this browser. Export a backup file, or import a Lumio v2 export or
          a prototype <code className="rounded bg-muted px-1">lumio-s1</code> export.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={download}>
            <Download className="size-4" aria-hidden="true" /> {tr('settings.export')}
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" aria-hidden="true" /> {tr('settings.import')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            aria-label="Import a Lumio export file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <RefreshCw className="size-4" aria-hidden="true" /> {tr('settings.reset')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all Lumio data on this device?</AlertDialogTitle>
                <AlertDialogDescription>
                  This clears your profile, plan, XP, streaks and quests from this browser.
                  Export a backup first if you want to keep them. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep my data</AlertDialogCancel>
                <AlertDialogAction onClick={onReset}>Delete everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {importMsg && (
          <p
            role="status"
            className={cn(
              'mt-3 rounded-xl px-3 py-2 text-sm font-medium',
              importMsg.ok ? 'bg-success-soft text-success-soft-foreground' : 'bg-destructive/10 text-destructive'
            )}
          >
            {importMsg.text}
          </p>
        )}
      </section>

      {/* Privacy, plain language */}
      <section aria-labelledby="set-privacy" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="set-privacy" className="mb-2 flex items-center gap-2 font-heading text-lg font-semibold">
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" /> {tr('settings.privacy')}
        </h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Lumio has no ads, no trackers and no accounts in this build.</li>
          <li>Your progress lives in this browser: the event log in IndexedDB with a snapshot mirror in localStorage. Clearing site data deletes it — keep exports.</li>
          <li>Nothing is sent to any server. The leaderboard and accounts arrive in a later chunk, always opt-in.</li>
          <li>Chapter content is Lumio-written sample material, labelled as such — never official curriculum.</li>
        </ul>
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-muted/60 p-3">
          <Mascot pose="curious" size="md" />
          <p className="text-sm">
            Questions about your data? The privacy dashboard grows with every chunk.
          </p>
        </div>
      </section>
    </div>
  );
}

/**
 * AI help section (chunk 5B Tier 2, updated): AI help is on for everyone —
 * no sign-in or opt-in switch. This section keeps the honest part: the
 * plain-language privacy explainer, the demo/real-mode line and the true
 * remaining budget.
 */
function AiHelpSection({
  lang,
  aiMode,
}: {
  lang: UiLang;
  aiMode: 'unknown' | 'off' | 'fake' | 'zai' | 'openai-compatible';
}) {
  const { budget, refresh } = useAiBudget();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section aria-labelledby="set-ai" className="rounded-2xl border border-border bg-card p-5">
      <h2 id="set-ai" className="flex items-center gap-2 font-heading text-lg font-semibold">
        <Sparkles className="size-5 text-primary" aria-hidden="true" /> {t(lang, 'ai.settingsTitle')}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t(lang, 'ai.privacyExplain')}</p>
      {aiMode === 'fake' && (
        <p role="status" className="mt-3 rounded-xl bg-gold-soft px-3 py-2 text-sm font-medium" style={{ color: 'var(--gold)' }}>
          {t(lang, 'ai.fakeMode')}
        </p>
      )}
      {(aiMode === 'zai' || aiMode === 'openai-compatible') && (
        <p role="status" className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          {t(lang, 'ai.realMode')}
        </p>
      )}
      {budget && (
        <p className="mt-3 text-xs tabular-nums text-muted-foreground">
          {fillVars(t(lang, 'ai.budgetLeft'), { n: budget.callsLeft, cap: budget.callsCap })}
        </p>
      )}
    </section>
  );
}

function NumField({
  label, value, min, max, step = 1, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  const [err, setErr] = useState('');
  return (
    <div>
      <Label htmlFor={`num-${label}`}>{label}</Label>
      <Input
        id={`num-${label}`}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        className="mt-1"
        aria-describedby={err ? `err-${label}` : undefined}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n) || n < min || n > max) {
            setErr(`Enter a number from ${min} to ${max}`);
          } else {
            setErr('');
            onChange(n);
          }
        }}
      />
      {err && <p id={`err-${label}`} role="alert" className="mt-1 text-xs text-destructive">{err}</p>}
    </div>
  );
}
