'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { aiApi, type AiApiCode, type PracticeAiItem } from '@/lib/lumio/aiClient';
import { t, type UiLang } from '@/lib/lumio/i18n';
import type { Band, Chapter } from '@/lib/lumio/content';
import { keyPointsFor } from '@/lib/lumio/chapterContent';
import { AiBadge, AiLabel, AiMarkdown, aiErrKey, fillVars, useAiBudget } from './AiMarkdown';

/**
 * Beta practice generator (chunk 5B, Tier 2): "More questions like this" for a
 * chapter. AI-written items are answerable here with LOCAL state only — no XP,
 * no streak, no SRS (contract rule 1). Items carry the beta label; items the
 * server's checks rejected are reported honestly (dropped count). Saving keeps
 * a practice-only record via the `ai-generated` event (replay-safe, capped).
 */

export function AiPracticeBeta({
  band,
  chapterIndex,
  chapter,
  lang,
  today,
  aiAvailable,
  demo,
  saved,
  onSaveAi,
}: {
  band: Band;
  chapterIndex: number;
  chapter: Chapter;
  lang: UiLang;
  /** learner-local yyyy-mm-dd date stamp for the save record */
  today: string;
  aiAvailable: boolean;
  demo?: boolean;
  /** a save for this chapter + language already exists in state.aiContent */
  saved: boolean;
  onSaveAi: (
    kind: 'practice',
    id: string,
    date: string,
    payload: { items: PracticeAiItem[] },
    label: string,
  ) => void;
}) {
  const [phase, setPhase] = useState<'closed' | 'loading' | 'open' | 'error'>('closed');
  const [items, setItems] = useState<PracticeAiItem[]>([]);
  const [dropped, setDropped] = useState(0);
  const [label, setLabel] = useState('');
  const [errCode, setErrCode] = useState<AiApiCode | null>(null);
  const [picks, setPicks] = useState<Record<number, number | null>>({});
  const [savedLocal, setSavedLocal] = useState(false);
  const [saving, setSaving] = useState(false);
  const { budget, refresh: refreshBudget } = useAiBudget();

  const chapterId = `${band}#${chapterIndex}`;

  const generate = async () => {
    setPhase('loading');
    setErrCode(null);
    setPicks({});
    const res = await aiApi.practice({
      chapterId,
      chapterTitle: chapter.title,
      subject: chapter.subject,
      summary: chapter.summary,
      keyPoints: keyPointsFor(chapter),
      sample: chapter.questions[0]
        ? {
            text: chapter.questions[0].text,
            options: chapter.questions[0].options,
            answer: chapter.questions[0].answer,
            explanation: chapter.questions[0].explanation,
          }
        : null,
      count: 5,
      band,
      lang,
    });
    if (res.ok && Array.isArray(res.data.data?.items) && res.data.data.items.length > 0) {
      setItems(res.data.data.items);
      setDropped(typeof res.data.dropped === 'number' ? res.data.dropped : 0);
      setLabel(res.data.label ?? '');
      setPhase('open');
      void refreshBudget();
    } else {
      setItems([]);
      setErrCode(res.ok ? 'INVALID_RESPONSE' : res.code);
      setPhase('error');
    }
  };

  const save = () => {
    if (saving || items.length === 0) return;
    setSaving(true);
    onSaveAi(
      'practice',
      `practice#${chapterId}#${lang}#${Date.now()}`,
      today,
      { items },
      label,
    );
    setSaving(false);
    setSavedLocal(true);
  };

  const pickOption = (itemIdx: number, optIdx: number) => {
    setPicks((prev) => (prev[itemIdx] === undefined ? { ...prev, [itemIdx]: optIdx } : prev));
  };

  // Honest gating: hidden entirely when the capability probe says AI is off.
  if (!aiAvailable) return null;

  if (phase === 'closed') {
    return (
      <div className="mt-3">
        <Button
          variant="outline"
          size="sm"
          className="press min-h-[44px]"
          onClick={() => void generate()}
        >
          <Sparkles className="size-4 text-primary" aria-hidden="true" />{' '}
          {t(lang, 'ai.betaMore')}
        </Button>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-3 flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
      >
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <p className="text-xs text-muted-foreground">{t(lang, 'ai.thinking')}</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="mt-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t(lang, 'ai.betaMore')}
        </p>
        <div role="status" className="mt-2 rounded-xl bg-muted/60 p-3 text-sm">
          {errCode ? t(lang, aiErrKey(errCode)) : t(lang, 'ai.err.UNAVAILABLE')}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3 min-h-[44px]"
          onClick={() => void generate()}
        >
          {t(lang, 'ai.regenerate')}
        </Button>
      </div>
    );
  }

  const alreadySaved = saved || savedLocal;

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <AiBadge demo={demo} lang={lang} />
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t(lang, 'ai.betaMore')}
        </p>
      </div>
      <p className="mt-1 text-sm font-medium text-muted-foreground">
        {t(lang, 'ai.betaLabel')}
      </p>

      <ol className="mt-3 flex flex-col gap-4">
        {items.map((item, i) => {
          const pick = picks[i];
          const answered = pick !== undefined && pick !== null;
          return (
            <li key={i} className="rounded-xl border border-border p-3">
              <p className="text-sm font-medium">
                {i + 1}. {item.text}
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {(item.options ?? []).map((opt, j) => {
                  const isAnswer = j === item.answer;
                  return (
                    <button
                      key={j}
                      type="button"
                      disabled={answered}
                      onClick={() => pickOption(i, j)}
                      aria-pressed={answered ? pick === j : undefined}
                      className={cn(
                        'press flex min-h-[44px] items-center gap-2 rounded-xl border-2 p-2.5 text-left text-sm font-medium',
                        !answered && 'border-border hover:border-primary/40',
                        answered &&
                          isAnswer &&
                          'border-success bg-success-soft text-success-soft-foreground',
                        answered &&
                          pick === j &&
                          !isAnswer &&
                          'border-destructive bg-destructive/10 text-destructive',
                        answered && !isAnswer && pick !== j && 'border-border opacity-60'
                      )}
                    >
                      <span
                        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold"
                        aria-hidden="true"
                      >
                        {String.fromCharCode(65 + j)}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {answered && item.explanation && (
                <div role="status" className="mt-2">
                  <AiMarkdown text={item.explanation} />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-xs font-medium text-muted-foreground">{t(lang, 'ai.noXp')}</p>
      {dropped > 0 && (
        <p role="status" className="mt-1 text-xs text-muted-foreground">
          {fillVars(t(lang, 'ai.betaDropped'), { n: dropped })}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {alreadySaved ? (
          <span
            className="inline-flex min-h-[36px] items-center rounded-full bg-success-soft px-3 text-xs font-semibold text-success-soft-foreground"
            aria-label={t(lang, 'ai.savedChip')}
          >
            {t(lang, 'ai.savedChip')}
          </span>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="min-h-[44px]"
            onClick={save}
            disabled={saving}
          >
            {t(lang, 'ai.save')}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="min-h-[44px]"
          onClick={() => void generate()}
        >
          {t(lang, 'ai.regenerate')}
        </Button>
        {budget && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {fillVars(t(lang, 'ai.budgetLeft'), { n: budget.callsLeft, cap: budget.callsCap })}
          </span>
        )}
      </div>

      <AiLabel
        feature="practice"
        output={items
          .map((item) => `${item.text}\n${item.explanation ?? ''}`)
          .join('\n')
          .trim()}
        lang={lang}
        demo={demo}
      />
    </div>
  );
}
