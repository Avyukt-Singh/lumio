'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, GraduationCap, Target, Compass, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mascot } from '../Mascot';
import { cn } from '@/lib/utils';
import { BOARDS, BANDS, EXAMS, type Band, type LearnerCat } from '@/lib/lumio/content';
import type { Profile, SchedulePlan } from '@/lib/lumio/types';

/**
 * First-run setup (chunk 1: compact but complete enough to build a real plan).
 * The full per-learner-type wizard with every validation is chunk 2 (PARITY.md);
 * this screen saves progress per step, so it is resumable.
 */

export interface FirstRunResult {
  profile: Profile;
  plan: SchedulePlan;
}

export interface FirstRunDraft {
  step: number;
  cat: LearnerCat;
  name: string;
  className: string;
  board: string;
  state: string;
  goalText: string;
  exam: string;
  examDate: string;
  schoolStart: string;
  schoolEnd: string;
  dinner: string;
  bedtime: string;
  sessions: number;
  sessionLen: number;
}

export const EMPTY_DRAFT: FirstRunDraft = {
  step: 0,
  cat: 'school',
  name: '',
  className: '',
  board: 'CBSE',
  state: '',
  goalText: '',
  exam: '',
  examDate: '',
  schoolStart: '08:00',
  schoolEnd: '15:00',
  dinner: '20:00',
  bedtime: '22:30',
  sessions: 2,
  sessionLen: 30,
};

const CATS: Array<{ id: LearnerCat; title: string; desc: string; icon: typeof GraduationCap }> = [
  { id: 'school', title: 'School student', desc: 'Nursery to Class 12', icon: GraduationCap },
  { id: 'dropper', title: 'Exam dropper', desc: 'Preparing for JEE, NEET, CUET and more', icon: Target },
  { id: 'above', title: 'Beyond Class 12', desc: 'Learning for skills and goals', icon: Compass },
];

