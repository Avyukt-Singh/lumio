'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ClipboardList,
  Clock,
  Eye,
  FlaskConical,
  Layers,
  NotebookPen,
  Shuffle,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Mascot } from '../Mascot';
import { AiMistakeCard } from '../ai/AiMistakeCard';
import { cn } from '@/lib/utils';
import { tFor } from '@/lib/lumio/i18n';
import { BANDS, type Band, type Question } from '@/lib/lumio/content';
import { flashcardsFor, sentencesOf, type Flashcard } from '@/lib/lumio/chapterContent';
import {
  weakTopics,
  practiceDoneToday,
  masteredCount,
  legendaryDone,
  chapterId,
  PRACTICE_XP,
  LEGENDARY_XP,
} from '@/lib/lumio/domain';
import type { LumioState, PracticeKind, MistakeTag } from '@/lib/lumio/types';

/**
 * Practice hub (chunk 3, master prompt 7.6): eight honest practice tools.
 * Every tool calls onPracticeDone / onLegendary exactly once per completion;
 * the parent enforces the XP-once-per-day rule. Nothing here invents facts:
 * explanations and worked steps are derived only from the question content.
 */

export interface PracticeHubProps {
  state: LumioState;
  /** learner-local yyyy-mm-dd */
  today: string;
  onCardReview: (cardId: string, correct: boolean) => void;
  onPracticeDone: (kind: PracticeKind) => void;
  onLegendary: () => void;
  onTagMistake: (questionId: string, tag: MistakeTag | null) => void;
  onOpenChapter: (chapterIndex: number) => void;
  /** chunk 5B: AI explain-my-mistake availability (practice-only, no XP) */
  aiAvailable?: boolean;
  demo?: boolean;
  /** chunk 4A: self-reported mock tests tab (rendered node passed by the parent) */
  mocks?: ReactNode;
}

type TabId =
  | 'flashcards'
  | 'weak'
  | 'drill'
  | 'adaptive'
  | 'revision'
  | 'legendary'
  | 'errorlab'
  | 'notebook'
  | 'mocks';

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'weak', label: 'Weak topics', icon: Target },
  { id: 'drill', label: 'Timed drill', icon: Timer },
  { id: 'adaptive', label: 'Adaptive practice', icon: TrendingUp },
  { id: 'revision', label: 'Mixed revision', icon: Shuffle },
  { id: 'legendary', label: 'Legendary', icon: Trophy },
  { id: 'errorlab', label: 'Error lab', icon: FlaskConical },
  { id: 'notebook', label: 'Mistake notebook', icon: NotebookPen },
  { id: 'mocks', label: 'Mock tests', icon: ClipboardList },
];

const MISTAKE_TAGS: Array<{ tag: MistakeTag; label: string }> = [
  { tag: 'concept', label: 'Concept gap' },
  { tag: 'careless', label: 'Careless slip' },
  { tag: 'calculation', label: 'Calculation error' },
  { tag: 'fact', label: 'Forgot the fact' },
];

const DRILL_MS = 60000;
const DRILL_UNTIMED_COUNT = 10;
const ADAPTIVE_COUNT = 8;
const REVISION_COUNT = 10;
const LEGENDARY_COUNT = 10;

interface QuizItem {
  key: string;
  q: Question;
  chapterTitle: string;
}

interface MissedItem {
  id: string;
  chapterTitle: string;
  subject: string;
  q: Question;
}

/** Deterministic Fisher-Yates so repeats across rounds vary with the seed. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Resolve stable question ids (`${band}#${ch}#${q}`) against the band content. */
function resolveMissed(band: Band, wrong: Record<string, 1>): MissedItem[] {
  const out: MissedItem[] = [];
  for (const id of Object.keys(wrong)) {
    const parts = id.split('#');
    if (parts.length !== 3 || parts[0] !== band) continue;
    const ci = Number(parts[1]);
    const qi = Number(parts[2]);
    if (!Number.isFinite(ci) || !Number.isFinite(qi)) continue;
    const ch = BANDS[band].chapters[ci];
    const q = ch?.questions[qi];
    if (!ch || !q) continue;
    out.push({ id, chapterTitle: ch.title, subject: ch.subject, q });
  }
  return out;
}

/** Five worked-solution steps derived only from the question's own explanation. */
function workedSteps(
  q: Question,
  chapterTitle: string,
  subject: string,
): Array<{ title: string; body: string }> {
  const sents = sentencesOf(q.explanation);
  const first = sents[0] ?? q.explanation.trim();
  const rest = sents.slice(1).join(' ');
  return [
    {
      title: 'What is asked',
      body: `A ${subject} question from "${chapterTitle}" — pick the one option that answers it.`,
    },
    { title: 'What you know', body: q.text },
    { title: 'Key idea', body: first || '—' },
    { title: 'Working through it', body: rest || first },
    { title: 'Answer', body: q.options[q.answer] },
  ];
}

