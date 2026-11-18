'use client';

// Guided product tour (chunk 7): controller + spotlight overlay + step card.
// Mounted ONCE in LumioApp; navigates the real app via the same handlers the
// nav uses (screen / reader / quiz), so every feature is explained where it
// lives. Design guardrails:
//  - The spotlight cut-out passes clicks through to the app (pointer-events
//    only on the dim + the card), so "try it" steps are genuinely hands-on.
//  - Next is NEVER blocked; the learner may do the action or move on.
//  - No scroll lock, no focus trap, no destructive actions, no auto-clicks.
//  - Missing / hidden targets degrade to a centred card — never a crash.
//  - Every string goes through i18n; motion honours calm + reduced-motion.

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, MousePointerClick, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Mascot } from '../Mascot';
import { cn } from '@/lib/utils';
import { t, tFor, type DictKey, type UiLang } from '@/lib/lumio/i18n';
import {
  TOUR_STEPS,
  type TourCtx, type TourLoc, type TourStep,
} from './steps';

interface Rect { top: number; left: number; width: number; height: number }

export interface TourProps {
  lang: UiLang;
  calm: boolean;
  ctx: TourCtx;
  /** current app location (so loc changes only happen when they differ) */
  screen: string;
  reader: number | null;
  quiz: number | null;
  /** open game id on the Games hub (so Back can close it again) */
  game: string | null;
  /** persisted step id to resume from (null = start at the first step) */
  initialStepId: string | null;
  onLoc: (loc: TourLoc) => void;
  onStepChange: (stepId: string) => void;
  /** finished=true when the learner reached the end; false = skipped */
  onEnd: (finished: boolean) => void;
  onBuddy: (open: boolean) => void;
}

const CARD_W = 360;
const CARD_H_EST = 300;
const EDGE = 12;
const GLOW_PAD = 6;

/** Replace {name} / {xp} / {streak} style placeholders from the tour context. */
function fill(s: string, ctx: TourCtx): string {
  return s
    .replace(/\{name\}/g, ctx.name || 'friend')
    .replace(/\{xp\}/g, ctx.xp.toLocaleString('en-IN'))
    .replace(/\{streak\}/g, String(ctx.streak));
}

