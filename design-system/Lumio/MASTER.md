# Lumio — Design System (MASTER)

> Generated for the Lumio 2.0 capstone build (chunk 1). Evidence base: the supplied
> UI UX Pro skill CSVs (`ui-reasoning.csv`, `colors.csv`, `typography.csv`,
> `charts.csv`, `ux-guidelines.csv`). The pack's `scripts/search.py` was NOT supplied,
> so every decision below cites the CSV row read directly (per master prompt 2.3:
> never fabricate skill content; label the fallback).

## Product

Gamified learning app for Indian school students (Nursery–Class 12), exam droppers and
post-Class-12 learners. Three density profiles of one system. Offline-first, AI-free.

## Overall pattern & style

- Evidence: `ui-reasoning.csv` row 9 (Educational App) — Recommended_Pattern
  **Feature-Rich Showcase**; Style_Priority **Claymorphism + Micro-interactions**;
  Key_Effects **Soft press (200ms) + Fluffy elements**; Decision_Rules
  `if_gamification → add-progress-animation`, `if_children → increase-playfulness`;
  Anti_Patterns **Dark modes + Complex jargon**.
- Supporting rows: 103 (Flashcard & Study Tool: multi-layer shadows, spring bounce,
  prioritize-clarity, optimize-touch-targets), 152 (Kids Learning: multi-layer shadows,
  spring bounce), 43/78 (course/language learning: progress-tracking is a must-have),
  121 (Trivia & Quiz: high-energy treatment — applied to the games hub only, not the
  young home screen), 107 (Timer & Pomodoro: minimal, high-contrast — applied to Focus).
- **Conflict recorded:** row 9 lists Dark modes as an anti-pattern, but the brand lock
  requires a night theme. Brand wins for the night theme; row 9's remaining guidance
  (playful colours, clear hierarchy, soft press ~200 ms) is applied to light themes.

## Colour (per theme; role structure from colors.csv)

Role structure taken from `colors.csv` (columns: Primary, On Primary, Secondary,
On Secondary, Accent, On Accent, Background, Foreground, Card, Card Foreground, Muted,
Muted Foreground, Border, Destructive, On Destructive, Ring) and re-mapped per theme:

| Theme | Source | Primary / On | Secondary / On | Accent / On | Background / Foreground |
| --- | --- | --- | --- | --- | --- |
| morning | row 9 + brand seed | #4F46E5 / #FFF | #7C3AED / #FFF | #EA580C / #000 | #F4F3FF / #1D1B3A |
| evening | brand seed | #C23B27 / #FFF | #9A3AB8 / #FFF | #B4230F / #FFF | #FFF1EA / #3A1D1D |
| night | brand seed | #6C8CFF / #0F1024 | #A78BFA / #0F1024 | #FFB59D / #3A1D1D | #0F1024 / #ECEBFF |

- Rows 9 and 103 agree with the brand-lock seeds #4F46E5 and #7C3AED (recorded in the
  Decision Log; no invented hex for identity colours).
- Night buttons use dark text on bright primaries — fixes the prototype's
  white-on-bright AA failure (audited: scripts/contrast-audit.mjs, 33/33 pass).

## Typography

- School/adult: `typography.csv` row 13 (Friendly SaaS — Plus Jakarta Sans) — matches
  the brand sheet; body set in Inter per brand lock.
- Young band: `typography.csv` row 45 (Kids/Education — Baloo 2 + Comic Neue) — applied
  from chunk 2 when per-band type ships (row 6 Fredoka + Nunito is the rejected
  alternative).
- Accessibility comfort option: row 48 (Atkinson Hyperlegible) — planned for Settings.
- **Devanagari gap (confirmed):** typography.csv has no Devanagari pairing. Noto Sans
  Devanagari will be added as a labelled provisional companion in chunk 4 (i18n).

## Density profiles (master prompt 6.2)

- young `--density 3 --motion 6` → 56 px targets, 18 px base, spacious
  (the search script was unavailable; values from the master prompt's own dial spec).
- school `--density 5` → 44 px targets, 16 px base.
- adult `--density 6 --motion 3` → 44 px targets, 15 px base, compact.

## Effects & motion

- Soft press ~200 ms on all interactive elements (row 9).
- Progress animations on gamification surfaces (row 9 `if_gamification`).
- Multi-layer shadows + spring bounce on cards in the young profile (rows 103/152).
- Focus screen: minimal, no decoration (row 107).

## Anti-patterns to avoid (rows 9/103/121/152 + 6.6)

Dark modes for young learners' default view (night theme is an explicit brand-locked
exception), complex jargon, inconsistent styling, poor contrast, muted low-energy games
hub, boring no-gamification course screens, emoji as functional icons, default
gradient-card dashboards, mascot on every card.
