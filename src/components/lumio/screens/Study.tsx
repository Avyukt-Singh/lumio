'use client';

import { useMemo, useState } from 'react';
import {
  BookOpen, CheckCircle2, CircleDashed, GraduationCap, Lock, Search, Sparkles,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mascot } from '../Mascot';
import { cn } from '@/lib/utils';
import { BANDS, type Band } from '@/lib/lumio/content';
import { chapterState, chapterTally, type ChapterState } from '@/lib/lumio/domain';
import type { LumioState } from '@/lib/lumio/types';

/**
 * Study Area (chunk 2): the chapter path with four states (locked, available,
 * completed, mastered) and header search across chapters (3.4). Tapping an open
 * chapter opens the reader.
 */

const STATE_LABEL: Record<ChapterState, string> = {
  locked: 'Locked',
  available: 'Ready',
  completed: 'Completed — improve',
  mastered: 'Mastered',
};

export function Study({
  state,
  onOpenChapter,
}: {
  state: LumioState;
  onOpenChapter: (index: number) => void;
}) {
  const band = state.profile?.band ?? 'sec';
  const bandDef = BANDS[band];
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const chapters = useMemo(() => {
    return bandDef.chapters
      .map((ch, i) => ({ chapter: ch, index: i, state: chapterState(band, i, state.res) }))
      .filter(({ chapter }) =>
        !q ||
        chapter.title.toLowerCase().includes(q) ||
        chapter.subject.toLowerCase().includes(q) ||
        chapter.summary.toLowerCase().includes(q)
      );
  }, [bandDef.chapters, band, state.res, q]);

  const tally = chapterTally(band, state.res);

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="study-head" data-tour="study-head" className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="study-head" className="flex items-center gap-2 font-heading text-2xl font-bold">
              <GraduationCap className="size-6 text-primary" aria-hidden="true" /> Study path
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {bandDef.name} · {tally.completed}/{tally.total} completed · {tally.mastered} mastered
            </p>
          </div>
          <Mascot pose="curious" size="md" />
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chapters, subjects…"
            aria-label="Search chapters"
            className="pl-9"
          />
        </div>
      </section>

      {/* The path: vertical connector line with state nodes */}
      <section aria-label="Chapter path" data-tour="study-path" className="rounded-2xl border border-border bg-card p-5">
        {chapters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chapters match “{query}”.</p>
        ) : (
          <ol className="relative flex flex-col">
            {chapters.map(({ chapter, index, state: st }, i) => {
              const open = st !== 'locked';
              return (
                <li key={index} className="relative flex gap-4 pb-4 last:pb-0">
                  {/* connector */}
                  {i < chapters.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute left-6 top-12 h-[calc(100%-2.5rem)] w-0.5',
                        st === 'mastered' || st === 'completed' ? 'bg-primary/40' : 'bg-border'
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      'relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border-2',
                      st === 'mastered' && 'border-success bg-success text-success-foreground',
                      st === 'completed' && 'border-primary bg-primary text-primary-foreground',
                      st === 'available' && 'border-primary bg-primary/10 text-primary',
                      st === 'locked' && 'border-border bg-muted text-muted-foreground'
                    )}
                  >
                    {st === 'mastered' ? (
                      <Sparkles className="size-5" aria-hidden="true" />
                    ) : st === 'locked' ? (
                      <Lock className="size-5" aria-hidden="true" />
                    ) : (
                      <span className="font-heading text-base font-bold">{index + 1}</span>
                    )}
                  </span>
                  <button
                    onClick={() => open && onOpenChapter(index)}
                    data-tour={i === 0 ? 'chapter-first' : undefined}
                    disabled={!open}
                    aria-label={`${chapter.title} — ${STATE_LABEL[st]}${open ? ', open chapter' : ''}`}
                    className={cn(
                      'press min-h-[56px] flex-1 rounded-xl border p-3 text-left',
                      open
                        ? 'border-border bg-muted/50 hover:border-primary/40 hover:bg-muted'
                        : 'cursor-not-allowed border-dashed border-border bg-transparent opacity-70'
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{chapter.title}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {chapter.subject}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          st === 'mastered' && 'bg-success-soft text-success-soft-foreground',
                          st === 'completed' && 'bg-primary/10 text-primary',
                          st === 'available' && 'bg-accent/15 text-accent',
                          st === 'locked' && 'bg-muted text-muted-foreground'
                        )}
                      >
                        {STATE_LABEL[st]}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {chapter.summary}
                    </span>
                    <span className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="size-3.5" aria-hidden="true" /> {chapter.questions.length} quiz questions
                      </span>
                      {st === 'completed' && (
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="size-3.5" aria-hidden="true" /> best {state.res[`${band}#${index}`]?.best}/{chapter.questions.length}
                        </span>
                      )}
                      {st === 'locked' && (
                        <span className="inline-flex items-center gap-1">
                          <CircleDashed className="size-3.5" aria-hidden="true" /> finish the previous chapter to unlock
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          A chapter unlocks when the previous one is completed (best score of at least 1).
          Mastered means full marks.
        </p>
      </section>
    </div>
  );
}

/** Board & class guide (7.2 keep): confidence lines, tools, honest sourcing. */
export function BoardGuide({ state }: { state: LumioState }) {
  const band = state.profile?.band ?? 'sec';
  const bandDef = BANDS[band];
  const board = state.profile?.board || 'your board';
  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="board-head" data-tour="board-head" className="rounded-2xl border border-border bg-card p-5">
        <h1 id="board-head" className="font-heading text-2xl font-bold">Board & class guide</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {board} · {bandDef.name}
        </p>
        <div className="mt-4 rounded-xl bg-muted/60 p-4">
          <h2 className="font-heading text-base font-semibold">How this band learns</h2>
          <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
            {bandDef.tools.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <div className="mt-3 rounded-xl bg-muted/60 p-4">
          <h2 className="font-heading text-base font-semibold">Subjects in your catalogue</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {(state.profile?.subjects ?? bandDef.subjects).join(' · ')}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Custom subjects you added during onboarding appear here too.
          </p>
        </div>
        <div className="mt-3 rounded-xl bg-muted/60 p-4">
          <h2 className="font-heading text-base font-semibold">Assessment patterns</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Most boards assess with a mix of short answers, long answers and internal
            projects. Lumio&apos;s quizzes practise the recall part; always confirm the
            exact pattern with your teacher or the official {board} resources — Lumio
            does not copy official board material and links nothing it cannot verify.
          </p>
          <p className="mt-2 text-sm font-medium">
            Confidence: you have completed {chapterTally(band, state.res).completed} of{' '}
            {bandDef.chapters.length} sample chapters in your path — steady, honest progress.
          </p>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Lumio-written sample material only — never official curriculum, textbooks or past papers.
        </p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">Where the full guide goes next</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The complete board guide with assessment-pattern tables, official-link checks and
          the CBSE Class 11 Physics outline screen is scheduled with the study-tools chunk.
          Everything shown here today is honest and labelled — nothing is invented.
        </p>
        <Button variant="ghost" className="mt-3" disabled>
          Official links arrive after the link checker (chunk 4)
        </Button>
      </section>
    </div>
  );
}