const CLASSES = [
  'Nursery', 'LKG', 'UKG', ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`),
];

export function bandOf(cls: string, cat: LearnerCat): Band {
  if (cat === 'dropper') return 'dropper';
  if (cat === 'above') return 'above';
  const n = CLASSES.indexOf(cls);
  if (n < 0) return 'middle';
  if (n <= 2) return 'young'; // Nursery, LKG, UKG
  // index 3 = Class 1 ... index 14 = Class 12
  const grade = n - 2;
  if (grade <= 5) return 'young'; // Classes 1-5
  if (grade <= 8) return 'middle'; // Classes 6-8
  if (grade <= 10) return 'sec'; // Classes 9-10
  return 'senior'; // Classes 11-12
}

function toMin(hhmm: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return fallback;
  return h * 60 + min;
}

export function FirstRun({
  draft,
  onDraftChange,
  onFinish,
}: {
  draft: FirstRunDraft | null;
  onDraftChange: (d: FirstRunDraft | null) => void;
  onFinish: (r: FirstRunResult) => void;
}) {
  const [d, setD] = useState<FirstRunDraft>(draft ?? EMPTY_DRAFT);
  const [error, setError] = useState('');
  const total = 3;

  const band = bandOf(d.className, d.cat);
  const set = (patch: Partial<FirstRunDraft>) => {
    const next = { ...d, ...patch };
    setD(next);
    onDraftChange(next); // resumable per step
  };

  const stepError = useMemo(() => {
    if (d.step === 0) return '';
    if (d.step === 1) {
      if (d.cat === 'school' && !d.className) return 'Choose your class.';
      if (d.cat === 'dropper' && !d.exam) return 'Choose the exam you are preparing for.';
      if (d.cat === 'dropper' && d.examDate) {
        if (Number.isNaN(Date.parse(d.examDate))) return 'Enter a valid exam date.';
        if (Date.parse(d.examDate) < Date.now()) return 'The exam date must be in the future.';
      }
      if (d.cat === 'above' && !d.goalText.trim()) return 'Tell Lumio what you want to learn.';
      return '';
    }
    if (d.step === 2) {
      const start = toMin(d.schoolStart, -1);
      const end = toMin(d.schoolEnd, -1);
      const dinner = toMin(d.dinner, -1);
      const bed = toMin(d.bedtime, -1);
      if (start < 0 || end < 0 || dinner < 0 || bed < 0) return 'Enter times as HH:MM.';
      if (end <= start) return 'School end must be after school start.';
      if (bed <= dinner) return 'Bedtime must be after dinner.';
      return '';
    }
    return '';
  }, [d]);

  const finish = () => {
    const profile: Profile = {
      name: d.name.trim(),
      cat: d.cat,
      band,
      board: d.cat === 'school' ? d.board : '',
      state: d.cat === 'school' && d.board === 'Other State Board' ? d.state : undefined,
      className: d.cat === 'school' ? d.className : '',
      goalText: d.goalText.trim() || (d.cat === 'dropper' ? `${d.exam} preparation` : ''),
      exam: d.cat === 'dropper' ? d.exam : undefined,
      examDate: d.cat === 'dropper' ? d.examDate : undefined,
      tz: 'Asia/Kolkata',
      lang: 'en',
    };
    const plan: SchedulePlan = {
      startMin: toMin(d.schoolStart, 480),
      endMin: toMin(d.schoolEnd, 900),
      dinnerMin: toMin(d.dinner, 1200),
      bedMin: toMin(d.bedtime, 1350),
      sessions: Math.max(1, Math.min(6, d.sessions)),
      sessionLen: Math.max(10, Math.min(120, d.sessionLen)),
    };
    onDraftChange(null); // clear resumable draft
    onFinish({ profile, plan });
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-4 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
        <Mascot pose="standing" size="lg" bob />
        <div>
          <h1 className="font-heading text-2xl font-bold">Hi, I am Lumio!</h1>
          <p className="text-sm text-muted-foreground">
            Your learning buddy. Answer a few things and I will build your plan.
          </p>
          <Progress value={((d.step + 1) / total) * 100} className="mt-2 h-2" aria-label={`Setup step ${d.step + 1} of ${total}`} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        {stepError && (
          <p role="alert" className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {stepError}
          </p>
        )}

        {d.step === 0 && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Who is learning?</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {CATS.map(({ id, title, desc, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => set({ cat: id })}
                  aria-pressed={d.cat === id}
                  className={cn(
                    'press flex min-h-[88px] flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left',
                    d.cat === id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <span className="font-semibold">{title}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Label htmlFor="fr-name">Your name (optional)</Label>
              <Input
                id="fr-name"
                value={d.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Learner name"
                maxLength={30}
                className="mt-1"
              />
            </div>
          </fieldset>
        )}

        {d.step === 1 && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Your learning goal</legend>
            {d.cat === 'school' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="fr-cls">Class</Label>
                    <Select value={d.className} onValueChange={(v) => set({ className: v })}>
                      <SelectTrigger id="fr-cls" className="mt-1">
                        <SelectValue placeholder="Pick your class" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {CLASSES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="fr-board">Board</Label>
                    <Select value={d.board} onValueChange={(v) => set({ board: v })}>
                      <SelectTrigger id="fr-board" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BOARDS.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {d.board === 'Other State Board' && (
                  <div className="mt-3">
                    <Label htmlFor="fr-state">Your state</Label>
                    <Input
                      id="fr-state"
                      value={d.state}
                      onChange={(e) => set({ state: e.target.value })}
                      placeholder="e.g. Kerala"
                      className="mt-1"
                    />
                  </div>
                )}
                <div className="mt-3">
                  <Label htmlFor="fr-goal">What do you want to get better at? (optional)</Label>
                  <Input
                    id="fr-goal"
                    value={d.goalText}
                    onChange={(e) => set({ goalText: e.target.value })}
                    placeholder="e.g. Do well in Physics"
                    maxLength={80}
                    className="mt-1"
                  />
                </div>
              </>
            )}
            {d.cat === 'dropper' && (
              <>
                <div>
                  <Label htmlFor="fr-exam">Target exam</Label>
                  <Select value={d.exam} onValueChange={(v) => set({ exam: v })}>
                    <SelectTrigger id="fr-exam" className="mt-1">
                      <SelectValue placeholder="Pick your exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXAMS.map((x) => (
                        <SelectItem key={x} value={x}>{x}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-3">
                  <Label htmlFor="fr-date">Exam date (optional)</Label>
                  <Input
                    id="fr-date"
                    type="date"
                    value={d.examDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => set({ examDate: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="mt-3">
                  <Label htmlFor="fr-goal2">This year, you want to… (optional)</Label>
                  <Input
                    id="fr-goal2"
                    value={d.goalText}
                    onChange={(e) => set({ goalText: e.target.value })}
                    placeholder="e.g. Finish the syllabus by March"
                    maxLength={80}
                    className="mt-1"
                  />
                </div>
              </>
            )}
            {d.cat === 'above' && (
              <div>
                <Label htmlFor="fr-goal3">What do you want to learn?</Label>
                <Input
                  id="fr-goal3"
                  value={d.goalText}
                  onChange={(e) => set({ goalText: e.target.value })}
                  placeholder="e.g. Python for data analysis"
                  maxLength={80}
                  className="mt-1"
                />
              </div>
            )}
          </fieldset>
        )}

        {d.step === 2 && (
          <fieldset>
            <legend className="mb-1 font-heading text-lg font-semibold">Your day</legend>
            <p className="mb-3 text-sm text-muted-foreground">
              Lumio plans study sessions around school, dinner and bedtime.{' '}
              {d.cat !== 'school' && 'School times stand for your study hours.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TimeField id="fr-schst" label="School / study starts" value={d.schoolStart} onChange={(v) => set({ schoolStart: v })} />
              <TimeField id="fr-schen" label="School / study ends" value={d.schoolEnd} onChange={(v) => set({ schoolEnd: v })} />
              <TimeField id="fr-dinner" label="Dinner" value={d.dinner} onChange={(v) => set({ dinner: v })} />
              <TimeField id="fr-bed" label="Bedtime" value={d.bedtime} onChange={(v) => set({ bedtime: v })} />
              <div>
                <Label htmlFor="fr-sess">Sessions per day</Label>
                <Select value={String(d.sessions)} onValueChange={(v) => set({ sessions: Number(v) })}>
                  <SelectTrigger id="fr-sess" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fr-len">Minutes per session</Label>
                <Select value={String(d.sessionLen)} onValueChange={(v) => set({ sessionLen: Number(v) })}>
                  <SelectTrigger id="fr-len" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15, 20, 25, 30, 45, 60].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} minutes</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" aria-hidden="true" />
              Band: <strong>{BANDS[band].name}</strong> — Lumio adapts to it.
            </p>
          </fieldset>
        )}

        <div className="mt-5 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => (d.step === 0 ? undefined : set({ step: d.step - 1 }))}
            disabled={d.step === 0}
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Back
          </Button>
          {d.step < total - 1 ? (
            <Button
              onClick={() => {
                if (stepError) return;
                set({ step: d.step + 1 });
                setError('');
              }}
              disabled={!!stepError}
            >
              Next <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={!!stepError}>
              <Check className="size-4" aria-hidden="true" /> Start learning
            </Button>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Sample content only — Lumio material is written for practice, not official curriculum.
      </p>
    </div>
  );
}

function TimeField({
  id, label, value, onChange,
}: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
      />
    </div>
  );
}
