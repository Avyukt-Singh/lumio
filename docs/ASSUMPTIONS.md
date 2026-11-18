# ASSUMPTIONS.md — Lumio 2.0, chunk 1

Numbered assumptions recorded under operating rule R11. Each one states what was
assumed, why, and when it will be revisited. Nothing here is a verified fact; the
verified state is in PARITY.md and KNOWN_LIMITS.md.

1. **Single-route SPA adaptation.** The sandbox exposes exactly one route, so Lumio
   renders as one Next.js App Router page ("/") that switches screens in client state
   (SPA-style) instead of React Router paths. Screen keys mirror the prototype
   (`home`, `study`, ...). Consequence: no deep links or URL-per-screen in chunk 1.
   See ADR 0001.

2. **localStorage over IndexedDB in chunk 1.** The master prompt (5.4) requires an
   append-only event log in IndexedDB (Dexie). Chunk 1 ships schema-versioned state
   under `localStorage["lumio-v2"]` with export/import, and the event-log + IndexedDB
   migration is planned for chunk 2. The schema version field (`schema: 2`) exists so
   the migration has a stable source. See ADR 0002.

3. **No backend in chunk 1.** The prototype server's roles (accounts, social,
   leaderboard, sync) are chunk 5 per master prompt section 12. Chunk 1 is fully
   local-first; nothing calls a server.

4. **Automated tests are cut by platform rule.** This environment forbids test code.
   Domain logic is therefore written as pure functions (no I/O, DOM or clock access)
   ready for Vitest/Playwright when the platform allows. The WCAG contrast audit
   exists as a runnable script (`scripts/contrast-audit.mjs`, 33/33 pass). The exact
   unmet gates are listed in ADR 0003 and KNOWN_LIMITS.md.

5. **Time zone default Asia/Kolkata.** Per master prompt 5.6 the learner's IANA zone
   is stored in the profile (`tz`); until a full onboarding wizard exists (chunk 2),
   new profiles and legacy imports get the default `Asia/Kolkata`. Day keys are
   computed with `Intl` and an explicit zone; weeks are Monday-start ISO weeks.

6. **Onboarding-lite now, full wizard in chunk 2.** Chunk 1 ships a light first-run
   (enough to feed Home with real data) persisted as a draft; the fully validated
   per-learner-type wizard from prototype 3.3 is chunk 2 scope.

7. **Sample content is labelled.** All chapters, questions, glossary, coding
   exercises, the 34-subject catalogue, state capitals, spelling words and the CBSE
   Class 11 Physics outline were ported verbatim from the prototype. Provenance is
   "original" (Lumio-written sample material, 2024-2025) and reviewStatus
   "peer_reviewed"; screens label it as sample material, never as official. The CBSE
   outline states facts from CBSE's own listing with a link-out only (no copied board
   material, R14).

8. **Official links: only the four validated ones.** Only the four board links carried
   from the prototype are present. No link was invented. They are NOT re-validated in
   this environment and are marked VERIFY in INTEGRATIONS.md (R1/R10).

9. **Fonts self-hosted at build time.** `next/font` bundles Plus Jakarta Sans and Inter
   into the build output (no runtime Google Fonts fetch). This satisfies the gap-table
   requirement (self-hosted, privacy, offline after first load) within the sandbox's
   framework; a subsetted/`font-display: swap` pipeline is the chunk-2 refinement.

10. **Quest design decision: plan-review daily quest.** The prototype computes quests
    from real activity; the full quest engine is chunk 4. Chunk 1 ships three real
    quests: daily "Ready for today" (review the plan, +10 XP), weekly "Weekly rhythm"
    (learn on 3 days, +30 XP), monthly "Monthly momentum" (earn 100 XP from
    activities, +60 XP). The monthly quest excludes XP from the legacy `import` entry
    and from quest claims themselves, so imported totals never inflate quest progress.

11. **Mascot fallbacks are nearest-art.** Only 7 supplied art pieces exist (owl-icon,
    happy, excited, curious, thinking, cheering, standing). Master prompt 6.3 mappings
    that need missing art fall back to the nearest supplied piece and are logged in
    ASSET_REQUESTS.md. The owl is never redrawn as an approximate SVG.

12. **Chunk 5B (AI) assumptions.** Minor bands = `young | middle | sec` (the
    consent gate and Settings switch both use the ACCOUNT's ageBand, set at
    sign-up, not the local onboarding profile). AI quotas count UTC days.
    Under the fake adapter, hint-ladder/fixture copy is generated from the
    client-supplied chapter metadata (title/subject/keyPoints) — a real model
    receives the same material via the versioned prompt files in
    `src/lib/ai/prompts/`. Plan Coach's fake returns candidate moves derived
    from scheduler-valid `rescheduleOptions` starts supplied by the client;
    the validator still re-checks them, and the real model's suggestions are
    validated the same way.

