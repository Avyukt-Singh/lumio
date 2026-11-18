# DESIGN.md — Lumio 2.0, chunk 1 (Shell and Home)

Design system evidence base: the UI UX Pro skill CSVs (supplied without
`scripts/search.py`; every decision cites a CSV row read directly — fallback
labelled per master prompt 2.3). Persisted tokens: `design-system/Lumio/MASTER.md`.
This is Decision Log v1 (chunk 1); it grows each chunk.

## Decision Log

| Decision | Evidence (file, row or quote) | Alternatives rejected | Brand-lock reconciliation |
| --- | --- | --- | --- |
| Overall style: Feature-Rich Showcase, Claymorphism + micro-interactions | `ui-reasoning.csv` row 9 (Educational App): Recommended_Pattern "Feature-Rich Showcase"; Style_Priority "Claymorphism + Micro-interactions"; Key_Effects "Soft press (200ms) + Fluffy elements"; Decision_Rules `if_gamification -> add-progress-animation`, `if_children -> increase-playfulness` | Row 121 Trivia & Quiz high-energy style (kept for the games hub in chunk 3 only, not the home screen); row 107 Timer minimal style (reserved for Focus, chunk 4) | Playful colours and clear hierarchy are applied to light themes; the night theme is an explicit brand-locked exception recorded below |
| Morning palette: indigo primaries on light lavender | `colors.csv` row 9 (Educational App) role structure + brand seed; primaries #4F46E5 (primary), #7C3AED (secondary), accent #EA580C; background #F4F3FF / foreground #1D1B3A from the prototype theme seeds (master prompt 6.1) | Sheet A palette (#6C63FF / #00D4FF / #FF6B9D) — rejected: sheet B seeds are the prototype's own and are what row 9/103 align with | Uses brand sheet B seeds verbatim; no invented identity hex |
| Evening palette: warm red-orange on peach | Brand seed from master prompt 6.1 (primaries #C23B27 / #9A3AB8, background #FFF1EA, text #3A1D1D), mapped onto the `colors.csv` role structure | Row 9 morning-style indigo for evening — rejected: prototype identity is warm | Accent token #B4230F chosen from the seed family to pass AA |
| Night palette: bright primaries with dark text | Brand seed (#6C8CFF / #A78BFA, background #0F1024, text #ECEBFF); dark-on-bright primaries fix the prototype's white-on-bright AA failure | Keeping white text on bright primaries (prototype behaviour) — rejected: fails WCAG AA and is the documented prototype defect | **Conflict recorded:** `ui-reasoning.csv` row 9 lists "Dark modes" as an anti-pattern, but the brand lock requires a night theme (6.1). Brand wins; row 9's remaining guidance applies to light themes only |
| Type pairing (school/adult): Plus Jakarta Sans headings + Inter body | `typography.csv` row 13 (Friendly SaaS, Plus Jakarta Sans); Inter body per brand sheet (master prompt 6.1: "Plus Jakarta Sans for headings, Inter for body. Treat as the preferred starting point that the skill may refine") | Row 1 Classic Elegant (Playfair + Inter) — too editorial; row 9 Developer Mono — wrong domain | Row 13 heading font is exactly the brand sheet's heading font; body Inter is the brand lock, kept |
| Type pairing (young band): Baloo 2 + Comic Neue | `typography.csv` row 45 (Kids/Education: "Fun, playful fonts for children. Comic Neue is readable comic style.") | Row 6 Fredoka + Nunito — rejected in favour of row 45, the education-specific pairing | Applied from chunk 2 when per-band type ships (single webfont pair shipped in chunk 1) |
| Accessibility comfort option: Atkinson Hyperlegible | `typography.csv` row 48 (Accessibility First: "Designed for maximum legibility. Excellent for accessibility.") | Keeping only the default pair — rejected: Settings needs a low-vision option | Planned Settings option, not yet shipped (chunk 2) |
| Devanagari companion | `typography.csv` confirmed gap — no Devanagari pairing exists in the pack | None available | Noto Sans Devanagari planned as a labelled provisional companion in chunk 4 (i18n) |
| Icon style: lucide SVG icons, never emoji-as-icons | `SKILL.md` priority table row 4 (Style Selection): Key_Checks "SVG icons (no emoji)", Anti-Patterns "Emoji as icons"; supported by `ux-guidelines.csv` (120 UX rules) | Prototype's emoji icon set — rejected by the gap table (master prompt 4: "Emoji as icons" is a listed weakness) | Prototype emoji usage in nav and buttons is replaced; emoji inside ported *content* strings (e.g. spelling words) is content data, not UI iconography, and is retained verbatim |
| Motion: soft press ~200 ms; reduced-motion equivalent for every animation | `ui-reasoning.csv` row 9 Key_Effects "Soft press (200ms)"; master prompt 6.5 (100–250 ms, one easing family, reduced-motion equivalent) | Row 152 spring-bounce everywhere — applied only to young-profile cards (rows 103/152) | Calm mode (prototype parity) and `prefers-reduced-motion` both disable non-essential motion |
| Navigation: bottom nav with at most 5 items on phones; sidebar on desktop | `ux-guidelines.csv` Navigation category; master prompt 6.2 density table; prototype 3.2 (collapsible sidebar desktop, bottom nav phones) | 6+ item bottom bar — rejected: exceeds the bottom-nav ceiling; hidden hamburger menus for young — rejected by 6.2 "no hidden menus" | Young band sees 4 items (home, study, games, ach) exactly as the prototype |
| Onboarding-lite first run | Master prompt 6.4 (onboarding wizard must exist) — chunk 1 ships a lite first-run draft; full validated wizard is chunk 2 | Shipping nothing until chunk 2 — rejected: Home needs a profile to be fed by real data | Draft state (`draft` in schema v2) keeps partial answers |
| Home dashboard layout: continue card, today's sessions, streak, week strip, quests | Master prompt 6.4 Home spec + prototype 3.2 | Default gradient-card dashboard — rejected by anti-slop 6.6 | Rewards presentation per 6.2: young = frequent, gentle, mascot-led; school/adult = streaks and XP |
| Empty states: mascot-curious | Master prompt 6.3 mapping ("empty states, curious") | Text-only empty states — rejected: loses the mascot's teaching role; mascot on every card — rejected by 6.3/6.6 | Only the supplied art is used; never redrawn |
| Density profiles (three of one system) | Master prompt 6.2 table (reproduced below) | One-size-fits-all UI — rejected by the product definition | Values recorded in MASTER.md (young `--density 3 --motion 6`, school `--density 5`, adult `--density 6 --motion 3`) |
| Quest presentation: three cards (daily/weekly/monthly), claimable once, real activity only | Prototype 3.6 quests (daily, weekly Monday-start, monthly, claimable once for XP) + master prompt 12 chunk-1 scope | Inflated or decorative quest counters — rejected by anti-slop (fake social proof) | Chunk-1 quest set: "Ready for today" (review plan, +10), "Weekly rhythm" (3 days, +30), "Monthly momentum" (100 XP from activities, +60) |
| Streak presentation: count + best + milestone flame at 3/7/14/30/60/100 | Prototype 3.6 streak (learner-local days, best stored, milestones listed) | Countdown-pressure copy for missed days — rejected by anti-slop 6.6 (dark patterns on minors) | Lost-streak copy is gentle with a recovery path; mascot mapping uses thinking (never shaming) until sad art exists |
| Week strip as a dot strip, not a chart | `charts.csv` row 1 (Trend Over Time / Line Chart), When_NOT_to_Use: "Fewer than 4 data points (use stat card)" | A line chart of 7 XP points — rejected: row 1 explicitly forbids charts under 4 points | A dot strip with text values is a stat-card pattern, no chart library needed; no charts ship in chunk 1 |
| Storage: schema-versioned `lumio-v2` JSON in localStorage (chunk 1) | Master prompt 5.4 (event log + IndexedDB) — deviated with ADR 0002; prototype 3.1 (`lumio-s1`, one JSON object) | Dexie/IndexedDB now — deferred to chunk 2 (ADR 0002); Dexie monorepo — superseded by ADR 0001 | Quota errors are surfaced, never silent (gap table, master prompt 4) |

## Accessibility

- Gate: WCAG 2.2 AA (operating rule R6). Colour is never the only status signal; no text under 12 px.
- Contrast: `scripts/contrast-audit.mjs` audits 11 foreground/background pairs per theme
  across morning, evening and night — **33/33 pass at 4.5:1**. Runnable: `node scripts/contrast-audit.mjs`.
  Night-theme buttons use dark text on bright primaries, fixing the prototype's documented failure.
- Focus: visible `:focus-visible` rings in every theme (ring token per theme, audited pair `ring`).
- Touch targets: 44 px minimum (56 px in the young profile), per R6 and skill priority row 2
  ("Min size 44x44px, 8px+ spacing").
- Calm mode: prototype parity — disables non-essential animation; also honours
  `prefers-reduced-motion`. Every animation has a reduced-motion equivalent that keeps its meaning (6.5).
- Keyboard: navigation is keyboard-complete; icon-only buttons always carry labels (skill priority row 1).
- Manual screen-reader and real-device testing has NOT been performed — see KNOWN_LIMITS.md.

## Density profiles (master prompt 6.2)

| | Young (Nursery to 5) | School and dropper (6 to 12) | Adult (above 12) |
| --- | --- | --- | --- |
| Type and targets | Large type, 56 px or bigger touch targets | Standard, 44 px targets | Compact, 44 px targets |
| Navigation | 4 items, icon plus word, no hidden menus | 5 to 6 items, bottom bar on phones | Sidebar on desktop, bottom bar on phones |
| Copy | Very short, picture-led, read-aloud on every screen | Short, direct, exam-aware | Plain, professional, goal-led |
| Rewards | Frequent, gentle, mascot-led | Streaks, XP, leagues | Progress, goals, minimal flourish |
| Motion and sound | Playful but calm; sound off until enabled | Purposeful; reduced-motion respected | Minimal |
| Parent or guardian | Required, simple summary | Recommended or optional | Not applicable |
