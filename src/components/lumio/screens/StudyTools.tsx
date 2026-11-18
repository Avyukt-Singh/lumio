'use client';

import { useRef, useState } from 'react';
import { Camera, FileText, NotebookPen, Printer, Sparkles, Trash2, Upload, Youtube } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  dayKey, isNoteExtension, MAX_NOTES, MAX_VIDEOS, NOTE_MAX_BYTES,
  sanitizeFileName, sanitizeNoteText, youtubeEmbedUrl, youtubeIdFromUrl,
} from '@/lib/lumio/domain';
import { BANDS, type Band } from '@/lib/lumio/content';
import { tFor, t } from '@/lib/lumio/i18n';
import { aiApi, type NotesAiResult, type WorksheetAiResult, type AiApiCode } from '@/lib/lumio/aiClient';
import type { LumioState, LearnerNote } from '@/lib/lumio/types';
import { AiLabel, AiMarkdown, AiBadge, aiErrKey } from '../ai/AiMarkdown';

/**
 * Study tools (chunk 4B, master prompt 7.14): printable worksheet generator,
 * plain-text note upload and validated YouTube study videos.
 * All strings come from the i18n dictionary; limits are honest and enforced.
 */

type CountChoice = 'all' | 2 | 1;

const COUNT_CHOICES: Array<{ value: CountChoice; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 2, label: '2' },
  { value: 1, label: '1' },
];

