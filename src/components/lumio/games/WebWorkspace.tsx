'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { CheckCircle2, RotateCcw, ShieldCheck, XCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GameShell, type GameProps } from './GameShell';

// ---------------------------------------------------------------------------
// Content / constants
// ---------------------------------------------------------------------------

const STARTER_HTML = '<p>Welcome to <b>Lumio</b>!</p>';
const STARTER_CSS = '';
const DRAFTS_KEY = 'lumio-web-drafts';
const PREVIEW_DEBOUNCE_MS = 400;

const STRETCH_IDEAS = [
  'Make a bulleted list of three of your favourite things, using <ul> and <li>.',
  'Add a big heading above the paragraph with <h1>, and style it in the CSS box.',
];

// ---------------------------------------------------------------------------
// DOM-checking helpers (all inputs unknown / DOM types, no `any`)
// ---------------------------------------------------------------------------

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseRgb(color: string): Rgb | null {
  const m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/.exec(color);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

/** Reddish: the red channel is clearly dominant (r >= 150 and 1.5x g and b). */
function isReddish(c: Rgb): boolean {
  return c.r >= 150 && c.r > c.g * 1.5 && c.r > c.b * 1.5;
}

/**
 * Deepest element inside the preview body whose text contains "Lumio".
 * Depth-first pre-order means later matches are deeper on their branch.
 */
function findLumioElement(doc: Document): HTMLElement | null {
  if (!doc.body) return null;
  let best: HTMLElement | null = null;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  let node: Element | null = walker.currentNode as Element | null;
  while (node) {
    if (typeof node.textContent === 'string' && node.textContent.includes('Lumio')) {
      best = node as HTMLElement;
    }
    node = walker.nextNode() as Element | null;
  }
  return best;
}

type CheckKind = 'info' | 'fail' | 'success';

interface CheckFeedback {
  kind: CheckKind;
  text: string;
}

// ---------------------------------------------------------------------------
// WebWorkspaceGame
// ---------------------------------------------------------------------------

export function WebWorkspaceGame(props: GameProps) {
  // Saved drafts load eagerly (this screen only mounts client-side after the
  // app's own hydration gate, so localStorage is safe to read here).
  function loadDraft(): { html: string; css: string } | null {
    try {
      const raw = window.localStorage.getItem(DRAFTS_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const o = parsed as Record<string, unknown>;
        return {
          html: typeof o.html === 'string' ? o.html : STARTER_HTML,
          css: typeof o.css === 'string' ? o.css : STARTER_CSS,
        };
      }
    } catch {
      // Corrupt or missing storage: start from the starter code.
    }
    return null;
  }

  // ---- state (lazy initialisers restore saved drafts; no setState in effects) ----
  const [html, setHtml] = useState(() => loadDraft()?.html ?? STARTER_HTML);
  const [css, setCss] = useState(() => loadDraft()?.css ?? STARTER_CSS);
  const [preview, setPreview] = useState(() => {
    const d = loadDraft();
    return { html: d?.html ?? STARTER_HTML, css: d?.css ?? STARTER_CSS };
  });
  const [check, setCheck] = useState<CheckFeedback | null>(null);

  // ---- refs ----
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const draftsLoadedRef = useRef(false);

  // ---- derivations (consts ABOVE all effects, per project rule) ----
  // The learner's HTML is NEVER rendered with dangerouslySetInnerHTML into the
  // React tree — the sandboxed iframe's srcDoc is the isolation boundary.
  const srcDoc = `<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>`;

  // ---- effects ----

  // Load saved drafts (plain utility storage, not the event log).
  useEffect(() => {
    draftsLoadedRef.current = true;
  }, []);

  // Persist drafts whenever they change.
  useEffect(() => {
    if (!draftsLoadedRef.current) return;
    try {
      window.localStorage.setItem(DRAFTS_KEY, JSON.stringify({ html, css }));
    } catch {
      // Storage may be unavailable (private mode); the app still works.
    }
  }, [html, css]);

  // 400 ms debounced preview update; the timeout is cleaned up on unmount
  // and on every keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setPreview({ html, css });
    }, PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [html, css]);

  // ---- handlers ----

  function editHtml(ev: ChangeEvent<HTMLTextAreaElement>) {
    setHtml(ev.target.value);
  }

  function editCss(ev: ChangeEvent<HTMLTextAreaElement>) {
    setCss(ev.target.value);
  }

  function resetAll() {
    setHtml(STARTER_HTML);
    setCss(STARTER_CSS);
    setCheck(null);
  }

  /** Real check: reads the iframe's DOM (allowed via allow-same-origin). */
  function checkPage() {
    const doc = iframeRef.current?.contentDocument ?? null;
    if (!doc || !doc.body) {
      setCheck({
        kind: 'fail',
        text: 'I could not read the preview right now. Wait a moment, then press the button again.',
      });
      return;
    }

    const el = findLumioElement(doc);
    if (!el) {
      setCheck({
        kind: 'fail',
        text: 'I cannot find the word Lumio on the page yet — make sure it appears in your HTML.',
      });
      return;
    }

    const style = window.getComputedStyle(el);
    const weight = Number.parseInt(style.fontWeight, 10);
    const bold = Number.isFinite(weight) && weight >= 700;
    if (!bold) {
      setCheck({
        kind: 'fail',
        text: 'The word is there, but it is not bold yet. Try a <b> or <strong> tag, or font-weight: bold in the CSS box.',
      });
      return;
    }

    const color = parseRgb(style.color);
    if (!color) {
      setCheck({
        kind: 'fail',
        text: 'The word is bold — but I could not read its colour. Give it a normal CSS colour like red.',
      });
      return;
    }
    if (!isReddish(color)) {
      setCheck({
        kind: 'fail',
        text: 'The word is bold — now make it red. A CSS rule like color: red; on it will do it.',
      });
      return;
    }

    setCheck({
      kind: 'success',
      text: 'Lumio is bold and red — you styled your first web page. Great work!',
    });
    props.onWin();
  }

  // ---- render ----

  return (
    <GameShell
      title="Web Workspace"
      blurb="Write HTML and CSS, see your page live in a sandboxed preview, and take the Lumio styling challenge."
      modelNote="The preview is sandboxed — your code cannot reach the network or this app's data."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: editors */}
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">HTML</span>
            <textarea
              value={html}
              onChange={editHtml}
              spellCheck={false}
              aria-label="HTML editor"
              className="min-h-[160px] w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-sm leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">CSS</span>
            <textarea
              value={css}
              onChange={editCss}
              spellCheck={false}
              aria-label="CSS editor"
              className="min-h-[120px] w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-sm leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resetAll}
              className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
            >
              <RotateCcw className="size-4" aria-hidden="true" /> Reset
            </button>
            <button
              type="button"
              onClick={checkPage}
              className="press inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <ShieldCheck className="size-4" aria-hidden="true" /> Check my page
            </button>
          </div>

          {/* Checked challenge */}
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="text-sm font-semibold">Challenge (checked, real)</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Make the word <span className="font-semibold">Lumio</span> appear in
              red and bold.
            </p>
            {check && (
              <div aria-live="polite" className="mt-2">
                <p
                  className={cn(
                    'flex items-start gap-1.5 rounded-lg border p-2 text-sm font-medium',
                    check.kind === 'success'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                      : 'border-rose-500/40 bg-rose-500/10 text-rose-600'
                  )}
                >
                  {check.kind === 'success' ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{check.text}</span>
                </p>
              </div>
            )}
          </div>

          {/* Stretch ideas — plain text, clearly not checked */}
          <div className="rounded-xl border border-border bg-background p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Lightbulb className="size-4" aria-hidden="true" />
              Ideas to try — not checked
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
              {STRETCH_IDEAS.map((idea, i) => (
                <li key={i}>{idea}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: sandboxed live preview */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Preview (sandboxed)</span>
          <iframe
            ref={iframeRef}
            sandbox="allow-same-origin"
            title="Preview"
            srcDoc={srcDoc}
            className="h-[420px] w-full rounded-xl border border-border bg-white"
          />
          <p className="text-xs text-muted-foreground">
            The preview updates about half a second after you stop typing. Your
            code runs inside a sandbox — it cannot touch this app or the network.
          </p>
        </div>
      </div>
    </GameShell>
  );
}