function OptionButton({
  label,
  index,
  state,
  onClick,
}: {
  label: string;
  index: number;
  state: 'idle' | 'picked' | 'correct' | 'wrong' | 'dim';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={state === 'picked'}
      className={cn(
        'press flex min-h-[52px] w-full items-center gap-3 rounded-xl border-2 p-3 text-left text-sm font-medium',
        state === 'idle' && 'border-border hover:border-primary/40',
        state === 'picked' && 'border-primary bg-primary/10',
        state === 'correct' && 'border-success bg-success-soft text-success-soft-foreground',
        state === 'wrong' && 'border-destructive bg-destructive/10 text-destructive',
        state === 'dim' && 'border-border opacity-60',
      )}
    >
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
          state === 'correct' && 'border-success bg-success text-success-foreground',
          state === 'wrong' && 'border-destructive bg-destructive text-destructive-foreground',
          state !== 'correct' && state !== 'wrong' && 'border-border',
        )}
        aria-hidden="true"
      >
        {String.fromCharCode(65 + index)}
      </span>
      {label}
    </button>
  );
}

function Feedback({
  correct,
  answerText,
  explanation,
}: {
  correct: boolean;
  answerText: string;
  explanation: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'anim-pop mt-4 rounded-xl p-4',
        correct ? 'bg-success-soft text-success-soft-foreground' : 'bg-gold-soft',
      )}
      style={correct ? undefined : { color: 'var(--gold)' }}
    >
      <p className="flex items-center gap-2 text-sm font-bold">
        {correct ? (
          <>
            <Check className="size-4" aria-hidden="true" /> Correct!
          </>
        ) : (
          <>
            <X className="size-4" aria-hidden="true" /> Not quite — the answer is &ldquo;{answerText}
            &rdquo;.
          </>
        )}
      </p>
      <p className="mt-1 text-sm">{explanation}</p>
    </div>
  );
}

