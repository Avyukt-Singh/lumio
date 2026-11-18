# RESUME — paste into a fresh chat to continue the Lumio 2.0 build

> I am resuming the Lumio 2.0 capstone build. The master build prompt is at
> `upload/Lumio 2.0 Master Build Prompt (Capstone).md`; the prototype is extracted under
> `upload/extracted/project/lumio/` and the UI UX Pro skill CSVs under
> `upload/extracted/skill/UI UX Pro Skill/`. First read `PROGRESS.md` and `docs/` in the
> repository (especially `docs/PARITY.md`, `docs/DESIGN.md`, `docs/ASSUMPTIONS.md`,
> `docs/ADR/`). Chunks 1 to 4 are fully done (4A: scheduler/mocks/focus/quests/freezes;
> 4B: study tools, guardian summary + privacy dashboard, Hindi/Hinglish i18n; 4C: XP &
> Streak dashboard, Streak Saver system, XP rule set, session-done XP) and must not
> be rebuilt or re-scaffolded. Continue with chunk 5 (backend-lite: accounts, social,
> league, rooms, sync, ranked play) following Section 12 of the master prompt and the
> chunk protocol. First reply with your understanding of the current state: last completed
> chunk, what is built, what is next.

## State summary (for the resuming agent)

- **Stack deviation (do not "fix" back):** the platform mandates Next.js 16 App Router,
  TypeScript, Tailwind 4, shadcn/ui, bun, and a single visible route `/`. All screens are
  client-side switched inside `src/components/lumio/LumioApp.tsx`. See `docs/ADR/0001`.
- **Storage (chunk 2):** append-only event log in IndexedDB (Dexie, db name `lumio-v2`,
  tables `events` + `meta`) is the source of truth. All mutations go through
  `dispatch(event)` in `LumioApp.tsx` → `appendEvent` → `applyEvent` → `projectState`.
  localStorage `lumio-v2` holds a projected snapshot mirror (boot, export, fallback).
  The chunk-1 snapshot migrates via a one-time `bootstrap` event. See `events.ts`,
  `db.ts`, ADR 0002.
- **HARD RULE (LumioApp.tsx):** every derived value (`tz`, `calm`, `theme`, `density`,
  and anything else) is declared ABOVE every `useEffect`. Violating this ordering
  produces a real temporal-dead-zone ReferenceError — it has bitten twice.
- **Domain rules** are pure functions in `src/lib/lumio/domain.ts` (time is injected):
  XP-for-improvement, streaks, chapter states, day planner (now commitment-aware),
  quests, 17 achievement rules, theme engine. `scripts/contrast-audit.mjs` must keep
  passing 33/33.
- **Content** is the verbatim prototype port in `src/lib/lumio/content.ts` with a
  provenance header; it must stay untouched. Reader material (key points, glossary
  picks, flashcards) is derived by pure functions in `chapterContent.ts`.
- **Quiz mechanics:** XP = max(0, score − prevBest) × 10 + one-time 20 on first scored
  attempt; a day counts only when XP > 0; wrong answers keyed by stable
  `${chapterId}#${questionIndex}` ids and stored in `state.wrong`.
- **Chunk-3 additions (do not rebuild):** the Games screen hosts the Practice engine
  (Leitner SRS in `state.srs`, weak-topic hub from `state.wrong`, timed drill, adaptive,
  mixed revision, legendary, error lab, mistake notebook in `state.mistakes`) and 23
  band-gated games/labs in `src/components/lumio/games/` (shared `GameShell`, registry
  `gamesForBand`). XP-once is enforced in `applyEvent` via ledger refs (`game-<id>`,
  `practice-<kind>#<date>`, `practice-legendary`). Coding Lab: Python-only (8 Pyodide
  exercises; JS worker removed in a user-directed revision). The desktop sidebar is a
  full-height rail pinned to the left viewport edge (Shell root is `md:flex-row` — do
  not revert to `flex-col`). Games are subject-filtered by the learner's chosen
  subjects with a "Show all games" toggle.
- **Chunk-4A additions (do not rebuild):** the Planner screen (7-day plan, per-session
  reschedule via `planOverrides` + `rescheduleOptions`, month calendar via `monthCells`,
  RFC-5545 `.ics` export via `buildIcs`/`zonedMinutesToUtc`, comp-subject pairing via
  `subjectForSession`); the Focus screen (timestamp-only Pomodoro, run persisted in
  `lumio-focus-run` with closed-app recovery, strict mode voids on tab hide, auto-start,
  XP 5/block capped 4/day in `applyEvent`, procedural Web Audio in `focusSounds.ts`,
  7-day analytics from `state.focusLog`); self-reported mocks (`state.mocks`, +10 XP
  once/day, weak chapters feed `weakTopics`); the full 8-quest set in `domain.QUESTS`;
  streak freezes (`state.freeze`, +1 per 7-day milestone granted in `projectState`,
  redeemed from Home via `freeze-used`, `streakFrom` shields spent days). New nav ids:
  `planner`, `focus` (Shell `ScreenId`).
