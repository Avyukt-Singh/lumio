# UX_AUDIT.md — Lumio 2.0, chunk 2

Manual audit against the UI UX Pro skill (ux-guidelines.csv, ui-reasoning.csv,
accessibility rules in the master prompt 6.4). Automated axe runs are not possible in
this environment (no axe runner available; ADR 0003 covers the test cut) — every item
below was verified manually in Chromium via the agent browser.

## Verified passes

- **Keyboard access:** all interactive elements are buttons/inputs/links; the Radix
  primitives used (Select, Tabs, Switch, Dialog, AlertDialog) provide full keyboard
  operation; skip link present ("Skip to main content").
- **Focus visibility:** `:focus-visible` outline retained globally (globals.css); never
  removed on any control.
- **Semantics & ARIA:** landmark structure (header/aside/main/nav), `aria-current="page"`
  on nav, `aria-pressed` on toggles/cards, `role="alert"` on validation errors,
  `role="status"` on async/plan verdicts, progressbars with value/min/max + labels,
  radio groups for theme choice, disabled buttons carry explanation hints.
- **Touch targets:** density profiles drive `--target` (56 px young / 44 px school and
  adult) via a global rule on buttons, inputs and `[role="button"]`; list rows >= 44 px.
- **Text size:** no text below 12 px (smallest is 12 px `text-xs`).
- **Colour:** 33/33 WCAG AA token pairs across the three themes
  (`scripts/contrast-audit.mjs` re-run after chunk 2). State chips pair soft
  backgrounds with soft-foreground tokens, never raw colour pairs.
- **Charts (7.11):** completion/mastery, subject map (row 19), consistency calendar
  (row 5, printed day-of-month values), XP trend (row 1) — every chart has a
  table/details alternative; the trend hides the bars under 4 active points per the
  row-1 stop rule; no series distinguished by hue alone.
- **Motion:** press/bob/pop animations only, all disabled by calm mode and
  `prefers-reduced-motion`; mascot never animates on success screens when calm.
- **Content:** sample-material labelling on wizard footer, reader source line, board
  guide, progress notes; no lorem ipsum; no dead buttons (games screen explains itself;
  board-guide link row is labelled as arriving with the link checker).
- **Forms:** every onboarding step validates before Next enables; errors are plain
  sentences with `role="alert"`; optional steps offer "Skip for now"; date inputs carry
  `min` set to today.
- **Responsive:** 390 px — no horizontal scroll (390 == 390), bottom nav 5 items max
  with an honest note for overflow keys; 1280 px — sidebar layout.

## Known gaps (honest)

- No automated axe/Lighthouse run (platform limitation). Manual checks above.
- Read-aloud highlight verified visually only while the utterance queue runs in
  headless Chromium without audio hardware; real-device check pending (KNOWN_LIMITS).
- Flashcard flip animation is a state swap (no 3D transition) — deliberate, calm-mode
  friendly; can be upgraded in the chunk-3 practice engine.

---

# Chunk-4 addendum (4A + 4B)

Manual audit, same method (agent-browser Chromium; no automated axe available).

## Verified passes

- **Keyboard & ARIA:** Planner reschedule panels are buttons with descriptive
  aria-labels ("Reschedule session 1 on Sun 15 Nov", "Move session 1 to 5:00 PM",
  "Reset session 1 to its planned time"); month navigation has Previous/Next month
  labels; Focus presets are a radiogroup with aria-checked; the two Focus toggles and
  sound chips carry aria-pressed; the 7-day chart exposes role="img" plus an sr-only
  per-day list as the table alternative; mock chips use aria-pressed; the Guardian
  consent control is a labelled Switch.
- **Forms:** mock date rejects future dates with a role="alert"; video URL errors are
  role="alert"; note size/type errors are status/alert messages; every destructive
  action (reset, note/video removal) sits behind explicit buttons, reset behind an
  AlertDialog.
- **Touch targets:** all new controls min-h-[44px] (reschedule chips, preset chips,
  sound chips, export/print buttons).
- **Responsive:** 390 px — no horizontal scroll re-verified after chunks 4A/4B; bottom
  nav still caps at 5 with the honest "N more tools" note; Planner day cards and the
  Focus analytics stack correctly.
- **Hindi typography:** with `lang-hi` the Devanagari font stack resolves to Noto Sans
  Devanagari first and body line-height is 1.75 (verified computed styles) — matras and
  shirorekha render without clipping; `document.documentElement.lang` switches to "hi"
  for assistive tech.
- **Print:** `.print-area` / `.print-hide` print CSS confines worksheets and the
  guardian summary to paper with black-on-white output.

## Known gaps (honest)

- Headless Chromium has no speech voices: the real onerror path fires honestly there.
  The pause/resume/stop state machine was verified with a synthesiser stub; a real-voice
  device check remains in KNOWN_LIMITS.
- The mock test flow is fully manual (self-report), by design; nothing is inferred.
- Worksheet print output was verified via the DOM/print CSS, not on paper.
