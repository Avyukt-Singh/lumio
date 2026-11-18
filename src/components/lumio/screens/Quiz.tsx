'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, PartyPopper, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Mascot } from '../Mascot';
import { AiMistakeCard } from '../ai/AiMistakeCard';
import { cn } from '@/lib/utils';
import { BANDS, type Band, type Chapter } from '@/lib/lumio/content';
import { chapterId, quizXpBreakdown, AI_QUIZ_XP_DAILY_CAP } from '@/lib/lumio/domain';
import { aiApi, type AiApiCode, type QuizGenItem } from '@/lib/lumio/aiClient';
import { aiErrKey } from '../ai/AiMarkdown';
import { tFor } from '@/lib/lumio/i18n';
import type { LumioState, MistakeTag } from '@/lib/lumio/types';

/**
 * Quiz engine (chunk 2, 3.6 + 7.5): one question at a time, per-question
 * feedback with the explanation, XP rules (base + improvement + score bonus)
 * on finish, mastery labels (best == nq mastered, best >= 1 completed), stable
 * question ids for wrong answers, and a kind celebration — no pressure, no guilt.
 */

export interface QuizOutcome {
  score: number;
  nq: number;
  wrongIds: string[];
  xpGain: number;
  baseXp: number;
  improvementXp: number;
  bonus80: number;
  bonus100: number;
  firstAttempt: boolean;
  prevBest: number;
  mastered: boolean;
  completed: boolean;
}