export function StudyTools({
  state, now, onAddNote, onRemoveNote, onAddVideo, onRemoveVideo,
  aiAvailable, demo, onSaveAi, onSaveWorksheet,
}: {
  state: LumioState;
  now: Date;
  onAddNote: (note: { id: string; name: string; text: string; added: string }) => void;
  onRemoveNote: (noteId: string) => void;
  onAddVideo: (video: { id: string; videoId: string; sourceUrl: string; added: string }) => void;
  onRemoveVideo: (videoId: string) => void;
  /** chunk 5B: Notes AI availability + save (practice-only, never XP) */
  aiAvailable?: boolean;
  demo?: boolean;
  onSaveAi?: (args: {
    id: string;
    kind: 'notes';
    date: string;
    payload: NotesAiResult;
    label: string;
  }) => void;
  /** chunk 5-AI feature 3: AI worksheet save path (ai-content-saved event) */
  onSaveWorksheet?: (args: {
    id: string;
    date: string;
    payload: WorksheetAiResult;
    label: string;
  }) => void;
}) {
  const tr = tFor(state.profile?.lang);
  const tz = state.profile?.tz ?? 'Asia/Kolkata';
  const band: Band = state.profile?.band ?? 'sec';
  const bandDef = BANDS[band];
  const chapters = bandDef.chapters;

  // worksheet state
  const [chapterIdx, setChapterIdx] = useState(0);
  const [count, setCount] = useState<CountChoice>('all');
  const chapter = chapters[chapterIdx] ?? chapters[0];
  const questions =
    chapter && count !== 'all' ? chapter.questions.slice(0, count) : chapter?.questions ?? [];

  // ---- chunk 5-AI feature 3: AI worksheet state ----
  const [wsMode, setWsMode] = useState<'sample' | 'ai'>('sample');
  const [wsDifficulty, setWsDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [aiWs, setAiWs] = useState<WorksheetAiResult | null>(null);
  const [aiWsHash, setAiWsHash] = useState('');
  const [aiWsPhase, setAiWsPhase] = useState<'idle' | 'loading' | 'error'>('idle');
  const [aiWsErr, setAiWsErr] = useState<AiApiCode | null>(null);
  const [aiWsSaved, setAiWsSaved] = useState(false);
  // AI tools are open to everyone — the only limit is the fair-use budget.
  const aiGateOk = aiAvailable === true;

  const generateAiWs = async () => {
    if (!chapter) return;
    setAiWsPhase('loading');
    setAiWsErr(null);
    const res = await aiApi.worksheet({
      chapterTitle: chapter.title,
      subject: chapter.subject,
      summary: chapter.summary,
      keyPoints: chapter.questions.slice(0, 6).map((q) => q.explanation),
      difficulty: wsDifficulty,
      band,
      lang: state.profile?.lang ?? 'en',
    });
    if (res.ok && res.data.data) {
      setAiWs(res.data.data);
      setAiWsHash(res.data.outputHash ?? '');
      setAiWsSaved(false);
      setAiWsPhase('idle');
    } else {
      setAiWsErr(res.ok ? 'INVALID_RESPONSE' : res.code);
      setAiWsPhase('error');
    }
  };

  const aiWsTotalMarks = aiWs ? aiWs.items.reduce((n, it) => n + it.marks, 0) : 0;

  // note state
  const fileRef = useRef<HTMLInputElement>(null);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  // ---- chunk 5-AI feature 6: photo/scan of notes (VLM) with explicit
  // "check the extracted text" step before anything is saved ----
  const scanRef = useRef<HTMLInputElement>(null);
  const [scanPhase, setScanPhase] = useState<'idle' | 'loading' | 'check' | 'error'>('idle');
  const [scanText, setScanText] = useState('');
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  /** Downscale a picked image to <=1280px JPEG so the data URL stays small. */
  const downscaleImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image'));
      };
      img.src = url;
    });

  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setScanMsg(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setScanMsg(tr('tools.scanBadType'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setScanMsg(tr('tools.scanTooBig'));
      return;
    }
    setScanPhase('loading');
    try {
      const dataUrl = await downscaleImage(file);
      const res = await aiApi.ocr({ image: dataUrl, band, lang: state.profile?.lang ?? 'en' });
      if (res.ok && res.data.data) {
        setScanText(res.data.data.text);
        setScanPhase('check');
      } else {
        setScanPhase('error');
        setScanMsg(res.ok ? tr('tools.scanNoText') : tr(aiErrKey(res.code)));
      }
    } catch {
      setScanPhase('error');
      setScanMsg(tr('ai.err.UNAVAILABLE'));
    }
  }

  // video state
  const [videoUrl, setVideoUrl] = useState('');
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [videoBad, setVideoBad] = useState(false);

  function handleNoteFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    setNoteStatus(null);
    if (!file) return;
    if (!isNoteExtension(file.name)) {
      setNoteStatus(tr('tools.noteBadType'));
      return;
    }
    if (file.size > NOTE_MAX_BYTES) {
      setNoteStatus(tr('tools.noteTooBig'));
      return;
    }
    if (state.notes.length >= MAX_NOTES) {
      setNoteStatus('You have 50 notes stored — remove one first.');
      return;
    }
    void file.text().then((raw) => {
      onAddNote({
        id: crypto.randomUUID(),
        name: sanitizeFileName(file.name),
        text: sanitizeNoteText(raw),
        added: dayKey(now, tz),
      });
      setNoteStatus(tr('tools.noteSaved'));
    });
  }

  function handleAddVideo() {
    setVideoStatus(null);
    setVideoBad(false);
    const id = youtubeIdFromUrl(videoUrl);
    if (!id) {
      setVideoStatus(tr('tools.videoBad'));
      setVideoBad(true);
      return;
    }
    if (state.videos.some((v) => v.videoId === id)) {
      setVideoStatus('Already saved.');
      return;
    }
    if (state.videos.length >= MAX_VIDEOS) {
      setVideoStatus('You have 20 videos stored — remove one first.');
      return;
    }
    onAddVideo({
      id: crypto.randomUUID(),
      videoId: id,
      sourceUrl: videoUrl.trim(),
      added: dayKey(now, tz),
    });
    setVideoUrl('');
    setVideoStatus(tr('tools.videoAdded'));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <section aria-labelledby="tools-header" data-tour="tools-root" className="rounded-2xl border border-border bg-card p-5">
        <h1 id="tools-header" className="flex items-center gap-2 font-heading text-2xl font-bold">
          <NotebookPen className="size-6 text-primary" aria-hidden="true" /> {tr('tools.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{tr('tools.subtitle')}</p>
      </section>

      {/* Worksheet generator */}
      <section aria-labelledby="tools-worksheet" data-tour="tools-worksheet" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="tools-worksheet" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <FileText className="size-5 text-primary" aria-hidden="true" /> {tr('tools.worksheet')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{tr('tools.worksheetNote')}</p>

        {/* chunk 5-AI feature 3: sample vs AI worksheet mode */}
        {aiGateOk && (
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={tr('tools.wsModeLabel')}>
            <Button
              size="sm"
              variant={wsMode === 'sample' ? 'default' : 'outline'}
              className="min-h-[44px]"
              onClick={() => setWsMode('sample')}
              aria-pressed={wsMode === 'sample'}
            >
              {tr('tools.wsModeSample')}
            </Button>
            <Button
              size="sm"
              variant={wsMode === 'ai' ? 'default' : 'outline'}
              className="min-h-[44px]"
              onClick={() => setWsMode('ai')}
              aria-pressed={wsMode === 'ai'}
            >
              <Sparkles className="size-4 text-primary" aria-hidden="true" /> {tr('tools.wsModeAi')}
            </Button>
          </div>
        )}

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">{tr('tools.pickChapter')}</legend>
          <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {chapters.map((ch, i) => (
              <Button
                key={ch.title}
                size="sm"
                variant={i === chapterIdx ? 'default' : 'outline'}
                className="min-h-[44px] max-w-full"
                onClick={() => setChapterIdx(i)}
                aria-pressed={i === chapterIdx}
                aria-label={`${ch.subject}: ${ch.title}`}
              >
                <span className="truncate">{ch.title}</span>
              </Button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-3">
          <legend className="text-sm font-medium">{tr('tools.questionCount')}</legend>
          <div className="mt-2 flex gap-1.5" role="group" aria-label={tr('tools.questionCount')}>
            {COUNT_CHOICES.map((c) => (
              <Button
                key={String(c.value)}
                size="sm"
                variant={count === c.value ? 'default' : 'outline'}
                className="min-h-[44px] min-w-[44px]"
                onClick={() => setCount(c.value)}
                aria-pressed={count === c.value}
                hidden={wsMode === 'ai'}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </fieldset>

        {/* AI mode: difficulty + generate + honest status */}
        {aiGateOk && wsMode === 'ai' && (
          <div className="mt-4 rounded-xl border border-dashed border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              {(['easy', 'medium', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setWsDifficulty(d)}
                  aria-pressed={wsDifficulty === d}
                  className={cn(
                    'press min-h-[36px] rounded-full border-2 px-3 text-xs font-semibold',
                    wsDifficulty === d ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                  )}
                >
                  {tr(d === 'easy' ? 'ai.diffEasy' : d === 'medium' ? 'ai.diffMedium' : 'ai.diffHard')}
                </button>
              ))}
            </div>
            {aiWsPhase === 'loading' ? (
              <div role="status" aria-live="polite" className="mt-3 flex flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <p className="text-xs text-muted-foreground">{tr('ai.thinking')}</p>
              </div>
            ) : aiWsPhase === 'error' ? (
              <div role="status" className="mt-3">
                <p className="rounded-xl bg-muted/60 p-3 text-sm">{aiWsErr ? tr(aiErrKey(aiWsErr)) : tr('ai.err.UNAVAILABLE')}</p>
                <Button variant="secondary" size="sm" className="mt-2 min-h-[44px]" onClick={() => void generateAiWs()}>
                  {tr('ai.regenerate')}
                </Button>
              </div>
            ) : !aiWs ? (
              <Button variant="outline" size="sm" className="mt-3 min-h-[44px]" onClick={() => void generateAiWs()}>
                <Sparkles className="size-4 text-primary" aria-hidden="true" /> {tr('tools.wsAiGenerate')}
              </Button>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" className="min-h-[44px]" onClick={() => void generateAiWs()}>
                  {tr('ai.regenerate')}
                </Button>
                {aiWsSaved ? (
                  <span className="inline-flex min-h-[36px] items-center rounded-full bg-success-soft px-3 text-xs font-semibold text-success-soft-foreground">
                    {tr('ai.savedChip')}
                  </span>
                ) : (
                  onSaveWorksheet && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-[44px]"
                      onClick={() => {
                        onSaveWorksheet({
                          id: `worksheet#${chapter?.title ?? 'ch'}#${aiWsHash || Date.now()}`,
                          date: dayKey(now, tz),
                          payload: aiWs,
                          label: 'ai_generated_unreviewed',
                        });
                        setAiWsSaved(true);
                      }}
                    >
                      {tr('ai.save')}
                    </Button>
                  )
                )}
                {aiWs.dropped ? (
                  <span className="text-xs text-muted-foreground">
                    {tr('ai.betaDropped').replace('{n}', String(aiWs.dropped))}
                  </span>
                ) : null}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">{tr('tools.wsAiLabel')}</p>
          </div>
        )}

        {wsMode === 'sample' && chapter && questions.length > 0 && (
          <div
            className="print-area mt-4 rounded-xl border border-border bg-background p-6 font-serif text-foreground shadow-sm"
            aria-label={tr('tools.worksheetHeader')}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-foreground/40 pb-2">
              <h3 className="font-heading text-xl font-bold">{tr('tools.worksheetHeader')}</h3>
              <p className="text-sm text-muted-foreground">{chapter.subject} · {bandDef.name}</p>
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-6 text-sm">
              <p>{tr('tools.nameLine')} <span className="inline-block w-48 border-b border-foreground/60">&nbsp;</span></p>
              <p>{tr('tools.dateLine')} <span className="inline-block w-32 border-b border-foreground/60">&nbsp;</span></p>
            </div>
            <ol className="mt-5 flex flex-col gap-5">
              {questions.map((q, i) => (
                <li key={i} className="text-[15px] leading-relaxed">
                  <p><span className="font-semibold">{i + 1}.</span> {q.text}</p>
                  <div className="mt-2 ml-6 flex flex-col gap-6" aria-hidden="true">
                    <div className="h-6 border-b border-foreground/50" />
                    <div className="h-6 border-b border-foreground/50" />
                    <div className="h-6 border-b border-foreground/50" />
                  </div>
                </li>
              ))}
            </ol>
            <div className="break-before pt-4" style={{ breakBefore: 'page' }}>
              <h3 className="border-b border-foreground/40 pb-2 font-heading text-lg font-bold">
                {tr('tools.answerKey')}
              </h3>
              <ol className="mt-3 flex flex-col gap-1 text-sm">
                {questions.map((q, i) => (
                  <li key={i}>
                    <span className="font-semibold">{i + 1}.</span> {q.options[q.answer]}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* AI worksheet paper (printable; answer key + marking scheme on its own page) */}
        {wsMode === 'ai' && aiWs && (
          <div
            className="print-area mt-4 rounded-xl border border-border bg-background p-6 font-serif text-foreground shadow-sm"
            aria-label={tr('tools.wsAiPaper')}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-foreground/40 pb-2">
              <h3 className="font-heading text-xl font-bold">{aiWs.title}</h3>
              <p className="text-sm text-muted-foreground">{chapter?.subject} · {aiWsTotalMarks} {tr('tools.wsMarks')}</p>
            </div>
            <p className="mt-2 text-sm">{aiWs.instructions}</p>
            <div className="mt-3 flex flex-wrap justify-between gap-6 text-sm">
              <p>{tr('tools.nameLine')} <span className="inline-block w-48 border-b border-foreground/60">&nbsp;</span></p>
              <p>{tr('tools.dateLine')} <span className="inline-block w-32 border-b border-foreground/60">&nbsp;</span></p>
            </div>
            <ol className="mt-5 flex flex-col gap-5">
              {aiWs.items.map((it, i) => (
                <li key={i} className="text-[15px] leading-relaxed">
                  <p>
                    <span className="font-semibold">{i + 1}.</span> {it.text}{' '}
                    <span className="text-sm text-muted-foreground">[{it.marks} {tr('tools.wsMarks')}]</span>
                  </p>
                  {it.type === 'mcq' && it.options.length > 0 ? (
                    <div className="mt-2 ml-6 flex flex-col gap-1.5 text-sm">
                      {it.options.map((opt, j) => (
                        <p key={j}>{String.fromCharCode(65 + j)}. {opt}</p>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 ml-6 flex flex-col gap-6" aria-hidden="true">
                      <div className="h-6 border-b border-foreground/50" />
                      <div className="h-6 border-b border-foreground/50" />
                      {(it.type === 'long' || it.type === 'numerical' || it.type === 'hots') && (
                        <>
                          <div className="h-6 border-b border-foreground/50" />
                          <div className="h-6 border-b border-foreground/50" />
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <div className="break-before pt-4" style={{ breakBefore: 'page' }}>
              <h3 className="border-b border-foreground/40 pb-2 font-heading text-lg font-bold">
                {tr('tools.answerKey')} · {tr('tools.wsMarkingScheme')}
              </h3>
              <ol className="mt-3 flex flex-col gap-2 text-sm">
                {aiWs.items.map((it, i) => (
                  <li key={i}>
                    <span className="font-semibold">{i + 1}.</span> {it.answer}{' '}
                    <span className="text-muted-foreground">[{it.marks} {tr('tools.wsMarks')}]</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">{tr('tools.wsAiKeyNote')}</p>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          <Button
            className="min-h-[44px] self-start"
            onClick={() => window.print()}
            disabled={wsMode === 'sample' ? questions.length === 0 : !aiWs}
            aria-label={tr('tools.print')}
          >
            <Printer className="size-4" aria-hidden="true" /> {tr('tools.print')}
          </Button>
          <p className="text-xs text-muted-foreground">{tr('tools.printHint')}</p>
          <p className="text-xs text-muted-foreground">{tr('tools.answersNote')}</p>
        </div>
      </section>

      {/* My notes */}
      <section aria-labelledby="tools-notes" data-tour="tools-notes" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="tools-notes" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <NotebookPen className="size-5 text-primary" aria-hidden="true" /> {tr('tools.notes')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{tr('tools.notesNote')}</p>

        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          className="hidden"
          onChange={handleNoteFile}
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={scanRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleScanFile(e)}
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="min-h-[44px]" onClick={() => fileRef.current?.click()} aria-label={tr('tools.uploadNote')}>
            <Upload className="size-4" aria-hidden="true" /> {tr('tools.uploadNote')}
          </Button>
          {/* chunk 5-AI feature 6: scan a photo of notes (VLM) */}
          {aiGateOk && (
            <Button variant="outline" className="min-h-[44px]" onClick={() => scanRef.current?.click()} aria-label={tr('tools.scanNote')}>
              <Camera className="size-4" aria-hidden="true" /> {tr('tools.scanNote')}
            </Button>
          )}
        </div>

        {/* Scan states */}
        {scanPhase === 'loading' && (
          <div role="status" aria-live="polite" className="mt-3 flex flex-col gap-2 rounded-xl border border-border p-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <p className="text-xs text-muted-foreground">{tr('tools.scanChecking')}</p>
          </div>
        )}
        {scanPhase === 'check' && (
          <div className="mt-3 rounded-xl border border-border p-3">
            <p className="text-sm font-semibold">{tr('tools.scanCheckTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tr('tools.scanCheckNote')}</p>
            <textarea
              value={scanText}
              onChange={(e) => setScanText(e.target.value)}
              rows={6}
              className="mt-2 w-full rounded-lg border border-border bg-background p-3 text-sm"
              aria-label={tr('tools.scanCheckTitle')}
            />
            <Button
              size="sm"
              className="mt-2 min-h-[44px]"
              disabled={!scanText.trim()}
              onClick={() => {
                onAddNote({
                  id: crypto.randomUUID(),
                  name: `scan-${dayKey(now, tz)}.txt`,
                  text: sanitizeNoteText(scanText),
                  added: dayKey(now, tz),
                });
                setScanPhase('idle');
                setScanText('');
                setScanMsg(tr('tools.noteSaved'));
              }}
            >
              {tr('tools.scanSave')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-2 min-h-[44px]"
              onClick={() => { setScanPhase('idle'); setScanText(''); }}
            >
              {tr('common.cancel')}
            </Button>
          </div>
        )}
        {scanMsg && scanPhase !== 'check' && (
          <p role="status" className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {scanMsg}
          </p>
        )}

        {state.notes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{tr('tools.noNotes')}</p>
        ) : (
          <ul className="mt-3 flex max-h-96 flex-col gap-2 overflow-y-auto" aria-label={tr('tools.notes')}>
            {state.notes.map((n) => {
              const open = openNoteId === n.id;
              const saved = Object.keys(state.aiContent).some((k) => k.startsWith(`notes#${n.id}#`));
              return (
                <li key={n.id} className="rounded-xl border border-border p-3">
                  <div className="flex min-h-[44px] items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenNoteId(open ? null : n.id)}
                      aria-expanded={open}
                      className="min-h-[44px] min-w-0 flex-1 truncate text-left font-medium underline-offset-2 hover:underline"
                      aria-label={`${n.name}, ${n.text.length} characters`}
                    >
                      {n.name}
                    </button>
                    {saved && (
                      <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success-soft-foreground">
                        {tr('ai.savedChip')}
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {n.added} · {n.text.length}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-[44px]"
                      onClick={() => onRemoveNote(n.id)}
                      aria-label={`Remove ${n.name}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  {open && (
                    <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm">
                      {n.text}
                    </pre>
                  )}
                  <NoteAiBlock
                    note={n}
                    band={band}
                    lang={state.profile?.lang ?? 'en'}
                    date={dayKey(now, tz)}
                    saved={saved}
                    aiAvailable={aiAvailable !== false}
                    demo={demo}
                    onSaveAi={onSaveAi}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Study video */}
      <section aria-labelledby="tools-video" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="tools-video" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Youtube className="size-5 text-primary" aria-hidden="true" /> {tr('tools.video')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{tr('tools.videoNote')}</p>

        <div className="mt-3 flex flex-col gap-2">
          <Label htmlFor="tools-video-url">{tr('tools.videoUrl')}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="tools-video-url"
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className={cn('min-h-[44px]', videoBad && 'border-destructive')}
              aria-invalid={videoBad}
            />
            <Button className="min-h-[44px]" onClick={handleAddVideo} aria-label={tr('tools.addVideo')}>
              {tr('tools.addVideo')}
            </Button>
          </div>
        </div>

        {videoStatus && (
          <p
            role={videoBad ? 'alert' : 'status'}
            className={cn(
              'mt-3 rounded-lg px-3 py-2 text-sm',
              videoBad ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
            )}
          >
            {videoStatus}
          </p>
        )}

        {state.videos.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{tr('tools.noVideos')}</p>
        ) : (
          <ul className="mt-3 flex max-h-[480px] flex-col gap-3 overflow-y-auto" aria-label={tr('tools.video')}>
            {state.videos.map((v, i) => (
              <li key={v.id} className="rounded-xl border border-border p-3">
                <div className="flex min-h-[44px] items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                    {v.sourceUrl}
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{v.added}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-[44px]"
                    onClick={() => onRemoveVideo(v.id)}
                    aria-label={`Remove video ${i + 1}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <iframe
                  src={youtubeEmbedUrl(v.videoId)}
                  className="aspect-video w-full rounded-xl"
                  allowFullScreen
                  title={`Study video ${i + 1}`}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{tr('tools.videoDisclaimer')}</p>
      </section>
    </div>
  );
}

// ---------- chunk 5B: Notes AI (practice-only, never XP) ----------

/**
 * One note's AI block: consent checkbox + send button, then a result card
 * with summary bullets, glossary rows, flashcards and answerable practice
 * questions (local reveal, no XP). Save dispatches an `ai-generated` event
 * via LumioApp; the Saved chip comes from the projection.
 */
function NoteAiBlock({
  note,
  band,
  lang,
  date,
  saved,
  aiAvailable,
  demo,
  onSaveAi,
}: {
  note: LearnerNote;
  band: Band;
  lang: 'en' | 'hi' | 'hinglish';
  date: string;
  saved: boolean;
  aiAvailable: boolean;
  demo?: boolean;
  onSaveAi?: (args: {
    id: string;
    kind: 'notes';
    date: string;
    payload: NotesAiResult;
    label: string;
  }) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NotesAiResult | null>(null);
  const [label, setLabel] = useState<string>('');
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  const run = async () => {
    if (loading || !consent) return;
    setLoading(true);
    setRevealed({});
    setFlipped({});
    const res = await aiApi.notes({
      noteId: note.id,
      noteName: note.name,
      noteText: note.text,
      band,
      lang,
    });
    setLoading(false);
    if (res.ok && res.data?.data) {
      setResult(res.data.data);
      setLabel(res.data.label ?? 'ai_generated_unreviewed');
    } else {
      setResult(null);
    }
  };

  // Honest gating: AI off -> nothing rendered.
  if (!aiAvailable) return null;

  return (
    <div className="mt-2 border-t border-border/60 pt-2">
      {!result && !loading && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-[44px] flex-1 cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
            <span className="text-muted-foreground">{t(lang, 'ai.notesConsent')}</span>
          </label>
          <Button
            size="sm"
            className="press min-h-[44px]"
            disabled={!consent}
            onClick={() => void run()}
          >
            <Sparkles className="size-4 text-primary-foreground" aria-hidden="true" />{' '}
            {t(lang, 'ai.notesSend')}
          </Button>
        </div>
      )}

      {loading && (
        <div role="status" aria-live="polite" className="mt-2 flex flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      )}

      {result && (
        <div className="mt-2 rounded-2xl border border-border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {t(lang, 'ai.notesTitle')}
          </p>

          {/* Summary bullets */}
          {result.summary?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(lang, 'ai.notesSummary')}
              </p>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
                {result.summary.map((s, i) => (
                  <li key={i} className="text-sm">
                    <AiMarkdown text={s} className="inline" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Glossary term/meaning rows */}
          {result.glossary?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(lang, 'ai.notesGlossary')}
              </p>
              <dl className="mt-1 flex flex-col gap-2">
                {result.glossary.map((g, i) => (
                  <div key={i} className="rounded-xl bg-muted/60 p-3">
                    <dt className="text-sm font-semibold">{g.term}</dt>
                    <dd className="mt-0.5 text-sm text-muted-foreground">
                      <AiMarkdown text={g.meaning} className="inline" />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Flashcards grid: tap front/back to flip */}
          {result.flashcards?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(lang, 'ai.notesCards')}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {result.flashcards.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))}
                    aria-pressed={flipped[i] === true}
                    className="press min-h-[44px] rounded-xl border border-border bg-muted/40 p-3 text-left"
                  >
                    <span className="block text-sm font-medium">{c.front}</span>
                    {flipped[i] ? (
                      <span className="mt-1 block text-sm text-muted-foreground">{c.back}</span>
                    ) : (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t(lang, 'ai.showAnswer')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Practice questions: local reveal, no XP */}
          {result.questions?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(lang, 'ai.notesQuestions')} · {t(lang, 'ai.noXp')}
              </p>
              <div className="mt-2 flex flex-col gap-3">
                {result.questions.map((qa, qi) => (
                  <fieldset key={qi} className="rounded-xl border border-border p-3">
                    <legend className="sr-only">{qa.text}</legend>
                    <p className="text-sm font-medium">{qa.text}</p>
                    <div className="mt-2 flex flex-col gap-2">
                      {qa.options.map((opt, oi) => {
                        const answered = revealed[qi] === true;
                        const isAnswer = oi === qa.answer;
                        return (
                          <button
                            key={oi}
                            type="button"
                            disabled={answered}
                            onClick={() => setRevealed((r) => ({ ...r, [qi]: true }))}
                            aria-pressed={answered && isAnswer}
                            className={cn(
                              'press flex min-h-[44px] items-center gap-2 rounded-xl border-2 p-2.5 text-left text-sm font-medium',
                              !answered && 'border-border hover:border-primary/40',
                              answered && isAnswer && 'border-success bg-success-soft text-success-soft-foreground',
                              answered && !isAnswer && 'border-border opacity-60'
                            )}
                          >
                            <span
                              className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold"
                              aria-hidden="true"
                            >
                              {String.fromCharCode(65 + oi)}
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {revealed[qi] === true && <AiMarkdown text={qa.explanation} />}
                  </fieldset>
                ))}
              </div>
            </div>
          )}

          {/* Save / Regenerate + label */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onSaveAi && (
              <Button
                size="sm"
                variant={saved ? 'ghost' : 'default'}
                className="min-h-[44px]"
                onClick={() =>
                  onSaveAi({
                    id: `notes#${note.id}#${lang}#${date}`,
                    kind: 'notes',
                    date,
                    payload: result,
                    label,
                  })
                }
              >
                {saved ? t(lang, 'ai.savedChip') : t(lang, 'ai.save')}
              </Button>
            )}
            <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => void run()}>
              {t(lang, 'ai.notesSend')}
            </Button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{t(lang, 'ai.notesSaved')}</p>
          <AiLabel feature="notes" output={JSON.stringify(result)} lang={lang} demo={demo} />
        </div>
      )}
    </div>
  );
}