- **Chunk-4D additions (do not rebuild):** 20 Class 11 labs in
  `src/components/lumio/games/class11/` (senior/dropper bands, XP 25 each in
  `domain.GAME_XP`), each with a `PredictFirst` prompt, a `ChapterRef` NCERT pointer and
  a `LabReport` observation table (all in `class11/shared.tsx`). Registry ids: projplay,
  friction, shm, vernier, titration, gaslaws, periodic, salt, unitcircle, conic, permcomb,
  limits, numsys, logic, pytrace, sorting, dtree, traincls, bias11, dataclean. PythonTracer
  hosts a tiny Python-subset interpreter (its tokenizer needs ':' in OPS1). Timer effects
  must call completion callbacks from timer/event callbacks — never synchronously inside
  an effect body (react-hooks/set-state-in-effect lint rule).
- **Chunk-4B additions (do not rebuild):** i18n lives in `src/lib/lumio/i18n.ts`
  (~150 keys; strict chain hi -> hi-Latn -> en via `t()`/`tFor`; `questTitle`/`questDesc`
  map quest ids to keys) applied in Shell (takes a `lang` prop), Home, Settings (new
  Language card dispatching `profile-patched`), Planner, Focus, Games, Practice header.
  Noto Sans Devanagari is paired via `--font-devanagari` + `html.lang-hi` (1.75 line
  height). Study Tools screen: worksheet generator (`.print-area` print CSS, answer key
  page break), note upload (sanitised plain text via `sanitizeNoteText`, 200 KB / 50
  caps, never HTML — XSS-safe), Study Video (`youtubeIdFromUrl` validation only,
  nocookie embed). Guardian screen: consent-gated read-only summary + privacy dashboard
  (export / clear-drafts / reset). Reader read-aloud: idle/playing/paused + `resumeIdx`
  (Pause exact via speechSynthesis.pause; Stop keeps the sentence; Resume continues).
  State gains `notes` + `videos` (events note-added/removed, video-added/removed,
  profile-patched bounded to language). Nav ids `tools`, `guardian`. HARD RULE unchanged:
  derived values above every `useEffect`.
- **Chunk-4C additions (do not rebuild):** the XP & Streak dashboard lives in
  `src/components/lumio/screens/XpStreak.tsx` (nav id `xpstreak`, always reachable; the
  Home hero XP pill links to it for mobile where the bottom bar caps at 5). XP rules in
  `domain.ts`: `quizXpBreakdown` (base 15 + 10/improved question + 10 at 80%+ / 25 at
  100%; a retake that does not beat the best pays ZERO — anti-farm), lab first-clear
  bonus +10, planned-session XP 10 + 5 on-time (`session-done` event, XP once per
  `date#index`, only markable after the slot starts — Home/Planner "Done" buttons),
  `levelInfo` (100+50·(n−1) curve), daily goal 50 XP. Streak Savers extend the old
  freeze: cap 3, earn rules = 7-day milestone (unchanged), 150 activity-XP per ISO week,
  90%+ quiz or lab pass (once per week), full schedule week (`sessionDone` count vs
  `plan.sessions × 7`) — evaluated in `projectState`, marked per week key. Purchase
  fallback: `saver-bought` costs 100 XP via a NEGATIVE 'purchase' ledger entry —
  `totalXp`/`xpOn` sum the ledger RAW (do not re-add the old `Math.max(0, amount)`
  clamp; purchases would become free). Earn/use/purchase toasts fire from `dispatch`
  via `use-toast`. State gains `sessionDone`; `FreezeState` gains
  `weekXp`/`weekScore`/`weekPlan`/`bought`. HARD RULE unchanged.