export function Quiz({
  state,
  band,
  chapterIndex,
  chapter,
  onBack,
  onFinish,
  onFinishAi,
  onTagMiss,
  aiAvailable,
  demo,
}: {
  state: LumioState;
  band: Band;
  chapterIndex: number;
  chapter: Chapter;
  onBack: () => void;
  onFinish: (outcome: QuizOutcome) => void;
  /** chunk 5-AI: AI fresh-quiz completion (dispatches ai-quiz-attempted) */
  onFinishAi?: (r: { quizHash: string; score: number; nq: number; wrongIds: string[] }) => void;
  /** chunk 5-AI feature 7: confirm the AI-suggested mistake tag */
  onTagMiss?: (questionId: string, tag: MistakeTag) => void;
  /** chunk 5B: AI explain-my-mistake gating */
  aiAvailable?: boolean;
  demo?: boolean;
}) {
  const lang = state.profile?.lang ?? 'en';
  const tr = tFor(lang);
  const cid = chapterId(band, chapterIndex);
  const nq = chapter.questions.length;
  const prevBest = state.res[cid]?.best ?? 0;
  const firstAttempt = !state.res[cid];

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);

  // ---- chunk 5-AI feature 2: AI-generated fresh quiz ----
  const [aiSet, setAiSet] = useState<{ items: QuizGenItem[]; hash: string; dropped: number } | null>(null);
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [aiPhase, setAiPhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [aiErr, setAiErr] = useState<AiApiCode | null>(null);

  // AI controls are open to everyone — the only limit is the fair-use budget.
  const aiGateOk = aiAvailable === true;
  // Best score per chapter across ALL generated sets + today's capped total:
  // the same numbers applyEvent enforces, shown honestly before playing.
  const aiBest = state.aiQuizBest[cid] ?? 0;
  const todayKey = (() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: state.profile?.tz ?? 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  })();
  const aiXpToday = state.xpLedger
    .filter((x) => x.source === 'aiquiz' && x.date === todayKey)
    .reduce((n, x) => n + x.amount, 0);
  const aiCapLeft = Math.max(0, AI_QUIZ_XP_DAILY_CAP - aiXpToday);

  // Texts of this chapter's questions the learner previously missed — powers
  // "more like the ones I got wrong" (never copied, only informs the topics).
  const missedTexts = Object.keys(state.wrong)
    .filter((id) => id.startsWith(`${cid}#`))
    .map((id) => chapter.questions[Number(id.split('#')[2])]?.text)
    .filter((x): x is string => !!x)
    .slice(0, 6);

  const generateAiQuiz = async (useMisses: boolean) => {
    setAiPhase('loading');
    setAiErr(null);
    const res = await aiApi.quizGen({
      chapterId: cid,
      chapterTitle: chapter.title,
      subject: chapter.subject,
      summary: chapter.summary,
      keyPoints: chapter.questions.slice(0, 6).map((q) => q.explanation),
      difficulty: aiDifficulty,
      count: 5,
      wrongTexts: useMisses ? missedTexts : undefined,
      band,
      lang,
    });
    if (res.ok && res.data.data && Array.isArray(res.data.data.items) && res.data.data.items.length >= 3) {
      // Switch the active set to the generated one — engine flow is identical.
      setAiSet({ items: res.data.data.items, hash: res.data.outputHash, dropped: typeof res.data.dropped === 'number' ? res.data.dropped : 0 });
      setIdx(0);
      setPicked(null);
      setChecked(false);
      setCorrectCount(0);
      setWrongIds([]);
      setPicks({});
      setDone(false);
      setAiPhase('idle');
    } else {
      setAiErr(res.ok ? 'INVALID_RESPONSE' : res.code);
      setAiPhase('error');
    }
  };

  const backToAuthored = () => {
    setAiSet(null);
    setIdx(0);
    setPicked(null);
    setChecked(false);
    setCorrectCount(0);
    setWrongIds([]);
    setPicks({});
    setDone(false);
    setAiPhase('idle');
  };

  // Active question set: generated items or the authored chapter questions.
  const questions: Array<{ text: string; options: string[]; answer: number; explanation: string }> = aiSet
    ? aiSet.items
    : chapter.questions;
  const activeNq = questions.length;
  const q = questions[idx];

  const check = () => {
    if (picked === null || checked) return;
    setChecked(true);
    setPicks((p) => ({ ...p, [idx]: picked }));
    if (picked === q.answer) {
      setCorrectCount((c) => c + 1);
    } else {
      // Stable id: authored questions key by chapter index, AI items by the
      // set's content hash — both replay-safe and never text-keyed.
      setWrongIds((w) => [...w, aiSet ? `ai:${aiSet.hash}#${idx}` : `${cid}#${idx}`]);
    }
  };

  const next = () => {
    if (idx + 1 >= activeNq) {
      setDone(true);
      return;
    }
    setIdx(idx + 1);
    setPicked(null);
    setChecked(false);
  };

  if (done) {
    // ---- chunk 5-AI: AI fresh-quiz result — deterministic improvement XP
    // against the per-chapter best across ALL generated sets, under the same
    // daily cap applyEvent enforces. No base/bonus rules — capped improvement only.
    if (aiSet) {
      const rawGain = Math.max(0, correctCount - aiBest) * 10;
      const aiXpGain = Math.min(rawGain, aiCapLeft);
      return (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
          <section
            aria-labelledby="quiz-result-ai"
            className="anim-pop rounded-2xl border border-border bg-card p-6 text-center"
          >
            <div className="mx-auto w-fit">
              <Mascot pose={correctCount >= activeNq ? 'cheering' : correctCount >= 1 ? 'excited' : 'thinking'} size="xl" bob={correctCount < activeNq} />
            </div>
            <h1 id="quiz-result-ai" className="mt-3 font-heading text-2xl font-bold">
              {correctCount} / {activeNq} correct
            </h1>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              {tr('ai.quizAiResultNote')}
            </p>
            <div className="mx-auto mt-4 w-fit rounded-2xl bg-primary/10 px-5 py-3">
              <p className="font-heading text-xl font-bold text-primary">+{aiXpGain} XP</p>
              <p className="text-xs text-muted-foreground">
                {rawGain > 0
                  ? `${aiXpGain < rawGain ? tr('ai.quizAiCapped') : ''}${aiBest} → ${correctCount}`
                  : tr('ai.quizAiNoGain')}
              </p>
              <p className="text-xs text-muted-foreground">
                {tr('ai.quizAiCap')}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button
                onClick={() =>
                  onFinishAi?.({
                    quizHash: aiSet.hash,
                    score: correctCount,
                    nq: activeNq,
                    wrongIds,
                  })
                }
              >
                <PartyPopper className="size-4" aria-hidden="true" /> {tr('ai.quizCollect')}
              </Button>
              <Button variant="ghost" onClick={backToAuthored}>
                {tr('ai.quizAuthoredBack')}
              </Button>
            </div>
            {aiSet.dropped > 0 && (
              <p role="status" className="mt-3 text-xs text-muted-foreground">
                {tr('ai.betaDropped').replace('{n}', String(aiSet.dropped))}
              </p>
            )}
          </section>

          {wrongIds.length > 0 && (
            <section aria-label={tr('ai.mistakeTitle')} className="flex flex-col gap-3">
              {wrongIds.map((wid) => {
                const qi = Number(wid.split('#').pop());
                const wq = aiSet.items[qi];
                if (!wq) return null;
                return (
                  <div key={wid} className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-sm font-medium">{wq.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{chapter.title}</p>
                    <AiMistakeCard
                      id={wid}
                      band={band}
                      lang={lang}
                      chapterTitle={chapter.title}
                      subject={chapter.subject}
                      question={wq}
                      chosen={picks[qi] ?? null}
                      aiAvailable={aiAvailable !== false}
                      demo={demo}
                      tagged={state.mistakes[wid]?.tag ?? null}
                      onConfirmTag={onTagMiss}
                    />
                  </div>
                );
              })}
            </section>
          )}
        </div>
      );
    }
    const bd = quizXpBreakdown(prevBest, correctCount, nq, firstAttempt);
    const outcome: QuizOutcome = {
      score: correctCount,
      nq,
      wrongIds,
      xpGain: bd.total,
      baseXp: bd.base,
      improvementXp: bd.improvement,
      bonus80: bd.bonus80,
      bonus100: bd.bonus100,
      firstAttempt,
      prevBest,
      mastered: correctCount >= nq && nq > 0,
      completed: correctCount >= 1,
    };
    const mascotPose = outcome.mastered ? 'cheering' : outcome.completed ? 'excited' : 'thinking';
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <section
          aria-labelledby="quiz-result"
          className="anim-pop rounded-2xl border border-border bg-card p-6 text-center"
        >
          <div className="mx-auto w-fit">
            <Mascot pose={mascotPose} size="xl" bob={!outcome.mastered} />
          </div>
          <h1 id="quiz-result" className="mt-3 font-heading text-2xl font-bold">
            {correctCount} / {nq} correct
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {outcome.mastered
              ? 'Mastered! Every question right — this chapter is fully yours.'
              : outcome.completed
                ? 'Chapter completed. Take the quiz again to improve — XP comes from getting better.'
                : 'Good start! Score at least 1 to complete the chapter. Every attempt teaches you something.'}
          </p>

          {/* XP breakdown — base + improvement + score bonus (chunk 4C rules) */}
          <div className="mx-auto mt-4 w-fit rounded-2xl bg-primary/10 px-5 py-3">
            <p className="font-heading text-xl font-bold text-primary">
              +{outcome.xpGain} XP
            </p>
            <p className="text-xs text-muted-foreground">
              {outcome.improvementXp > 0
                ? `${outcome.improvementXp} for improving (best ${prevBest} → ${correctCount})`
                : outcome.firstAttempt
                  ? 'No improvement XP this time — XP is for getting better, not for repeating.'
                  : 'You matched your best. Repeating a perfect quiz gives nothing — by design.'}
              {outcome.baseXp > 0 && ` · ${outcome.baseXp} completion base`}
              {outcome.bonus80 > 0 && ' · +10 score bonus (80%+)'}
              {outcome.bonus100 > 0 && ' · +25 perfect-score bonus'}
            </p>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {outcome.mastered
              ? 'Status: mastered'
              : outcome.completed
                ? 'Status: completed — mastered at full marks'
                : 'Status: not yet completed'}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => onFinish(outcome)}>
              <PartyPopper className="size-4" aria-hidden="true" /> Collect and continue
            </Button>
          </div>
        </section>

          {/* chunk 5B: explain-my-mistake for every wrong answer (AI, practice-only) */}
          {wrongIds.length > 0 && (
            <section aria-label={tr('ai.mistakeTitle')} className="flex flex-col gap-3">
              {wrongIds.map((wid) => {
                const qi = Number(wid.split('#')[2]);
                const wq = chapter.questions[qi];
                if (!wq) return null;
                return (
                  <div key={wid} className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-sm font-medium">{wq.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{chapter.title}</p>
                    <AiMistakeCard
                      id={wid}
                      band={band}
                      lang={lang}
                      chapterTitle={chapter.title}
                      subject={chapter.subject}
                      question={wq}
                      chosen={picks[qi] ?? null}
                      aiAvailable={aiAvailable !== false}
                      demo={demo}
                      tagged={state.mistakes[wid]?.tag ?? null}
                      onConfirmTag={onTagMiss}
                    />
                  </div>
                );
              })}
            </section>
          )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div>
        <Button variant="ghost" onClick={onBack} aria-label="Back to the chapter">
          <ArrowLeft className="size-4" aria-hidden="true" /> Chapter
        </Button>
      </div>

      <section aria-labelledby="quiz-head" data-tour="quiz-root" className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h1 id="quiz-head" className="font-heading text-lg font-semibold">{chapter.title}</h1>
          <span className="text-sm text-muted-foreground">
            {idx + 1} / {activeNq}
          </span>
        </div>
        {aiSet && (
          <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" /> {tr('ai.quizAiActiveBadge')}
          </p>
        )}
        <Progress value={((idx + (checked ? 1 : 0)) / activeNq) * 100} className="mt-2 h-2" aria-label={`Quiz progress: question ${idx + 1} of ${activeNq}`} />

        <fieldset className="mt-4">
          <legend className="font-heading text-base font-semibold sm:text-lg">{q.text}</legend>
          <div className="mt-3 flex flex-col gap-2" data-tour="quiz-options">
            {q.options.map((opt, i) => {
              const isPicked = picked === i;
              const isAnswer = i === q.answer;
              return (
                <button
                  key={i}
                  onClick={() => !checked && setPicked(i)}
                  disabled={checked}
                  aria-pressed={isPicked}
                  className={cn(
                    'press flex min-h-[52px] items-center gap-3 rounded-xl border-2 p-3 text-left text-sm font-medium',
                    !checked && isPicked && 'border-primary bg-primary/10',
                    !checked && !isPicked && 'border-border hover:border-primary/40',
                    checked && isAnswer && 'border-success bg-success-soft text-success-soft-foreground',
                    checked && isPicked && !isAnswer && 'border-destructive bg-destructive/10 text-destructive',
                    checked && !isAnswer && !isPicked && 'border-border opacity-60'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                      checked && isAnswer ? 'border-success bg-success text-success-foreground'
                        : checked && isPicked ? 'border-destructive bg-destructive text-destructive-foreground'
                          : 'border-border'
                    )}
                    aria-hidden="true"
                  >
                    {checked && isAnswer ? <Check className="size-4" /> : checked && isPicked ? <X className="size-4" /> : String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </fieldset>

        {checked && (
          <div
            role="status"
            className={cn(
              'anim-pop mt-4 rounded-xl p-4',
              picked === q.answer ? 'bg-success-soft text-success-soft-foreground' : 'bg-gold-soft'
            )}
            style={picked === q.answer ? undefined : { color: 'var(--gold)' }}
          >
            <p className="flex items-center gap-2 text-sm font-bold">
              {picked === q.answer ? (
                <><Check className="size-4" aria-hidden="true" /> Correct!</>
              ) : (
                <><X className="size-4" aria-hidden="true" /> Not quite — the answer is “{q.options[q.answer]}”.</>
              )}
            </p>
            <p className="mt-1 text-sm">{q.explanation}</p>
          </div>
        )}

        {/* chunk 5B: explain-my-mistake on a wrong answer (AI, practice-only) */}
        {checked && picked !== q.answer && (
          <AiMistakeCard
            id={`${cid}#${idx}`}
            band={band}
            lang={lang}
            chapterTitle={chapter.title}
            subject={chapter.subject}
            question={q}
            chosen={picked}
            aiAvailable={aiAvailable !== false}
            demo={demo}
            tagged={state.mistakes[`${cid}#${idx}`]?.tag ?? null}
            onConfirmTag={onTagMiss}
          />
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {aiSet
              ? `${tr('ai.quizAiBest')} ${aiBest}/${activeNq} · ${tr('ai.quizAiCapLeft').replace('{n}', String(aiCapLeft))}`
              : `Best so far: ${prevBest}/${nq} · XP is for improvement only`}
          </p>
          {!checked ? (
            <Button onClick={check} disabled={picked === null}>
              Check answer
            </Button>
          ) : (
            <Button onClick={next}>
              {idx + 1 >= activeNq ? 'Finish' : 'Next question'} <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </section>

      {/* ---- chunk 5-AI feature 2: AI fresh quiz controls ---- */}
      {aiGateOk && !aiSet && (
        <section aria-label={tr('ai.quizAiTitle')} className="rounded-2xl border border-dashed border-border p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden="true" /> {tr('ai.quizAiTitle')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{tr('ai.quizAiIntro')}</p>
          {aiPhase === 'loading' ? (
            <div role="status" aria-live="polite" className="mt-3 flex flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <p className="text-xs text-muted-foreground">{tr('ai.thinking')}</p>
            </div>
          ) : aiPhase === 'error' ? (
            <div role="status" className="mt-3">
              <p className="rounded-xl bg-muted/60 p-3 text-sm">{aiErr ? tr(aiErrKey(aiErr)) : tr('ai.err.UNAVAILABLE')}</p>
              <Button variant="secondary" size="sm" className="mt-2 min-h-[44px]" onClick={() => void generateAiQuiz(false)}>
                {tr('ai.regenerate')}
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(['easy', 'medium', 'hard'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAiDifficulty(d)}
                    aria-pressed={aiDifficulty === d}
                    className={cn(
                      'press min-h-[36px] rounded-full border-2 px-3 text-xs font-semibold',
                      aiDifficulty === d ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                    )}
                  >
                    {tr(d === 'easy' ? 'ai.diffEasy' : d === 'medium' ? 'ai.diffMedium' : 'ai.diffHard')}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => void generateAiQuiz(false)}>
                  {tr('ai.quizAiGo')}
                </Button>
                {missedTexts.length > 0 && (
                  <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => void generateAiQuiz(true)}>
                    {tr('ai.quizAiFromMisses')}
                  </Button>
                )}
              </div>
            </>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{tr('ai.quizAiLabel')}</p>
        </section>
      )}
    </div>
  );
}