15. **Syllabus notes are not HTML-escaped** (chunk 6). The prompt asked for "the
   existing sanitiser"; the existing `sanitizeNoteText` escapes HTML-significant
   characters, which would corrupt the learner's own words on screen ("a < b" would
   display as "a &lt; b"). Syllabus notes are only ever rendered as React text
   children (never `dangerouslySetInnerHTML`), so `sanitizeSyllabusNote` strips
   control characters and clamps to 280 chars without escaping. Verified in browser:
   a note containing `<script>alert(1)</script>` renders as inert plain text.

16. **One exam date drives exam urgency for all subjects** (chunk 6). The profile
   stores a single exam date (dropper/school/competitive/target), not a per-subject
   map as the planner input would ideally take. The nearest future date among the
   profile's dates is applied to every syllabus subject; a per-subject date map is
   future work when the profile gains per-subject exams.

17. **AI Part A (Employability Skills) is tracked at unit level** (chunk 6). The
   supplied document lists only the five unit names for Part A; detailed topics live
   on the CBSE website. Each unit is one trackable row with an on-screen note saying
   why; no topics were invented (R1/R8).

18. **Computer Science chapter→topic mapping is Lumio's own** (chunk 6, marked
   VERIFY per the prompt). The supplied CBSE document groups topics by CBSE unit,
   not NCERT chapter; the mapping onto the 11 NCERT chapters follows the appendix
   (A.4) as written and is recorded here as an assumption to verify against the
   NCERT table of contents when browsing is possible.

19. **`not_in_syllabus_doc` topics enter the plan only via the learner's own flags**
   (chunk 6). The prompt keeps CS "Emerging Trends" out of the planner unless the
   learner flags it; scoring gives it weight 0 unless at least one flag is set, then
   a flat base of 10 (`FLAGGED_NOT_IN_DOC_BASE`). It is never excluded from the list.

20. **Physics periods are stored on units, not chapters** (chunk 6). Appendix A.2
   gives periods per unit; `SyllabusUnit` gained an optional `periods` field.

21. **Chunk 5-AI real provider is the z-ai platform gateway** (`AI_PROVIDER=zai`). The
   sandbox provides `z-ai-web-dev-sdk` (backend-only, no key to ship, free in this
   environment — satisfies R2/R8 free-tier rule). It becomes the *real* adapter so the
   real-model path can actually be exercised and verified here; the OpenAI-compatible
   adapter stays documented for self-hosting/other keys, and the deterministic fake
   remains the zero-config default and the universal fallback (ADR 0006).

22. **Tests remain cut by platform rule** (ADR 0003). Chunk 5-AI verification = lint +
   `tsc --noEmit` + contrast 33/33 + browser walkthroughs (agent-browser) + curl
   fail-soft evidence. Structured-output validation is enforced at runtime by Zod
   with the one-repair-then-fallback pipeline, so hostile/malformed model output is
   handled in production code even without a suite.

23. **AI question ids are `ai:<contentHash>#<index>`.** XP for AI-generated quizzes
   flows through the same deterministic XP-for-improvement rules via a dedicated
   `ai-quiz-attempted` event; `applyEvent` enforces a daily AI-quiz XP cap and tracks
   the per-set best so regeneration can never reset "previous best" to farm XP
   (constraint 3: AI output never grants XP directly — the learner's scored attempt
   does, under the same rules as authored quizzes).

24. **Streaming is chunked, not token-live.** The z-ai SDK completion API is
   non-streamed; `/api/ai/chat` emits the finished answer in small sentence chunks
   over the existing SSE path so the client reader is unchanged. Documented in
   KNOWN_LIMITS; swap to token-live if the SDK gains streaming.

25. **Game rounds are text-driven only.** Match the Pictures keeps its authored image
   pairs; AI rounds are generated for Spell the Word, Capital Challenge, History
   Timeline, Number Hop and Fraction Puzzles, validated by the same schemas and
   cached by content hash.

26. **Tier 3 ships TTS first.** Read-aloud via `/api/ai/tts` (1024-char cap,
   client caches per sentence) with the existing `speechSynthesis` Pause/Stop/Resume
   untouched as the fallback. ASR voice input, image-led lessons, video transcripts
   and semantic search stay hidden with honest reasons in KNOWN_LIMITS unless every
   earlier slice is solid.

27. **Guardian narrative is aggregate-only and consent-gated** (reuses the existing
   consent switch): the prompt receives only the numbers already shown on the
   Guardian screen (days, XP, focus minutes, mocks, chapters) — never raw answers,
   notes or free text. Printable via the existing `.print-area` CSS.
