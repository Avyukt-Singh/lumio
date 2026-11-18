# KNOWN_LIMITS.md — Lumio 2.0, chunk 4

Honest list of what chunk 1 does not do, cannot verify, or defers. Every PARITY.md
row that is not Pass traces back to an entry here (master prompt 15.1).

## Platform-forced cuts

1. **No automated tests (platform rule: no test code).** The master prompt requires
   tests as chunk gates (sections 5.3, 11, 12). This environment forbids test code, so
   the following suites are NOT present and must be added when the platform allows:
   - Vitest unit tests for every pure domain function: `quizXpGain`, `streakFrom`,
     `streakMilestone`, `themeAt`, `planDay` (including day-too-full), `questProgress`
     (including import-XP exclusion), `chapterState` unlock chain, `weekKey`
     Monday-start/ISO-year behaviour, `dayKey` timezone behaviour.
   - Importer round-trip test: a prototype `lumio-s1` export imports with XP, days,
     results and settings preserved and unknown keys reported (section 12 chunk-1 gate).
   - Playwright end-to-end: shell opens, theme switches at boundaries, settings round-trip,
     export/import round-trip.
   - axe-core accessibility scan and Lighthouse CI.
   - Mitigation in place: domain logic is written as pure functions with injected time
     (no I/O, DOM or clock access), so the tests above are drop-in. The WCAG contrast
     audit exists as a runnable script: `node scripts/contrast-audit.mjs` — 33/33 pass
     across morning/evening/night.

## Honest scope limits

2. **No backend and no leaderboard in chunk 1.** Accounts, social, leagues, focus rooms
   and cross-device sync are chunk 5 (section 12). Nothing in chunk 1 calls a server.
3. **localStorage, not IndexedDB, yet.** Chunk 1 persists schema-versioned
   `lumio-v2` JSON in localStorage. The append-only event log and IndexedDB
   (Dexie) migration with multi-device merge is chunk 2 (ADR 0002).
4. **5 MB quota risk.** localStorage shares the browser's ~5 MB origin quota. Content
   is small in chunk 1, but uploaded notes or large histories will not fit. Quota
   errors are surfaced to the learner (never silent); IndexedDB removes the risk in chunk 2.
5. **Mascot art gaps.** Only 7 supplied pieces exist. Missing: sad, cool, wink and
   surprised expressions; flying, reading, teaching and backpack poses; the three
   time-of-day wallpaper backgrounds. Nearest-art fallbacks are used and listed in
   ASSET_REQUESTS.md; the owl is never redrawn.
6. **No Hindi or Hinglish yet.** Interface and content are English-only; the profile
   type already reserves `lang`. Hindi/Hinglish and the Devanagari typography
   companion are chunk 4 (typography.csv has no Devanagari pairing — noted in MASTER.md).
7. **No charts yet.** The week strip is a dot strip because charts.csv row 1 forbids
   charts with fewer than 4 data points ("use stat card"). Any future chart must cite a
   charts.csv row (DESIGN.md decision log).
8. **Service worker is basic.** Manifest + app-shell caching only. No versioned offline
   content packs, no update prompt, no push (chunk 2+).
9. **Icons are WebP.** The supplied mascot art and PWA icons are WebP. Supported in
   Chrome, Edge, Firefox and Safari 16+; older Safari (pre-16) will not render them.
10. **Single-route SPA.** One page ("/") switches screens in client state; no deep
    links, no URL history per screen (sandbox exposes one route — ADR 0001).
11. **Real-device / screen-reader / cross-browser testing not performed.** No Android,
    iOS, Firefox, WebKit or assistive-technology pass has been run in this environment.
    A manual test sheet is owed alongside the Playwright suites.
12. **Official links carried over without re-validation.** The four board links come
    from the prototype and are marked VERIFY in INTEGRATIONS.md. They were not
    re-validated in this environment (no network); R1's build-time link checker is owed.
13. **Sample material, not official.** All ported content is Lumio-written sample
    material (provenance "original", reviewStatus "peer_reviewed"), labelled on screen
    as such. It is not official curriculum and must never be presented as official.

## Chunk-2 additions

