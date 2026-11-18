'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, Clock, Compass, GraduationCap, Moon, Plus, ShieldCheck,
  Sun, Sunrise, Target, Trash2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Mascot } from '../Mascot';
import { cn } from '@/lib/utils';
import { BOARDS, BANDS, EXAMS, type Band, type LearnerCat } from '@/lib/lumio/content';
import {
  classGrade, currentAcademicYear, INTEREST_AREAS, subjectsForClass,
} from '@/lib/lumio/chapterContent';
import { minToLabel, planDay } from '@/lib/lumio/domain';
import type { Commitment, Profile, SchedulePlan, ThemeName, ThemeOverride } from '@/lib/lumio/types';

/**
 * Full onboarding wizard (chunk 2, master prompt 3.3 + 7.1): every step per
 * learner type is validated, progress saves per step (resumable), optional
 * steps can be skipped for now, the youngest band is completed with a guardian
 * confirmation, and the last step shows a live schedule preview built from the
 * answers. Reopening from Settings pre-fills every answer and keeps progress.
 */

export interface FirstRunResult {
  profile: Profile;
  plan: SchedulePlan;
}

export interface WizardDraft {
  step: number;
  cat: LearnerCat;
  // look & feel (first two questions, asked for every learner)
  theme: ThemeOverride;
  // shared
  name: string;
  lang: 'en' | 'hi' | 'hinglish';
  goalText: string;
  // school
  className: string;
  board: string;
  stateName: string;
  intl: string;
  academicYear: string;
  subjects: string[];
  customSubjects: string;
  textbooks: string;
  wake: string;
  schoolStart: string;
  schoolEnd: string;
  dinner: string;
  bedtime: string;
  commitments: Commitment[];
  studyOutside: string; // hours as text for input
  nextExam: string;
  nextExamDate: string;
  compExam: string;
  compExamDate: string;
  compSub: string;
  guardianOk: boolean;
  // dropper
  exam: string;
  examDate: string;
  attempts: string;
  syllabus: string;
  strong: string;
  weak: string;
  prevPrep: string;
  mocksTaken: string;
  mockScore: string;
  mockTotal: string;
  availableHours: string;
  bestTime: string;
  // above
  learnerType: string;
  interest: string;
  interestCustom: string;
  level: string;
  targetDate: string;
  hoursPerWeek: string;
  preferredTime: string;
  topics: string;
}

export const EMPTY_DRAFT: WizardDraft = {
  step: 0,
  cat: 'school',
  theme: 'auto',
  name: '',
  lang: 'en',
  goalText: '',
  className: '',
  board: 'CBSE',
  stateName: '',
  intl: '',
  academicYear: '',
  subjects: [],
  customSubjects: '',
  textbooks: '',
  wake: '06:30',
  schoolStart: '08:00',
  schoolEnd: '15:00',
  dinner: '20:00',
  bedtime: '22:30',
  commitments: [],
  studyOutside: '',
  nextExam: '',
  nextExamDate: '',
  compExam: '',
  compExamDate: '',
  compSub: '',
  guardianOk: false,
  exam: '',
  examDate: '',
  attempts: '',
  syllabus: '',
  strong: '',
  weak: '',
  prevPrep: '',
  mocksTaken: '',
  mockScore: '',
  mockTotal: '',
  availableHours: '',
  bestTime: 'morning',
  learnerType: '',
  interest: '',
  interestCustom: '',
  level: '',
  targetDate: '',
  hoursPerWeek: '',
  preferredTime: 'morning',
  topics: '',
};