export function Tour(props: TourProps) {
  const { lang, calm, ctx, screen, reader, quiz, game, initialStepId, onLoc, onStepChange, onEnd, onBuddy } = props;
  const tr = tFor(lang);

  const steps = useMemo(
    () => TOUR_STEPS.filter((s) => !s.showIf || s.showIf(ctx)),
    [ctx]
  );

  const [idx, setIdx] = useState(() => {
    if (!initialStepId) return 0;
    const i = steps.findIndex((s) => s.id === initialStepId);
    return i >= 0 ? i : 0;
  });
  /** last measurement for a given selector — spot only counts when it matches the CURRENT target */
  const [meas, setMeas] = useState<{ sel: string; rect: Rect | null }>({ sel: '', rect: null });
  const [vp, setVp] = useState(() => ({
    w: typeof window === 'undefined' ? 1100 : window.innerWidth,
    h: typeof window === 'undefined' ? 800 : window.innerHeight,
  }));
  /** step id the "Nice!" tick was earned on (resets automatically per step) */
  const [niceId, setNiceId] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const locRef = useRef({ screen, reader, quiz, game });

  const step: TourStep | undefined = steps[Math.min(idx, steps.length - 1)];
  const total = steps.length;
  // derived-safe index (no clamp effect needed): ctx changes can shrink the list
  const safeIdx = Math.max(0, Math.min(idx, steps.length - 1));
  const nice = !!step && niceId === step.id;

  // keep the "current location" mirror fresh (declared before the step-entry
  // effect so both run in the right order)
  useEffect(() => {
    locRef.current = { screen, reader, quiz, game };
  }, [screen, reader, quiz, game]);

  // reduced motion (device setting) — combined with the app's calm mode below
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const f = () => setReduceMotion(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const animate = !reduceMotion && !calm;

  // viewport size (placement + phone detection)
  useEffect(() => {
    const f = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    window.addEventListener('orientationchange', f);
    return () => {
      window.removeEventListener('resize', f);
      window.removeEventListener('orientationchange', f);
    };
  }, []);

  // focus: move into the card on every step; restore on unmount
  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    return () => {
      try { prevFocusRef.current?.focus?.(); } catch { /* element gone */ }
    };
  }, []);
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [safeIdx]);

  // step entry: persist + navigate to the step's exact location when needed
  useEffect(() => {
    const s = steps[safeIdx];
    if (!s) return;
    onStepChange(s.id);
    if (s.closeBuddy) onBuddy(false);
    const loc = s.loc;
    const cur = locRef.current;
    // loc.game === undefined means "hub / no game" for every step — the open
    // game is closed again on entry so Back and Next always restore the hub.
    const wantGame = loc.game ?? null;
    if (
      cur.screen !== loc.screen ||
      cur.reader !== loc.reader ||
      cur.quiz !== loc.quiz ||
      cur.game !== wantGame
    ) {
      onLoc(loc);
    }
  }, [safeIdx, steps, onStepChange, onBuddy, onLoc]);

  // target measurement: poll briefly (mount delay), then re-measure on
  // scroll / resize / layout changes so the spotlight never drifts.
  // All setState happens in async callbacks — never synchronously in the effect.
  const selector = step?.target;
  useEffect(() => {
    if (!selector) return;
    let alive = true;
    let timer: number | undefined;
    let tries = 0;
    let scrolled = false;

    const findEl = (): HTMLElement | null => {
      const els = document.querySelectorAll<HTMLElement>(`[data-tour="${selector}"]`);
      for (const el of Array.from(els)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return el;
      }
      return null;
    };

    const measure = (): boolean => {
      if (!alive) return true;
      const el = findEl();
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // first sighting: bring the target into view (never scrolls mid-try)
      if (!scrolled && (r.top < 60 || r.bottom > vh - 60)) {
        scrolled = true;
        try {
          el.scrollIntoView({ block: 'center', behavior: animate ? 'smooth' : 'auto' });
        } catch { /* very old engines */ }
      }
      setMeas({ sel: selector, rect: { top: r.top, left: r.left, width: r.width, height: r.height } });
      return true;
    };

    const loop = () => {
      if (!alive) return;
      const ok = measure();
      tries += 1;
      if (!ok) {
        if (tries < 25) timer = window.setTimeout(loop, 100);
        else setMeas({ sel: selector, rect: null }); // fallback: centred card
      }
    };
    timer = window.setTimeout(loop, 40); // async first measure (target may still be mounting)

    const remeasure = () => { if (alive) measure(); };
    window.addEventListener('resize', remeasure);
    window.addEventListener('scroll', remeasure, true);
    window.addEventListener('orientationchange', remeasure);
    window.visualViewport?.addEventListener('resize', remeasure);
    const layoutPoll = window.setInterval(remeasure, 700); // sidebar collapse, accordions…

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      window.clearInterval(layoutPoll);
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('scroll', remeasure, true);
      window.removeEventListener('orientationchange', remeasure);
      window.visualViewport?.removeEventListener('resize', remeasure);
    };
  }, [selector, safeIdx, animate, game]);

  // "try it" detection: any real click inside the spotlighted element
  useEffect(() => {
    if (!step || step.type !== 'try' || !step.target) return;
    const onDoc = (ev: MouseEvent) => {
      const tEl = ev.target as HTMLElement | null;
      if (!tEl) return;
      const els = document.querySelectorAll(`[data-tour="${step.target}"]`);
      for (const el of Array.from(els)) {
        if (el.contains(tEl)) { setNiceId(step.id); return; }
      }
    };
    document.addEventListener('click', onDoc, true);
    return () => document.removeEventListener('click', onDoc, true);
  }, [step?.type, step?.target, step?.id]);

  // ---- navigation ----
  const end = useCallback((finished: boolean) => onEnd(finished), [onEnd]);
  const next = useCallback(() => {
    if (safeIdx >= total - 1) end(true);
    else setIdx(safeIdx + 1);
  }, [safeIdx, total, end]);
  const back = useCallback(() => setIdx((i) => Math.max(0, Math.min(i, total - 1) - 1)), [total]);
  const skipSection = useCallback(() => {
    const cur = steps[safeIdx];
    const nextIdx = steps.findIndex((s, i) => i > safeIdx && s.sec !== cur.sec);
    if (nextIdx === -1) end(true);
    else setIdx(nextIdx);
  }, [steps, safeIdx, end]);

  // keyboard: Esc = skip whole tour, arrows = back/next (never while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.key === 'Escape') { e.preventDefault(); end(false); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, back, end]);

  if (!step) return null;

  const phone = vp.w < 640;
  const title = fill(t(lang, step.titleKey as DictKey), ctx);
  const body = fill(t(lang, step.bodyKey as DictKey), ctx);
  const stepN = safeIdx + 1;
  const secLabel = t(lang, `tour.sec.${step.sec}` as DictKey);
  const last = safeIdx >= total - 1;
  // the spotlight only counts when the measurement belongs to the CURRENT target
  const spot = selector && meas.sel === selector ? meas.rect : null;

  // ---- card placement ----
  // (never uses CSS transform for centering — framer-motion owns the
  // transform property on this element and would overwrite it)
  const cardStyle: CSSProperties = (() => {
    const w = Math.min(CARD_W, vp.w - EDGE * 2);
    if (!spot) {
      // centred fallback: the card is rendered inside a flex wrapper instead
      return { width: w };
    }
    const pad = { ...spot, top: spot.top - GLOW_PAD, left: spot.left - GLOW_PAD, width: spot.width + GLOW_PAD * 2, height: spot.height + GLOW_PAD * 2 };
    const spaceR = vp.w - (pad.left + pad.width);
    const spaceL = pad.left;
    const spaceB = vp.h - (pad.top + pad.height);
    const spaceT = pad.top;
    if (phone) {
      // phones: full-width sheet; keep it OFF the target so it never covers it
      const under = spaceB > CARD_H_EST + 120;
      return {
        left: EDGE, right: EDGE, width: 'auto',
        ...(under ? { top: Math.min(pad.top + pad.height + 12, vp.h - 200) } : { top: 68 }),
      };
    }
    const topFor = () => Math.min(Math.max(EDGE, pad.top + pad.height / 2 - 150), Math.max(EDGE, vp.h - CARD_H_EST - EDGE));
    if (spaceR >= w + 24) return { width: w, left: Math.min(pad.left + pad.width + 12, vp.w - w - EDGE), top: topFor() };
    if (spaceL >= w + 24) return { width: w, left: Math.max(EDGE, pad.left - w - 12), top: topFor() };
    if (spaceB >= CARD_H_EST * 0.7) return { width: w, left: Math.min(Math.max(EDGE, pad.left + pad.width / 2 - w / 2), vp.w - w - EDGE), top: Math.min(pad.top + pad.height + 12, vp.h - CARD_H_EST) };
    if (spaceT >= CARD_H_EST * 0.7) return { width: w, left: Math.min(Math.max(EDGE, pad.left + pad.width / 2 - w / 2), vp.w - w - EDGE), top: Math.max(EDGE, pad.top - CARD_H_EST - 12) };
    return { width: w };
  })();

  const dimRects: ReactNode[] = [];
  if (spot) {
    const p = {
      top: Math.max(0, spot.top - GLOW_PAD),
      bottom: Math.min(vp.h, spot.top + spot.height + GLOW_PAD),
      left: Math.max(0, spot.left - GLOW_PAD),
      right: Math.min(vp.w, spot.left + spot.width + GLOW_PAD),
    };
    dimRects.push(
      <div key="d-top" className="pointer-events-auto absolute bg-black/60" style={{ left: 0, top: 0, width: '100%', height: p.top }} />,
      <div key="d-bottom" className="pointer-events-auto absolute bg-black/60" style={{ left: 0, top: p.bottom, width: '100%', height: vp.h - p.bottom }} />,
      <div key="d-left" className="pointer-events-auto absolute bg-black/60" style={{ left: 0, top: p.top, width: p.left, height: p.bottom - p.top }} />,
      <div key="d-right" className="pointer-events-auto absolute bg-black/60" style={{ left: p.right, top: p.top, width: vp.w - p.right, height: p.bottom - p.top }} />,
      // highlight ring (non-interactive decoration)
      <motion.div
        key="ring"
        className="pointer-events-none absolute rounded-xl ring-2 ring-primary"
        initial={false}
        animate={animate ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
        transition={animate ? { duration: 2, repeat: Infinity } : undefined}
        style={{ left: p.left, top: p.top, width: p.right - p.left, height: p.bottom - p.top }}
      />
    );
  } else {
    dimRects.push(<div key="d-full" className="pointer-events-auto absolute inset-0 bg-black/60" />);
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]" data-testid="tour-root">
      {/* dim + spotlight (clicks pass through the cut-out to the real app) */}
      {dimRects}

      {/* screen-reader announcement */}
      <p className="sr-only" aria-live="polite">
        {fill(t(lang, 'tour.stepOf' as DictKey), ctx).replace('{n}', String(stepN)).replace('{total}', String(total))}: {title}
      </p>

      {/* step card — centred via a flex wrapper when there is no spotlight,
          absolutely placed beside the target otherwise */}
      <div
        className={cn(
          'pointer-events-none absolute inset-0',
          !spot && 'flex items-center justify-center p-3'
        )}
      >
        <motion.div
          ref={cardRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-labelledby="tour-title"
          aria-describedby="tour-body"
          initial={animate ? { opacity: 0, y: 10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="pointer-events-auto flex max-h-[70dvh] flex-col overflow-y-auto scroll-slim rounded-2xl border border-border bg-card p-4 shadow-xl outline-none"
          style={cardStyle}
        >
        {/* header: section + counter + progress */}
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {fill(t(lang, 'tour.stepOf' as DictKey), ctx).replace('{n}', String(stepN)).replace('{total}', String(total))}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
            {secLabel ? `· ${secLabel}` : ''}
          </span>
          <button
            type="button"
            onClick={() => end(false)}
            aria-label={t(lang, 'tour.skip' as DictKey)}
            className="press inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(stepN / total) * 100}%` }} />
        </div>

        <div className="flex items-start gap-3">
          {(step.id === 'welcome' || step.id === 'finish') && (
            <Mascot pose={step.id === 'finish' ? 'excited' : 'happy'} size="md" bob={animate} />
          )}
          <div className="min-w-0 flex-1">
            <h2 id="tour-title" className="font-heading text-lg font-bold text-foreground">{title}</h2>
            <p id="tour-body" className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </div>
        </div>

        {/* try-it hint + Nice! tick */}
        {step.type === 'try' && (
          <div className="mt-3 flex items-center gap-2" aria-live="polite">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                nice ? 'bg-success-soft text-success-soft-foreground' : 'bg-accent/15 text-accent'
              )}
            >
              {nice ? <Check className="size-3.5" aria-hidden="true" /> : <MousePointerClick className="size-3.5" aria-hidden="true" />}
              {nice ? t(lang, 'tour.nice' as DictKey) : t(lang, 'tour.tryHint' as DictKey)}
            </span>
          </div>
        )}

        {/* controls */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="secondary" className="min-h-[44px]" onClick={back} disabled={safeIdx === 0}>
            <ChevronLeft className="size-4" aria-hidden="true" /> {t(lang, 'tour.back' as DictKey)}
          </Button>
          <Button variant="ghost" className="min-h-[44px] text-muted-foreground" onClick={skipSection}>
            {t(lang, 'tour.skipSection' as DictKey)}
          </Button>
          <span className="flex-1" />
          <Button variant="ghost" className="min-h-[44px] text-muted-foreground" onClick={() => end(false)}>
            {t(lang, 'tour.skip' as DictKey)}
          </Button>
          <Button className="min-h-[44px]" onClick={next}>
            {last ? t(lang, 'tour.finish' as DictKey) : t(lang, 'tour.next' as DictKey)}
            {!last && <ChevronRight className="size-4" aria-hidden="true" />}
          </Button>
        </div>
        </motion.div>
      </div>
    </div>
  );
}