1. **Read-aloud audio not asserted.** speechSynthesis fires, the sentence highlight
   advances, pause/stop and the saved speed work, and Devanagari text requests a
   `hi-IN` voice. Headless Chromium has no audio hardware, so actual sound cannot be
   verified here. Manual step: on a real device open any chapter, tap Listen, confirm
   audible speech and the moving highlight, then change speed and reload to confirm it
   persists.
2. **Board guide is text-only.** Assessment patterns are written honestly and generically
   per band; official links wait for the build-time link checker (7.2) — Lumio invents
   no URLs. The CBSE Class 11 Physics outline screen ships with the study-tools chunk.
3. **One question type in quizzes.** Chunk 2 ships the prototype's multiple-choice
   format with explanations. The item-type expansion (multi-select, numeric with unit,
   fill-in-the-blank, ordering, matching, hotspot, short answer with rubric) is 7.5
   upgrade work, scheduled with the practice/content-pipeline chunks.
4. **No automated axe run.** The accessibility gate ("axe clean") could not be executed
   in this environment; a full manual audit is in UX_AUDIT.md. Closing step: run
   Lighthouse + axe in any normal browser against `/`.
5. **Read-aloud "Resume" after Stop** restarts the current sentence rather than
   mid-sentence position (speechSynthesis gives no reliable offset). Kind-of parity with
   the prototype's pause/resume; noted honestly.
6. **Flashcards record a reviewed marker only.** Leitner scheduling, due-only rules and
   XP land in chunk 3; the reader cards are practice-only until then and say so on screen.
   (Chunk-3 update: the Games hub runs the full Leitner SRS; the reader's tap-to-flip
   cards remain practice-only by design.)

## Chunk-3 additions

1. **Pyodide downloads at runtime from the CDN.** Python exercises fetch the Pyodide
   0.26.4 runtime (~10 MB) from jsDelivr on first use — the master prompt's
   self-hosted, pinned runtime with integrity checks (Section 7.8 upgrade) is owed;
   until then Python needs internet the first time and says so on screen. Execution
   runs locally in WebAssembly; no code leaves the device. A truly infinite Python
   loop cannot be interrupted mid-run (main-thread execution) — the UI states this
   honestly before the learner runs Python.
2. **Simplified physics/models are stated, never hidden.** Every lab carries its own
   honest note (no drag on projectiles, one-stage rocket with 8% tank mass, ideal
   wires in Circuit Lab, the 10% ecological rule, a decision-stump classifier in the
   AI Labs). The Spaceship low-orbit mission is deliberately unreachable in one
   stage (capped ~8.7 km/s < 9.4 needed) and says so — real rockets stage; the other
   two missions are winnable.
3. **Timed drill announces time only at 30 s and 10 s**, not every second (WCAG
   announcement guidance); an untimed round is always offered (2.2.1).
4. **Draft persistence for code uses utility localStorage** (`lumio-code-drafts`,
   `lumio-web-drafts`), not the event log — learning progress stays in the log,
   scratch code does not. Clearing storage clears drafts; the app says nothing is
   lost that counts toward XP.
5. **Difficulty calibration (1PL/Elo) and FSRS** from 7.6 upgrades are not in this
   chunk; Leitner with authored difficulty ships as the default, as the master
   prompt permits for young learners.
6. **Item pools repeat.** Quizzes and drills draw from the ported chapter question
   sets (2–3 items per chapter), so practice rounds repeat faster than the master
   prompt's large-pool ideal; the prototype had the same limitation.
7. **CodeMirror 6 editor** (7.8 upgrade) is not wired; the code editor is a labelled
   monospace textarea with localStorage drafts. Editor upgrade is owed with the
   content-pipeline/backend chunks.


## Chunk-4 additions (4A + 4B)

1. **Study content stays English.** Chunk 4B translates the interface (nav, Home,
   quests, Planner, Focus, Games, Settings, Guardian, Tools) into Hindi and Hinglish
   with a strict fallback chain (hi -> hi-Latn -> en). Chapter text, questions,
   glossary and explanations remain the verbatim English port; the Settings language
   card says so on screen. Full content translation is a future chunk.
2. **Freeze-granting streak must reach 7.** Freezes exist only after a 7-day streak
   milestone, so the redemption banner was verified at the domain level and by type
   checking rather than a live end-to-end run (documented in PROGRESS.md).
