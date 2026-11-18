'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpenText, KeyRound, Layers, Lightbulb, ListChecks, Pause, Play,
  Sparkles, Square, Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mascot } from '../Mascot';
import { cn } from '@/lib/utils';
import { BANDS, type Band } from '@/lib/lumio/content';
import { chapterId, dayKey } from '@/lib/lumio/domain';
import {
  flashcardsFor, glossaryFor, keyPointsFor, sentencesOf,
} from '@/lib/lumio/chapterContent';
import type { PracticeAiItem, LessonAiResult } from '@/lib/lumio/aiClient';
import type { LumioState } from '@/lib/lumio/types';
import { AiPracticeBeta } from '../ai/AiPracticeBeta';
import { AiLesson } from '../ai/AiLesson';

/**
 * Chapter reader (chunk 2, 3.4 + 7.4): source line, notes with Listen
 * (read-aloud, sentence by sentence, saved speed), key points, glossary and
 * flashcards (tap to flip). The quiz is one tab away.
 */

const TTS_KEY = 'lumio-tts-speed';

function loadSpeed(): number {
  try {
    const v = Number(localStorage.getItem(TTS_KEY));
    return Number.isFinite(v) && v >= 0.5 && v <= 2 ? v : 1;
  } catch {
    return 1;
  }
}

function isDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