function TabCard({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">{children}</div>;
}

function EmptyState({ note }: { note: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <Mascot pose="curious" size="lg" />
      <p className="max-w-md text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

// ---------- 1. Flashcards (Leitner SRS) ----------

function FlashcardsTab({
  state,
  today,
  band,
  onCardReview,
  onPracticeDone,
}: {
  state: LumioState;
  today: string;
  band: Band;
  onCardReview: (cardId: string, correct: boolean) => void;
  onPracticeDone: (kind: PracticeKind) => void;
}) {
  const deck = BANDS[band].chapters.flatMap((ch, i) => flashcardsFor(band, i, ch));
  const due = deck.filter((c) => {
    const s = state.srs[c.id];
    return !s || s.due <= today;
  });
  const boxCounts = [1, 2, 3, 4, 5].map((b) => deck.filter((c) => state.srs[c.id]?.box === b).length);
  const unseen = deck.filter((c) => !state.srs[c.id]).length;
  const nextDue = deck.reduce<string | null>((min, c) => {
    const d = state.srs[c.id]?.due;
    if (d && d > today && (min === null || d < min)) return d;
    return min;
  }, null);
  const collected = practiceDoneToday(state, 'srs', today);

  const [queue, setQueue] = useState<Flashcard[] | null>(null);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const finishedRef = useRef(false);

  const startSession = () => {
    if (due.length === 0) return;
    finishedRef.current = false;
    setQueue(due);
    setPos(0);
    setFlipped(false);
    setReviewed(0);
  };

  const endSession = () => {
    setQueue(null);
    setFlipped(false);
  };

  const review = (correct: boolean) => {
    if (!queue || pos >= queue.length) return;
    const card = queue[pos];
    onCardReview(card.id, correct);
    setFlipped(false);
    setReviewed((r) => r + 1);
    const np = pos + 1;
    setPos(np);
    if (np >= queue.length && !finishedRef.current) {
      finishedRef.current = true;
      onPracticeDone('srs');
    }
  };

  // Overview
  if (queue === null) {
    return (
      <TabCard>
        <h2 className="font-heading text-lg font-semibold">Flashcards</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {due.length === 1 ? '1 card due today' : `${due.length} cards due today`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Box 1: {boxCounts[0]} &middot; Box 2: {boxCounts[1]} &middot; Box 3: {boxCounts[2]} &middot;
          Box 4: {boxCounts[3]} &middot; Box 5: {boxCounts[4]} &middot; Not started: {unseen}
        </p>

        {due.length === 0 ? (
          <div className="mt-2">
            <EmptyState note="Nothing due right now — cards return after 1, 2, 4, 8 or 16 days depending on the box they reach." />
            {nextDue !== null && (
              <p className="text-center text-sm text-muted-foreground">
                Next cards return on {nextDue}.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <Button className="min-h-[44px]" onClick={startSession}>
              Start review session
            </Button>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          New cards appear as you study chapters.
        </p>
      </TabCard>
    );
  }

  // Session summary
  if (pos >= queue.length) {
    return (
      <TabCard>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Mascot pose="cheering" size="xl" bob />
          <h2 className="font-heading text-xl font-bold">
            Reviewed {reviewed} card{reviewed === 1 ? '' : 's'}
          </h2>
          <p className="text-sm text-muted-foreground">
            +{PRACTICE_XP.srs} XP{' '}
            {collected ? 'collected today' : "for today's first review set"}
          </p>
          <Button variant="outline" className="min-h-[44px]" onClick={endSession}>
            Back to overview
          </Button>
        </div>
      </TabCard>
    );
  }

  // One card at a time
  const card = queue[pos];
  return (
    <TabCard>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">
          Card {pos + 1} of {queue.length}
        </h2>
        <Button variant="ghost" className="min-h-[44px]" onClick={endSession}>
          End session
        </Button>
      </div>
      <Progress
        value={(pos / queue.length) * 100}
        className="mt-2 h-2"
        aria-label={`Review progress: card ${pos + 1} of ${queue.length}`}
      />

      <div className="mt-4 rounded-2xl border border-border bg-background p-5 text-center">
        <Badge variant="secondary">{card.kind === 'qa' ? 'Question' : 'Term'}</Badge>
        <p className="mt-3 font-heading text-lg font-semibold sm:text-xl">{card.front}</p>
        {flipped && (
          <div
            role="status"
            aria-live="polite"
            className="anim-pop mt-4 rounded-xl bg-success-soft p-4 text-success-soft-foreground"
          >
            <p className="text-sm font-bold">Answer</p>
            <p className="mt-1 text-sm">{card.back}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {!flipped ? (
          <Button className="min-h-[44px]" onClick={() => setFlipped(true)}>
            <Eye className="size-4" aria-hidden="true" /> Flip card
          </Button>
        ) : (
          <>
            <Button
              className="min-h-[44px] bg-success text-success-foreground hover:bg-success/90"
              onClick={() => review(true)}
            >
              <Check className="size-4" aria-hidden="true" /> I knew it
            </Button>
            <Button variant="outline" className="min-h-[44px]" onClick={() => review(false)}>
              See it again
            </Button>
          </>
        )}
      </div>
    </TabCard>
  );
}

// ---------- 2. Weak topics ----------

function WeakTopicsTab({
  state,
  onOpenChapter,
}: {
  state: LumioState;
  onOpenChapter: (chapterIndex: number) => void;
}) {
  const topics = weakTopics(state);
  return (
    <TabCard>
      <h2 className="font-heading text-lg font-semibold">Weak topics</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Built from the questions you have missed in quizzes and practice.
      </p>

      {topics.length === 0 ? (
        <EmptyState note="No weak topics yet. Finish a chapter quiz — Lumio will collect the questions you miss here." />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {topics.map((t) => (
            <li
              key={t.chapterIndex}
              className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-heading text-sm font-semibold">{t.chapterTitle}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{t.subject}</Badge>
                  <span>
                    {t.misses} missed question{t.misses === 1 ? '' : 's'}
                  </span>
                </p>
              </div>
              <Button
                variant="outline"
                className="min-h-[44px]"
                onClick={() => onOpenChapter(t.chapterIndex)}
              >
                Open this chapter <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </TabCard>
  );
}

// ---------- 3. Timed drill ----------

function DrillTab({
  state,
  today,
  band,
  onPracticeDone,
}: {
  state: LumioState;
  today: string;
  band: Band;
  onPracticeDone: (kind: PracticeKind) => void;
}) {
  const pool = BANDS[band].chapters.flatMap((ch, ci) =>
    ch.questions.map((q, qi) => ({ key: `${band}#${ci}#${qi}`, q, chapterTitle: ch.title })),
  );

  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle');
  const [untimed, setUntimed] = useState(false);
  const [order, setOrder] = useState<number[] | null>(null);
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');

  const endedRef = useRef(false);
  const announcedRef = useRef<Set<number>>(new Set());
  const timeoutRef = useRef<number | null>(null);
  const endRoundRef = useRef<() => void>(() => {});

  // Derived values (declared above all effects, per project rule).
  const running = phase === 'run' && order !== null;
  const cur = order !== null ? pool[order[pos] % pool.length] : null;
  const collected = practiceDoneToday(state, 'drill', today);

  const endRound = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPicked(null);
    setPhase('done');
    onPracticeDone('drill');
  };
  endRoundRef.current = endRound;

  const finishAnswer = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (endedRef.current) return;
    const na = answered + 1;
    if (untimed && na >= DRILL_UNTIMED_COUNT) {
      setAnswered(na);
      endRound();
      return;
    }
    setAnswered(na);
    setPicked(null);
    setPos((p) => (p + 1) % Math.max(1, order?.length ?? 1));
  };

  const pick = (i: number) => {
    if (!running || picked !== null || !cur) return;
    const correct = i === cur.q.answer;
    setPicked(i);
    if (correct) {
      setScore((s) => s + 1);
      finishAnswer();
    } else {
      // Wrong: show the explanation briefly, then move on.
      timeoutRef.current = window.setTimeout(finishAnswer, 1600);
    }
  };

  const startRound = () => {
    endedRef.current = false;
    announcedRef.current = new Set();
    const seed = (Date.now() % 2147483647) || 1;
    setOrder(seededShuffle(pool.map((_, i) => i), seed));
    setPos(0);
    setScore(0);
    setAnswered(0);
    setPicked(null);
    setSecondsLeft(untimed ? null : Math.ceil(DRILL_MS / 1000));
    setDeadline(untimed ? null : Date.now() + DRILL_MS);
    setAnnounce(untimed ? 'Untimed round started. Ten questions.' : 'Round started. Sixty seconds.');
    setPhase('run');
  };

  // Countdown: ticks every 250ms but re-renders only when the second changes.
  useEffect(() => {
    if (!running || deadline === null) return;
    const t = window.setInterval(() => {
      const s = Math.ceil((deadline - Date.now()) / 1000);
      setSecondsLeft((prev) => (prev === s ? prev : s));
      if (s <= 0) {
        window.clearInterval(t);
        endRoundRef.current();
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [running, deadline]);

  // Announce time politely only at 30s and 10s — never every second.
  useEffect(() => {
    if (!running || secondsLeft === null) return;
    if ((secondsLeft === 30 || secondsLeft === 10) && !announcedRef.current.has(secondsLeft)) {
      announcedRef.current.add(secondsLeft);
      setAnnounce(`${secondsLeft} seconds left.`);
    }
  }, [running, secondsLeft]);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  if (phase === 'idle') {
    return (
      <TabCard>
        <h2 className="font-heading text-lg font-semibold">Timed drill</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A 60-second rapid-fire round across every chapter in this band. A wrong answer shows the
          explanation for a moment, then moves on. The pool loops if you outrun it.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button className="min-h-[44px]" onClick={startRound}>
            <Timer className="size-4" aria-hidden="true" /> Start drill
          </Button>
          <button
            type="button"
            aria-pressed={untimed}
            onClick={() => setUntimed(!untimed)}
            className={cn(
              'press flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-medium',
              untimed ? 'border-primary bg-primary/10 text-primary' : 'border-border',
            )}
          >
            <Clock className="size-4" aria-hidden="true" />
            Untimed round {untimed ? 'on' : 'off'}
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Untimed rounds run 10 questions with no clock.
        </p>
      </TabCard>
    );
  }

  if (phase === 'done') {
    return (
      <TabCard>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Mascot pose="excited" size="xl" bob />
          <h2 className="font-heading text-xl font-bold">{score} correct</h2>
          <p className="text-sm text-muted-foreground">
            {answered} question{answered === 1 ? '' : 's'} answered this round.
          </p>
          <p className="text-sm text-muted-foreground">
            +{PRACTICE_XP.drill} XP {collected ? 'collected today' : "for today's first round"}
          </p>
          <Button className="min-h-[44px]" onClick={() => setPhase('idle')}>
            New round
          </Button>
        </div>
      </TabCard>
    );
  }

  // Running
  if (!cur) return null;
  return (
    <TabCard>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {secondsLeft !== null ? (
          <Badge variant="secondary" className="font-mono text-base">
            {secondsLeft}s left
          </Badge>
        ) : (
          <Badge variant="secondary">Untimed</Badge>
        )}
        <p className="text-sm text-muted-foreground">
          Score {score} &middot;{' '}
          {untimed
            ? `${Math.min(answered + 1, DRILL_UNTIMED_COUNT)} of ${DRILL_UNTIMED_COUNT}`
            : `${answered} answered`}
        </p>
      </div>
      {untimed && (
        <Progress
          value={(answered / DRILL_UNTIMED_COUNT) * 100}
          className="mt-2 h-2"
          aria-label={`Drill progress: ${answered} of ${DRILL_UNTIMED_COUNT} questions answered`}
        />
      )}
      <p aria-live="polite" className="mt-1 min-h-[1rem] text-xs text-muted-foreground">
        {announce}
      </p>

      <p className="mt-2 font-heading text-base font-semibold sm:text-lg">{cur.q.text}</p>
      <p className="mt-1 text-xs text-muted-foreground">{cur.chapterTitle}</p>

      <div className="mt-3 flex flex-col gap-2">
        {cur.q.options.map((opt, i) => (
          <OptionButton
            key={i}
            label={opt}
            index={i}
            state={
              picked === null
                ? 'idle'
                : picked === i
                  ? i === cur.q.answer
                    ? 'correct'
                    : 'wrong'
                  : 'dim'
            }
            onClick={() => pick(i)}
          />
        ))}
      </div>

      {picked !== null && picked !== cur.q.answer && (
        <div
          role="status"
          aria-live="polite"
          className="anim-pop mt-3 rounded-xl bg-gold-soft p-4"
          style={{ color: 'var(--gold)' }}
        >
          <p className="flex items-center gap-2 text-sm font-bold">
            <X className="size-4" aria-hidden="true" /> Not quite — the answer is &ldquo;
            {cur.q.options[cur.q.answer]}&rdquo;.
          </p>
          <p className="mt-1 text-sm">{cur.q.explanation}</p>
          <Button variant="outline" className="mt-3 min-h-[44px]" onClick={finishAnswer}>
            Continue now
          </Button>
        </div>
      )}
    </TabCard>
  );
}

// ---------- 4. Adaptive practice ----------

function AdaptiveTab({
  state,
  today,
  band,
  onPracticeDone,
}: {
  state: LumioState;
  today: string;
  band: Band;
  onPracticeDone: (kind: PracticeKind) => void;
}) {
  const chapters = BANDS[band].chapters;

  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle');
  const [chapterIdx, setChapterIdx] = useState(0);
  const [qCounter, setQCounter] = useState(0);
  const [pos, setPos] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const paidRef = useRef(false);

  const chapter = chapters[chapterIdx] ?? chapters[0];
  const qIdx = qCounter % Math.max(1, chapter.questions.length);
  const q = chapter.questions[qIdx];
  const collected = practiceDoneToday(state, 'adaptive', today);

  const start = () => {
    paidRef.current = false;
    setChapterIdx(weakTopics(state)[0]?.chapterIndex ?? 0);
    setQCounter(0);
    setPos(0);
    setScore(0);
    setPicked(null);
    setChecked(false);
    setPhase('run');
  };

  const check = () => {
    if (picked === null || checked) return;
    setChecked(true);
    if (picked === q.answer) setScore((s) => s + 1);
  };

  const next = () => {
    const correct = picked === q.answer;
    if (correct) setChapterIdx((chapterIdx + 1) % chapters.length);
    // A miss keeps the learner in the same topic (re-teach).
    setQCounter(qCounter + 1);
    setPicked(null);
    setChecked(false);
    const np = pos + 1;
    if (np >= ADAPTIVE_COUNT) {
      setPos(np);
      setPhase('done');
      if (!paidRef.current) {
        paidRef.current = true;
        onPracticeDone('adaptive');
      }
    } else {
      setPos(np);
    }
  };

  if (phase === 'idle') {
    return (
      <TabCard>
        <h2 className="font-heading text-lg font-semibold">Adaptive practice</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Eight questions that adjust to you: it starts at your weakest topic.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Correct answers move you forward; a miss keeps you in the same topic.
        </p>
        <div className="mt-4">
          <Button className="min-h-[44px]" onClick={start}>
            <TrendingUp className="size-4" aria-hidden="true" /> Start adaptive set
          </Button>
        </div>
      </TabCard>
    );
  }

  if (phase === 'done') {
    return (
      <TabCard>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Mascot pose="excited" size="xl" bob />
          <h2 className="font-heading text-xl font-bold">
            {score} of {ADAPTIVE_COUNT} correct
          </h2>
          <p className="text-sm text-muted-foreground">
            +{PRACTICE_XP.adaptive} XP {collected ? 'collected today' : "for today's first set"}
          </p>
          <Button className="min-h-[44px]" onClick={() => setPhase('idle')}>
            Another round
          </Button>
        </div>
      </TabCard>
    );
  }

  return (
    <TabCard>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">Adaptive practice</h2>
        <span className="text-sm text-muted-foreground">
          {pos + 1} / {ADAPTIVE_COUNT}
        </span>
      </div>
      <Progress
        value={(pos / ADAPTIVE_COUNT) * 100}
        className="mt-2 h-2"
        aria-label={`Adaptive progress: question ${pos + 1} of ${ADAPTIVE_COUNT}`}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{chapter.subject}</Badge>
        <p className="text-sm font-medium">{chapter.title}</p>
      </div>
      <p className="mt-3 font-heading text-base font-semibold sm:text-lg">{q.text}</p>

      <div className="mt-3 flex flex-col gap-2">
        {q.options.map((opt, i) => (
          <OptionButton
            key={i}
            label={opt}
            index={i}
            state={
              !checked
                ? picked === i
                  ? 'picked'
                  : 'idle'
                : i === q.answer
                  ? 'correct'
                  : picked === i
                    ? 'wrong'
                    : 'dim'
            }
            onClick={() => !checked && setPicked(i)}
          />
        ))}
      </div>

      {checked && (
        <Feedback correct={picked === q.answer} answerText={q.options[q.answer]} explanation={q.explanation} />
      )}

      <div className="mt-5 flex items-center justify-end">
        {!checked ? (
          <Button className="min-h-[44px]" onClick={check} disabled={picked === null}>
            Check answer
          </Button>
        ) : (
          <Button className="min-h-[44px]" onClick={next}>
            {pos + 1 >= ADAPTIVE_COUNT ? 'Finish' : 'Next question'}{' '}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </TabCard>
  );
}

// ---------- shared runner for mixed revision + legendary ----------

function RunQuiz({
  items,
  doneTitle,
  doneXpLine,
  onDone,
  onAgain,
}: {
  items: QuizItem[];
  doneTitle: string;
  doneXpLine: string;
  onDone: () => void;
  onAgain: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const paidRef = useRef(false);

  const item = items[idx];

  const check = () => {
    if (picked === null || checked || !item) return;
    setChecked(true);
    if (picked === item.q.answer) setScore((s) => s + 1);
  };

  const next = () => {
    if (!item) return;
    const np = idx + 1;
    setPicked(null);
    setChecked(false);
    setIdx(np);
    if (np >= items.length) {
      setFinished(true);
      if (!paidRef.current) {
        paidRef.current = true;
        onDone();
      }
    }
  };

  if (finished) {
    return (
      <TabCard>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Mascot pose="cheering" size="xl" bob />
          <h2 className="font-heading text-xl font-bold">
            {score} / {items.length} correct
          </h2>
          <p className="text-sm text-muted-foreground">{doneTitle}</p>
          <p className="text-sm font-semibold text-primary">{doneXpLine}</p>
          <Button className="min-h-[44px]" onClick={onAgain}>
            Another round
          </Button>
        </div>
      </TabCard>
    );
  }

  if (!item) return null;
  return (
    <TabCard>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">
          Question {idx + 1} of {items.length}
        </h2>
        <span className="text-sm text-muted-foreground">Score {score}</span>
      </div>
      <Progress
        value={(idx / items.length) * 100}
        className="mt-2 h-2"
        aria-label={`Quiz progress: question ${idx + 1} of ${items.length}`}
      />

      <div className="mt-4">
        <Badge variant="secondary">{item.chapterTitle}</Badge>
      </div>
      <p className="mt-3 font-heading text-base font-semibold sm:text-lg">{item.q.text}</p>

      <div className="mt-3 flex flex-col gap-2">
        {item.q.options.map((opt, i) => (
          <OptionButton
            key={i}
            label={opt}
            index={i}
            state={
              !checked
                ? picked === i
                  ? 'picked'
                  : 'idle'
                : i === item.q.answer
                  ? 'correct'
                  : picked === i
                    ? 'wrong'
                    : 'dim'
            }
            onClick={() => !checked && setPicked(i)}
          />
        ))}
      </div>

      {checked && (
        <Feedback
          correct={picked === item.q.answer}
          answerText={item.q.options[item.q.answer]}
          explanation={item.q.explanation}
        />
      )}

      <div className="mt-5 flex items-center justify-end">
        {!checked ? (
          <Button className="min-h-[44px]" onClick={check} disabled={picked === null}>
            Check answer
          </Button>
        ) : (
          <Button className="min-h-[44px]" onClick={next}>
            {idx + 1 >= items.length ? 'Finish' : 'Next question'}{' '}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </TabCard>
  );
}

// ---------- 5. Mixed revision ----------

function RevisionTab({
  state,
  today,
  band,
  onPracticeDone,
}: {
  state: LumioState;
  today: string;
  band: Band;
  onPracticeDone: (kind: PracticeKind) => void;
}) {
  const chapters = BANDS[band].chapters;
  const completed = chapters
    .map((_, i) => i)
    .filter((i) => (state.res[chapterId(band, i)]?.best ?? 0) >= 1);
  const locked = completed.length < 2;
  const collected = practiceDoneToday(state, 'revision', today);

  const [round, setRound] = useState(0);

  const items: QuizItem[] = [];
  if (!locked) {
    const perCh = Math.ceil(REVISION_COUNT / completed.length);
    const queues = completed.map((ci, k) => {
      const qs = chapters[ci].questions;
      const expanded: Array<{ q: Question; qi: number }> = [];
      for (let n = 0; expanded.length < perCh; n++) {
        const qi = n % qs.length;
        expanded.push({ q: qs[qi], qi });
      }
      return seededShuffle(expanded, (round + 1) * 97 + k * 13 + 7).map(({ q, qi }) => ({
        key: `${band}#${ci}#${qi}`,
        q,
        chapterTitle: chapters[ci].title,
      }));
    });
    for (let r = 0; items.length < REVISION_COUNT; r++) {
      let any = false;
      for (const queue of queues) {
        if (items.length >= REVISION_COUNT) break;
        const it = queue[r];
        if (it) {
          items.push(it);
          any = true;
        }
      }
      if (!any) break;
    }
  }

  if (locked) {
    return (
      <TabCard>
        <h2 className="font-heading text-lg font-semibold">Mixed revision</h2>
        <EmptyState note="Complete at least two chapter quizzes first — revision mixes what you have already learned." />
        <p className="text-center text-sm text-muted-foreground">
          Chapters completed so far: {completed.length}
        </p>
      </TabCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TabCard>
        <h2 className="font-heading text-lg font-semibold">Mixed revision</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ten questions interleaved across your {completed.length} completed chapter
          {completed.length === 1 ? '' : 's'} — revising in mixed order is harder and it sticks
          better.
        </p>
      </TabCard>
      <RunQuiz
        key={round}
        items={items}
        doneTitle="Mixed revision complete."
        doneXpLine={`+${PRACTICE_XP.revision} XP ${
          collected ? 'collected today' : "for today's first revision"
        }`}
        onDone={() => onPracticeDone('revision')}
        onAgain={() => setRound((r) => r + 1)}
      />
    </div>
  );
}

// ---------- 6. Legendary ----------

function LegendaryTab({
  state,
  band,
  onLegendary,
}: {
  state: LumioState;
  band: Band;
  onLegendary: () => void;
}) {
  const chapters = BANDS[band].chapters;
  const mastered = masteredCount(state);
  const locked = mastered < 2;
  const doneEver = legendaryDone(state);

  const [round, setRound] = useState(0);

  // Hard mix: the last question of each chapter, padded with earlier ones if needed.
  const items: QuizItem[] = [];
  if (!locked) {
    for (let back = 0; items.length < LEGENDARY_COUNT && back < 64; back++) {
      for (let ci = 0; ci < chapters.length && items.length < LEGENDARY_COUNT; ci++) {
        const qs = chapters[ci].questions;
        const qi = qs.length - 1 - back;
        if (qi >= 0) {
          items.push({ key: `${band}#${ci}#${qi}`, q: qs[qi], chapterTitle: chapters[ci].title });
        }
      }
    }
  }

  if (locked) {
    return (
      <TabCard>
        <h2 className="font-heading text-lg font-semibold">Legendary</h2>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Trophy className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-md text-sm text-muted-foreground">
            Master 2 chapters to unlock the legendary challenge (you have {mastered}).
          </p>
        </div>
      </TabCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <TabCard>
        <div className="flex items-center gap-3">
          <Trophy className="size-6 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-heading text-lg font-semibold">Legendary</h2>
            <p className="text-sm text-muted-foreground">
              Ten hard questions drawn from across all {chapters.length} chapters in this band.
            </p>
          </div>
        </div>
      </TabCard>
      <RunQuiz
        key={round}
        items={items}
        doneTitle="Legendary challenge complete."
        doneXpLine={
          doneEver
            ? `+${LEGENDARY_XP} XP, once ever — collected`
            : `+${LEGENDARY_XP} XP, once ever`
        }
        onDone={onLegendary}
        onAgain={() => setRound((r) => r + 1)}
      />
    </div>
  );
}

// ---------- 7. Error lab ----------

function ErrorLabTab({
  state,
  today,
  band,
  onPracticeDone,
}: {
  state: LumioState;
  today: string;
  band: Band;
  onPracticeDone: (kind: PracticeKind) => void;
}) {
  const missed = resolveMissed(band, state.wrong);
  const collected = practiceDoneToday(state, 'errorlab', today);

  const [pos, setPos] = useState(0);
  const [done, setDone] = useState(false);
  const paidRef = useRef(false);

  const advance = () => {
    if (pos === 0 && !paidRef.current) {
      paidRef.current = true;
      onPracticeDone('errorlab');
    }
    if (pos + 1 >= missed.length) {
      setDone(true);
    } else {
      setPos(pos + 1);
    }
  };

  if (missed.length === 0) {
    return (
      <TabCard>
        <h2 className="font-heading text-lg font-semibold">Error lab</h2>
        <EmptyState note="No misses recorded yet — the Error Lab fills up as questions come back wrong in quizzes and practice." />
      </TabCard>
    );
  }

  if (done) {
    return (
      <TabCard>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <Mascot pose="excited" size="xl" bob />
          <h2 className="font-heading text-xl font-bold">
            Reviewed {missed.length} mistake{missed.length === 1 ? '' : 's'}
          </h2>
          <p className="text-sm text-muted-foreground">
            +{PRACTICE_XP.errorlab} XP {collected ? 'collected today' : "for today's first lab"}
          </p>
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={() => {
              setPos(0);
              setDone(false);
              paidRef.current = true;
            }}
          >
            Review them again
          </Button>
        </div>
      </TabCard>
    );
  }

  const row = missed[pos];
  const tagged = state.mistakes[row.id]?.tag;
  const tagLabel = MISTAKE_TAGS.find((t) => t.tag === tagged)?.label;
  const steps = workedSteps(row.q, row.chapterTitle, row.subject);
  const last = pos + 1 >= missed.length;

  return (
    <TabCard>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold">
          Mistake {pos + 1} of {missed.length}
        </h2>
        <Badge variant="secondary">{row.subject}</Badge>
      </div>

      <p className="mt-3 font-heading text-base font-semibold sm:text-lg">{row.q.text}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        You missed this in &ldquo;{row.chapterTitle}&rdquo;
        {tagLabel ? ` — tagged as ${tagLabel.toLowerCase()}` : ''}.
      </p>

      <div className="mt-4 rounded-2xl border border-border bg-background p-4">
        <p className="text-sm font-semibold">Worked solution</p>
        <ol className="mt-3 flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex items-start gap-3">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-5 flex items-center justify-end">
        <Button className="min-h-[44px]" onClick={advance}>
          {last ? 'Finish review' : 'Next mistake'} <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </TabCard>
  );
}

// ---------- 8. Mistake notebook ----------

function NotebookTab({
  state,
  band,
  onTagMistake,
  aiAvailable,
  demo,
}: {
  state: LumioState;
  band: Band;
  onTagMistake: (questionId: string, tag: MistakeTag | null) => void;
  aiAvailable?: boolean;
  demo?: boolean;
}) {
  const lang = state.profile?.lang ?? 'en';
  const rows = resolveMissed(band, state.wrong);

  return (
    <TabCard>
      <div data-tour="practice-mistakes">
      <h2 className="font-heading text-lg font-semibold">Mistake notebook</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Every question you have missed. Tag each one so Lumio knows what kind of revision it needs —
        a concept gap gets re-teaching, a careless slip just a gentle nudge.
      </p>

      {rows.length === 0 ? (
        <EmptyState note="No mistakes recorded yet — the notebook fills up with questions you miss in quizzes and practice." />
      ) : (
        <ul className="mt-4 flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
          {rows.map((row) => {
            const active = state.mistakes[row.id]?.tag ?? null;
            return (
              <li key={row.id} className="rounded-xl border border-border p-4">
                <p className="text-sm font-medium">{row.q.text}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{row.chapterTitle}</Badge>
                  <span>{row.subject}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Tag this mistake">
                  {MISTAKE_TAGS.map(({ tag, label }) => {
                    const isActive = active === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onTagMistake(row.id, isActive ? null : tag)}
                        className={cn(
                          'press min-h-[44px] rounded-full border px-4 text-sm font-medium',
                          isActive
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/40',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {/* chunk 5B: AI explanation, notebook-style (chosen = null) */}
                <AiMistakeCard
                  id={row.id}
                  band={band}
                  lang={lang}
                  chapterTitle={row.chapterTitle}
                  subject={row.subject}
                  question={row.q}
                  chosen={null}
                  aiAvailable={aiAvailable !== false}
                  demo={demo}
                  tagged={state.mistakes[row.id]?.tag ?? null}
                  onConfirmTag={(qid, tag) => onTagMistake(qid, tag)}
                />
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </TabCard>
  );
}

// ---------- hub ----------

export function PracticeHub({
  state,
  today,
  onCardReview,
  onPracticeDone,
  onLegendary,
  onTagMistake,
  onOpenChapter,
  aiAvailable,
  demo,
  mocks,
}: PracticeHubProps) {
  const band = state.profile?.band ?? 'sec';
  const tr = tFor(state.profile?.lang);
  const [tab, setTab] = useState<TabId>('flashcards');

  return (
    <section aria-labelledby="practice-heading" data-tour="practice-root" className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <Mascot pose="curious" size="md" bob />
          </div>
          <div>
            <h1 id="practice-heading" className="font-heading text-2xl font-bold">
              {tr('games.practice')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr('games.practiceNote')}
            </p>
          </div>
        </div>
      </div>

      <div role="tablist" aria-label="Practice tools" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`practice-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`practice-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              'press flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-semibold',
              tab === t.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:border-primary/40',
            )}
          >
            <t.icon className="size-4" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`practice-panel-${tab}`} aria-labelledby={`practice-tab-${tab}`}>
        {tab === 'flashcards' && (
          <FlashcardsTab
            state={state}
            today={today}
            band={band}
            onCardReview={onCardReview}
            onPracticeDone={onPracticeDone}
          />
        )}
        {tab === 'weak' && <WeakTopicsTab state={state} onOpenChapter={onOpenChapter} />}
        {tab === 'drill' && (
          <DrillTab state={state} today={today} band={band} onPracticeDone={onPracticeDone} />
        )}
        {tab === 'adaptive' && (
          <AdaptiveTab state={state} today={today} band={band} onPracticeDone={onPracticeDone} />
        )}
        {tab === 'revision' && (
          <RevisionTab state={state} today={today} band={band} onPracticeDone={onPracticeDone} />
        )}
        {tab === 'legendary' && (
          <LegendaryTab state={state} band={band} onLegendary={onLegendary} />
        )}
        {tab === 'errorlab' && (
          <ErrorLabTab state={state} today={today} band={band} onPracticeDone={onPracticeDone} />
        )}
        {tab === 'notebook' && (
          <NotebookTab
            state={state}
            band={band}
            onTagMistake={onTagMistake}
            aiAvailable={aiAvailable}
            demo={demo}
          />
        )}
        {tab === 'mocks' && mocks}
      </div>
    </section>
  );
}
