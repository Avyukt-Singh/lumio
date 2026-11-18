'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import {
  AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, Circle, CircleDashed,
  Eye, EyeOff, Flag, ListChecks, NotebookPen, Sparkles, ThumbsDown, ThumbsUp, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { dayKey } from '@/lib/lumio/domain';
import { tFor } from '@/lib/lumio/i18n';
import type { UiLang } from '@/lib/lumio/i18n';
import { aiApi } from '@/lib/lumio/aiClient';
import type { LumioState } from '@/lib/lumio/types';
import { topicOrderIndex, syllabusSubjectById } from '@/lib/lumio/syllabus';
import { countMarks, markSubject, markUnit, overallProgress } from '@/lib/lumio/syllabus/progress';
import type { MarkCounts } from '@/lib/lumio/syllabus/progress';
import { scoreTopics } from '@/lib/lumio/syllabus/planner';
// `SyllabusPlan` (the plan WITH `notes`) lives in planner.ts — the pure
// builder owns it; types.ts only carries `AcceptedPlan` (the stored form).
import type { SyllabusPlan as SyllabusPlanT } from '@/lib/lumio/syllabus/planner';
import {
  MAX_TOPIC_FLAGS, MAX_TOPIC_NOTE, SYLLABUS_FLAGS, deriveMark,
} from '@/lib/lumio/syllabus/types';
import type {
  AcceptedPlan, SyllabusChapter, SyllabusFlag,
  SyllabusProgress, SyllabusSubject, SyllabusTopic, SyllabusTopicPatch,
  TopicMark, TopicProgress,
} from '@/lib/lumio/syllabus/types';

/**
 * Syllabus screen (chunk 6): the learner's own CBSE Class 11 checklist.
 * Honest by design — it never earns XP, topic titles stay in the NCERT/CBSE
 * English wording, and every derived mark comes from the learner's own
 * self-reported state. All display time comes from the injected `now` prop.
 */

type Tr = (key: string) => string;
type StatusFilter = 'all' | 'not_started' | 'in_progress' | 'completed';
type SortMode = 'order' | 'priority';
/** Plan shown in the preview card: the deterministic builder output or an
 *  AI-refined plan straight from `onRefineAi` (an AcceptedPlan). */
type PreviewPlan = AcceptedPlan | SyllabusPlanT;

/** Dataset display names — content (like topic titles) stays English. */
const SUBJECT_ID_LABELS: Record<string, string> = {
  maths: 'Mathematics',
  physics: 'Physics',
  chemistry: 'Chemistry',
  cs: 'Computer Science',
  ai: 'Artificial Intelligence',
};

function subjectName(subjectId: string): string {
  return SUBJECT_ID_LABELS[subjectId] ?? subjectId;
}

/** The five learner-visible marks, their patches and their icons. */
const MARK_OPTIONS: Array<{ key: TopicMark; patch: SyllabusTopicPatch; icon: LucideIcon }> = [
  { key: 'not_started', patch: { progress: 'not_started' }, icon: Circle },
  { key: 'in_progress', patch: { progress: 'in_progress' }, icon: CircleDashed },
  { key: 'completed_unrated', patch: { progress: 'completed', confidence: null }, icon: CheckCircle2 },
  { key: 'completed_confident', patch: { progress: 'completed', confidence: 'confident' }, icon: ThumbsUp },
  { key: 'completed_unsure', patch: { progress: 'completed', confidence: 'unsure' }, icon: ThumbsDown },
];

const MARK_LABEL_KEY: Record<TopicMark, string> = {
  not_started: 'syllabus.mark.not_started',
  in_progress: 'syllabus.mark.in_progress',
  completed_unrated: 'syllabus.mark.completed',
  completed_confident: 'syllabus.mark.completed_confident',
  completed_unsure: 'syllabus.mark.completed_unsure',
};

const PROGRESS_LABEL_KEY: Record<SyllabusProgress, string> = {
  not_started: 'syllabus.mark.not_started',
  in_progress: 'syllabus.mark.in_progress',
  completed: 'syllabus.mark.completed',
};

function activityLabel(itemActivity: string, tr: Tr): string {
  return tr(`syllabus.activity.${itemActivity}`);
}

/**
 * Reasons for one plan item. Deterministic items carry machine-readable
 * reason codes rendered via i18n templates; AI items carry plain text.
 * Never rendered as HTML — React text children only.
 */
function reasonLine(item: { reason?: string; reasonCodes: string[] }, tr: Tr): string {
  if (item.reason) return item.reason;
  return item.reasonCodes.map((c) => tr(`syllabus.reason.${c}`)).join(' · ');
}

/** Snapshot of a record sufficient for a compensating (undo) event. */
function patchOf(rec: TopicProgress): SyllabusTopicPatch {
  return { progress: rec.progress, confidence: rec.confidence, flags: rec.flags, note: rec.note };
}

const EMPTY_PATCH: SyllabusTopicPatch = { progress: 'not_started', confidence: null, flags: [], note: '' };

// ---------- shared sub-pieces ----------

/** Five-state segmented bar; each segment carries a title, and the counts
 *  are repeated as text beneath — never colour alone. */
function SegmentedBar({ counts, label }: { counts: MarkCounts; label: string }) {
  const segments: Array<{ n: number; cls: string; title: string; key: string }> = [
    { n: counts.completedConfident, cls: 'bg-primary', title: 'syllabus.mark.completed_confident', key: 'confident' },
    { n: counts.completedUnrated, cls: 'bg-success', title: 'syllabus.mark.completed', key: 'unrated' },
    { n: counts.completedUnsure, cls: 'bg-gold', title: 'syllabus.mark.completed_unsure', key: 'unsure' },
    { n: counts.inProgress, cls: 'bg-primary/40', title: 'syllabus.mark.in_progress', key: 'progress' },
    { n: counts.notStarted, cls: 'bg-muted', title: 'syllabus.mark.not_started', key: 'notStarted' },
  ];
  const tr = tFor('en') as Tr;
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-3 w-full overflow-hidden rounded-full border border-border"
    >
      {segments.map((s) =>
        s.n > 0 ? (
          <div
            key={s.key}
            className={cn(s.cls, 'h-full')}
            style={{ flexGrow: s.n }}
            title={`${tr(s.title)}: ${s.n}`}
          />
        ) : null
      )}
    </div>
  );
}