export function Reader({
  state,
  chapterIndex,
  onBack,
  onStartQuiz,
  onFlashcardsReviewed,
  onAskAi,
  aiAvailable,
  demo,
  onSaveAi,
  onSaveLesson,
}: {
  state: LumioState;
  chapterIndex: number;
  onBack: () => void;
  onStartQuiz: () => void;
  onFlashcardsReviewed: () => void;
  /** chunk 5B: when provided, "Ask Study Buddy" opens the floating AI panel
   *  pre-grounded on this chapter (panel state lives in LumioApp). */
  onAskAi?: () => void;
  /** chunk 5B Tier 2: beta practice generator availability + save path */
  aiAvailable?: boolean;
  demo?: boolean;
  onSaveAi?: (
    kind: 'practice',
    id: string,
    date: string,
    payload: { items: PracticeAiItem[] },
    label: string,
  ) => void;
  /** chunk 5-AI: lesson save path (ai-content-saved event via LumioApp) */
  onSaveLesson?: (
    kind: 'lesson',
    id: string,
    date: string,
    payload: LessonAiResult,
    label: string,
  ) => void;
}) {
  const band: Band = state.profile?.band ?? 'sec';
  const bandDef = BANDS[band];
  const chapter = bandDef.chapters[chapterIndex];
  const cid = chapterId(band, chapterIndex);
  const keyPoints = useMemo(() => keyPointsFor(chapter), [chapter]);
  const glossary = useMemo(() => glossaryFor(chapter), [chapter]);
  const sentences = useMemo(() => sentencesOf(chapter.summary), [chapter]);
  const cards = useMemo(() => flashcardsFor(band, chapterIndex, chapter), [band, chapterIndex, chapter]);

  // ----- read-aloud (speechSynthesis, sentence by sentence, saved speed) -----
  // State machine: idle -> playing <-> paused, with stop keeping the place.
  const [ttsState, setTtsState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [ttsIndex, setTtsIndex] = useState(-1);
  const [resumeIdx, setResumeIdx] = useState(-1); // -1 = no saved resume point
  const [speed, setSpeed] = useState<number>(loadSpeed);
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  const stoppedRef = useRef(false);
  // Mirror of ttsIndex so stopSpeech/resumeSpeech can read it without
  // becoming unstable callbacks (which would retrigger the unmount effect).
  const ttsIndexRef = useRef(-1);

  const stopSpeech = useCallback(() => {
    stoppedRef.current = true;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* unsupported */
    }
    const cur = ttsIndexRef.current;
    // Keep the current sentence as the resume point; keep ttsIndex so the
    // highlighted sentence stays visible.
    setResumeIdx(cur >= 0 && cur < sentences.length ? cur : -1);
    setTtsState('idle');
  }, [sentences.length]);

  useEffect(() => stopSpeech, [stopSpeech]);

  const speakFrom = useCallback(
    (startIdx: number) => {
      if (!('speechSynthesis' in window)) return;
      stoppedRef.current = false;
      setTtsState('playing');
      const speakOne = (i: number) => {
        if (stoppedRef.current || i >= sentences.length) {
          if (!stoppedRef.current) {
            // Natural finish: clear the highlight and any saved resume point.
            ttsIndexRef.current = -1;
            setTtsIndex(-1);
            setResumeIdx(-1);
            setTtsState('idle');
          }
          return;
        }
        ttsIndexRef.current = i;
        setTtsIndex(i);
        const u = new SpeechSynthesisUtterance(sentences[i]);
        u.rate = speedRef.current;
        u.lang = isDevanagari(sentences[i]) ? 'hi-IN' : 'en-IN';
        u.onend = () => speakOne(i + 1);
        u.onerror = () => {
          ttsIndexRef.current = -1;
          setTtsIndex(-1);
          setTtsState('idle');
        };
        window.speechSynthesis.speak(u);
      };
      window.speechSynthesis.cancel();
      speakOne(startIdx);
    },
    [sentences]
  );

  const pauseSpeech = useCallback(() => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.pause();
    } catch {
      /* unsupported */
    }
    setTtsState('paused');
  }, []);

  const resumeSpeech = useCallback(() => {
    if (ttsState !== 'paused') return;
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        setTtsState('playing');
        return;
      } catch {
        /* fall back to re-speaking the current sentence */
      }
    }
    const cur = ttsIndexRef.current;
    speakFrom(cur >= 0 ? cur : 0);
  }, [ttsState, speakFrom]);

  const saveSpeed = (v: number) => {
    setSpeed(v);
    try {
      localStorage.setItem(TTS_KEY, String(v));
    } catch {
      /* ignore */
    }
  };

  // ----- flashcards (tap to flip) -----
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const flip = () => setFlipped((f) => !f);
  const go = (dir: 1 | -1) => {
    const next = cardIdx + dir;
    if (next < 0 || next >= cards.length) return;
    setCardIdx(next);
    setFlipped(false);
  };
  const finishCards = () => {
    if (!reviewed) {
      setReviewed(true);
      onFlashcardsReviewed(); // recorded once per day by the projection
    }
  };

  const res = state.res[cid];
  const best = res?.best ?? 0;
  const mastered = best >= chapter.questions.length && chapter.questions.length > 0;

  // chunk 5B Tier 2: a save for this chapter + language already exists?
  const betaSaved = Object.keys(state.aiContent).some((id) =>
    id.startsWith(`practice#${cid}#${state.profile?.lang ?? 'en'}#`)
  );
  const lessonSaved = Object.keys(state.aiContent).some(
    (id) => state.aiContent[id].kind === 'lesson' && id.startsWith(`lesson#${cid}#`)
  );
  const betaToday = dayKey(new Date(), state.profile?.tz ?? 'Asia/Kolkata');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="ghost" onClick={onBack} aria-label="Back to the study path">
          <ArrowLeft className="size-4" aria-hidden="true" /> Study path
        </Button>
      </div>

      <section aria-labelledby="reader-head" data-tour="reader-root" className="rounded-2xl border border-border bg-card p-5">
        <h1 id="reader-head" className="font-heading text-2xl font-bold">{chapter.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {chapter.subject} · {BANDS[band].name}
        </p>
        {/* Source line: who wrote it — never presented as official (R1) */}
        <p className="mt-2 text-xs text-muted-foreground">
          Written by the Lumio team — sample material for practice, not official curriculum.
          {mastered ? ' You have mastered this chapter.' : best > 0 ? ` Best quiz score: ${best}/${chapter.questions.length}.` : ''}
        </p>
        {onAskAi && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" className="press min-h-[44px]" onClick={onAskAi}>
              <BookOpenText className="size-4 text-primary" aria-hidden="true" /> Ask Study Buddy
            </Button>
          </div>
        )}
        {aiAvailable && onSaveAi && (
          <AiPracticeBeta
            band={band}
            chapterIndex={chapterIndex}
            chapter={chapter}
            lang={state.profile?.lang ?? 'en'}
            today={betaToday}
            aiAvailable={aiAvailable}
            demo={demo}
            saved={betaSaved}
            onSaveAi={onSaveAi}
          />
        )}
        {aiAvailable && onSaveLesson && (
          <AiLesson
            band={band}
            chapterIndex={chapterIndex}
            chapter={chapter}
            lang={state.profile?.lang ?? 'en'}
            today={betaToday}
            aiAvailable={aiAvailable}
            demo={demo}
            saved={lessonSaved}
            interest={state.profile?.interest}
            onSaveAi={onSaveLesson}
          />
        )}
      </section>

      <Tabs defaultValue="notes">
        <TabsList className="w-full justify-start overflow-x-auto scroll-slim">
          <TabsTrigger value="notes"><BookOpenText className="mr-1.5 size-4" aria-hidden="true" />Notes</TabsTrigger>
          <TabsTrigger value="points"><Lightbulb className="mr-1.5 size-4" aria-hidden="true" />Key points</TabsTrigger>
          <TabsTrigger value="glossary"><ListChecks className="mr-1.5 size-4" aria-hidden="true" />Glossary</TabsTrigger>
          <TabsTrigger value="cards"><Layers className="mr-1.5 size-4" aria-hidden="true" />Flashcards</TabsTrigger>
        </TabsList>

        {/* Notes + Listen */}
        <TabsContent value="notes" className="mt-3">
          <div className="rounded-2xl border border-border bg-card p-5" data-tour="reader-notes">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-lg font-semibold">Notes</h2>
              <div className="ml-auto flex items-center gap-1.5">
                {ttsState === 'playing' ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={pauseSpeech} aria-label="Pause read-aloud">
                      <Pause className="size-4" aria-hidden="true" /> Pause
                    </Button>
                    <Button variant="ghost" size="sm" onClick={stopSpeech} aria-label="Stop read-aloud">
                      <Square className="size-4" aria-hidden="true" /> Stop
                    </Button>
                  </>
                ) : ttsState === 'paused' ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={resumeSpeech} aria-label="Resume read-aloud">
                      <Play className="size-4" aria-hidden="true" /> Resume
                    </Button>
                    <Button variant="ghost" size="sm" onClick={stopSpeech} aria-label="Stop read-aloud">
                      <Square className="size-4" aria-hidden="true" /> Stop
                    </Button>
                  </>
                ) : resumeIdx >= 0 && resumeIdx < sentences.length ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => speakFrom(resumeIdx)}
                      aria-label={`Resume read-aloud from sentence ${resumeIdx + 1}`}
                    >
                      <Play className="size-4" aria-hidden="true" /> Resume (sentence {resumeIdx + 1})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => speakFrom(0)}
                      aria-label="Start over from the first sentence"
                    >
                      Start over
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => speakFrom(0)} aria-label="Listen to the notes">
                    <Volume2 className="size-4" aria-hidden="true" /> Listen
                  </Button>
                )}
              </div>
            </div>
            <ol className="flex flex-col gap-2">
              {sentences.map((s, i) => (
                <li
                  key={i}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm leading-relaxed transition-colors',
                    ttsIndex === i && 'bg-primary/10 font-medium'
                  )}
                >
                  {s}
                </li>
              ))}
            </ol>
            <div className="mt-4 rounded-xl bg-muted/60 p-3">
              <Label htmlFor="tts-speed" className="text-xs">Read-aloud speed ({speed.toFixed(1)}×)</Label>
              <Slider
                id="tts-speed"
                min={0.5}
                max={2}
                step={0.1}
                value={[speed]}
                onValueChange={([v]) => saveSpeed(v)}
                className="mt-2"
                aria-label="Read-aloud speed"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Hindi text is read with a Hindi voice when available. Speed is saved on this device.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pause freezes the exact position. Stop keeps your place at the start of the current
                sentence — Resume continues from there. Audio itself cannot be verified in a headless
                browser — try it on your device.
              </p>
            </div>
            {!('speechSynthesis' in window) && (
              <p role="status" className="mt-2 text-xs text-muted-foreground">
                Read-aloud is not available in this browser.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Key points */}
        <TabsContent value="points" className="mt-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-semibold">
              <KeyRound className="size-5 text-primary" aria-hidden="true" /> Key points
            </h2>
            <ul className="flex flex-col gap-2">
              {keyPoints.map((p, i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-xl bg-muted/60 p-3 text-sm">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        {/* Glossary */}
        <TabsContent value="glossary" className="mt-3">
          <div className="rounded-2xl border border-border bg-card p-5" data-tour="reader-glossary">
            <h2 className="mb-1 font-heading text-lg font-semibold">Glossary</h2>
            <p className="mb-3 text-xs text-muted-foreground">Words from this chapter that appear in the Lumio glossary.</p>
            <dl className="flex flex-col gap-2">
              {glossary.map(([term, def]) => (
                <div key={term} className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-sm font-semibold">{term}</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">{def}</dd>
                </div>
              ))}
            </dl>
          </div>
        </TabsContent>

        {/* Flashcards */}
        <TabsContent value="cards" className="mt-3">
          <div className="rounded-2xl border border-border bg-card p-5" data-tour="reader-flashcards">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold">Flashcards</h2>
              <span className="text-sm text-muted-foreground">{cardIdx + 1} / {cards.length}</span>
            </div>
            <Progress value={((cardIdx + 1) / cards.length) * 100} className="h-1.5" aria-label="Flashcard progress" />
            <button
              onClick={flip}
              aria-pressed={flipped}
              aria-label={`Flashcard ${cardIdx + 1} of ${cards.length}: ${flipped ? 'answer' : 'question'} shown. Tap to flip.`}
              className={cn(
                'press mt-4 flex min-h-[180px] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 p-6 text-center',
                flipped ? 'border-primary bg-primary/5' : 'border-border bg-muted/60'
              )}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {cards[cardIdx].kind === 'term' ? 'Term' : 'Question'}
              </span>
              <span className="font-heading text-xl font-bold">{cards[cardIdx].front}</span>
              {flipped && (
                <span className="anim-pop rounded-xl bg-success-soft px-4 py-2 text-lg font-semibold text-success-soft-foreground">
                  {cards[cardIdx].back}
                </span>
              )}
              {!flipped && <span className="text-xs text-muted-foreground">Tap to reveal</span>}
            </button>
            <div className="mt-4 flex items-center justify-between">
              <Button variant="ghost" onClick={() => go(-1)} disabled={cardIdx === 0} aria-label="Previous card">
                Previous
              </Button>
              {cardIdx === cards.length - 1 ? (
                <Button onClick={finishCards} variant={reviewed ? 'ghost' : 'default'} disabled={reviewed}>
                  {reviewed ? 'Set reviewed' : 'Mark set as reviewed'}
                </Button>
              ) : (
                <Button onClick={() => go(1)} aria-label="Next card">Next card</Button>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Quiz CTA */}
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-5" data-tour="reader-quiz">
        <Mascot pose={mastered ? 'cheering' : 'happy'} size="md" />
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold">Ready for the quiz?</h2>
          <p className="text-sm text-muted-foreground">
            {chapter.questions.length} questions with explanations. XP is for improvement —
            best score {best}/{chapter.questions.length}.
          </p>
        </div>
        <Button onClick={onStartQuiz}>
          {best > 0 ? 'Try to improve' : 'Start quiz'} <Sparkles className="size-4" aria-hidden="true" />
        </Button>
      </section>
    </div>
  );
}
