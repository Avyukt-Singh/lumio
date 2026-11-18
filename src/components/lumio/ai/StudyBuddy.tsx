'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Send, Sparkles, Square, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { aiApi, type AiApiCode } from '@/lib/lumio/aiClient';
import { t, type UiLang } from '@/lib/lumio/i18n';
import { BANDS, type Band } from '@/lib/lumio/content';
import { glossaryFor, keyPointsFor } from '@/lib/lumio/chapterContent';
import type { LumioState } from '@/lib/lumio/types';
import { AiBadge, AiLabel, AiMarkdown, aiErrKey, fillVars, useAiBudget } from './AiMarkdown';

/**
 * Study Buddy (chunk 5B): floating grounded chat panel. Gated honestly by
 * sign-in / opt-in / availability; streams replies with a hint ladder
 * (1..4), read-aloud (young band), mic dictation and a daily budget line.
 * Chat history lives in component state only — nothing is persisted
 * (contract rule 10).
 */

export interface BuddyChapter {
  id: string;
  title: string;
  subject: string;
  chapterIndex: number;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const MAX_HINT = 4;

function isDevanagari(text: string): boolean {
  return /[\u0900-\u097F]/.test(text);
}

export function StudyBuddy({
  open,
  onOpenChange,
  state,
  chapter,
  aiAvailable,
  demo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: LumioState | null;
  chapter: BuddyChapter | null;
  aiAvailable: boolean;
  demo?: boolean;
}) {
  const lang: UiLang = state?.profile?.lang ?? 'en';
  const band: Band = state?.profile?.band ?? 'sec';
  const tr = (k: Parameters<typeof t>[1]) => t(lang, k);
  const { budget, refresh: refreshBudget } = useAiBudget();

  const [pickedIdx, setPickedIdx] = useState(0);
  const chapters = BANDS[band].chapters;
  const selectedChapter: BuddyChapter = useMemo(() => {
    if (chapter) return chapter;
    const ch = chapters[Math.min(Math.max(0, pickedIdx), chapters.length - 1)];
    return { id: `${band}#${pickedIdx}`, title: ch.title, subject: ch.subject, chapterIndex: pickedIdx };
  }, [chapter, chapters, pickedIdx, band]);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errCode, setErrCode] = useState<AiApiCode | null>(null);
  const [hintLevel, setHintLevel] = useState(1);
  const lastQuestionRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const grounding = useMemo(() => {
    const ch = chapters[selectedChapter.chapterIndex] ?? chapters[0];
    return {
      summary: ch?.summary ?? '',
      keyPoints: ch ? keyPointsFor(ch) : [],
      glossary: ch ? glossaryFor(ch) : ([] as Array<[string, string]>),
    };
  }, [chapters, selectedChapter.chapterIndex]);

  // Adjust-on-change (React render-time reset, not an effect): a new grounded
  // chapter starts a fresh conversation and a fresh hint ladder.
  const [convChapterId, setConvChapterId] = useState(selectedChapter.id);
  if (convChapterId !== selectedChapter.id) {
    setConvChapterId(selectedChapter.id);
    setMessages([]);
    setHintLevel(1);
    setErrCode(null);
    setSpeakingIdx(null);
    setInput('');
    lastQuestionRef.current = null;
  }

