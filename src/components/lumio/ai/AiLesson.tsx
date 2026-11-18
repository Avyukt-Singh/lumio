'use client';

import { useState } from 'react';
import { BookOpenText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { aiApi, type AiApiCode, type LessonAiResult } from '@/lib/lumio/aiClient';
import { t, type UiLang, type DictKey } from '@/lib/lumio/i18n';
import type { Band, Chapter } from '@/lib/lumio/content';
import { glossaryFor, keyPointsFor } from '@/lib/lumio/chapterContent';
import { AiBadge, AiLabel, AiMarkdown, aiErrKey, fillVars, useAiBudget } from './AiMarkdown';

/**
 * AI chapter lesson (chunk 5-AI feature 1): a fresh, clearly-labelled study
 * set for the chapter — sections, key points, glossary, flashcards — with the
 * follow-up actions "Explain simpler", "Give an example" and "Explain in
 * Hindi/Hinglish". The deterministic Reader material is the fallback and is
 * never replaced in state; saving an accepted lesson is practice-only
 * (no XP, replay-safe via the ai-content-saved event).
 */

export function AiLesson({
  band,
  chapterIndex,
  chapter,
  lang,
  today,
  aiAvailable,
  demo,
  saved,
  interest,
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
  /** a lesson save for this chapter + language already exists */
  saved: boolean;
  /** the learner's interest area (above-band personalisation), optional */
  interest?: string;
  onSaveAi: (
    kind: 'lesson',
    id: string,
    date: string,
    payload: LessonAiResult,
    label: string,
  ) => void;
}) {
  const [phase, setPhase] = useState<'closed' | 'loading' | 'open' | 'error'>('closed');
  const [lesson, setLesson] = useState<LessonAiResult | null>(null);
  const [mode, setMode] = useState<'full' | 'simpler' | 'example' | 'translate'>('full');
  const [label, setLabel] = useState('');
  const [errCode, setErrCode] = useState<AiApiCode | null>(null);
  const [savedLocal, setSavedLocal] = useState(false);
  const { budget, refresh: refreshBudget } = useAiBudget();

  const cid = `${band}#${chapterIndex}`;

  const generate = async (nextMode: typeof mode, point?: string) => {
    setMode(nextMode);
    setPhase('loading');
    setErrCode(null);
    const res = await aiApi.lesson({
      chapterId: cid,
      chapterTitle: chapter.title,
      subject: chapter.subject,
      summary: chapter.summary,
      keyPoints: keyPointsFor(chapter),
      glossary: glossaryFor(chapter),
      mode: nextMode,
      point,
      interest,
      band,
      lang,
    });
    if (res.ok && res.data.data) {
      setLesson(res.data.data);
      setLabel(res.data.label ?? '');
      setPhase('open');
      void refreshBudget();
    } else {
      setErrCode(res.ok ? 'INVALID_RESPONSE' : res.code);
      setPhase('error');
    }
  };

  // Honest gating: hidden entirely when the capability probe says AI is off.
  if (!aiAvailable) return null;

  if (phase === 'closed') {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-border p-3">
        <p className="text-sm text-muted-foreground">{t(lang, 'ai.lessonIntro')}</p>
        <Button
          variant="outline"
          size="sm"
          className="press mt-2 min-h-[44px]"
          onClick={() => void generate('full')}
        >
          <Sparkles className="size-4 text-primary" aria-hidden="true" />{' '}
          {t(lang, 'ai.lessonGenerate')}
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
        <Skeleton className="h-4 w-2/3" />
        <p className="text-xs text-muted-foreground">{t(lang, 'ai.thinking')}</p>
      </div>
    );
  }

  if (phase === 'error' || !lesson) {
    return (
      <div className="mt-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t(lang, 'ai.lessonTitle')}
        </p>
        <div role="status" className="mt-2 rounded-xl bg-muted/60 p-3 text-sm">
          {errCode ? t(lang, aiErrKey(errCode)) : t(lang, 'ai.err.UNAVAILABLE')}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t(lang, 'ai.lessonFallback')}</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-3 min-h-[44px]"
          onClick={() => void generate(mode)}
        >
          {t(lang, 'ai.regenerate')}
        </Button>
      </div>
    );
  }

  const alreadySaved = saved || savedLocal;
  const actionLabel: Record<typeof mode, DictKey> = {
    full: 'ai.lessonGenerate',
    simpler: 'ai.lessonSimpler',
    example: 'ai.lessonExample',
    translate: 'ai.lessonTranslate',
  };

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <AiBadge demo={demo} lang={lang} />
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {t(lang, 'ai.lessonTitle')}
        </p>
      </div>
      <p className="mt-1 text-sm font-medium text-muted-foreground">{t(lang, 'ai.lessonLabel')}</p>

      {lesson.sections.map((s, i) => (
        <section key={i} className="mt-3 first:mt-2">
          <h3 className="font-heading text-sm font-bold">{s.heading}</h3>
          <AiMarkdown text={s.text} />
        </section>
      ))}

      <h3 className="mt-4 font-heading text-sm font-bold">{t(lang, 'ai.lessonKeyPoints')}</h3>
      <ul className="mt-1.5 flex flex-col gap-1.5">
        {lesson.keyPoints.map((p, i) => (
          <li key={i} className="flex items-start gap-2 rounded-xl bg-muted/60 p-2.5 text-sm">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      {lesson.glossary.length > 0 && (
        <>
          <h3 className="mt-4 font-heading text-sm font-bold">{t(lang, 'ai.lessonGlossary')}</h3>
          <dl className="mt-1.5 flex flex-col gap-1.5">
            {lesson.glossary.map((g, i) => (
              <div key={i} className="rounded-xl bg-muted/60 p-2.5 text-sm">
                <dt className="font-semibold">{g.term}</dt>
                <dd className="text-muted-foreground">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {lesson.flashcards.length > 0 && (
        <>
          <h3 className="mt-4 font-heading text-sm font-bold">{t(lang, 'ai.lessonCards')}</h3>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {lesson.flashcards.map((c, i) => (
              <li key={i} className="rounded-xl border border-border p-2.5 text-sm">
                <span className="font-semibold">{c.front}</span>
                <span className="text-muted-foreground"> — {c.back}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Follow-up actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {mode !== 'simpler' && (
          <Button
            variant="secondary"
            size="sm"
            className="min-h-[44px]"
            onClick={() => void generate('simpler')}
          >
            {t(lang, 'ai.lessonSimpler')}
          </Button>
        )}
        {mode !== 'example' && (
          <Button
            variant="secondary"
            size="sm"
            className="min-h-[44px]"
            onClick={() => void generate('example')}
          >
            {t(lang, 'ai.lessonExample')}
          </Button>
        )}
        {mode !== 'translate' && lang !== 'hi' && (
          <Button
            variant="secondary"
            size="sm"
            className="min-h-[44px]"
            onClick={() => void generate('translate')}
          >
            {t(lang, 'ai.lessonTranslate')}
          </Button>
        )}
        {mode !== 'full' && (
          <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => void generate('full')}>
            {t(lang, 'ai.lessonBackToFull')}
          </Button>
        )}
      </div>

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
            onClick={() => {
              onSaveAi('lesson', `lesson#${cid}#${lang}#${Date.now()}`, today, lesson, label);
              setSavedLocal(true);
            }}
          >
            {t(lang, 'ai.save')}
          </Button>
        )}
        {budget && (
          <span className={cn('text-[11px] tabular-nums text-muted-foreground')}>
            {fillVars(t(lang, 'ai.budgetLeft'), { n: budget.callsLeft, cap: budget.callsCap })}
          </span>
        )}
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <BookOpenText className="size-3.5" aria-hidden="true" /> {t(lang, 'ai.lessonFallbackNote')}
      </p>

      <AiLabel
        feature="lesson"
        output={[...lesson.keyPoints, ...lesson.sections.map((s) => s.text)].join('\n').trim()}
        lang={lang}
        demo={demo}
      />
      {/* mode label kept for the report flow */}
      <span className="hidden">{t(lang, actionLabel[mode])}</span>
    </div>
  );
}
