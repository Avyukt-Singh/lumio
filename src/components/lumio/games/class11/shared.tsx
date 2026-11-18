'use client';

import { useState } from 'react';
import { Brain, BookOpen, ClipboardList, CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared helpers for the Class-11 lab set (senior band). Three integration
 * requirements from the curriculum spec live here so every lab stays
 * consistent:
 *
 * 1. `PredictFirst` — a "predict first" prompt that asks the learner to commit
 *    to a guess before a simulation result is revealed (retention technique).
 *    It is fully self-managed: pass a question, options and an explanation;
 *    it reports the outcome through `onResolved` (once).
 * 2. `ChapterRef` — an honest, text-only link to the linked NCERT chapter /
 *    topic. No URLs are invented (R1 truth in the UI); the text is a study
 *    pointer, not a clickable official link.
 * 3. `LabReport` — a bordered observation table (practical-exam prep). Rows
 *    are supplied by the lab as strings/numbers and rendered read-only with
 *    a caption and an optional honest note.
 */

export interface PredictOption {
  label: string;
  /** Exactly one option per prediction must be correct. */
  correct?: boolean;
}

/**
 * "Predict first" card. Key it (React `key`) to reset between questions.
 * `onResolved` fires once, after the learner commits to a choice.
 */
export function PredictFirst({
  prompt,
  options,
  explain,
  onResolved,
  className,
}: {
  prompt: string;
  options: PredictOption[];
  /** Why the correct answer is right — shown after committing. */
  explain: string;
  onResolved?: (correct: boolean) => void;
  className?: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const correctIdx = options.findIndex((o) => o.correct);
  const resolved = picked !== null;

  function choose(i: number) {
    if (resolved) return;
    setPicked(i);
    onResolved?.(i === correctIdx);
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-primary/30 bg-primary/5 p-4',
        className
      )}
    >
      <p className="flex items-start gap-2 text-sm font-semibold">
        <Brain className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        Predict first: {prompt}
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Prediction options for: ${prompt}`}>
        {options.map((o, i) => {
          const isPicked = picked === i;
          const isCorrect = o.correct === true;
          return (
            <button
              key={o.label}
              onClick={() => choose(i)}
              disabled={resolved}
              aria-pressed={isPicked}
              className={cn(
                'press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-sm font-medium',
                !resolved && 'border-border bg-card hover:bg-accent/10',
                resolved && isCorrect && 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                resolved && isPicked && !isCorrect && 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                resolved && !isPicked && !isCorrect && 'border-border bg-card text-muted-foreground opacity-60'
              )}
            >
              {resolved && isCorrect && <CheckCircle2 className="size-4" aria-hidden="true" />}
              {resolved && isPicked && !isCorrect && <XCircle className="size-4" aria-hidden="true" />}
              {o.label}
            </button>
          );
        })}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn(
          'mt-2 text-xs',
          resolved ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {resolved
          ? `${picked === correctIdx ? 'Good prediction. ' : 'Not quite — now test it. '}${explain}`
          : 'Commit to a guess before you run the sim — you will remember the result better.'}
      </p>
    </div>
  );
}

/** Text-only, honest pointer to the linked NCERT chapter / topic (no URLs). */
export function ChapterRef({
  subject,
  chapter,
  topic,
  className,
}: {
  subject: string;
  chapter: string;
  topic?: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'flex items-start gap-1.5 text-xs text-muted-foreground',
        className
      )}
    >
      <BookOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>
        Linked chapter: <b>{chapter}</b> ({subject}){topic ? ` — ${topic}` : ''}. Open this lab right after studying the concept.
      </span>
    </p>
  );
}

/**
 * Observation table for practical-exam prep. Supply columns and rows from the
 * lab's state; the table is read-only, labelled and screen-reader friendly.
 */
export function LabReport({
  title,
  columns,
  rows,
  note,
  className,
}: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  note?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-border bg-background/50 p-4', className)}>
      <p className="flex items-center gap-2 text-sm font-bold">
        <ClipboardList className="size-4" aria-hidden="true" /> {title}
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No observations yet — run a trial and it will be recorded here.
        </p>
      ) : (
        <div className="mt-3 max-h-64 overflow-y-auto">
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-border text-left">
                {columns.map((c) => (
                  <th key={c} scope="col" className="whitespace-nowrap px-2 py-1.5 font-semibold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  {r.map((cell, j) => (
                    <td key={j} className="whitespace-nowrap px-2 py-1.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {note && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}
    </div>
  );
}