- **Chunk-5A additions (do not rebuild):** custom email-OTP auth (ADR 0004 —
  next-auth deliberately unused). Server: `src/lib/auth/*` (scrypt passwords
  with maxmem 64 MiB, SHA-256-hashed session tokens in cookie `lumio_session`,
  HMAC OTPs 10-min/5-attempt/60s-cooldown/hourly caps, HMAC reset tickets,
  single-use recovery codes, anti-enumeration responses, Origin check) +
  `src/lib/email/*` (console fake default + nodemailer smtp, dev outbox at
  GET /api/dev/outbox when NODE_ENV!=production and console mode). Client:
  `src/lib/lumio/accountClient.ts`, `src/components/lumio/account/*`. UI
  strings live under `account.*` i18n keys in EN/HI/Hinglish. HARD RULES:
  cross-route server state MUST sit on globalThis (Next dev compiles routes
  separately — module state is not shared); `/api/*` is never cached by
  `public/sw.js` (cache `lumio-v2-5a`); accounts never gate the learning loop
  (probe is post-hydration, unreachable server => honest "unavailable"
  badge). Signed-in user id is mirrored into Dexie meta `account-user-id`;
  `localStorage['lumio-account-last']` powers the never-merge-silently device
  prompt. Next: chunk 5B (friends, league, rooms, sync, ranked play).
- **Platform rule:** no test code can be written in this environment (ADR 0003). Do not
  claim tests exist; keep domain logic pure so suites can be added later.
- **Chunk gate:** end of every chunk requires updated `PROGRESS.md`, `RESUME.md`,
  screenshots in `docs/shots/`, honest PARITY delta, and a pause for the user's
  explicit "continue".- **Chunk-5B additions (do not rebuild):** Phase 2 AI behind server-only
  gateway `src/lib/ai/*` (fake adapter default — real providers via
  AI_PROVIDER=openai-compatible, three env lines; fallback chain; callExternal
  timeout/retry/taxonomy). HARD RULES: AI needs verified sign-in + `aiEnabled`
  opt-in (minors = young/middle/sec by ACCOUNT ageBand + guardianConsentAt);
  budgets = `AiUsage` table (user/day, tokens/day, global/day, UTC day key) +
  in-memory IP/hour buckets on globalThis; cache by content hash for
  non-personal gens. Cross-route server state (IP buckets, response cache)
  sits on globalThis — same rule as auth. AI practice NEVER grants
  XP/streak/mastery/SRS; saved results go through the `ai-generated` event
  (`state.aiContent`, cap 30, dedupe by id). Prompts are versioned files in
  `src/lib/ai/prompts/*.v1.ts` (bump version, never edit v1 in place). Client
  uses `aiApi` (`src/lib/lumio/aiClient.ts`, never-throw) + SSE reader for
  chat. AI text renders ONLY through `AiMarkdown` (react-markdown
  allowedElements, no images/links/HTML). Crisis disclosures short-circuit
  server-side to the deterministic Tele-MANAS reply (no model call, no
  budget cost). Status FAKE-ONLY — real-provider checklist in
  `docs/AI_SETUP.md`. Next up (unchanged): chunk 5 backend-lite was PARTLY
  absorbed by 5A/5B accounts; remaining chunk-5 social (friend codes, league,
  rooms, sync, ranked) still open.
- **Chunk-5-AI additions (do not rebuild):** REAL AI via `AI_PROVIDER=zai`
  (`src/lib/ai/zai.ts` — z-ai platform SDK, backend-only; same StreamingAdapter
  contract; `zaiVision` for OCR). New routes `/api/ai/{lesson,quiz,worksheet,
  mock,coach,guardian,ocr}` + versioned prompts (`lesson|quiz-gen|worksheet|
  mockpaper|coach|guardian.v1.ts`) each with a shape-normalising
  `z.preprocess` (real models drift — normalisers map observed shapes, clamp,
  drop unusable items; gateway tryParse logs schema issues in dev). New events:
  `ai-content-saved`/`ai-content-removed` (30-cap), `ai-quiz-attempted`
  (improvement XP via `aiQuizBest` per chapter across ALL sets + hard daily cap
  `AI_QUIZ_XP_DAILY_CAP=40`, ledger source `aiquiz`). UI: AiLesson (Reader,
  full/simpler/example/translate), AI fresh quiz (Quiz.tsx, difficulty +
  misses-driven, `ai:<hash>#<idx>` ids), AI worksheet mode (StudyTools, answer
  key + marking scheme), AiMistakeCard suggestedTag confirm + 3-on-this-slip,
  `/api/ai/ocr` + photo scan with mandatory check step, AiMockPaper (grade →
  existing mock-recorded flow), AiCoachPanel (Planner why/reflect, aggregates
  only), AiGuardian (consent-gated aggregate narrative), honest AI status chip
  in the Shell header (`aiStatusSlot`). HARD RULES unchanged: content.ts +
  domain.ts untouched; AI never grants XP directly; every AI surface labelled
  (AiBadge/AiLabel/AiMarkdown); gating = verified account + aiEnabled (+ guardian
  consent for minors). Open: 5-AI-4 (game rounds, code-lab AI exercises, labs
  feedback) + Tier 3 (TTS/ASR/image lessons/video/semantic search).
