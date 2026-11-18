'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { aiApi, type MistakeAiResult, type PracticeAiItem } from '@/lib/lumio/aiClient';
import { t, type UiLang, type DictKey } from '@/lib/lumio/i18n';
import type { Band, Question } from '@/lib/lumio/content';
import type { MistakeTag } from '@/lib/lumio/types';
import { AiLabel, AiMarkdown, aiErrKey, fillVars } from './AiMarkdown';

/**
 * "Explain my mistake" card (chunk 5B): asks aiApi.mistake for a live question
 * and the learner's chosen option (null in the Mistake Notebook). Renders an
 * explanation, the likely misconception and ONE practice question answered
 * with local state only — never any XP (contract rule 1). On ANY failure the
 * card falls back to the authored question explanation; it never shows an
 * error card. Results are cached per question id to avoid repeat calls.
 */

const cache = new Map<string, MistakeAiResult>();

export function AiMistakeCard({
  id,
  band,
  lang,
  chapterTitle,
  subject,
  question,
  chosen,
  aiAvailable,
  demo,
  tagged,
  onConfirmTag,
}: {
  id: string; // stable question id — cache key
  band: Band;
  lang: UiLang;
  chapterTitle: string;
  subject: string;
  question: Question;
  chosen: number | null;
  aiAvailable: boolean;
  demo?: boolean;
  /** chunk 5-AI feature 7: the learner's current tag for this question */
  tagged?: MistakeTag | null;
  /** confirm the AI-suggested tag (dispatches mistake-tagged via LumioApp) */
  onConfirmTag?: (questionId: string, tag: MistakeTag) => void;
}) {
  const [state, setState] = useState<'closed' | 'loading' | 'open' | 'fallback'>('closed');
  const [result, setResult] = useState<MistakeAiResult | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [tagSaved, setTagSaved] = useState(false);
  // chunk 5-AI feature 7: "3 questions on this exact slip"
  const [slipPhase, setSlipPhase] = useState<'idle' | 'loading' | 'open' | 'error'>('idle');
  const [slipItems, setSlipItems] = useState<PracticeAiItem[]>([]);
  const [slipErr, setSlipErr] = useState<string | null>(null);
  const [slipPicks, setSlipPicks] = useState<Record<number, number | null>>({});

  const load = async () => {
    const cached = cache.get(id);
    if (cached) {
      setResult(cached);
      setPick(null);
      setState('open');
      return;
    }
    setState('loading');
    const res = await aiApi.mistake({
      chapterTitle,
      subject,
      question: {
        text: question.text,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
      },
      chosen,
      band,
      lang,
    });
    if (res.ok && res.data?.data) {
      cache.set(id, res.data.data);
      setResult(res.data.data);
      setPick(null);
      setState('open');
    } else {
      // Honest fallback: the authored explanation, never an error card.
      setState('fallback');
    }
  };

  const TAG_KEY: Record<MistakeTag, DictKey> = {
    concept: 'ai.tagConcept',
    careless: 'ai.tagCareless',
    calculation: 'ai.tagCalculation',
    fact: 'ai.tagFact',
  };

  const generateSlipSet = async () => {
    setSlipPhase('loading');
    setSlipErr(null);
    const res = await aiApi.practice({
      chapterId: `slip#${id.slice(0, 40)}`,
      chapterTitle,
      subject,
      summary: chapterTitle,
      keyPoints: [question.explanation],
      sample: {
        text: question.text,
        options: question.options,
        answer: question.answer,
        explanation: question.explanation,
      },
      count: 3,
      band,
      lang,
    });
    if (res.ok && Array.isArray(res.data.data?.items) && res.data.data.items.length > 0) {
      setSlipItems(res.data.data.items);
      setSlipPicks({});
      setSlipPhase('open');
    } else {
      setSlipErr(res.ok ? 'INVALID_RESPONSE' : res.code);
      setSlipPhase('error');
    }
  };

  // Honest gating: hidden entirely when AI is off.
  if (!aiAvailable) return null;

  if (state === 'closed') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="press mt-2 min-h-[44px] w-fit"
        onClick={() => void load()}
      >
        <Sparkles className="size-4 text-primary" aria-hidden="true" /> {t(lang, 'ai.mistakeTitle')}
      </Button>
    );
  }

  if (state === 'loading') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-2 flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
      >
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {t(lang, 'ai.mistakeTitle')}
      </p>
      {state === 'fallback' ? (
        <>
          <AiMarkdown text={question.explanation} className="mt-2" />
          <p className="mt-2 text-xs text-muted-foreground">{t(lang, 'ai.mistakeFallback')}</p>
        </>
      ) : (
        result && (
          <>
            <AiMarkdown text={result.explanation} className="mt-2" />
            {result.misconception && (
              <div className="mt-2 rounded-xl bg-muted/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(lang, 'ai.mistakeMixup')}
                </p>
                <AiMarkdown text={result.misconception} className="mt-1" />
              </div>
            )}
            {/* chunk 5-AI feature 7: AI-suggested mistake tag — learner confirms */}
            {result.suggestedTag && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-border p-3">
                <p className="text-sm">
                  {t(lang, 'ai.tagSuggests')}{' '}
                  <span className="font-semibold">{t(lang, TAG_KEY[result.suggestedTag])}</span>
                </p>
                {tagSaved || (tagged && tagged === result.suggestedTag) ? (
                  <span className="inline-flex min-h-[36px] items-center rounded-full bg-success-soft px-3 text-xs font-semibold text-success-soft-foreground">
                    {t(lang, 'ai.tagSaved')}
                  </span>
                ) : (
                  onConfirmTag && result.suggestedTag && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-[44px]"
                      onClick={() => {
                        onConfirmTag(id, result.suggestedTag as MistakeTag);
                        setTagSaved(true);
                      }}
                    >
                      {t(lang, 'ai.tagConfirm')}
                    </Button>
                  )
                )}
              </div>
            )}
            {/* chunk 5-AI feature 7: 3 questions on this exact slip (practice-only) */}
            <div className="mt-3">
              {slipPhase === 'idle' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => void generateSlipSet()}
                >
                  <Sparkles className="size-4 text-primary" aria-hidden="true" /> {t(lang, 'ai.slipMore')}
                </Button>
              )}
              {slipPhase === 'loading' && (
                <div role="status" aria-live="polite" className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              )}
              {slipPhase === 'error' && (
                <div role="status">
                  <p className="rounded-xl bg-muted/60 p-3 text-sm">
                    {slipErr ? t(lang, aiErrKey(slipErr as never)) : t(lang, 'ai.err.UNAVAILABLE')}
                  </p>
                  <Button variant="secondary" size="sm" className="mt-2 min-h-[44px]" onClick={() => void generateSlipSet()}>
                    {t(lang, 'ai.regenerate')}
                  </Button>
                </div>
              )}
              {slipPhase === 'open' && (
                <fieldset className="rounded-xl border border-border p-3">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(lang, 'ai.slipSetTitle')} · {t(lang, 'ai.noXp')}
                  </legend>
                  <ol className="mt-2 flex flex-col gap-3">
                    {slipItems.map((item, i) => {
                      const sp = slipPicks[i];
                      const answered = sp !== undefined && sp !== null;
                      return (
                        <li key={i}>
                          <p className="text-sm font-medium">{item.text}</p>
                          <div className="mt-1.5 flex flex-col gap-1.5">
                            {item.options.map((opt, j) => (
                              <button
                                key={j}
                                type="button"
                                disabled={answered}
                                onClick={() => setSlipPicks((p) => (p[i] === undefined ? { ...p, [i]: j } : p))}
                                aria-pressed={answered ? sp === j : undefined}
                                className={cn(
                                  'press flex min-h-[44px] items-center gap-2 rounded-xl border-2 p-2.5 text-left text-sm font-medium',
                                  !answered && 'border-border hover:border-primary/40',
                                  answered && j === item.answer && 'border-success bg-success-soft text-success-soft-foreground',
                                  answered && sp === j && j !== item.answer && 'border-destructive bg-destructive/10 text-destructive',
                                  answered && j !== item.answer && sp !== j && 'border-border opacity-60'
                                )}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                          {answered && <AiMarkdown text={item.explanation} className="mt-1.5" />}
                        </li>
                      );
                    })}
                  </ol>
                </fieldset>
              )}
            </div>
            {result.practice && (
              <fieldset className="mt-3 rounded-xl border border-border p-3">
                <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(lang, 'ai.practiceQ')} · {t(lang, 'ai.noXp')}
                </legend>
                <p className="text-sm font-medium">{result.practice.text}</p>
                <div className="mt-2 flex flex-col gap-2">
                  {result.practice.options.map((opt, i) => {
                    const answered = pick !== null;
                    const isAnswer = i === result.practice.answer;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={answered}
                        onClick={() => setPick(i)}
                        aria-pressed={pick === i}
                        className={cn(
                          'press flex min-h-[44px] items-center gap-2 rounded-xl border-2 p-2.5 text-left text-sm font-medium',
                          !answered && 'border-border hover:border-primary/40',
                          answered && isAnswer && 'border-success bg-success-soft text-success-soft-foreground',
                          answered && pick === i && !isAnswer && 'border-destructive bg-destructive/10 text-destructive',
                          answered && !isAnswer && pick !== i && 'border-border opacity-60'
                        )}
                      >
                        <span
                          className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold"
                          aria-hidden="true"
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {pick !== null && (
                  <div role="status" className="mt-2">
                    <AiMarkdown text={result.practice.explanation} />
                  </div>
                )}
              </fieldset>
            )}
          </>
        )
      )}
      <AiLabel
        feature="mistake"
        output={
          result
            ? `${result.explanation}\n${result.misconception}`
            : question.explanation
        }
        lang={lang}
        demo={demo}
      />
    </div>
  );
}