const CLASSES = [
  'Nursery', 'LKG', 'UKG', ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`),
];

const CATS: Array<{ id: LearnerCat; title: string; desc: string; icon: typeof GraduationCap }> = [
  { id: 'school', title: 'School student', desc: 'Nursery to Class 12', icon: GraduationCap },
  { id: 'dropper', title: 'Exam dropper', desc: 'Preparing for JEE, NEET, CUET and more', icon: Target },
  { id: 'above', title: 'Beyond Class 12', desc: 'Learning for skills and goals', icon: Compass },
];

const ATTEMPT_OPTIONS = ['First attempt', 'Second attempt', 'Third or later'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const TIMES = ['morning', 'afternoon', 'evening', 'night'];

export function bandOf(cls: string, cat: LearnerCat): Band {
  if (cat === 'dropper') return 'dropper';
  if (cat === 'above') return 'above';
  const n = CLASSES.indexOf(cls);
  if (n < 0) return 'middle';
  if (n <= 2) return 'young';
  const grade = n - 2;
  if (grade <= 5) return 'young';
  if (grade <= 8) return 'middle';
  if (grade <= 10) return 'sec';
  return 'senior';
}

function toMin(hhmm: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return fallback;
  return h * 60 + min;
}

function hoursToMin(hhmm: string, fallback: number): number {
  return toMin(hhmm, fallback);
}

const todayStr = () => new Date().toISOString().slice(0, 10);

// ---------- step definitions ----------

interface StepDef {
  id: string;
  title: string;
  optional?: boolean;
}

function stepsFor(cat: LearnerCat, className: string): StepDef[] {
  // theme + language come first for every learner (asked before anything else)
  const firstTwo: StepDef[] = [
    { id: 'theme', title: 'Your theme' },
    { id: 'lang', title: 'Your language' },
  ];
  const grade = classGrade(className);
  const school: StepDef[] = [
    { id: 'intro', title: 'Who is learning?' },
    { id: 'board', title: 'Your board' },
    { id: 'class', title: 'Your class' },
    { id: 'year', title: 'Academic year & language' },
    { id: 'subjects', title: 'Your subjects' },
    { id: 'books', title: 'Prescribed textbooks', optional: true },
    { id: 'day', title: 'Your day' },
    { id: 'commitments', title: 'Other commitments', optional: true },
    { id: 'outside', title: 'Study time outside school', optional: true },
    { id: 'exams', title: 'Exams ahead', optional: true },
    { id: 'goal', title: 'Your goal' },
    { id: 'guardian', title: 'Guardian confirmation' },
    { id: 'preview', title: 'Your plan is ready' },
  ];
  // competitive-exam goal only from Class 9; guardian optional for 9-12
  if (grade < 9) school.splice(9, 1);
  const dropper: StepDef[] = [
    { id: 'intro', title: 'Who is learning?' },
    { id: 'dropper-exam', title: 'Target exam' },
    { id: 'dropper-attempts', title: 'Previous attempts' },
    { id: 'dropper-syllabus', title: 'Subjects & syllabus' },
    { id: 'dropper-areas', title: 'Strong & weak areas' },
    { id: 'dropper-prep', title: 'Previous preparation & mocks' },
    { id: 'dropper-hours', title: 'Study hours' },
    { id: 'day', title: 'Your day' },
    { id: 'commitments', title: 'Other commitments', optional: true },
    { id: 'goal', title: 'Your goals' },
    { id: 'preview', title: 'Your plan is ready' },
  ];
  const above: StepDef[] = [
    { id: 'intro', title: 'Who is learning?' },
    { id: 'above-type', title: 'What brings you here?' },
    { id: 'above-goal', title: 'Goal & target date' },
    { id: 'above-time', title: 'Time you can give' },
    { id: 'commitments', title: 'Other commitments', optional: true },
    { id: 'above-topics', title: 'Topics to focus on', optional: true },
    { id: 'preview', title: 'Your plan is ready' },
  ];
  if (cat === 'school') return [...firstTwo, ...school];
  if (cat === 'dropper') return [...firstTwo, ...dropper];
  return [...firstTwo, ...above];
}

function draftFromProfile(p: Profile, plan: SchedulePlan | null, theme?: ThemeOverride): WizardDraft {
  const fromMin = (min: number | undefined, def: string) =>
    typeof min === 'number' && min >= 0
      ? `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
      : def;
  return {
    ...EMPTY_DRAFT,
    step: 0,
    theme: theme ?? 'auto',
    cat: p.cat,
    name: p.name,
    lang: p.lang,
    goalText: p.goalText,
    className: p.className,
    board: p.board || 'CBSE',
    stateName: p.state ?? '',
    intl: p.intl ?? '',
    academicYear: p.academicYear ?? '',
    subjects: p.subjects ?? [],
    textbooks: p.textbooks ?? '',
    wake: fromMin(p.wakeMin, EMPTY_DRAFT.wake),
    schoolStart: fromMin(plan?.startMin, EMPTY_DRAFT.schoolStart),
    schoolEnd: fromMin(plan?.endMin, EMPTY_DRAFT.schoolEnd),
    dinner: fromMin(plan?.dinnerMin, EMPTY_DRAFT.dinner),
    bedtime: fromMin(plan?.bedMin, EMPTY_DRAFT.bedtime),
    commitments: p.commitments ?? [],
    studyOutside: p.studyOutsideMin ? String(p.studyOutsideMin / 60) : '',
    nextExam: p.nextExam ?? '',
    nextExamDate: p.nextExamDate ?? '',
    compExam: p.compExam ?? '',
    compExamDate: p.compExamDate ?? '',
    compSub: p.compSub ?? '',
    guardianOk: p.guardianConfirmed ?? false,
    exam: p.exam ?? '',
    examDate: p.examDate ?? '',
    attempts: p.attempts ?? '',
    syllabus: p.syllabusCovered ?? '',
    strong: p.strongAreas ?? '',
    weak: p.weakAreas ?? '',
    prevPrep: p.prevPrep ?? '',
    mocksTaken: typeof p.mocksTaken === 'number' ? String(p.mocksTaken) : '',
    mockScore: typeof p.mockScore === 'number' ? String(p.mockScore) : '',
    mockTotal: typeof p.mockTotal === 'number' ? String(p.mockTotal) : '',
    availableHours: '',
    bestTime: 'morning',
    learnerType: p.learnerType ?? '',
    interest: p.interest ?? '',
    level: p.level ?? '',
    targetDate: p.targetDate ?? '',
    hoursPerWeek: typeof p.hoursPerWeek === 'number' ? String(p.hoursPerWeek) : '',
    preferredTime: 'morning',
    topics: '',
  };
}

// ---------- validation ----------

