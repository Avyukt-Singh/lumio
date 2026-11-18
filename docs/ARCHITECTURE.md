# ARCHITECTURE.md — Lumio 2.0, chunk 2

Current state of the build and its planned evolution (master prompt section 12).
Deviations from the target stack are recorded in ADR 0001 and ADR 0002.

## Current architecture (chunk 2)

- **Framework:** Next.js 16 App Router (strict TypeScript), React 19, Tailwind CSS 4
  driven by design tokens, shadcn/ui primitives, bun as package manager. Single route
  `/` renders the whole app; screens switch in client state (SPA-style) — ADR 0001.
- **Storage (event-sourced, ADR 0002):**
  - Source of truth: append-only event log in IndexedDB (Dexie, db `lumio-v2`).
    Tables: `events` (`++id, deviceId, clientTime, type, synced`) and `meta` (device id).
  - Every mutation goes through one path: `dispatch(event)` in `LumioApp.tsx` →
    `appendEvent` (adds device metadata, `synced: 0` = pending sync-queue entry) →
    `applyEvent` (pure reducer) → `projectState` (recomputes XP/streak/achievements) →
    state + snapshot mirror in localStorage (`lumio-v2`).
  - Replay = fold over events; the `bootstrap` event is a mid-log checkpoint used for
    imports, resets and the one-time chunk-1 migration.
  - If IndexedDB is unavailable the app degrades to the localStorage mirror and keeps
    working; save errors are surfaced, never silent.
- **Design tokens:** CSS variables per theme (morning/evening/night) x density profile
  (young/school/adult), synced to `<html>` by LumioApp (font-size, body bg, touch
  targets resolve globally). Source of truth: `design-system/Lumio/MASTER.md`.
- **Time:** learner IANA zone stored in the profile; default `Asia/Kolkata`. All day
  keys, ISO weeks (Monday start) and month keys come from `Intl` with an explicit zone.

## Module map

| Path | Role | Status |
| --- | --- | --- |
| `src/lib/lumio/types.ts` | Typed state schema v2 + `LumioEvent`/`StoredEvent` unions, `Commitment`, `QuestionId` | On disk |
| `src/lib/lumio/content.ts` | Verbatim prototype content (provenance header) — never edited | On disk |
| `src/lib/lumio/domain.ts` | Pure domain: dates, theme engine, XP ledger, `quizXpGain`, streaks, chapter states, commitment-aware `planDay`, quests, 17 achievement rules | On disk |
| `src/lib/lumio/chapterContent.ts` | Pure reader-material builders (sentences, key points, glossary picks, flashcards, subject catalogue) | On disk |
| `src/lib/lumio/db.ts` | Dexie layer: events/meta tables, safe wrappers, device id, persistence request | On disk |
| `src/lib/lumio/events.ts` | `LumioEvent` union, pure `applyEvent`, `replayEvents`, `appendEvent`, chunk-1 migration seeding | On disk |
| `src/lib/lumio/storage.ts` | Snapshot mirror, validation, `normalizeState` forward migration, export/import, legacy importer, `resetAllStorage` | On disk |
| `src/components/lumio/LumioApp.tsx` | State owner: async hydration, `dispatch`, theme engine wiring, screen switching, SW update banner. HARD RULE: derived values above all `useEffect`s | On disk |
| `src/components/lumio/Shell.tsx` | Band-aware nav (sidebar + capped bottom nav), header pills + settings gear | On disk |
| `src/components/lumio/screens/Onboarding.tsx` | Full validated wizard, all learner types, guardian step, live schedule preview, pre-filled reopen | On disk |
| `src/components/lumio/screens/Study.tsx` | Study path (4 chapter states) + search + BoardGuide | On disk |
| `src/components/lumio/screens/Reader.tsx` | Notes + Listen (TTS), key points, glossary, flashcards, quiz CTA | On disk |
| `src/components/lumio/screens/Quiz.tsx` | Quiz engine: feedback, explanations, XP breakdown, mastery, celebration | On disk |
| `src/components/lumio/screens/Progress.tsx` | Dashboard: completion/mastery, subject map, consistency calendar, XP trend | On disk |
| `src/components/lumio/screens/Achievements.tsx` | 17 rules with dates/progress | On disk |
| `public/sw.js` | SW v2: offline cache + SKIP_WAITING update handshake | On disk |
| `scripts/contrast-audit.mjs` | WCAG AA audit (33/33) | On disk |
| `src/lib/lumio/syllabus/types.ts` | Chunk 6 syllabus data/marks/plan types, five-state derivation, note/flag sanitisers | On disk |
| `src/lib/lumio/syllabus/class11.ts` | CBSE Class 11 (2026-27) dataset — 5 subjects, 529 stable ids, faithful Appendix A transcription | On disk |
| `src/lib/lumio/syllabus/index.ts` | `syllabusFor` gate (CBSE Class 11 only), topic/chapter helpers, grouped-marks share | On disk |
| `src/lib/lumio/syllabus/progress.ts` | Pure five-state marks + counts + needs-attention derivation | On disk |
| `src/lib/lumio/syllabus/planner.ts` | Pure deterministic daily planner (see scoring constants below) | On disk |
| `scripts/syllabus-audit.mjs` | Dataset audit: unique ids, titles, marks sums, chapter counts, catalogue pairing (run with bun) | On disk |

