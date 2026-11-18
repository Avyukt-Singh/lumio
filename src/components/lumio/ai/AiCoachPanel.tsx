'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { aiApi, type AiApiCode } from '@/lib/lumio/aiClient';
import { t, type UiLang } from '@/lib/lumio/i18n';
import { AiBadge, AiLabel, AiMarkdown, aiErrKey, useAiBudget } from './AiMarkdown';

/**
 * Study coach panel (chunk 5-AI feature 8): display-only AI explanations —
 * "why this plan", weekly reflection, question of the day. Reads aggregates
 * only; the schedule itself stays deterministic (planDay) and nothing here
 * can grant XP or move sessions.
 */

export function AiCoachPanel({
  mode,
  title,
  lang,
  band,
  planSummary,
  weakTopics,
  streak,
  xpLast7,
  focusMins7,
  mocksSummary,
  aiAvailable,
  demo,
}: {
  mode: 'why' | 'reflect' | 'qotd';
  /** label for the collapsed trigger */
  title: string;
  lang: UiLang;
  band: 'young' | 'middle' | 'sec' | 'senior' | 'dropper' | 'above';
  planSummary: string;
  weakTopics: string[];
  streak: number;
  xpLast7: number;
  focusMins7: number;
  mocksSummary: string;
  aiAvailable: boolean;
  demo?: boolean;
}) {
  const [phase, setPhase] = useState<'closed' | 'loading' | 'open' | 'error'>('closed');
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const [errCode, setErrCode] = useState<AiApiCode | null>(null);
  const { budget, refresh } = useAiBudget();

  const generate = async () => {
    setPhase('loading');
    setErrCode(null);
    const res = await aiApi.coach({ mode, planSummary, weakTopics, streak, xpLast7, focusMins7, mocksSummary, band, lang });
    if (res.ok && res.data.data) {
      setText(res.data.data.text);
      setLabel(res.data.label ?? '');
      setPhase('open');
      void refresh();
    } else {
      setErrCode(res.ok ? 'INVALID_RESPONSE' : res.code);
      setPhase('error');
    }
  };

  if (!aiAvailable) return null;

  if (phase === 'closed') {
    return (
      <div className="mt-3">
        <Button variant="outline" size="sm" className="press min-h-[44px]" onClick={() => void generate()}>
          <Sparkles className="size-4 text-primary" aria-hidden="true" /> {title}
        </Button>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div role="status" aria-live="polite" className="mt-3 flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <p className="text-xs text-muted-foreground">{t(lang, 'ai.thinking')}</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div role="status" className="mt-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <AiBadge demo={demo} lang={lang} />
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</p>
        </div>
        <p className="mt-2 rounded-xl bg-muted/60 p-3 text-sm">{errCode ? t(lang, aiErrKey(errCode)) : t(lang, 'ai.err.UNAVAILABLE')}</p>
        <Button variant="secondary" size="sm" className="mt-2 min-h-[44px]" onClick={() => void generate()}>
          {t(lang, 'ai.regenerate')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <AiBadge demo={demo} lang={lang} />
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</p>
      </div>
      <AiMarkdown text={text} className="mt-2" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => void generate()}>
          {t(lang, 'ai.regenerate')}
        </Button>
        {budget && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {t(lang, 'ai.budgetLeft').replace('{n}', String(budget.callsLeft)).replace('{cap}', String(budget.callsCap))}
          </span>
        )}
      </div>
      <AiLabel feature={`coach-${mode}`} output={text} lang={lang} demo={demo} />
      <span className="hidden">{label}</span>
    </div>
  );
}