3. **Read-aloud audio is still unverified on real hardware.** Headless Chromium fires
   `synthesis-failed` honestly (the UI shows the error state). The pause/resume/stop
   state machine was verified with a synthesiser stub in the agent browser; real-device
   audio check remains a manual step.
4. **YouTube embeds use youtube-nocookie with no sandbox attribute** (embeds require
   the frame origin). Only validated 11-character ids from youtube.com / youtu.be URLs
   are ever embedded; every other host is refused with an honest message. YouTube may
   still set its own cookies during playback — the screen says so.
5. **Notes are plain text by design.** .md files are accepted but rendered as plain
   text (never parsed to HTML) — rendering is XSS-safe by construction; uploads are
   additionally sanitised (control chars stripped, HTML-significant chars escaped,
   200 KB cap, 50-note cap).
6. **Mock XP is once per day for recording one mock**; extra same-day mocks are stored
   without XP. Scores are self-reported and never validated against real papers.
7. **The worksheet answer key prints on a separate page** via CSS page breaks; print
   output was verified through the DOM and print CSS, not on physical paper.
8. **i18n fallback chain is strict but honest:** missing Hindi keys fall through to
   Hinglish, then English; a handful of dynamic status messages (focus recovery,
   strict-void, upload errors in the Tools screen) are English-only in this chunk.

## Chunk 5A (accounts and email OTP) additions

1. **Real SMTP is FAKE-ONLY in this sandbox.** The `smtp` adapter (nodemailer)
   is implemented and typed, but no real provider credentials or outbound
   network are available here, so only the `console` fake adapter was
   exercised end-to-end (dev outbox + browser flows). A manual setup with
   copy-paste `.env` blocks and a curl smoke test is in `docs/EMAIL_SETUP.md`.
2. **The rate limiter and ticket/outbox state are in-memory (per process),
   not durable.** The platform stack specifies local memory caching only;
   restarting the server resets the hourly send caps and invalidates the dev
   AUTH_SECRET (dev sessions/OTPs reset too). This matches the free-tier
   single-instance reality and is honest in the capability table.
3. **The dev outbox is exposed at `GET /api/dev/outbox` only when
   `NODE_ENV !== 'production'` AND the console adapter is active.** It
   contains full message texts — that is its purpose (demos and verification)
   — and it cannot leak in production because the route 404s there.
4. **Session slide-window refresh happens on request** (at most once per
   hour); there is no background sweeper. Expired OTPs and sessions are
   pruned opportunistically on each send.
5. **Accounts never gate the learning loop.** With the server unreachable the
   badge shows "Accounts are unavailable right now. Everything else works."
   and every local feature keeps running (verified with network-blocked
   browser session).
6. **`next-auth` remains installed but unused** (ADR 0004); removal is a
   later cleanup, deliberately not mixed into this chunk.

## Chunk 5B — AI features (Phase 2) honest limits

1. **LLM status is FAKE-ONLY.** The gateway (`src/lib/ai/`), budgets, safety
   layers and every feature were verified end to end with the deterministic
   labelled fake adapter (curl evidence + agent-browser evidence in
   PROGRESS.md). No real free provider was exercised: this environment has
   outbound network but no API key. `docs/AI_SETUP.md` holds the per-provider
   setup + one-line smoke tests; run them and upgrade the INTEGRATIONS row to
   `VERIFIED` before production.
2. **The second-independent-solve check is vacuous under the fake.** The
   practice generator's STEM-accuracy guard re-solves each generated item with
   a fresh model call; the fake solver fixture echoes the provided key, so the
   check only becomes real with a real provider. The alpha-numeric checks
   (schema validation, answer-index range, output policy) are real.
3. **The per-IP hourly limiter is in-memory** (globalThis), like all rate
   state in this deployment — restarting resets it, and proxies sharing an IP
   share a bucket. Per-user/day and global caps live in SQLite (`AiUsage`) and
   survive restarts.
4. **Quota days are UTC** (`aiDayKey`) — the deployment-wide ledger must be
   stable regardless of learner timezones; a learner near UTC midnight may see
   their budget reset slightly off local midnight.