## Chunk 6: syllabus planner scoring constants

All in `src/lib/lumio/syllabus/planner.ts` as named exports, tuned for prompt
section 5.1. Deterministic: identical inputs always give the same plan
(tie-break by syllabus order, then id).

- `PRIORITY_BASE` — completed-but-not-confident 40, completed+lacks_practice 35,
  in progress 30, not started 20 (+ `nextInOrderBonus` 8), completed unrated 15,
  completed-and-confident 0.
- `FLAG_BONUS` — concept_unclear 12, lacks_practice 10, needs_revision 8,
  formulas/needs_help 6, speed 5, careless 4.
- `MARKS_WEIGHT_MAX` 30 — scaled by the unit's share of the subject's marks
  (`unitMarksShare`; grouped physics units split their group's marks evenly).
- `STALE_AFTER_DAYS` 21 / `STALE_BONUS_MAX` 15 — gentle spaced revision so
  "confident" does not mean "forgotten".
- `EXAM_SOON_DAYS` 30 / `EXAM_MARKS_SCALE` 1.5 — exam-urgency marks scaling.
- `ASSESSMENT_MULTIPLIER` — formative_only ×0.4, advanced ×0.2,
  `not_in_syllabus_doc` ×0 unless the learner flagged it (`FLAGGED_NOT_IN_DOC_BASE` 10).
  Nothing is ever excluded from the list.
- `ACTIVITY_MINUTES` — learn 35, practise 25, revise 15, recall 10;
  `MIN_SLOT_CHUNK` 10; `MAX_ITEMS_PER_SLOT` 4.

The AI refinement (`/api/ai/syllabus-coach`) reorders only these candidates and
is re-validated against them everywhere (unknown ids, duplicates, minutes over
slot, subject mismatch → dropped; all dropped → deterministic plan).

## The purity rule (non-negotiable, master prompt 5.3)

`src/lib/lumio/domain.ts`, `events.ts` (`applyEvent`) and `chapterContent.ts` are
**pure**: no I/O, no DOM, no clock access. Time (`Date`, time zone) is always injected
by the caller. Consequences:

- The tests cut by the platform (ADR 0003) can be added without refactoring.
- Monotonic values (XP, best scores, best streak, achievements) are **derived, never
  set directly** (5.4) — the event reducer computes them, callers only append events.
- `db.ts` is the only module allowed to touch IndexedDB; `storage.ts` the only one for
  localStorage.

## Declaration-order rule (LumioApp.tsx)

All derived values (`tz`, `calm`, `theme`, `density`, …) are declared **above every
`useEffect`**. Effects reference them in dependency arrays, so any effect placed above
its inputs executes in the temporal dead zone. This bit twice (chunk 1 and chunk 2);
keep the rule when extending LumioApp.

## Planned evolution

- **Chunk 3 — playable games:** practice engine on top of `flashcardDays`/stable card
  ids (Leitner boxes 1/2/4/8/16 days, due-only), weak-topic hub from `state.wrong`
  (weights 2/3/1/2/1/2), adaptive practice, drills, error lab, mistake notebook, shared
  game shell, every game and lab, coding labs (JS Worker, Python offline).
- **Chunk 4 — full study tools:** complete scheduler (7-day plan, reschedule, month
  calendar, `.ics`), revision/mocks, Focus suite, full quest engine, study tools,
  guardian summary, Hindi/Hinglish + Devanagari font.
- **Chunk 5 — backend-lite:** minimal accounts, parent link, friends, league, rooms,
  cross-device sync (the `synced: 0` flag already marks the sync queue), optional
  AI-lite integrations.

Each chunk ends with the section 12 protocol: updated PROGRESS.md, RESUME.md,
PARITY.md, demo script and screenshots.