function validateStep(d: WizardDraft, stepId: string): string {
  switch (stepId) {
    case 'class':
      if (d.cat === 'school' && !d.className) return 'Choose your class.';
      return '';
    case 'board':
      if (d.cat !== 'school') return '';
      if (!d.board) return 'Choose your board.';
      if (d.board === 'Other State Board' && !d.stateName.trim()) {
        return 'Tell us your state or union territory so the subject list matches.';
      }
      if (d.board === 'Other / International' && !d.intl.trim()) {
        return 'Describe your curriculum briefly (e.g. IB MYP, Cambridge).';
      }
      return '';
    case 'subjects':
      if (d.cat === 'above') return '';
      if (d.subjects.length === 0 && !d.customSubjects.trim()) {
        return 'Pick at least one subject (or add your own).';
      }
      return '';
    case 'day': {
      const wake = toMin(d.wake, -1);
      const start = toMin(d.schoolStart, -1);
      const end = toMin(d.schoolEnd, -1);
      const dinner = toMin(d.dinner, -1);
      const bed = toMin(d.bedtime, -1);
      if (wake < 0 || start < 0 || end < 0 || dinner < 0 || bed < 0) {
        return 'Enter all times as HH:MM.';
      }
      if (wake > start) return 'Wake time must be before school starts.';
      if (end <= start) return 'School end must be after school start.';
      if (dinner <= end) return 'Dinner must be after school ends.';
      if (bed <= dinner) return 'Bedtime must be after dinner.';
      return '';
    }
    case 'commitments': {
      for (const c of d.commitments) {
        if (c.endMin <= c.startMin) return `“${c.label || 'Commitment'}” must end after it starts.`;
        if (c.endMin - c.startMin > 12 * 60) return 'A commitment cannot be longer than 12 hours.';
      }
      return '';
    }
    case 'outside': {
      if (!d.studyOutside.trim()) return '';
      const n = Number(d.studyOutside);
      if (!Number.isFinite(n) || n < 0 || n > 12) return 'Study hours outside school must be between 0 and 12.';
      return '';
    }
    case 'exams': {
      if (d.nextExamDate) {
        if (Number.isNaN(Date.parse(d.nextExamDate))) return 'Enter a valid exam date.';
        if (Date.parse(d.nextExamDate) < Date.parse(todayStr())) return 'The exam date must be in the future.';
      }
      if (d.compExamDate) {
        if (Number.isNaN(Date.parse(d.compExamDate))) return 'Enter a valid competitive-exam date.';
        if (Date.parse(d.compExamDate) < Date.parse(todayStr())) return 'The competitive-exam date must be in the future.';
      }
      return '';
    }
    case 'dropper-exam': {
      if (!d.exam) return 'Choose the exam you are preparing for.';
      if (d.examDate) {
        if (Number.isNaN(Date.parse(d.examDate))) return 'Enter a valid exam date.';
        if (Date.parse(d.examDate) < Date.parse(todayStr())) return 'The exam date must be in the future.';
      }
      return '';
    }
    case 'dropper-attempts':
      if (!d.attempts) return 'Choose how many attempts you have had.';
      return '';
    case 'dropper-prep': {
      const taken = d.mocksTaken.trim() === '' ? 0 : Number(d.mocksTaken);
      if (!Number.isFinite(taken) || taken < 0 || taken > 50) return 'Mocks taken must be between 0 and 50.';
      if (taken > 0) {
        const score = Number(d.mockScore);
        const total = Number(d.mockTotal);
        if (!Number.isFinite(score) || score < 0) return 'Enter your latest mock score.';
        if (!Number.isFinite(total) || total <= 0) return 'Enter the total the mock is out of.';
        if (score > total) return 'The mock score cannot be above the total.';
      }
      return '';
    }
    case 'dropper-hours': {
      const n = Number(d.availableHours);
      if (!Number.isFinite(n) || n < 1 || n > 16) return 'Available study hours per day must be between 1 and 16.';
      return '';
    }
    case 'above-goal': {
      const focus = d.interest === 'Custom' ? d.interestCustom.trim() : d.interest;
      if (!focus) return 'Choose an area of interest (or write your own goal).';
      if (!d.goalText.trim()) return 'Write your goal in one line.';
      if (d.targetDate) {
        if (Number.isNaN(Date.parse(d.targetDate))) return 'Enter a valid target date.';
        if (Date.parse(d.targetDate) < Date.parse(todayStr())) return 'The target date must be in the future.';
      }
      return '';
    }
    case 'above-time': {
      const n = Number(d.hoursPerWeek);
      if (!Number.isFinite(n) || n < 1 || n > 100) return 'Hours per week must be between 1 and 100.';
      return '';
    }
    case 'guardian':
      return '';
    default:
      return '';
  }
}

// ---------- final answers ----------