5. **Crisis helpline: Tele-MANAS 14416** (Govt of India, 24x7). Verified at
   build time (2026-02) via a government-domain search result containing the
   number; re-verify before release. If it cannot be re-verified, remove the
   number and keep the supportive text (the code already has a
   `HELPLINE_VERIFIED` switch and a number-free copy variant).
6. **Daily Coach line is template-only** (Tier 3 optional "AI-rephrased"
   variant was deliberately not built — the deterministic template is honest
   and costs nothing).
7. **Voice dictation (Study Buddy mic) depends on the browser's
   SpeechRecognition** (Chrome-family). Headless/Firefox get an honest
   "not supported in this browser" toast; audio, when supported, is processed
   by the browser vendor — stated in the UI (`ai.dictationNote`).
8. **Streaming fallback**: Study Buddy streams over SSE; if the stream fails
   before any token the client shows the calm error copy with a retry — there
   is no automatic non-streamed second call (the gateway itself already falls
   back to the labelled fake when a real provider is down).
9. **The service worker caches app bundles** (cache `lumio-v2-5a`); after a
   code deploy, returning users may need one extra reload to pick up new JS.
   `/api/*` (including all AI routes) is never cached.
10. **AI practice never grants XP/streak/mastery/SRS** — verified by XP total
    unchanged after answering generated items (browser evidence). Saved AI
    notes/practice live in `state.aiContent` via `ai-generated` events (cap
    30, deduped, replay-safe) and are labelled practice-only.

## Chunk 6 additions

1. **Physics practical list not captured** — the supplied scanned book did not
   include the practical list, so the Physics Practical tab shows an honest
   "Practical list not added yet" note (`practicalNote`) instead of invented
   experiments. Adding the real list means adding data (`class11.ts`), not code.
2. **Syllabus tracker is CBSE Class 11 only.** Other classes/boards see no
   Syllabus nav item (`syllabusForProfile` returns null — no dead items). The data
   layer accepts future datasets by adding data, not code.
3. **AI refinement is FAKE-ONLY** in this environment (no provider key; same as
   chunk 5B). Under the fake, the "refinement" echoes the deterministic
   candidates the route pre-computed; the real model path, validator and fallback
   are live code behind the same interface.
4. **Exam urgency uses one shared date** (see ASSUMPTIONS 16) — per-subject exam
   dates are not in the profile yet.
5. **Maths unit-level weightage only** — the CBSE document gives no chapter-wise
   weightage for Maths, so chapter-level "high marks" hints come from unit marks
   (grouped equally across a unit's chapters by the planner's share calculation).
6. **AI Part A topics are unit-level only** (see ASSUMPTIONS 17).

## Chunk 5-AI limits (honest status)

- **Streaming is chunked, not token-live.** The z-ai SDK completion API returns
  the finished answer; `/api/ai/chat` emits it in sentence-sized SSE chunks.
  The client reader is unchanged. Swap to token-live when the SDK supports it.
- **Under the labelled fake**, the independent re-solve accuracy check stays
  vacuous (the fixture echoes the key) — with `AI_PROVIDER=zai` it genuinely
  re-solves and drops disagreeing items (observed: 2/5 quiz items, 1/6 mock
  items dropped in verification runs).
- **Real-model shape drift is normalised, not guaranteed.** The normalisers
  map the shapes observed during verification; a wholly new shape fails the
  schema and the surface shows the calm fallback + authored content.
- **AI-quiz XP is capped at 40/day** (`AI_QUIZ_XP_DAILY_CAP`), improvement-only,
  with a per-chapter best across all generated sets. Authored chapter quizzes
  remain the uncapped path.
- **Photo OCR is never auto-saved** — the learner must pass the editable
  "Check the extracted text" step; illegible words arrive as `[?]`, not guesses.
- **Not built in 5-AI (no dead UI shipped):** AI game rounds (feature 10),
  Code Lab AI exercises with server-validated reference solutions, labs
  feedback on LabReport/PredictFirst, TTS route, ASR voice input,
  image-led lessons, video transcripts, semantic search (Tier 3 + 5-AI-4).
  Each will land as a vertical slice with the same fallback+label contract.
