'use client';

import { useState } from 'react';
import { ClipboardList, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { aiApi, type AiApiCode } from '@/lib/lumio/aiClient';
import { t, type UiLang } from '@/lib/lumio/i18n';
import { BANDS, type Band } from '@/lib/lumio/content';
import { AiBadge, AiLabel, AiMarkdown, aiErrKey } from './AiMarkdown';

type PaperQuestion = {
  text: string;
  options: string[];
  answer: number;
  marks: number;
  chapter: string;
  explanation: string;
};
type Paper = {
  title: string;
  sections: Array<{ name: string; instructions: string; questions: PaperQuestion[] }>;
  total: number;
  dropped: number;
};

/**
 * AI practice paper (chunk 5-AI feature 5): a generated, sectioned paper the
 * learner answers in-app and the app grades. Labelled everywhere: practice
 * paper, not official, no previous-year questions. Recording the result goes
 * through the EXISTING self-reported mock flow (honest, weak chapters feed
 * weakTopics) — the AI never writes the result itself.
 */

const EXAMS = ['school', 'jee', 'neet', 'cuet'] as const;

export function AiMockPaper({
  band,
  lang,
  subjects,
  chapterTitles,
  onRecordMock,
  aiAvailable,
  demo,
}: {
  band: Band;
  lang: UiLang;
  subjects: string[];
  chapterTitles: string[];
  onRecordMock: (mock: { date: string; subject: string; score: number; total: number; weakChapters: number[] }) => void;
  aiAvailable: boolean;
  demo?: boolean;
}) {
  const [phase, setPhase] = useState<'closed' | 'idle' | 'loading' | 'play' | 'error'>('closed');
  const [exam, setExam] = useState<(typeof EXAMS)[number]>('school');
  const [subject, setSubject] = useState(subjects[0] ?? '');
  const [count, setCount] = useState(8);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [errCode, setErrCode] = useState<AiApiCode | null>(null);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [graded, setGraded] = useState(false);

  const chapters = BAND_CHAPTERS[band] ?? [];

  const generate = async () => {
    setPhase('loading');
    setErrCode(null);
    const res = await aiApi.mock({
      exam,
      subject,
      chapters: chapterTitles.slice(0, 8),
      count,
      band,
      lang,
    });
    if (res.ok && res.data.data) {
      setPaper(res.data.data);
      setPicks({});
      setGraded(false);
      setPhase('play');
    } else {
      setErrCode(res.ok ? 'INVALID_RESPONSE' : res.code);
      setPhase('error');
    }
  };

  const allQuestions: Array<{ q: PaperQuestion; key: string }> = paper
    ? paper.sections.flatMap((s, si) => s.questions.map((q, qi) => ({ q, key: `${si}#${qi}` })))
    : [];

  const score = allQuestions.reduce((n, { q, key }) => n + (picks[key] === q.answer ? q.marks : 0), 0);
  const totalMarks = allQuestions.reduce((n, { q }) => n + q.marks, 0);
  // weakness analysis: chapters where the learner picked a wrong option
  const weakChapters = allQuestions
    .filter(({ q, key }) => picks[key] !== undefined && picks[key] !== q.answer)
    .map(({ q }) => {
      const idx = chapters.findIndex((c) => c.title === q.chapter);
      return idx >= 0 ? idx : -1;
    })
    .filter((i) => i >= 0);

  if (!aiAvailable) return null;

  return (
    <section aria-labelledby="ai-mock-heading" className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardList className="size-5 text-primary" aria-hidden="true" />
        <h2 id="ai-mock-heading" className="font-heading text-lg font-bold">
          {t(lang, 'ai.mockTitle')}
        </h2>
        <AiBadge demo={demo} lang={lang} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t(lang, 'ai.mockNote')}</p>

      {phase === 'closed' ? (
        <Button variant="outline" className="mt-3 min-h-[44px]" onClick={() => setPhase('idle')}>
          <Sparkles className="size-4 text-primary" aria-hidden="true" /> {t(lang, 'ai.mockOpen')}
        </Button>
      ) : phase === 'loading' ? (
        <div role="status" aria-live="polite" className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <p className="text-xs text-muted-foreground">{t(lang, 'ai.thinking')}</p>
        </div>
      ) : phase === 'error' ? (
        <div role="status" className="mt-3">
          <p className="rounded-xl bg-muted/60 p-3 text-sm">{errCode ? t(lang, aiErrKey(errCode)) : t(lang, 'ai.err.UNAVAILABLE')}</p>
          <Button variant="secondary" size="sm" className="mt-2 min-h-[44px]" onClick={() => void generate()}>
            {t(lang, 'ai.regenerate')}
          </Button>
        </div>
      ) : phase === 'idle' ? (
        <>
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold">{t(lang, 'ai.mockExam')}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={exam === e}
                  onClick={() => setExam(e)}
                  className={cn(
                    'press min-h-[44px] rounded-full border px-4 text-sm font-semibold uppercase',
                    exam === e ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-3">
            <legend className="text-sm font-semibold">{t(lang, 'ai.mockSubject')}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.slice(0, 8).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={subject === s}
                  onClick={() => setSubject(s)}
                  className={cn(
                    'press min-h-[44px] rounded-full border px-4 text-sm font-semibold',
                    subject === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/40'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="min-h-[44px]" onClick={() => void generate()}>
              <Sparkles className="size-4" aria-hidden="true" /> {t(lang, 'ai.mockGenerate')}
            </Button>
            <Button variant="ghost" className="min-h-[44px]" onClick={() => setPhase('closed')}>
              {t(lang, 'common.cancel')}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t(lang, 'ai.mockLabel')}</p>
        </>
      ) : (
        paper && (
          <>
            <div className="mt-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
                <h3 className="font-heading text-lg font-bold">{paper.title}</h3>
                <span className="text-sm text-muted-foreground">
                  {t(lang, 'ai.mockQCount').replace('{n}', String(allQuestions.length))}
                </span>
              </div>
              {paper.sections.map((s, si) => (
                <fieldset key={si} className="mt-4">
                  <legend className="text-sm font-bold">{s.name}</legend>
                  <p className="text-xs text-muted-foreground">{s.instructions}</p>
                  <ol className="mt-3 flex flex-col gap-4">
                    {s.questions.map((q, qi) => {
                      const key = `${si}#${qi}`;
                      const pick = picks[key];
                      const answered = graded && pick !== undefined;
                      return (
                        <li key={key}>
                          <p className="text-sm font-medium">
                            {qi + 1}. {q.text}{' '}
                            <span className="text-xs text-muted-foreground">[{q.marks} · {q.chapter}]</span>
                          </p>
                          <div className="mt-2 flex flex-col gap-2">
                            {q.options.map((opt, oi) => (
                              <button
                                key={oi}
                                type="button"
                                disabled={graded}
                                onClick={() => setPicks((p) => ({ ...p, [key]: oi }))}
                                aria-pressed={pick === oi}
                                className={cn(
                                  'press flex min-h-[44px] items-center gap-2 rounded-xl border-2 p-2.5 text-left text-sm font-medium',
                                  !graded && pick === oi && 'border-primary bg-primary/10',
                                  !graded && pick !== oi && 'border-border hover:border-primary/40',
                                  graded && oi === q.answer && 'border-success bg-success-soft text-success-soft-foreground',
                                  graded && pick === oi && oi !== q.answer && 'border-destructive bg-destructive/10 text-destructive',
                                  graded && oi !== q.answer && pick !== oi && 'border-border opacity-60'
                                )}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                          {answered && pick !== q.answer && (
                            <AiMarkdown text={q.explanation} className="mt-2" />
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </fieldset>
              ))}
            </div>

            {!graded ? (
              <Button className="mt-3 min-h-[44px]" onClick={() => setGraded(true)} disabled={Object.keys(picks).length < allQuestions.length}>
                {t(lang, 'ai.mockGrade')}
              </Button>
            ) : (
              <div className="mt-3 rounded-xl bg-primary/10 p-4">
                <p className="font-heading text-lg font-bold text-primary">
                  {t(lang, 'ai.mockScore').replace('{s}', String(score)).replace('{t}', String(totalMarks))}
                </p>
                {weakChapters.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <p className="text-xs text-muted-foreground">{t(lang, 'ai.mockWeak')}</p>
                    {[...new Set(weakChapters)].map((idx) => (
                      <Badge key={idx} variant="outline" className="text-xs font-normal">
                        {chapters[idx]?.title ?? q_chapterFallback(allQuestions, chapters[idx])}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => {
                      onRecordMock({
                        date: new Date().toISOString().slice(0, 10),
                        subject,
                        score,
                        total: totalMarks,
                        weakChapters: [...new Set(weakChapters)].sort((a, b) => a - b),
                      });
                      setPhase('closed');
                      setPaper(null);
                    }}
                  >
                    {t(lang, 'ai.mockRecord')}
                  </Button>
                  <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => void generate()}>
                    {t(lang, 'ai.mockNewPaper')}
                  </Button>
                </div>
              </div>
            )}
            {paper.dropped > 0 && (
              <p role="status" className="mt-2 text-xs text-muted-foreground">
                {t(lang, 'ai.betaDropped').replace('{n}', String(paper.dropped))}
              </p>
            )}
            <AiLabel
              feature="mockpaper"
              output={allQuestions.map(({ q }) => q.text).join('\n')}
              lang={lang}
              demo={demo}
            />
          </>
        )
      )}
    </section>
  );
}

function q_chapterFallback(_questions: Array<{ q: PaperQuestion }>, chapter?: { title: string }): string {
  return chapter?.title ?? 'Chapter';
}

/** chapter lists by band */
const BAND_CHAPTERS = BANDS as unknown as Record<Band, Array<{ title: string; subject: string }>>;
