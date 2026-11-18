'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { aiApi, type AiApiCode } from '@/lib/lumio/aiClient';
import { t, type UiLang } from '@/lib/lumio/i18n';
import { AiBadge, AiLabel, AiMarkdown, aiErrKey } from './AiMarkdown';

/**
 * Guardian narrative (chunk 5-AI feature 9): an optional, kind, plain-language
 * weekly summary generated ONLY from the aggregate numbers already shown on
 * the Guardian screen (days active, XP, focus minutes, chapters, mocks,
 * streak). Consent-gated behind the same switch as the whole Guardian screen;
 * printable via the existing .print-area CSS; never any raw answers or notes.
 */

export function AiGuardian({
  lang,
  daysActive7,
  xp7,
  focusMins7,
  chaptersCompleted,
  chaptersMastered,
  mocks7,
  streak,
  consent,
  aiAvailable,
  demo,
}: {
  lang: UiLang;
  daysActive7: number;
  xp7: number;
  focusMins7: number;
  chaptersCompleted: number;
  chaptersMastered: number;
  mocks7: number;
  streak: number;
  /** the existing guardian-summary consent (whole screen is behind it) */
  consent: boolean;
  aiAvailable: boolean;
  demo?: boolean;
}) {
  const [phase, setPhase] = useState<'closed' | 'loading' | 'open' | 'error'>('closed');
  const [data, setData] = useState<{ headline: string; text: string } | null>(null);
  const [errCode, setErrCode] = useState<AiApiCode | null>(null);

  const generate = async () => {
    setPhase('loading');
    setErrCode(null);
    const res = await aiApi.guardian({
      daysActive7,
      xp7,
      focusMins7,
      chaptersCompleted,
      chaptersMastered,
      mocks7,
      streak,
      lang,
    });
    if (res.ok && res.data.data) {
      setData(res.data.data);
      setPhase('open');
    } else {
      setErrCode(res.ok ? 'INVALID_RESPONSE' : res.code);
      setPhase('error');
    }
  };

  if (!aiAvailable || !consent) return null;

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <AiBadge demo={demo} lang={lang} />
        <p className="text-sm font-semibold">{t(lang, 'ai.guardianTitle')}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t(lang, 'ai.guardianNote')}</p>

      {phase === 'closed' ? (
        <Button variant="outline" size="sm" className="mt-2 min-h-[44px]" onClick={() => void generate()}>
          <Sparkles className="size-4 text-primary" aria-hidden="true" /> {t(lang, 'ai.guardianGenerate')}
        </Button>
      ) : phase === 'loading' ? (
        <div role="status" aria-live="polite" className="mt-2 flex flex-col gap-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : phase === 'error' ? (
        <div role="status" className="mt-2">
          <p className="rounded-xl bg-muted/60 p-3 text-sm">{errCode ? t(lang, aiErrKey(errCode)) : t(lang, 'ai.err.UNAVAILABLE')}</p>
          <Button variant="secondary" size="sm" className="mt-2 min-h-[44px]" onClick={() => void generate()}>
            {t(lang, 'ai.regenerate')}
          </Button>
        </div>
      ) : (
        data && (
          <div className="mt-2 rounded-xl bg-muted/60 p-3">
            <p className="font-heading text-sm font-bold">{data.headline}</p>
            <AiMarkdown text={data.text} className="mt-1" />
            <Button variant="ghost" size="sm" className="mt-2 min-h-[44px]" onClick={() => void generate()}>
              {t(lang, 'ai.regenerate')}
            </Button>
          </div>
        )
      )}

      {phase === 'open' && data && (
        <AiLabel feature="guardian" output={`${data.headline}\n${data.text}`} lang={lang} demo={demo} />
      )}
    </div>
  );
}