export function answersToResult(d: WizardDraft, band: Band): FirstRunResult {
  const grade = classGrade(d.className);
  const profile: Profile = {
    name: d.name.trim(),
    cat: d.cat,
    band,
    board: d.cat === 'school' ? d.board : '',
    state: d.cat === 'school' && d.board === 'Other State Board' ? d.stateName.trim() : undefined,
    intl: d.cat === 'school' && d.board === 'Other / International' ? d.intl.trim() : undefined,
    className: d.cat === 'school' ? d.className : '',
    goalText: d.goalText.trim(),
    exam: d.cat === 'dropper' ? d.exam : undefined,
    examDate: d.cat === 'dropper' && d.examDate ? d.examDate : undefined,
    tz: 'Asia/Kolkata',
    lang: d.lang,
    academicYear: d.cat === 'school' ? d.academicYear || undefined : undefined,
    subjects: d.cat === 'above' ? undefined : [...d.subjects, ...d.customSubjects.trim() ? d.customSubjects.split(',').map((s) => s.trim()).filter(Boolean) : []],
    textbooks: d.cat === 'school' && d.textbooks.trim() ? d.textbooks.trim() : undefined,
    nextExam: d.cat === 'school' && d.nextExam.trim() ? d.nextExam.trim() : undefined,
    nextExamDate: d.cat === 'school' && d.nextExamDate ? d.nextExamDate : undefined,
    compExam: d.cat === 'school' && d.compExam.trim() ? d.compExam.trim() : undefined,
    compExamDate: d.cat === 'school' && d.compExamDate ? d.compExamDate : undefined,
    compSub: d.cat === 'school' && d.compSub.trim() ? d.compSub.trim() : undefined,
    guardianConfirmed: d.cat === 'school' ? d.guardianOk : undefined,
    attempts: d.cat === 'dropper' ? d.attempts : undefined,
    syllabusCovered: d.cat === 'dropper' && d.syllabus.trim() ? d.syllabus.trim() : undefined,
    strongAreas: d.cat === 'dropper' && d.strong.trim() ? d.strong.trim() : undefined,
    weakAreas: d.cat === 'dropper' && d.weak.trim() ? d.weak.trim() : undefined,
    prevPrep: d.cat === 'dropper' && d.prevPrep.trim() ? d.prevPrep.trim() : undefined,
    mocksTaken: d.cat === 'dropper' && d.mocksTaken.trim() !== '' ? Number(d.mocksTaken) : undefined,
    mockScore: d.cat === 'dropper' && d.mockScore.trim() !== '' ? Number(d.mockScore) : undefined,
    mockTotal: d.cat === 'dropper' && d.mockTotal.trim() !== '' ? Number(d.mockTotal) : undefined,
    learnerType: d.cat === 'above' ? d.learnerType : undefined,
    interest: d.cat === 'above' ? (d.interest === 'Custom' ? d.interestCustom.trim() : d.interest) : undefined,
    level: d.cat === 'above' ? d.level : undefined,
    targetDate: d.cat === 'above' && d.targetDate ? d.targetDate : undefined,
    hoursPerWeek: d.cat === 'above' && d.hoursPerWeek.trim() !== '' ? Number(d.hoursPerWeek) : undefined,
    wakeMin: hoursToMin(d.wake, 390),
    studyOutsideMin: d.cat === 'school' && d.studyOutside.trim() !== '' ? Math.round(Number(d.studyOutside) * 60) : undefined,
    commitments: d.commitments,
  };
  const plan: SchedulePlan = {
    startMin: hoursToMin(d.schoolStart, 480),
    endMin: hoursToMin(d.schoolEnd, 900),
    dinnerMin: hoursToMin(d.dinner, 1200),
    bedMin: hoursToMin(d.bedtime, 1350),
    sessions: Math.max(1, Math.min(6, BANDS[band].dailyGoal || 2)),
    sessionLen: band === 'young' ? 15 : 30,
    wakeMin: profile.wakeMin,
    busy: d.commitments,
  };
  return { profile, plan };
}

// ---------- the wizard ----------