/** "12 done · 3 unsure · 5 in progress · 40 not started" — the text row that
 *  makes the bar distinguishable by more than colour. */
function CountsLine({ counts, tr }: { counts: MarkCounts; tr: Tr }) {
  const done = counts.completedUnrated + counts.completedConfident + counts.completedUnsure;
  return (
    <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
      <span className="tabular-nums">{done} {tr('syllabus.mark.completed')}</span>
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">{counts.completedUnsure} {tr('syllabus.mark.completed_unsure')}</span>
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">{counts.inProgress} {tr('syllabus.mark.in_progress')}</span>
      <span aria-hidden="true">·</span>
      <span className="tabular-nums">{counts.notStarted} {tr('syllabus.mark.not_started')}</span>
      {counts.needsAttention > 0 && (
        <span className="flex items-center gap-1 font-medium text-foreground">
          <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
          {tr('syllabus.needsAttention')}: <span className="tabular-nums">{counts.needsAttention}</span>
        </span>
      )}
    </p>
  );
}

function unitMarksLabel(unit: { marks: number | null; marksGroup?: string }, tr: Tr): string {
  if (unit.marks != null) {
    const base = tr('syllabus.marksGroup');
    if (unit.marksGroup) {
      return base.replace('{n}', String(unit.marks)).replace('{group}', unit.marksGroup);
    }
    return base.replace('{n}', String(unit.marks)).replace(/\s*\({group}\)/, '').trim();
  }
  return unit.marksGroup ?? '';
}

// ---------- Today's focus card (also reused by Home) ----------

/**
 * Renders an accepted plan with a checkbox per topic id. Ticking dispatches
 * `{ progress: 'completed' }` and opens a small confidence prompt. Topics
 * ticked in this session stop showing ticks (the parent state layer already
 * stores them as completed-and-rated).
 */
