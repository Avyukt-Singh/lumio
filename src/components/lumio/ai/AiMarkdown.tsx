'use client';

import { useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AlertTriangle, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { aiApi, type AiApiCode } from '@/lib/lumio/aiClient';
import { t, type DictKey, type UiLang } from '@/lib/lumio/i18n';

/**
 * Shared AI output rendering (chunk 5B). Every AI string goes through
 * <AiMarkdown>, which allow-lists plain formatting elements only — never
 * links, images or raw HTML (contract rule 3). <AiLabel> is the mandatory
 * footer under every AI output: AI badge, disclaimer, report control.
 */

const ALLOWED = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre'] as const;

export function AiMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        'text-sm leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_em]:italic [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_strong]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
        className
      )}
    >
      <ReactMarkdown allowedElements={[...ALLOWED]} unwrapDisallowed>
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** Map an API error code to its calm i18n key (never a raw code on screen). */
export function aiErrKey(code: AiApiCode): DictKey {
  switch (code) {
    case 'SIGN_IN_REQUIRED':
      return 'ai.needSignIn';
    case 'OVER_BUDGET':
      return 'ai.err.OVER_BUDGET';
    case 'INVALID_RESPONSE':
      return 'ai.err.INVALID_RESPONSE';
    case 'BLOCKED_BY_POLICY':
      return 'ai.err.BLOCKED_BY_POLICY';
    case 'UNCONFIGURED':
      return 'ai.err.UNCONFIGURED';
    case 'RATE_LIMITED':
      return 'ai.err.RATE_LIMITED';
    case 'CONSENT_REQUIRED':
      return 'ai.err.CONSENT_REQUIRED';
    case 'AI_DISABLED':
      return 'ai.err.AI_DISABLED';
    default:
      // UNAVAILABLE / SERVER_ERROR / BAD_REQUEST and anything unknown
      return 'ai.err.UNAVAILABLE';
  }
}

/** Tiny manual interpolation following the existing {email} dictionary style. */
export function fillVars(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m
  );
}

/** Remaining daily AI budget, refreshed after each completed reply. */
export function useAiBudget() {
  const [budget, setBudget] = useState<{ callsLeft: number; callsCap: number } | null>(null);
  const refresh = useCallback(async () => {
    const res = await aiApi.budget();
    if (res?.ok && typeof res.callsLeft === 'number' && typeof res.callsCap === 'number') {
      setBudget({ callsLeft: res.callsLeft, callsCap: res.callsCap });
    } else {
      setBudget(null);
    }
  }, []);
  return { budget, refresh };
}

/** Small "AI" chip used on cards and panel headers. */
export function AiBadge({ demo, lang }: { demo?: boolean; lang: UiLang }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
      <BadgeCheck className="size-3" aria-hidden="true" /> AI
      {demo && (
        <span className="rounded-full bg-gold-soft px-1.5 font-semibold" style={{ color: 'var(--gold)' }}>
          {t(lang, 'ai.demoMode')}
        </span>
      )}
    </span>
  );
}

/**
 * Mandatory label under every AI output (contract rule 2): AI badge, the
 * disclaimer line and a report-a-problem disclosure.
 */
export function AiLabel({
  feature,
  output,
  lang,
  demo,
}: {
  feature: string;
  output: string;
  lang: UiLang;
  demo?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const res = await aiApi.report({ feature, output, note: note.trim() || undefined });
    setBusy(false);
    if (res.ok) {
      setSent(true);
      setOpen(false);
      toast({ description: t(lang, 'ai.reportSent') });
    } else {
      toast({ description: t(lang, aiErrKey(res.code)) });
    }
  };

  return (
    <div className="mt-2 border-t border-border/60 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <AiBadge demo={demo} lang={lang} />
        <p className="min-w-0 flex-1 text-[11px] leading-snug text-muted-foreground">
          {t(lang, 'ai.disclaimer')}
        </p>
        {!open && (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[36px] px-2 text-xs text-muted-foreground"
            onClick={() => setOpen(true)}
          >
            <AlertTriangle className="size-3.5" aria-hidden="true" /> {t(lang, 'ai.report')}
          </Button>
        )}
      </div>
      {open && !sent && (
        <div className="mt-2 flex flex-col gap-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t(lang, 'ai.reportNotePlaceholder')}
            rows={2}
            aria-label={t(lang, 'ai.report')}
          />
          <div className="flex gap-2">
            <Button size="sm" className="min-h-[44px]" onClick={() => void submit()} disabled={busy}>
              {t(lang, 'ai.reportSubmit')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-[44px]"
              onClick={() => setOpen(false)}
            >
              {t(lang, 'ai.close')}
            </Button>
          </div>
        </div>
      )}
      {sent && (
        <p role="status" className="mt-1 text-[11px] text-muted-foreground">
          {t(lang, 'ai.reportSent')}
        </p>
      )}
    </div>
  );
}