  // Teardown when the panel closes (external systems only + render-time reset).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* unsupported */
      }
      setSpeakingIdx(null);
    }
  }

  // Final teardown on unmount: external systems only (no setState here).
  useEffect(
    () => () => {
      abortRef.current?.abort();
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* unsupported */
      }
    },
    []
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const speak = (idx: number, text: string) => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = isDevanagari(text) ? 'hi-IN' : 'en-IN';
      u.onend = () => setSpeakingIdx((cur) => (cur === idx ? null : cur));
      u.onerror = () => setSpeakingIdx(null);
      setSpeakingIdx(idx);
      window.speechSynthesis.speak(u);
    } catch {
      setSpeakingIdx(null);
    }
  };

  const stopSpeak = () => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* unsupported */
    }
    setSpeakingIdx(null);
  };

  const dictate = () => {
    const W = window as unknown as {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!SR) {
      toast({ description: tr('ai.dictationUnsupported') });
      return;
    }
    try {
      const rec = new (SR as new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: (e: { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void;
        onerror: () => void;
        start: () => void;
      })();
      rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const text = e.results?.[0]?.[0]?.transcript ?? '';
        if (text) setInput((v) => (v ? `${v} ` : '') + text);
      };
      rec.onerror = () => toast({ description: tr('ai.dictationUnsupported') });
      rec.start();
    } catch {
      toast({ description: tr('ai.dictationUnsupported') });
    }
  };

  const ask = async (question: string, level: number) => {
    setErrCode(null);
    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    setMessages((m) => [...m, { role: 'user', content: question }, { role: 'assistant', content: '' }]);
    const res = await aiApi.chat(
      {
        chapterId: selectedChapter.id,
        chapterTitle: selectedChapter.title,
        subject: selectedChapter.subject,
        summary: grounding.summary,
        keyPoints: grounding.keyPoints,
        glossary: grounding.glossary,
        question,
        history: messages.map(({ role, content }) => ({ role, content })),
        hintLevel: level,
        band,
        lang,
      },
      (piece) => {
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + piece };
          }
          return next;
        });
      },
      controller.signal
    );
    abortRef.current = null;
    setSending(false);
    // User-initated stop: keep any partial text, no error card.
    if (controller.signal.aborted) {
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant' && last.content === '') next.pop();
        return next;
      });
      return;
    }
    if (res.ok) {
      lastQuestionRef.current = question;
      void refreshBudget();
    } else if (res.code === 'BLOCKED_BY_POLICY') {
      // Replace the streaming bubble with the calm copy (no error card).
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = { ...last, content: t(lang, 'ai.err.BLOCKED_BY_POLICY') };
        }
        return next;
      });
    } else if (res.code === 'OVER_BUDGET') {
      // Calm budget card replaces the empty streaming bubble.
      setErrCode('OVER_BUDGET');
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant' && last.content === '') next.pop();
        return next;
      });
      void refreshBudget();
    } else {
      setErrCode(res.code);
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant' && last.content === '') next.pop();
        return next;
      });
    }
  };

  const send = () => {
    const q = input.trim();
    if (!q || sending) return;
    // Asking the same question again auto-raises the hint level (spec).
    const autoLevel =
      lastQuestionRef.current === q ? Math.min(MAX_HINT, hintLevel + 1) : hintLevel;
    if (autoLevel !== hintLevel) setHintLevel(autoLevel);
    setInput('');
    void ask(q, autoLevel);
  };

  const hintMore = () => {
    const q = lastQuestionRef.current;
    if (!q || sending || hintLevel >= MAX_HINT) return;
    const level = hintLevel + 1;
    setHintLevel(level);
    void ask(q, level);
  };

  const newQuestion = () => {
    stopSpeak();
    setMessages([]);
    setHintLevel(1);
    setErrCode(null);
    lastQuestionRef.current = null;
    setInput('');
  };

  if (!open) return null;

  const hasReply = messages.some((m) => m.role === 'assistant' && m.content);

  const gated = !aiAvailable ? 'unavailable' : null;

  return (
    <div
      role="dialog"
      aria-label={tr('ai.askTitle')}
      data-tour="ai-panel"
      className="fixed bottom-24 inset-x-3 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg md:bottom-6 md:left-auto md:right-6 md:w-96"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border p-4">
        <Sparkles className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <h2 className="min-w-0 flex-1 truncate font-heading text-base font-semibold">
          {tr('ai.askTitle')}
        </h2>
        <AiBadge demo={demo} lang={lang} />
        <Button
          variant="ghost"
          size="sm"
          className="min-h-[44px] px-2"
          onClick={() => onOpenChange(false)}
          aria-label={tr('ai.close')}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <div className="scroll-slim flex-1 overflow-y-auto p-4">
        {gated ? (
          <div className="rounded-2xl border border-border bg-muted/60 p-4 text-sm">
            <p>{tr('ai.err.UNAVAILABLE')}</p>
          </div>
        ) : (
          <>
            {/* Chapter grounding: fixed chapter (Reader) or a simple select */}
            {!chapter && (
              <div className="mb-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">{tr('ai.chapters')}</p>
                <Select
                  value={String(pickedIdx)}
                  onValueChange={(v) => setPickedIdx(Number(v))}
                >
                  <SelectTrigger className="min-h-[44px] w-full" aria-label={tr('ai.chapters')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {chapters.map((ch, i) => (
                      <SelectItem key={ch.title} value={String(i)}>
                        {i + 1}. {ch.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Conversation */}
            {messages.length === 0 && !errCode && (
              <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                {tr('ai.askPlaceholder')}
              </p>
            )}
            <div ref={scrollRef} className="scroll-slim flex flex-col gap-3" aria-live="polite">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <p
                    key={i}
                    className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary/10 p-3 text-sm"
                  >
                    {m.content}
                  </p>
                ) : (
                  <div key={i} className="max-w-[92%] rounded-2xl border border-border bg-background p-3">
                    {m.content ? (
                      <AiMarkdown text={m.content} />
                    ) : (
                      <p role="status" className="text-sm text-muted-foreground">
                        {tr('ai.thinking')}
                      </p>
                    )}
                    {m.content && band === 'young' && (
                      <div className="mt-1 flex items-center gap-1">
                        {speakingIdx === i ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-[36px] px-2 text-xs"
                            onClick={stopSpeak}
                            aria-label={tr('ai.stopReading')}
                          >
                            <Square className="size-3.5" aria-hidden="true" /> {tr('ai.stopReading')}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-[36px] px-2 text-xs"
                            onClick={() => speak(i, m.content)}
                            aria-label={tr('ai.readAloud')}
                          >
                            <Volume2 className="size-3.5" aria-hidden="true" /> {tr('ai.readAloud')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            {/* Error cards — calm copy only */}
            {errCode && (
              <div role="status" className="mt-3 rounded-xl border border-border bg-muted/60 p-3 text-sm">
                {t(lang, aiErrKey(errCode))}
              </div>
            )}

            {/* Hint ladder footer */}
            {hasReply && !sending && !errCode && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {fillVars(tr('ai.hintLevelLabel'), { n: hintLevel })}
                </span>
                {hintLevel < MAX_HINT && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={hintMore}
                  >
                    {tr('ai.hintMore')}
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={newQuestion}>
                  {tr('ai.newQuestion')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Composer + label */}
      {!gated && (
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tr('ai.askPlaceholder')}
              rows={2}
              aria-label={tr('ai.askTitle')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <div className="flex flex-col gap-1">
              {sending ? (
                <Button
                  variant="secondary"
                  className="min-h-[44px]"
                  onClick={() => abortRef.current?.abort()}
                  aria-label={tr('ai.stop')}
                >
                  <Square className="size-4" aria-hidden="true" /> {tr('ai.stop')}
                </Button>
              ) : (
                <Button className="min-h-[44px]" onClick={send} disabled={!input.trim()} aria-label={tr('ai.send')}>
                  <Send className="size-4" aria-hidden="true" />
                  <span className="sr-only">{tr('ai.send')}</span>
                </Button>
              )}
              <Button
                variant="ghost"
                className="min-h-[44px] px-2"
                onClick={dictate}
                aria-label={tr('ai.dictation')}
              >
                <Mic className="size-4" aria-hidden="true" />
                <span className="sr-only">{tr('ai.dictation')}</span>
              </Button>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{tr('ai.dictationNote')}</p>
          {budget && (
            <p className={cn('mt-1 text-[11px] tabular-nums text-muted-foreground')}>
              {fillVars(tr('ai.budgetLeft'), { n: budget.callsLeft, cap: budget.callsCap })}
            </p>
          )}
          <AiLabel
            feature="chat"
            output={messages.filter((m) => m.role === 'assistant').map((m) => m.content).join('\n')}
            lang={lang}
            demo={demo}
          />
        </div>
      )}
    </div>
  );
}