export function TodayFocusCard({
  lang,
  plan,
  onTopicUpdate,
}: {
  lang: UiLang;
  plan: AcceptedPlan;
  onTopicUpdate: (topicId: string, patch: SyllabusTopicPatch) => void;
}): JSX.Element {
  const tr = tFor(lang) as Tr;
  const [rated, setRated] = useState<ReadonlySet<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ n: number; msg: string }>({ n: 0, msg: '' });

  useEffect(() => {
    if (flash.n === 0) return;
    const timer = window.setTimeout(() => setFlash((f) => ({ ...f, msg: '' })), 2500);
    return () => window.clearTimeout(timer);
  }, [flash.n]);

  function bump(msg: string) {
    setFlash((f) => ({ n: f.n + 1, msg }));
  }

  function tick(topicId: string) {
    onTopicUpdate(topicId, { progress: 'completed' });
    setPendingId(topicId);
    bump(tr('syllabus.noteSaved'));
  }

  function rate(topicId: string, confidence: 'confident' | 'unsure') {
    onTopicUpdate(topicId, { progress: 'completed', confidence });
    setRated((prev) => new Set(prev).add(topicId));
    setPendingId(null);
  }

  if (plan.items.length === 0) {
    return (
      <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        {tr('syllabus.planCaughtUp')}
      </p>
    );
  }

  return (
    <div>
      <span className="sr-only" role="status" aria-live="polite">{flash.msg}</span>
      <ol className="flex flex-col gap-3">
        {plan.items.map((item, idx) => {
          const reason = reasonLine(item, tr);
          return (
            <li key={`${item.slotIndex}-${idx}`} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{tr('syllabus.planSession').replace('{i}', String(item.slotIndex + 1))}</Badge>
                <Badge variant="outline">{subjectName(item.subjectId)}</Badge>
                <Badge variant="secondary">{activityLabel(item.activity, tr)}</Badge>
                <span className="ml-auto text-xs font-medium text-muted-foreground">
                  {tr('syllabus.planMinutes').replace('{n}', String(item.minutes))}
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {item.topicIds.map((topicId, tIdx) => {
                  const title = item.topicTitles[tIdx] ?? topicId;
                  const alreadyRated = rated.has(topicId);
                  return (
                    <li key={topicId}>
                      {alreadyRated ? (
                        <p className="flex min-h-[44px] items-center gap-2 text-sm">
                          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                          <span className="font-mono text-xs text-muted-foreground">{topicId}</span>
                          <span>{title}</span>
                          <span className="sr-only">{tr('syllabus.noteSaved')}</span>
                        </p>
                      ) : (
                        <div className="flex min-h-[44px] items-start gap-2 py-1">
                          <Checkbox
                            id={`focus-${topicId}`}
                            checked={false}
                            onCheckedChange={() => tick(topicId)}
                            aria-label={`${tr('syllabus.mark.completed')}: ${title}`}
                            className="mt-0.5"
                          />
                          <Label
                            htmlFor={`focus-${topicId}`}
                            className="flex flex-1 cursor-pointer flex-col gap-0.5 text-sm font-normal leading-snug"
                          >
                            <span>{title}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{topicId}</span>
                          </Label>
                        </div>
                      )}
                      {pendingId === topicId && (
                        <div className="mt-1 rounded-lg bg-muted px-3 py-2">
                          <p className="text-sm font-medium">{tr('syllabus.confidenceAsk')}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="min-h-[44px]"
                              onClick={() => rate(topicId, 'confident')}
                              aria-label={`${tr('syllabus.confidenceYes')}: ${title}`}
                            >
                              <ThumbsUp className="size-4" aria-hidden="true" /> {tr('syllabus.confidenceYes')}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="min-h-[44px]"
                              onClick={() => rate(topicId, 'unsure')}
                              aria-label={`${tr('syllabus.confidenceNo')}: ${title}`}
                            >
                              <ThumbsDown className="size-4" aria-hidden="true" /> {tr('syllabus.confidenceNo')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="min-h-[44px]"
                              onClick={() => setPendingId(null)}
                            >
                              {tr('syllabus.confidenceSkip')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {reason && (
                <p className="mt-2 text-xs text-muted-foreground">{reason}</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------- topic row ----------

function TopicRow({
  topic,
  record,
  tr,
  onTopicUpdate,
  onSaved,
}: {
  topic: SyllabusTopic;
  record: TopicProgress | undefined;
  tr: Tr;
  onTopicUpdate: (topicId: string, patch: SyllabusTopicPatch) => void;
  onSaved: () => void;
}): JSX.Element {
  const mark = deriveMark(record);
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const note = record?.note?.trim() ?? '';

  function selectMark(option: (typeof MARK_OPTIONS)[number]) {
    onTopicUpdate(topic.id, option.patch);
    onSaved();
  }

  function toggleFlag(flag: SyllabusFlag, checked: boolean) {
    const current = record?.flags ?? [];
    if (!checked && current.length >= MAX_TOPIC_FLAGS) return;
    const next = checked ? [...current, flag] : current.filter((f) => f !== flag);
    onTopicUpdate(topic.id, { flags: next });
    onSaved();
  }

  function saveNote() {
    onTopicUpdate(topic.id, { note: draft.slice(0, MAX_TOPIC_NOTE).trim() });
    onSaved();
    setNoteOpen(false);
  }

  function clearNote() {
    setDraft('');
    onTopicUpdate(topic.id, { note: '' });
    onSaved();
    setNoteOpen(false);
  }

  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug">{topic.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {topic.assessment === 'formative_only' && (
            <Badge variant="outline" title={tr('syllabus.badge.formativeHint')}>
              {tr('syllabus.badge.formative')}
            </Badge>
          )}
          {topic.assessment === 'not_in_syllabus_doc' && (
            <Badge variant="outline" title={tr('syllabus.badge.notInDoc')}>
              {tr('syllabus.badge.notInDocShort')}
            </Badge>
          )}
          {topic.advanced && (
            <Badge variant="secondary" title={tr('syllabus.badge.advanced')}>
              {tr('syllabus.badge.advanced')}
            </Badge>
          )}
        </div>
      </div>

      {/* inline flag chips + note preview */}
      {(record?.flags.length ?? 0) > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {record?.flags.map((f) => (
            <Badge key={f} variant="secondary" className="gap-1 text-[11px]">
              <Flag className="size-3" aria-hidden="true" /> {tr(`syllabus.flag.${f}`)}
            </Badge>
          ))}
        </div>
      )}
      {note && (
        <p className="mt-1.5 truncate text-xs text-muted-foreground" title={note}>
          <NotebookPen className="mr-1 inline size-3" aria-hidden="true" />
          {note}
        </p>
      )}

      {/* five-state selector */}
      <div
        role="radiogroup"
        aria-label={topic.title}
        className="mt-2 flex flex-wrap gap-1.5"
      >
        {MARK_OPTIONS.map((option) => {
          const Icon = option.icon;
          const label = tr(MARK_LABEL_KEY[option.key]);
          const active = mark === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${topic.title}: ${label}`}
              onClick={() => selectMark(option)}
              className={cn(
                'flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                active ? 'border-primary bg-primary/10 text-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* flags + note controls */}
      <div className="mt-2 flex flex-wrap gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="min-h-[44px]">
              <Flag className="size-4" aria-hidden="true" /> {tr('syllabus.flagsTitle')}
              {((record?.flags.length ?? 0) > 0) && (
                <span className="tabular-nums">({record?.flags.length})</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <p className="mb-2 text-sm font-semibold">{tr('syllabus.flagsTitle')}</p>
            <div className="flex flex-col gap-1">
              {SYLLABUS_FLAGS.map((flag) => {
                const checked = record?.flags.includes(flag) ?? false;
                return (
                  <div key={flag} className="flex min-h-[44px] items-center gap-2">
                    <Checkbox
                      id={`flag-${topic.id}-${flag}`}
                      checked={checked}
                      onCheckedChange={(v) => toggleFlag(flag, v === true)}
                    />
                    <Label
                      htmlFor={`flag-${topic.id}-${flag}`}
                      className="cursor-pointer text-sm font-normal leading-snug"
                    >
                      {tr(`syllabus.flag.${flag}`)}
                    </Label>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          size="sm"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => {
            setDraft(note);
            setNoteOpen(true);
          }}
          aria-haspopup="dialog"
        >
          <NotebookPen className="size-4" aria-hidden="true" /> {tr('syllabus.noteTitle')}
          {note && <span aria-hidden="true">•</span>}
        </Button>
      </div>

      {/* note dialog */}
      <Dialog open={noteOpen} onOpenChange={(o) => !o && setNoteOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('syllabus.noteTitle')}</DialogTitle>
            <DialogDescription className="line-clamp-2">{topic.title}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={draft}
            maxLength={MAX_TOPIC_NOTE}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_TOPIC_NOTE))}
            placeholder={tr('syllabus.notePlaceholder')}
            aria-label={`${tr('syllabus.noteTitle')} — ${topic.title}`}
            className="min-h-[120px]"
          />
          <p className="text-xs tabular-nums text-muted-foreground">{draft.length}/{MAX_TOPIC_NOTE}</p>
          <DialogFooter className="flex flex-wrap gap-2 sm:flex-row">
            <Button variant="ghost" className="min-h-[44px]" onClick={clearNote}>
              {tr('syllabus.noteClear')}
            </Button>
            <Button className="min-h-[44px]" onClick={saveNote}>
              {tr('syllabus.noteSave')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

// ---------- chapter block ----------

function ChapterBlock({
  chapter,
  topics,
  records,
  tr,
  onTopicUpdate,
  onSaved,
  onBulkMark,
  open,
  onToggle,
}: {
  chapter: SyllabusChapter;
  /** topics after the active filters were applied (syllabus/priority order) */
  topics: SyllabusTopic[];
  records: Record<string, TopicProgress>;
  tr: Tr;
  onTopicUpdate: (topicId: string, patch: SyllabusTopicPatch) => void;
  onSaved: () => void;
  onBulkMark: (topicIds: string[], target: SyllabusProgress) => void;
  open: boolean;
  onToggle: () => void;
}): JSX.Element {
  const hasFormative = chapter.topics.some((t) => t.assessment === 'formative_only');
  const hasNotInDoc = chapter.topics.some((t) => t.assessment === 'not_in_syllabus_doc');
  const bulkIds = chapter.topics.slice(0, 60).map((t) => t.id);

  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`chapter-panel-${chapter.id}`}
        className={cn(
          'flex w-full flex-wrap items-center gap-2 rounded-t-xl px-3 py-2 text-left min-h-[44px]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'hover:bg-muted/60'
        )}
      >
        <span className="font-heading text-sm font-semibold">
          {chapter.ncertNo !== undefined && (
            <span className="mr-1.5 text-muted-foreground">
              Ch {chapter.ncertNo}
              {chapter.ncertPart !== undefined && <span> · Part {chapter.ncertPart}</span>}
            </span>
          )}
          {chapter.title}
        </span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {topics.filter((t) => deriveMark(records[t.id]).startsWith('completed')).length}/{topics.length}
        </span>
      </button>
      <div id={`chapter-panel-${chapter.id}`} hidden={!open}>
        <div className="border-t border-border px-3 py-3">
          {chapter.note && (
            <p className="mb-2 text-xs text-muted-foreground">{chapter.note}</p>
          )}
          {topics.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">{tr('syllabus.noTopics')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {topics.map((topic) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  record={records[topic.id]}
                  tr={tr}
                  onTopicUpdate={onTopicUpdate}
                  onSaved={onSaved}
                />
              ))}
            </ul>
          )}
          {hasFormative && (
            <p className="mt-2 text-xs text-muted-foreground">{tr('syllabus.badge.formativeHint')}</p>
          )}
          {hasNotInDoc && (
            <p className="mt-2 text-xs text-muted-foreground">{tr('syllabus.badge.notInDoc')}</p>
          )}
          <div className="mt-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="min-h-[44px]" disabled={bulkIds.length === 0}>
                  <ListChecks className="size-4" aria-hidden="true" /> {tr('syllabus.markChapter')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {(['not_started', 'in_progress', 'completed'] as const).map((target) => (
                  <DropdownMenuItem key={target} onClick={() => onBulkMark(bulkIds, target)}>
                    {tr(PROGRESS_LABEL_KEY[target])}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- main screen ----------

export function SyllabusScreen({
  state, now, subjects, allSubjects, deterministicPlan, acceptedPlan, dueCardsCount,
  aiAvailable, demo,
  onTopicUpdate, onTopicsBulk, onAcceptPlan, onClearPlan, onSubjectVisibility, onRefineAi, onGoSettings,
}: {
  state: LumioState;
  now: Date;
  subjects: readonly SyllabusSubject[];
  allSubjects: readonly SyllabusSubject[];
  deterministicPlan: SyllabusPlanT;
  acceptedPlan: AcceptedPlan | null;
  dueCardsCount: number;
  aiAvailable: boolean;
  demo: boolean;
  onTopicUpdate: (topicId: string, patch: SyllabusTopicPatch) => void;
  onTopicsBulk: (topicIds: string[], patch: SyllabusTopicPatch) => void;
  onAcceptPlan: (plan: AcceptedPlan) => void;
  onClearPlan: () => void;
  onSubjectVisibility: (subjectId: string, hidden: boolean) => void;
  onRefineAi: (includeNotes: boolean) => Promise<AcceptedPlan | null>;
  onGoSettings: () => void;
}): JSX.Element {
  const lang = state.profile?.lang ?? 'en';
  const tr = tFor(lang) as Tr;
  const tz = state.profile?.tz ?? 'Asia/Kolkata';
  const records = state.syllabus.topics;

  // ---- internal state ----
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [tab, setTab] = useState<'theory' | 'practical'>('theory');
  const [includeFormative, setIncludeFormative] = useState(true);
  const [showHidden, setShowHidden] = useState(false);

  // plan preview / AI refine
  const [planPreview, setPlanPreview] = useState<PreviewPlan | null>(null);
  const [refining, setRefining] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [aiFailed, setAiFailed] = useState(false);
  const [reported, setReported] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // theory filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [flagFilter, setFlagFilter] = useState<'all' | SyllabusFlag>('all');
  const [hasNoteOnly, setHasNoteOnly] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [formativeOnly, setFormativeOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('order');

  // chapter disclosures
  const [openChapters, setOpenChapters] = useState<ReadonlySet<string>>(new Set());

  // bulk downgrade confirm
  const [pendingBulk, setPendingBulk] = useState<{ ids: string[]; target: SyllabusProgress } | null>(null);

  // undo snapshots: the PREVIOUS record for every affected topic id
  const undoRef = useRef<Map<string, TopicProgress>>(new Map());

  // "Saved" aria-live flash
  const [flash, setFlash] = useState<{ n: number; msg: string }>({ n: 0, msg: '' });
  useEffect(() => {
    if (flash.n === 0) return;
    const timer = window.setTimeout(() => setFlash((f) => ({ ...f, msg: '' })), 2500);
    return () => window.clearTimeout(timer);
  }, [flash.n]);

  function bumpSaved() {
    setFlash((f) => ({ n: f.n + 1, msg: tr('syllabus.noteSaved') }));
  }

  // ---- derived ----
  const selectedSubject = selectedSubjectId
    ? syllabusSubjectById([...allSubjects], selectedSubjectId)
    : null;

  const overall = useMemo(
    () => overallProgress(subjects, records, includeFormative),
    [subjects, records, includeFormative]
  );

  const todayKey = dayKey(now, tz);
  const examDate = useMemo(() => {
    const p = state.profile;
    const candidates = [p?.nextExamDate, p?.examDate, p?.compExamDate, p?.targetDate].filter(
      (d): d is string => !!d
    );
    return candidates.sort()[0] ?? undefined;
  }, [state.profile]);

  /** planner-priority rank per topic id for the selected subject */
  const priorityScores = useMemo(() => {
    if (!selectedSubject || sortMode !== 'priority') return null;
    const scored = scoreTopics(
      selectedSubject,
      records,
      topicOrderIndex([selectedSubject]),
      examDate,
      todayKey
    );
    return new Map(scored.map((s) => [s.topicId, s.score] as const));
  }, [selectedSubject, sortMode, records, examDate, todayKey]);

  const filtersActive =
    search.trim() !== '' ||
    statusFilter !== 'all' ||
    flagFilter !== 'all' ||
    hasNoteOnly ||
    attentionOnly ||
    formativeOnly;

  function topicMatches(topic: SyllabusTopic): boolean {
    const rec = records[topic.id];
    const mark = deriveMark(rec);
    const q = search.trim().toLowerCase();
    if (q && !topic.title.toLowerCase().includes(q)) return false;
    if (statusFilter === 'not_started' && mark !== 'not_started') return false;
    if (statusFilter === 'in_progress' && mark !== 'in_progress') return false;
    if (statusFilter === 'completed' && !mark.startsWith('completed')) return false;
    if (flagFilter !== 'all' && !(rec?.flags ?? []).includes(flagFilter)) return false;
    if (hasNoteOnly && !(rec?.note ?? '').trim()) return false;
    if (attentionOnly && !(mark === 'completed_unsure' || (rec?.flags.length ?? 0) > 0)) return false;
    if (formativeOnly && topic.assessment !== 'formative_only') return false;
    return true;
  }

  function filteredTopics(topics: readonly SyllabusTopic[]): SyllabusTopic[] {
    const matched = topics.filter(topicMatches);
    if (sortMode === 'priority' && priorityScores) {
      return [...matched].sort((a, b) => {
        const sa = priorityScores.get(a.id) ?? Number.NEGATIVE_INFINITY;
        const sb = priorityScores.get(b.id) ?? Number.NEGATIVE_INFINITY;
        return sb - sa || a.id.localeCompare(b.id);
      });
    }
    return matched;
  }

  // ---- undo / bulk ----
  function dispatchUndoRestore(snapshot: Map<string, TopicProgress>) {
    for (const [id, prev] of snapshot) {
      onTopicUpdate(id, prev ? patchOf(prev) : EMPTY_PATCH);
    }
    toast({ description: tr('syllabus.undone') });
  }

  function dispatchBulk(ids: string[], target: SyllabusProgress) {
    const snapshot = new Map<string, TopicProgress>();
    for (const id of ids) {
      const prev = records[id];
      if (prev) snapshot.set(id, prev);
    }
    undoRef.current = snapshot;
    const patch: SyllabusTopicPatch =
      target === 'completed' ? { progress: 'completed', confidence: null } : { progress: target };
    onTopicsBulk(ids, patch);
    bumpSaved();
    const snapshotRef = snapshot;
    toast({
      description: tr('syllabus.bulkDone'),
      duration: 8000,
      action: (
        <ToastAction altText={tr('syllabus.undo')} onClick={() => dispatchUndoRestore(snapshotRef)}>
          {tr('syllabus.undo')}
        </ToastAction>
      ),
    });
  }

  function requestBulkMark(ids: string[], target: SyllabusProgress) {
    if (ids.length === 0) return;
    if (target !== 'completed') {
      const anyCompleted = ids.some((id) => deriveMark(records[id]).startsWith('completed'));
      if (anyCompleted) {
        setPendingBulk({ ids, target });
        return;
      }
    }
    dispatchBulk(ids, target);
  }

  // ---- plan ----
  const preview: PreviewPlan = planPreview ?? deterministicPlan;
  const previewNotes: readonly string[] = 'notes' in preview ? preview.notes : [];
  const canRefine =
    aiAvailable && !acceptedPlan && deterministicPlan.items.length > 0;

  const planNotes = useMemo(() => {
    const out: string[] = [];
    for (const note of previewNotes) {
      if (note.startsWith('DUE_CARDS:')) {
        out.push(tr('syllabus.planDueCards').replace('{n}', note.slice('DUE_CARDS:'.length)));
      } else if (note === 'NO_SLOTS') {
        out.push(tr('syllabus.planNoSlots'));
      } else if (note === 'NO_SUBJECTS') {
        out.push(tr('syllabus.planNoSubjects'));
      } else if (note === 'ALL_CAUGHT_UP') {
        out.push(tr('syllabus.planCaughtUp'));
      }
    }
    if (!previewNotes.some((n) => n.startsWith('DUE_CARDS:')) && dueCardsCount > 0) {
      out.push(tr('syllabus.planDueCards').replace('{n}', String(dueCardsCount)));
    }
    return out;
  }, [previewNotes, dueCardsCount, lang]);

  const shownIsAi = (acceptedPlan ?? preview).source === 'ai';

  async function handleRefine() {
    setRefining(true);
    setAiFailed(false);
    try {
      const res = await onRefineAi(includeNotes);
      if (res) {
        setPlanPreview(res);
        setReported(false);
      } else {
        setAiFailed(true);
      }
    } finally {
      setRefining(false);
    }
  }

  function handleAccept() {
    onAcceptPlan({
      date: preview.date,
      source: preview.source,
      items: preview.items,
      summary: 'summary' in preview ? preview.summary : undefined,
    });
    setStatusMsg(tr('syllabus.planAccepted'));
    setPlanPreview(null);
  }

  function handleReport() {
    void aiApi
      .report({ feature: 'syllabus-day-coach', output: JSON.stringify(acceptedPlan ?? preview) })
      .then(() => setReported(true));
  }

  function toggleChapter(id: string) {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---- plan item renderer (preview mode — no ticks) ----
  function renderPlanItems(plan: PreviewPlan) {
    if (plan.items.length === 0) {
      return (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {tr('syllabus.planCaughtUp')}
        </p>
      );
    }
    return (
      <ol className="flex flex-col gap-3">
        {plan.items.map((item, idx) => {
          const reason = reasonLine(item, tr);
          return (
            <li key={`${item.slotIndex}-${idx}`} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{tr('syllabus.planSession').replace('{i}', String(item.slotIndex + 1))}</Badge>
                <Badge variant="outline">{subjectName(item.subjectId)}</Badge>
                <Badge variant="secondary">{activityLabel(item.activity, tr)}</Badge>
                <span className="ml-auto text-xs font-medium text-muted-foreground">
                  {tr('syllabus.planMinutes').replace('{n}', String(item.minutes))}
                </span>
              </div>
              <p className="mt-2 text-sm leading-snug">{item.topicTitles.join(' · ')}</p>
              {reason && <p className="mt-1.5 text-xs text-muted-foreground">{reason}</p>}
            </li>
          );
        })}
      </ol>
    );
  }

  function renderAiChrome(plan: AcceptedPlan | SyllabusPlanT) {
    return (
      <div className="mt-3 rounded-xl bg-muted/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="gap-1 bg-primary text-primary-foreground">
            <Sparkles className="size-3" aria-hidden="true" /> {tr('syllabus.planAiBadge')}
          </Badge>
          <p className="text-xs text-muted-foreground">{tr('syllabus.planAiMistakes')}</p>
          <span className="ml-auto">
            <Button size="sm" variant="ghost" className="min-h-[44px]" onClick={handleReport}>
              <Flag className="size-4" aria-hidden="true" /> {tr('syllabus.planReport')}
            </Button>
          </span>
        </div>
        {reported && (
          <p role="status" aria-live="polite" className="mt-1 text-xs font-medium text-success">
            {tr('syllabus.planReported')}
          </p>
        )}
        {'summary' in plan && plan.summary && (
          <p className="mt-1 text-xs text-muted-foreground">{plan.summary}</p>
        )}
      </div>
    );
  }

  // ================= overview =================
  if (!selectedSubject) {
    const hiddenSubjects = allSubjects.filter((s) => !subjects.some((v) => v.id === s.id));
    const overallDone = overall.counts.completedUnrated + overall.counts.completedConfident + overall.counts.completedUnsure;
    return (
      <div className="flex flex-col gap-4">
        {/* screen header */}
        <section aria-labelledby="syllabus-header" data-tour="syllabus-root" className="rounded-2xl border border-border bg-card p-5">
          <h1 id="syllabus-header" className="flex items-center gap-2 font-heading text-2xl font-bold">
            <BookOpen className="size-6 text-primary" aria-hidden="true" /> {tr('syllabus.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{tr('syllabus.lead')}</p>
        </section>

        {/* 1. today's plan — pinned first */}
        <section aria-labelledby="syllabus-plan" data-tour="syllabus-plan" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="syllabus-plan" className="font-heading text-lg font-semibold">
            {acceptedPlan ? tr('syllabus.planFocus') : tr('syllabus.planTitle')}
          </h2>
          <div aria-live="polite" className="sr-only">{statusMsg}</div>
          {statusMsg && (
            <p role="status" className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              {statusMsg}
            </p>
          )}

          {acceptedPlan ? (
            <>
              <div className="mt-3">
                <TodayFocusCard lang={lang} plan={acceptedPlan} onTopicUpdate={onTopicUpdate} />
              </div>
              {shownIsAi && renderAiChrome(acceptedPlan)}
              <div className="mt-3">
                <Button
                  variant="secondary"
                  className="min-h-[44px]"
                  onClick={() => {
                    onClearPlan();
                    setStatusMsg('');
                  }}
                >
                  <X className="size-4" aria-hidden="true" /> {tr('syllabus.planClear')}
                </Button>
              </div>
            </>
          ) : (
            <>
              {planNotes.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {planNotes.map((note, i) => (
                    <p
                      key={i}
                      className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground"
                    >
                      {note}
                    </p>
                  ))}
                  {previewNotes.includes('NO_SUBJECTS') && (
                    <div>
                      <Button variant="secondary" className="min-h-[44px]" onClick={onGoSettings}>
                        {tr('nav.settings')}
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3">{renderPlanItems(preview)}</div>
              {preview.source === 'ai' && renderAiChrome(preview)}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button className="min-h-[44px]" onClick={handleAccept}>
                  <CheckCircle2 className="size-4" aria-hidden="true" /> {tr('syllabus.planAccept')}
                </Button>
                {preview.source === 'ai' && (
                  <Button
                    variant="ghost"
                    className="min-h-[44px]"
                    onClick={() => {
                      setPlanPreview(null);
                      setAiFailed(false);
                      setReported(false);
                    }}
                  >
                    {tr('common.reset')}
                  </Button>
                )}
                {aiFailed && (
                  <p role="status" className="text-sm text-muted-foreground">
                    {tr('syllabus.planFallback')}
                  </p>
                )}
              </div>
              {canRefine && (
                <div className="mt-4 border-t border-border pt-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="secondary"
                      className="min-h-[44px]"
                      onClick={() => void handleRefine()}
                      disabled={refining}
                    >
                      <Sparkles className="size-4" aria-hidden="true" />
                      {refining ? tr('syllabus.planRefining') : tr('syllabus.planRefine')}
                    </Button>
                    <div className="flex min-h-[44px] items-center gap-2">
                      <Checkbox
                        id="syllabus-include-notes"
                        checked={includeNotes}
                        onCheckedChange={(v) => setIncludeNotes(v === true)}
                      />
                      <Label htmlFor="syllabus-include-notes" className="cursor-pointer text-sm font-normal">
                        {tr('syllabus.planIncludeNotes')}
                      </Label>
                    </div>
                    {demo && (
                      <span className="text-xs text-muted-foreground">{tr('syllabus.demoHint')}</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* 2. overall progress */}
        <section aria-labelledby="syllabus-progress" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="syllabus-progress" className="font-heading text-lg font-semibold">
            {tr('syllabus.completedOf')
              .replace('{done}', String(overallDone))
              .replace('{total}', String(overall.counts.total))}
          </h2>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground" aria-hidden="true">
            {overallDone}/{overall.counts.total}
          </p>
          <div className="mt-2">
            <SegmentedBar
              counts={overall.counts}
              label={tr('syllabus.completedOf')
                .replace('{done}', String(overallDone))
                .replace('{total}', String(overall.counts.total))}
            />
          </div>
          <div className="mt-2">
            <CountsLine counts={overall.counts} tr={tr} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{tr('syllabus.honest')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{tr('syllabus.englishNote')}</p>
        </section>

        {/* 3 + 4. subject cards and controls */}
        <section aria-labelledby="syllabus-subjects" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="syllabus-subjects" className="font-heading text-lg font-semibold">
            {tr('syllabus.subjectsTitle')}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((subject) => {
              const marked = markSubject(subject, records, includeFormative, false);
              const counts = countMarks(marked);
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => setSelectedSubjectId(subject.id)}
                  aria-label={`${subject.name} · ${subject.code} — ${tr('syllabus.completedOf')
                    .replace('{done}', String(counts.completedUnrated + counts.completedConfident + counts.completedUnsure))
                    .replace('{total}', String(counts.total))}`}
                  className={cn(
                    'rounded-2xl border border-border bg-background p-4 text-left min-h-[44px]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'hover:bg-muted/60'
                  )}
                >
                  <p className="font-heading text-base font-semibold">{subject.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {subject.code} · {tr('syllabus.theoryMarks').replace('{n}', String(subject.theoryMarks))}
                  </p>
                  <div className="mt-2">
                    <SegmentedBar
                      counts={counts}
                      label={`${subject.name}: ${tr('syllabus.completedOf')
                        .replace('{done}', String(counts.completedUnrated + counts.completedConfident + counts.completedUnsure))
                        .replace('{total}', String(counts.total))}`}
                    />
                  </div>
                  <div className="mt-1.5">
                    <CountsLine counts={counts} tr={tr} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* controls row */}
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3">
            <div className="flex min-h-[44px] items-center gap-2">
              <Checkbox
                id="syllabus-hide-subjects"
                checked={showHidden}
                onCheckedChange={(v) => setShowHidden(v === true)}
              />
              <Label htmlFor="syllabus-hide-subjects" className="cursor-pointer text-sm font-normal">
                {tr('syllabus.hideSubjects')}
              </Label>
            </div>
            {showHidden && (
              <div className="flex flex-wrap gap-1.5">
                {subjects.map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => onSubjectVisibility(subject.id, true)}
                    aria-label={`${subject.name} — ${tr('syllabus.hideSubjects')}`}
                    className={cn(
                      'flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                    )}
                  >
                    {subject.name}
                    <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  </button>
                ))}
                {hiddenSubjects.map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => onSubjectVisibility(subject.id, false)}
                    aria-label={`${subject.name} — ${tr('syllabus.showAllSubjects')}`}
                    className={cn(
                      'flex min-h-[44px] items-center gap-1.5 rounded-full border border-dashed border-border bg-muted/60 px-3 text-xs font-medium text-muted-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                    )}
                  >
                    <Eye className="size-3.5" aria-hidden="true" />
                    {subject.name}
                    <EyeOff className="size-3.5" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex min-h-[44px] items-center gap-2">
              <Checkbox
                id="syllabus-include-formative"
                checked={includeFormative}
                onCheckedChange={(v) => setIncludeFormative(v === true)}
              />
              <Label htmlFor="syllabus-include-formative" className="cursor-pointer text-sm font-normal">
                {tr('syllabus.includeFormative')}
              </Label>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ================= subject view =================
  const subject = selectedSubject;
  const unitViews = subject.units
    .map((unit) => {
      const chapters = unit.chapters
        .map((chapter) => ({ chapter, topics: filteredTopics(chapter.topics) }))
        .filter((c) => c.topics.length > 0 || !filtersActive);
      return { unit, chapters };
    })
    .filter((u) => u.chapters.length > 0);
  const theoryEmpty = unitViews.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only" role="status" aria-live="polite">{flash.msg}</span>

      {/* header */}
      <section aria-labelledby="syllabus-subject-header" className="rounded-2xl border border-border bg-card p-5">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px]"
          onClick={() => setSelectedSubjectId(null)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> {tr('syllabus.backToOverview')}
        </Button>
        <h1 id="syllabus-subject-header" className="mt-2 font-heading text-2xl font-bold">
          {subject.name} <span className="text-base font-normal text-muted-foreground">· {subject.code}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr('syllabus.theoryMarks').replace('{n}', String(subject.theoryMarks))}
        </p>
        <p className="mt-2 text-sm">
          <span className="font-medium">{tr('syllabus.source')}:</span>{' '}
          <span>{subject.source.label}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subject.source.note}</p>

        {/* badge legend */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline" title={tr('syllabus.badge.formativeHint')}>
            {tr('syllabus.badge.formative')}
          </Badge>
          <Badge variant="outline" title={tr('syllabus.badge.notInDoc')}>
            {tr('syllabus.badge.notInDocShort')}
          </Badge>
          <Badge variant="secondary" title={tr('syllabus.badge.advanced')}>
            {tr('syllabus.badge.advanced')}
          </Badge>
        </div>
      </section>

      {/* tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v === 'practical' ? 'practical' : 'theory')}>
        <TabsList aria-label={tr('syllabus.title')}>
          <TabsTrigger value="theory" className="min-h-[44px]">{tr('syllabus.tabTheory')}</TabsTrigger>
          <TabsTrigger value="practical" className="min-h-[44px]">{tr('syllabus.tabPractical')}</TabsTrigger>
        </TabsList>

        {/* theory */}
        <TabsContent value="theory" className="mt-4">
          <section aria-label={tr('syllabus.tabTheory')} className="rounded-2xl border border-border bg-card p-5">
            {/* filters row */}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('syllabus.search')}
                aria-label={tr('syllabus.search')}
                className="min-h-[44px] w-full sm:w-56"
              />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="min-h-[44px] w-[170px]" aria-label={tr('syllabus.filterStatus')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr('syllabus.status.all')}</SelectItem>
                  <SelectItem value="not_started">{tr('syllabus.mark.not_started')}</SelectItem>
                  <SelectItem value="in_progress">{tr('syllabus.mark.in_progress')}</SelectItem>
                  <SelectItem value="completed">{tr('syllabus.mark.completed')}</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={flagFilter}
                onValueChange={(v) => setFlagFilter(v === 'all' ? 'all' : (v as SyllabusFlag))}
              >
                <SelectTrigger className="min-h-[44px] w-[190px]" aria-label={tr('syllabus.filterFlag')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr('syllabus.flag.all')}</SelectItem>
                  {SYLLABUS_FLAGS.map((flag) => (
                    <SelectItem key={flag} value={flag}>
                      {tr(`syllabus.flag.${flag}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortMode} onValueChange={(v) => setSortMode(v === 'priority' ? 'priority' : 'order')}>
                <SelectTrigger className="min-h-[44px] w-[170px]" aria-label={tr('syllabus.sortPriority')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">{tr('syllabus.sortOrder')}</SelectItem>
                  <SelectItem value="priority">{tr('syllabus.sortPriority')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex min-h-[44px] items-center gap-2">
                <Checkbox
                  id="syllabus-f-note"
                  checked={hasNoteOnly}
                  onCheckedChange={(v) => setHasNoteOnly(v === true)}
                />
                <Label htmlFor="syllabus-f-note" className="cursor-pointer text-sm font-normal">
                  {tr('syllabus.filterNote')}
                </Label>
              </div>
              <div className="flex min-h-[44px] items-center gap-2">
                <Checkbox
                  id="syllabus-f-attention"
                  checked={attentionOnly}
                  onCheckedChange={(v) => setAttentionOnly(v === true)}
                />
                <Label htmlFor="syllabus-f-attention" className="cursor-pointer text-sm font-normal">
                  {tr('syllabus.filterAttention')}
                </Label>
              </div>
              <div className="flex min-h-[44px] items-center gap-2">
                <Checkbox
                  id="syllabus-f-formative"
                  checked={formativeOnly}
                  onCheckedChange={(v) => setFormativeOnly(v === true)}
                />
                <Label htmlFor="syllabus-f-formative" className="cursor-pointer text-sm font-normal">
                  {tr('syllabus.filterFormative')}
                </Label>
              </div>
            </div>

            {/* units */}
            <div className="mt-4">
              {theoryEmpty ? (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {tr('syllabus.noTopics')}
                </p>
              ) : (
                <Accordion type="multiple" className="flex flex-col gap-3">
                  {unitViews.map(({ unit, chapters }) => {
                    const unitMarked = markUnit(subject, unit.id, records, includeFormative);
                    const unitCounts = countMarks(unitMarked);
                    const unitDone =
                      unitCounts.completedUnrated + unitCounts.completedConfident + unitCounts.completedUnsure;
                    return (
                      <AccordionItem key={unit.id} value={unit.id} className="border-none">
                        <AccordionTrigger className="rounded-xl border border-border px-3 py-3 hover:no-underline">
                          <span className="flex flex-1 flex-wrap items-center gap-2 text-left">
                            <span className="font-heading text-base font-semibold">{unit.title}</span>
                            {(() => {
                              const marksLabel = unitMarksLabel(unit, tr);
                              return marksLabel ? (
                                <Badge variant="outline">{marksLabel}</Badge>
                              ) : null;
                            })()}
                            {unit.periods !== undefined && (
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {tr('syllabus.periods').replace('{n}', String(unit.periods))}
                              </span>
                            )}
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {unitDone}/{unitCounts.total} {tr('syllabus.mark.completed')}
                            </span>
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-3">
                          <div className="flex flex-col gap-3">
                            {chapters.map(({ chapter, topics }) => (
                              <ChapterBlock
                                key={chapter.id}
                                chapter={chapter}
                                topics={topics}
                                records={records}
                                tr={tr}
                                onTopicUpdate={onTopicUpdate}
                                onSaved={bumpSaved}
                                onBulkMark={requestBulkMark}
                                open={openChapters.has(chapter.id)}
                                onToggle={() => toggleChapter(chapter.id)}
                              />
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </section>
        </TabsContent>

        {/* practical */}
        <TabsContent value="practical" className="mt-4">
          <section aria-label={tr('syllabus.tabPractical')} className="rounded-2xl border border-border bg-card p-5">
            {subject.practical ? (
              <>
                <h2 className="font-heading text-lg font-semibold">{tr('syllabus.practicalScheme')}</h2>
                <table className="mt-2 w-full max-w-sm text-sm">
                  <tbody>
                    {subject.practical.scheme.map((row) => (
                      <tr key={row.label} className="border-b border-border">
                        <th scope="row" className="py-1.5 pr-3 text-left font-medium">{row.label}</th>
                        <td className="py-1.5 text-right tabular-nums text-muted-foreground">{row.marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="mt-4 flex flex-col gap-2">
                  {subject.practical.items.map((item) => (
                    <TopicRow
                      key={item.id}
                      topic={item}
                      record={records[item.id]}
                      tr={tr}
                      onTopicUpdate={onTopicUpdate}
                      onSaved={bumpSaved}
                    />
                  ))}
                </ul>
              </>
            ) : (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                {subject.practicalNote ?? tr('syllabus.practicalEmpty')}
              </p>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {/* bulk downgrade confirmation */}
      <AlertDialog open={!!pendingBulk} onOpenChange={(o) => !o && setPendingBulk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('syllabus.confirmDowngradeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr('syllabus.confirmDowngradeBody').replace(
                '{state}',
                pendingBulk ? tr(PROGRESS_LABEL_KEY[pendingBulk.target]) : ''
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-wrap gap-2 sm:flex-row">
            <AlertDialogCancel className="min-h-[44px]">{tr('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[44px]"
              onClick={() => {
                if (pendingBulk) dispatchBulk(pendingBulk.ids, pendingBulk.target);
                setPendingBulk(null);
              }}
            >
              {pendingBulk ? tr(PROGRESS_LABEL_KEY[pendingBulk.target]) : tr('common.next')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
