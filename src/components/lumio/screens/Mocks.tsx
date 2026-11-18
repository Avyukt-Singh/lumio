'use client';

import { useState } from 'react';
import { ClipboardList, Info, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BANDS, type Band } from '@/lib/lumio/content';
import { MOCK_XP, mockXpGranted, subjectPool } from '@/lib/lumio/domain';
import type { LumioState } from '@/lib/lumio/types';
import { AiMockPaper } from '../ai/AiMockPaper';
import { tFor } from '@/lib/lumio/i18n';

/**
 * Chunk 4A: self-reported mock tests. Honest by design — the learner records
 * what actually happened; Lumio never invents or inflates a score. Mock XP
 * lands once per day (the parent enforces it via the mock-recorded event).
 */

export function MockTests({
  state,
  today,
  band,
  onRecordMock,
  aiAvailable,
  demo,
}: {
  state: LumioState;
  /** learner-local yyyy-mm-dd */
  today: string;
  band: Band;
  onRecordMock: (mock: {
    date: string;
    subject: string;
    score: number;
    total: number;
    weakChapters: number[];
  }) => void;
  /** chunk 5-AI feature 5: AI practice paper availability */
  aiAvailable?: boolean;
  demo?: boolean;
}) {
  const lang = state.profile?.lang ?? 'en';
  const subjects = subjectPool(state).length > 0 ? subjectPool(state) : BANDS[band].subjects;
  const chapters = BANDS[band].chapters;

  const [subject, setSubject] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [total, setTotal] = useState('100');
  const [score, setScore] = useState('');
  const [weak, setWeak] = useState<number[]>([]);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const dateOk = DATE_RE.test(date) && date <= today;
  const dateFuture = DATE_RE.test(date) && date > today;
  const totalNum = Number(total);
  const totalOk = Number.isInteger(totalNum) && totalNum >= 1 && totalNum <= 300;
  const scoreNum = Number(score);
  const scoreOk = score !== '' && Number.isFinite(scoreNum) && scoreNum >= 0 && scoreNum <= totalNum;
  const canSubmit = subject !== null && dateOk && totalOk && scoreOk;

  function toggleWeak(idx: number) {
    setWeak((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
  }

  function handleSubmit() {
    if (!canSubmit || subject === null) return;
    const trimmed = date.trim();
    const alreadyGranted = mockXpGranted(state, trimmed);
    onRecordMock({
      date: trimmed,
      subject,
      score: scoreNum,
      total: totalNum,
      weakChapters: [...weak].sort((a, b) => a - b),
    });
    setConfirmation(
      alreadyGranted
        ? "Mock recorded (today's mock XP already collected)."
        : `Mock recorded — +${MOCK_XP} XP`,
    );
    // keep the subject for back-to-back mocks; reset the rest
    setScore('');
    setWeak([]);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* chunk 5-AI feature 5: AI practice paper (generated, auto-graded) */}
      <AiMockPaper
        band={band}
        lang={lang}
        subjects={subjects}
        chapterTitles={chapters.map((c) => c.title)}
        onRecordMock={onRecordMock}
        aiAvailable={aiAvailable === true}
        demo={demo}
      />

      {/* record a mock */}
      <section aria-labelledby="mock-record-heading" data-tour="mock-record" className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" aria-hidden="true" />
          <h2 id="mock-record-heading" className="font-heading text-lg font-bold">
            Record a mock
          </h2>
        </div>
        <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Mocks are self-reported. Lumio never inflates a score — record what actually happened.
          </span>
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <fieldset>
            <legend className="text-sm font-semibold">Subject</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={subject === s}
                  onClick={() => setSubject(s)}
                  className={cn(
                    'press flex min-h-[44px] items-center rounded-full border px-4 text-sm font-semibold',
                    subject === s
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:border-primary/40',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mock-date" className="text-sm font-semibold">
                Date <span className="font-normal text-muted-foreground">(yyyy-mm-dd)</span>
              </label>
              <Input
                id="mock-date"
                type="text"
                inputMode="numeric"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder={today}
              />
              {dateFuture && (
                <p className="text-xs text-destructive">Mocks cannot be dated in the future.</p>
              )}
              {!dateFuture && !dateOk && (
                <p className="text-xs text-muted-foreground">Use the yyyy-mm-dd format, today or earlier.</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mock-total" className="text-sm font-semibold">
                Total marks <span className="font-normal text-muted-foreground">(1–300)</span>
              </label>
              <Input
                id="mock-total"
                type="number"
                min={1}
                max={300}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="mock-score" className="text-sm font-semibold">
              Score <span className="font-normal text-muted-foreground">(0 to total)</span>
            </label>
            <Input
              id="mock-score"
              type="number"
              min={0}
              max={totalOk ? totalNum : undefined}
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">Weak topics</legend>
            <p className="mt-1 text-xs text-muted-foreground">
              Mark the chapters that felt weakest — they feed your weak-topic ranking.
            </p>
            <div className="mt-2 flex max-h-52 flex-wrap gap-2 overflow-y-auto">
              {chapters.map((ch, idx) => (
                <button
                  key={`${band}#${idx}`}
                  type="button"
                  aria-pressed={weak.includes(idx)}
                  onClick={() => toggleWeak(idx)}
                  className={cn(
                    'press flex min-h-[44px] flex-col items-start justify-center rounded-xl border px-3 py-1 text-left',
                    weak.includes(idx)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:border-primary/40',
                  )}
                >
                  <span className="text-sm font-semibold leading-tight">{ch.title}</span>
                  <span
                    className={cn(
                      'text-[11px] leading-tight',
                      weak.includes(idx) ? 'text-primary-foreground/80' : 'text-muted-foreground',
                    )}
                  >
                    {ch.subject}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit} className="min-h-[44px]">
              Record mock
            </Button>
            {confirmation && (
              <p role="status" className="flex items-center gap-2 text-sm font-medium text-primary">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                {confirmation}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* past mocks */}
      <section aria-labelledby="mock-history-heading" className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <h2 id="mock-history-heading" className="font-heading text-lg font-bold">
          Past mocks
        </h2>
        {state.mocks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No mocks recorded yet.</p>
        ) : (
          <ul className="mt-3 flex max-h-96 flex-col gap-2 overflow-y-auto">
            {[...state.mocks].reverse().map((m, i) => {
              const pct = m.total > 0 ? Math.round((m.score / m.total) * 100) : 0;
              return (
                <li key={`${m.date}#${m.subject}#${state.mocks.length - 1 - i}#${m.score}`} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{m.subject}</Badge>
                    <span className="text-sm text-muted-foreground">{m.date}</span>
                    <span className="ml-auto text-sm font-semibold tabular-nums">
                      {m.score}/{m.total} ({pct}%)
                    </span>
                  </div>
                  {m.weakChapters.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.weakChapters.map((idx) => (
                        <Badge key={idx} variant="outline" className="text-xs font-normal">
                          {chapters[idx]?.title ?? 'Chapter'}
                        </Badge>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