export function Onboarding({
  draft,
  onDraftChange,
  onFinish,
  onCancel,
  theme,
  onTheme,
}: {
  draft: WizardDraft | null;
  onDraftChange: (d: WizardDraft | null) => void;
  onFinish: (r: FirstRunResult) => void;
  /** present when reopening from Settings: keeps the current profile untouched */
  onCancel?: () => void;
  /** current effective theme — the selected option in the first step */
  theme: ThemeName;
  /** applies the theme choice immediately (persisted in settings) */
  onTheme: (o: ThemeOverride) => void;
}) {
  const [d, setD] = useState<WizardDraft>(draft ?? EMPTY_DRAFT);
  const band = bandOf(d.className, d.cat);
  const steps = stepsFor(d.cat, d.cat === 'school' ? d.className : 'Class 9');
  const stepDef = steps[Math.min(d.step, steps.length - 1)];
  const total = steps.length;

  const set = (patch: Partial<WizardDraft>) => {
    const next = { ...d, ...patch };
    setD(next);
    onDraftChange(next); // resumable per step
  };

  const stepError = useMemo(() => validateStep(d, stepDef.id), [d, stepDef.id]);

  // live schedule preview (7.1 upgrade)
  const preview = useMemo(() => {
    if (stepDef.id !== 'preview') return null;
    const { plan } = answersToResult(d, band);
    const { slots, dropped } = planDay(plan);
    return { plan, slots, dropped };
  }, [stepDef.id, d, band]);

  // default academic year + subjects once class is known
  const suggestedSubjects = subjectsForClass(d.className, d.cat);
  const yearDefault = useMemo(() => currentAcademicYear(new Date()), []);

  const finish = () => {
    const r = answersToResult(d, band);
    onDraftChange(null);
    onFinish(r);
  };

  const isYoung = band === 'young';
  const grade = classGrade(d.className);

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mb-4 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
        <Mascot pose={isYoung ? 'excited' : 'standing'} size="lg" bob />
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold">
            {d.step === 0 ? 'Hi, I am Lumio!' : stepDef.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {d.step === 0
              ? 'Your learning buddy. A few quick questions and I will build your plan.'
              : `Step ${d.step + 1} of ${total}`}
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

        {/* ---------- step bodies ---------- */}
        {stepDef.id === 'theme' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Pick your theme</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { id: 'auto' as const, icon: Sunrise, title: 'Follow the day', desc: 'Light by day, dark at night' },
                { id: 'morning' as const, icon: Sun, title: 'Always light', desc: 'Bright colours all the time' },
                { id: 'night' as const, icon: Moon, title: 'Always dark', desc: 'Easy on the eyes at night' },
              ]).map(({ id, icon: Icon, title, desc }) => (
                <button
                  key={id}
                  onClick={() => { set({ theme: id }); onTheme(id); }}
                  aria-pressed={d.theme === id}
                  className={cn(
                    'press flex min-h-[88px] flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left',
                    d.theme === id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                  )}
                >
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <span className="font-semibold">{title}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              You can change this anytime from Settings.
            </p>
          </fieldset>
        )}

        {stepDef.id === 'lang' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Choose your language</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { id: 'en' as const, title: 'English', desc: 'Learn in English' },
                { id: 'hi' as const, title: 'हिन्दी', desc: 'हिन्दी में सीखें' },
                { id: 'hinglish' as const, title: 'Hinglish', desc: 'Roman mein Hindi' },
              ]).map(({ id, title, desc }) => (
                <button
                  key={id}
                  onClick={() => set({ lang: id })}
                  aria-pressed={d.lang === id}
                  className={cn(
                    'press flex min-h-[88px] flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left',
                    d.lang === id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                  )}
                >
                  <span className="font-heading text-lg font-semibold">{title}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              The rest of the setup can continue in English — your choice is saved and the app switches right after.
            </p>
          </fieldset>
        )}

        {stepDef.id === 'intro' && (
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
                    d.cat === id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                  )}
                >
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <span className="font-semibold">{title}</span>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Label htmlFor="ob-name">Your name (optional)</Label>
              <Input id="ob-name" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Learner name" maxLength={30} className="mt-1" />
            </div>
          </fieldset>
        )}

        {stepDef.id === 'board' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Your board</legend>
            <div>
              <Label htmlFor="ob-board">Board</Label>
              <Select value={d.board} onValueChange={(v) => set({ board: v })}>
                <SelectTrigger id="ob-board" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BOARDS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {d.board === 'Other State Board' && (
              <div className="mt-3">
                <Label htmlFor="ob-state">Your state or union territory</Label>
                <Input id="ob-state" value={d.stateName} onChange={(e) => set({ stateName: e.target.value })} placeholder="e.g. Kerala" className="mt-1" />
              </div>
            )}
            {d.board === 'Other / International' && (
              <div className="mt-3">
                <Label htmlFor="ob-intl">Your curriculum</Label>
                <Input id="ob-intl" value={d.intl} onChange={(e) => set({ intl: e.target.value })} placeholder="e.g. IB MYP, Cambridge IGCSE" className="mt-1" />
              </div>
            )}
          </fieldset>
        )}

        {stepDef.id === 'class' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Your class</legend>
            <Select value={d.className} onValueChange={(v) => {
              const grade = classGrade(v);
              // guardian defaults by age (3.3): required young, recommended middle, off 9-12
              set({ className: v, subjects: [], guardianOk: grade >= 6 && grade <= 8 });
            }}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Pick your class" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
        )}

        {stepDef.id === 'year' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Academic year & language</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ob-year">Academic year</Label>
                <Input id="ob-year" value={d.academicYear} onChange={(e) => set({ academicYear: e.target.value })} placeholder={yearDefault} className="mt-1" />
                <p className="mt-1 text-xs text-muted-foreground">Defaults to the current Indian academic year.</p>
              </div>
              <div>
                <Label htmlFor="ob-lang">Preferred language</Label>
                <Select value={d.lang} onValueChange={(v) => set({ lang: v as WizardDraft['lang'] })}>
                  <SelectTrigger id="ob-lang" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
                    <SelectItem value="hinglish">Hinglish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>
        )}

        {stepDef.id === 'subjects' && (
          <fieldset>
            <legend className="mb-1 font-heading text-lg font-semibold">Your subjects</legend>
            <p className="mb-3 text-sm text-muted-foreground">
              Matched to your board{d.board === 'Other State Board' && d.stateName ? ` and ${d.stateName}` : ''}, class and catalogue. Add anything missing.
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedSubjects.map((s) => {
                const on = d.subjects.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => set({ subjects: on ? d.subjects.filter((x) => x !== s) : [...d.subjects, s] })}
                    aria-pressed={on}
                    className={cn(
                      'press inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-3 text-sm font-medium',
                      on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:border-primary/40'
                    )}
                  >
                    {on ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              <Label htmlFor="ob-custom">Custom subjects (comma separated, optional)</Label>
              <Input id="ob-custom" value={d.customSubjects} onChange={(e) => set({ customSubjects: e.target.value })} placeholder="e.g. EVS, French" className="mt-1" />
            </div>
          </fieldset>
        )}

        {stepDef.id === 'books' && (
          <fieldset>
            <legend className="mb-1 font-heading text-lg font-semibold">Prescribed textbooks</legend>
            <p className="mb-3 text-sm text-muted-foreground">Optional — Lumio never copies textbook content; this only personalises your plan.</p>
            <Label htmlFor="ob-books">Textbook names</Label>
            <Input id="ob-books" value={d.textbooks} onChange={(e) => set({ textbooks: e.target.value })} placeholder="e.g. NCERT Science Class 8" className="mt-1" />
          </fieldset>
        )}

        {stepDef.id === 'day' && (
          <fieldset>
            <legend className="mb-1 font-heading text-lg font-semibold">Your day</legend>
            <p className="mb-3 text-sm text-muted-foreground">
              Lumio plans study sessions around school, dinner and bedtime.
              {d.cat !== 'school' && ' School times stand for your study hours.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TimeField id="ob-wake" label="Wake up" value={d.wake} onChange={(v) => set({ wake: v })} />
              <TimeField id="ob-schst" label={d.cat === 'school' ? 'School starts' : 'Study starts'} value={d.schoolStart} onChange={(v) => set({ schoolStart: v })} />
              <TimeField id="ob-schen" label={d.cat === 'school' ? 'School ends' : 'Study ends'} value={d.schoolEnd} onChange={(v) => set({ schoolEnd: v })} />
              <TimeField id="ob-dinner" label="Dinner" value={d.dinner} onChange={(v) => set({ dinner: v })} />
              <TimeField id="ob-bed" label="Bedtime" value={d.bedtime} onChange={(v) => set({ bedtime: v })} />
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" aria-hidden="true" />
              Band: <strong>{BANDS[band].name}</strong> — Lumio adapts to it.
            </p>
          </fieldset>
        )}

        {stepDef.id === 'commitments' && (
          <fieldset>
            <legend className="mb-1 font-heading text-lg font-semibold">Other commitments</legend>
            <p className="mb-3 text-sm text-muted-foreground">
              Tuitions, sports, music practice — Lumio keeps study sessions away from these times every day.
            </p>
            <ul className="flex flex-col gap-2">
              {d.commitments.map((c, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl border border-border p-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{minToLabel(c.startMin)}–{minToLabel(c.endMin)}</span>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${c.label}`} onClick={() => set({ commitments: d.commitments.filter((_, j) => j !== i) })}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            <CommitmentAdder onAdd={(c) => set({ commitments: [...d.commitments, c] })} />
          </fieldset>
        )}

        {stepDef.id === 'outside' && (
          <fieldset>
            <legend className="mb-1 font-heading text-lg font-semibold">Study time outside school</legend>
            {grade >= 10 ? (
              <p className="mb-3 rounded-lg bg-gold-soft px-3 py-2 text-sm font-medium" style={{ color: 'var(--gold)' }}>
                Classes 10–12: Lumio sets a 1.5× daily target from this answer.
              </p>
            ) : null}
            <Label htmlFor="ob-outside">Hours you can study outside school (per day)</Label>
            <Input id="ob-outside" type="number" min={0} max={12} step={0.5} value={d.studyOutside} onChange={(e) => set({ studyOutside: e.target.value })} placeholder="e.g. 2" className="mt-1" />
          </fieldset>
        )}

        {stepDef.id === 'exams' && (
          <fieldset>
            <legend className="mb-1 font-heading text-lg font-semibold">Exams ahead</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ob-nexam">Next school exam (optional)</Label>
                <Input id="ob-nexam" value={d.nextExam} onChange={(e) => set({ nextExam: e.target.value })} placeholder="e.g. Half-yearly" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="ob-nexamd">Its date</Label>
                <Input id="ob-nexamd" type="date" min={todayStr()} value={d.nextExamDate} onChange={(e) => set({ nextExamDate: e.target.value })} className="mt-1" />
              </div>
              {grade >= 9 && (
                <>
                  <div>
                    <Label htmlFor="ob-cexam">Competitive-exam goal (optional)</Label>
                    <Select value={d.compExam} onValueChange={(v) => set({ compExam: v })}>
                      <SelectTrigger id="ob-cexam" className="mt-1"><SelectValue placeholder="Pick an exam" /></SelectTrigger>
                      <SelectContent>
                        {EXAMS.map((x) => (
                          <SelectItem key={x} value={x}>{x}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ob-cexamd">Its date</Label>
                    <Input id="ob-cexamd" type="date" min={todayStr()} value={d.compExamDate} onChange={(e) => set({ compExamDate: e.target.value })} className="mt-1" />
                  </div>
                </>
              )}
            </div>
          </fieldset>
        )}

        {stepDef.id === 'goal' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Your goal</legend>
            {d.cat === 'school' && (
              <>
                <div className="mb-3">
                  <Label htmlFor="ob-goal">What do you want to get better at? (optional)</Label>
                  <Input id="ob-goal" value={d.goalText} onChange={(e) => set({ goalText: e.target.value })} placeholder="e.g. Do well in Physics" maxLength={80} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="ob-compsub">Complementary subject (optional)</Label>
                  <Input id="ob-compsub" value={d.compSub} onChange={(e) => set({ compSub: e.target.value })} placeholder="e.g. Geography alongside Physics" maxLength={40} className="mt-1" />
                  <p className="mt-1 text-xs text-muted-foreground">A completed chapter unlocks a 15-minute session in this subject.</p>
                </div>
              </>
            )}
            {d.cat === 'dropper' && (
              <div>
                <Label htmlFor="ob-goal2">This year, you want to…</Label>
                <Input id="ob-goal2" value={d.goalText} onChange={(e) => set({ goalText: e.target.value })} placeholder="e.g. Finish the syllabus by March" maxLength={80} className="mt-1" />
              </div>
            )}
          </fieldset>
        )}

        {stepDef.id === 'dropper-exam' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Target exam</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ob-exam">Exam</Label>
                <Select value={d.exam ?? ''} onValueChange={(v) => set({ exam: v })}>
                  <SelectTrigger id="ob-exam" className="mt-1"><SelectValue placeholder="Pick your exam" /></SelectTrigger>
                  <SelectContent>
                    {EXAMS.map((x) => (
                      <SelectItem key={x} value={x}>{x}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ob-examd">Exam date</Label>
                <Input id="ob-examd" type="date" min={todayStr()} value={d.examDate ?? ''} onChange={(e) => set({ examDate: e.target.value })} className="mt-1" />
              </div>
            </div>
          </fieldset>
        )}

        {stepDef.id === 'dropper-attempts' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Previous attempts</legend>
            <Select value={d.attempts} onValueChange={(v) => set({ attempts: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="How many times have you taken it?" /></SelectTrigger>
              <SelectContent>
                {ATTEMPT_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-3 text-xs text-muted-foreground">Every attempt counts. Lumio plans from where you are, not from zero.</p>
          </fieldset>
        )}

        {stepDef.id === 'dropper-syllabus' && (
          <fieldset>
            <legend className="mb-1 font-heading text-lg font-semibold">Subjects & syllabus</legend>
            <p className="mb-3 text-sm text-muted-foreground">Pick the subjects you are preparing and what you have covered so far.</p>
            <div className="flex flex-wrap gap-2">
              {subjectsForClass('', 'dropper').map((s) => {
                const on = d.subjects.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => set({ subjects: on ? d.subjects.filter((x) => x !== s) : [...d.subjects, s] })}
                    aria-pressed={on}
                    className={cn(
                      'press inline-flex min-h-[44px] items-center gap-1.5 rounded-full border-2 px-3 text-sm font-medium',
                      on ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
                    )}
                  >
                    {on ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
                    {s}
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              <Label htmlFor="ob-syll">Syllabus covered so far (optional)</Label>
              <Input id="ob-syll" value={d.syllabus} onChange={(e) => set({ syllabus: e.target.value })} placeholder="e.g. Kinematics and Thermodynamics done" maxLength={120} className="mt-1" />
            </div>
          </fieldset>
        )}

        {stepDef.id === 'dropper-areas' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Strong & weak areas</legend>
            <div className="grid gap-3">
              <div>
                <Label htmlFor="ob-strong">Strong areas (optional)</Label>
                <Input id="ob-strong" value={d.strong} onChange={(e) => set({ strong: e.target.value })} placeholder="e.g. Mechanics, Organic Chemistry" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="ob-weak">Weak areas (optional)</Label>
                <Input id="ob-weak" value={d.weak} onChange={(e) => set({ weak: e.target.value })} placeholder="e.g. Rotation, Electrostatics" className="mt-1" />
              </div>
            </div>
          </fieldset>
        )}

        {stepDef.id === 'dropper-prep' && (
          <fieldset>
            <legend className="mb-1 font-heading text-lg font-semibold">Previous preparation & mocks</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="ob-prev">Previous preparation (optional)</Label>
                <Input id="ob-prev" value={d.prevPrep} onChange={(e) => set({ prevPrep: e.target.value })} placeholder="e.g. One year coaching, self-study" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="ob-mocks">Mocks taken</Label>
                <Input id="ob-mocks" type="number" min={0} max={50} value={d.mocksTaken} onChange={(e) => set({ mocksTaken: e.target.value })} placeholder="0" className="mt-1" />
              </div>
              <div />
              <div>
                <Label htmlFor="ob-mscore">Latest mock score</Label>
                <Input id="ob-mscore" type="number" min={0} value={d.mockScore} onChange={(e) => set({ mockScore: e.target.value })} className="mt-1" disabled={Number(d.mocksTaken || 0) === 0} />
              </div>
              <div>
                <Label htmlFor="ob-mtotal">Out of</Label>
                <Input id="ob-mtotal" type="number" min={1} value={d.mockTotal} onChange={(e) => set({ mockTotal: e.target.value })} className="mt-1" disabled={Number(d.mocksTaken || 0) === 0} />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">The score cannot be above the total — Lumio checks, kindly.</p>
          </fieldset>
        )}

        {stepDef.id === 'dropper-hours' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Study hours</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ob-avail">Hours available per day</Label>
                <Input id="ob-avail" type="number" min={1} max={16} value={d.availableHours} onChange={(e) => set({ availableHours: e.target.value })} placeholder="e.g. 8" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="ob-best">Best time of day</Label>
                <Select value={d.bestTime} onValueChange={(v) => set({ bestTime: v })}>
                  <SelectTrigger id="ob-best" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMES.map((t) => (
                      <SelectItem key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>
        )}

        {stepDef.id === 'above-type' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">What brings you here?</legend>
            <div className="mb-4">
              <Label htmlFor="ob-ltype">Type of learner</Label>
              <Select value={d.learnerType} onValueChange={(v) => set({ learnerType: v })}>
                <SelectTrigger id="ob-ltype" className="mt-1"><SelectValue placeholder="Pick one" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="College student">College student</SelectItem>
                  <SelectItem value="Working professional">Working professional</SelectItem>
                  <SelectItem value="Self-learner">Self-learner</SelectItem>
                  <SelectItem value="Career switcher">Career switcher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Label htmlFor="ob-interest">Area of interest</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {[...INTEREST_AREAS.slice(0, 12), 'Custom'].map((a) => (
                <button
                  key={a}
                  onClick={() => set({ interest: a })}
                  aria-pressed={d.interest === a}
                  className={cn(
                    'press inline-flex min-h-[44px] items-center rounded-full border-2 px-3 text-sm font-medium',
                    d.interest === a ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/40'
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
            {d.interest === 'Custom' && (
              <div className="mt-3">
                <Label htmlFor="ob-icustom">Your area</Label>
                <Input id="ob-icustom" value={d.interestCustom} onChange={(e) => set({ interestCustom: e.target.value })} maxLength={60} className="mt-1" />
              </div>
            )}
          </fieldset>
        )}

        {stepDef.id === 'above-goal' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Goal & target date</legend>
            <div className="grid gap-3">
              <div>
                <Label htmlFor="ob-level">Your level</Label>
                <Select value={d.level} onValueChange={(v) => set({ level: v })}>
                  <SelectTrigger id="ob-level" className="mt-1"><SelectValue placeholder="Pick one" /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ob-goal3">Your goal</Label>
                <Input id="ob-goal3" value={d.goalText} onChange={(e) => set({ goalText: e.target.value })} placeholder="e.g. Build and ship a small web app" maxLength={80} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="ob-tdate">Target date (optional)</Label>
                <Input id="ob-tdate" type="date" min={todayStr()} value={d.targetDate} onChange={(e) => set({ targetDate: e.target.value })} className="mt-1" />
              </div>
            </div>
          </fieldset>
        )}

        {stepDef.id === 'above-time' && (
          <fieldset>
            <legend className="mb-3 font-heading text-lg font-semibold">Time you can give</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="ob-hpw">Hours per week</Label>
                <Input id="ob-hpw" type="number" min={1} max={100} value={d.hoursPerWeek} onChange={(e) => set({ hoursPerWeek: e.target.value })} placeholder="e.g. 6" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="ob-pt">Preferred time</Label>
                <Select value={d.preferredTime} onValueChange={(v) => set({ preferredTime: v })}>
                  <SelectTrigger id="ob-pt" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMES.map((t) => (
                      <SelectItem key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ob-bed2">Bedtime</Label>
                <Input id="ob-bed2" type="time" value={d.bedtime} onChange={(e) => set({ bedtime: e.target.value })} className="mt-1" />
              </div>
            </div>
          </fieldset>
        )}

        {stepDef.id === 'above-topics' && (
          <fieldset>
            <legend className="mb-1 font-heading text-lg font-semibold">Topics to focus on</legend>
            <p className="mb-3 text-sm text-muted-foreground">Optional — specific topics you want Lumio to prioritise.</p>
            <Label htmlFor="ob-topics">Topics</Label>
            <Input id="ob-topics" value={d.topics} onChange={(e) => set({ topics: e.target.value })} placeholder="e.g. React basics, SQL joins" maxLength={120} className="mt-1" />
          </fieldset>
        )}

        {stepDef.id === 'guardian' && (
          <fieldset>
            <legend className="mb-2 font-heading text-lg font-semibold">Guardian confirmation</legend>
            {grade <= 5 && (
              <p className="mb-3 rounded-lg bg-gold-soft px-3 py-2 text-sm font-medium" style={{ color: 'var(--gold)' }}>
                For Classes Nursery–5 a guardian completes this step with you. Their confirmation is needed to finish.
              </p>
            )}
            {grade > 5 && grade <= 8 && (
              <p className="mb-3 text-sm text-muted-foreground">A guardian confirmation is recommended for Classes 6–8 and is on by default — you can turn it off.</p>
            )}
            {grade > 8 && (
              <p className="mb-3 text-sm text-muted-foreground">Guardian sharing is optional from Class 9 and off by default. Lumio never asks for a parent&apos;s phone number.</p>
            )}
            <div className="flex items-start gap-3 rounded-xl border border-border p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <Label htmlFor="ob-guard">A guardian has seen and approved this setup</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  With consent on, a printable weekly summary can be shared. Consent can be changed any time in Settings.
                </p>
              </div>
              <Switch
                id="ob-guard"
                checked={d.guardianOk}
                onCheckedChange={(v) => set({ guardianOk: v })}
              />
            </div>
          </fieldset>
        )}

        {stepDef.id === 'preview' && preview && (
          <fieldset>
            <legend className="mb-1 font-heading text-lg font-semibold">Your plan is ready</legend>
            <p className="mb-3 text-sm text-muted-foreground">
              Sessions fit around school, dinner{d.commitments.length ? ', your commitments' : ''} and bedtime.
            </p>
            <ol className="flex flex-col gap-2">
              {preview.slots.map((s, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="font-mono text-sm">{minToLabel(s.startMin)}–{minToLabel(s.endMin)}</span>
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                </li>
              ))}
            </ol>
            {preview.dropped > 0 ? (
              <p role="status" className="mt-3 rounded-lg bg-gold-soft px-3 py-2 text-sm font-medium" style={{ color: 'var(--gold)' }}>
                Your day is too full for {preview.dropped} session{preview.dropped === 1 ? '' : 's'}. Lumio says so instead of guessing — you can shorten sessions or free up time.
              </p>
            ) : (
              <p className="mt-3 rounded-lg bg-success-soft px-3 py-2 text-sm font-medium text-success-soft-foreground">
                All {preview.slots.length} planned session{preview.slots.length === 1 ? '' : 's'} fit today.
              </p>
            )}
          </fieldset>
        )}

        {/* ---------- nav ---------- */}
        <div className="mt-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              onClick={() => (d.step === 0 ? undefined : set({ step: d.step - 1 }))}
              disabled={d.step === 0}
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Back
            </Button>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Back to app
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {stepDef.optional && d.step < total - 1 && (
              <Button variant="ghost" onClick={() => set({ step: d.step + 1 })}>
                Skip for now <X className="size-4" aria-hidden="true" />
              </Button>
            )}
            {d.step < total - 1 ? (
              <Button
                onClick={() => {
                  if (stepError) return;
                  set({ step: d.step + 1 });
                }}
                disabled={!!stepError || (stepDef.id === 'guardian' && grade <= 5 && !d.guardianOk)}
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
      <Input id={id} type="time" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1" />
    </div>
  );
}

function CommitmentAdder({ onAdd }: { onAdd: (c: Commitment) => void }) {
  const [label, setLabel] = useState('');
  const [start, setStart] = useState('17:00');
  const [end, setEnd] = useState('18:00');
  const add = () => {
    const s = toMin(start, -1);
    const e = toMin(end, -1);
    if (!label.trim() || s < 0 || e <= s) return;
    onAdd({ label: label.trim(), startMin: s, endMin: e });
    setLabel('');
    setStart('17:00');
    setEnd('18:00');
  };
  return (
    <div className="mt-3 grid items-end gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
      <div>
        <Label htmlFor="ob-clabel">What</Label>
        <Input id="ob-clabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Cricket practice" className="mt-1" />
      </div>
      <div>
        <Label htmlFor="ob-cstart">From</Label>
        <Input id="ob-cstart" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="ob-cend">To</Label>
        <Input id="ob-cend" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1" />
      </div>
      <Button variant="secondary" onClick={add} aria-label="Add commitment">
        <Plus className="size-4" aria-hidden="true" /> Add
      </Button>
    </div>
  );
}

export { draftFromProfile };
