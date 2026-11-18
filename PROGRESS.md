# Lumio 2.0 — PROGRESS

## Chunk status

| Chunk | Scope | Status |
| --- | --- | --- |
| 1. Shell and Home | Recon, docs, design system, domain, content port, legacy importer, themes, density profiles, Mascot, shell, Home, Settings, PWA basics | **Done** |
| 2. The working quiz loop | Event log + IndexedDB, full onboarding wizard, catalogue, study path, chapter reader, quiz, mastery, XP-for-improvement, progress dashboard, achievements screens, SW update prompt | **Done** |
| 3. Playable games | Practice engine, shared game shell, every game and lab, coding labs | **Done** |
| 4. Full study tools | Scheduler complete, revision/mocks, Focus suite, quests (full), streak freezes, study tools, guardian summary, Hindi/Hinglish | **Done** (4A: scheduler, mocks, focus, quests, freezes · 4B: study tools, guardian summary + privacy dashboard, Hindi/Hinglish i18n) |
| 4C. XP & Streak Dashboard | Level/XP dashboard, 10-week heatmap, XP rule set (quiz base + score bonuses, lab first-clear, schedule session XP), daily XP goal, Streak Saver system (earn rules, cap 3, XP purchase, redemption), XP activity feed | **Done** |
| 4D. Class 11 labs | 20 senior-band labs (4 physics, 4 chemistry, 4 math, 4 CS, 4 AI) with predict-first prompts, NCERT chapter refs and observation tables; wired into the registry + GAME_XP | **Done** |
| 5A. Accounts and email OTP | Custom auth (ADR 0004): scrypt passwords, hashed session tokens, HMAC OTPs, anti-enumeration, lockout, recovery codes, guardian consent, auth UI in-app, console+SMTP email adapters, dev outbox, degradation UX | **Done** |
| 5B. Backend-lite rest | Friends, league, rooms, sync, ranked play, integrations, final docs | Not started |

## Files built so far

### Chunk 1
- `src/app/page.tsx`, `layout.tsx`, `globals.css` — single route, brand fonts, design tokens
- `src/lib/lumio/types.ts`, `content.ts`, `domain.ts`, `storage.ts` — schema, verbatim content, pure domain, storage
- `src/components/lumio/Mascot.tsx`, `Shell.tsx`, `LumioApp.tsx`, `screens/Home.tsx`, `screens/Settings.tsx`
- `public/manifest.webmanifest`, `public/sw.js`, `public/mascot/*.webp`
- `scripts/contrast-audit.mjs`, `design-system/Lumio/MASTER.md`, `docs/*`

### Chunk 2
- `src/lib/lumio/db.ts` — Dexie/IndexedDB: `events` table (append-only log, `synced` flag) + `meta` (device id); localStorage fallback everywhere; persistence request
- `src/lib/lumio/events.ts` — `LumioEvent` union, pure `applyEvent` reducer (bootstrap / onboarding / settings / plan / quiz / quest / plan-review / draft / flashcards), `replayEvents` fold, `appendEvent` with device metadata, one-time migration seeding the log from the chunk-1 `lumio-v2` snapshot
- `src/lib/lumio/types.ts` — Profile v2 fields (academic year, subjects, textbooks, exams, compSub, guardian, dropper/above answers, wake, structured commitments), `Commitment`, `QuestionId`, `wrong`, `themes`, `flashcardDays`, `StoredEvent`
- `src/lib/lumio/storage.ts` — `normalizeState` (forward migration), `resetAllStorage` (clears IDB + mirror), projection normalises before folding (older snapshots replay safely)
- `src/lib/lumio/domain.ts` — commitments-aware `planDay` (blocks subtracted from free windows), achievements +3 (Weekly champion, Monthly master, Any-light learner; 17 rules)
- `src/lib/lumio/chapterContent.ts` — pure reader-material builders: sentences, key points, glossary match, flashcards, class-aware subject catalogue, academic year, interest areas
- `src/components/lumio/screens/Onboarding.tsx` — full wizard (replaces `FirstRun.tsx`, deleted): per-learner-type step machine, every 3.3 validation, structured commitments adder, guardian step by age (required young / default-on middle / optional 9-12), live schedule preview, skip-for-now on optional steps, pre-filled reopen with cancel
- `src/components/lumio/screens/Study.tsx` — study path (locked/available/completed/mastered, connector line), header search, `BoardGuide` (board/class guide, confidence line, honest sourcing)
- `src/components/lumio/screens/Reader.tsx` — notes with Listen (speechSynthesis sentence-by-sentence, hi voice for Devanagari, saved speed), key points, glossary, tap-to-flip flashcards with reviewed marker, source line, quiz CTA
- `src/components/lumio/screens/Quiz.tsx` — one question at a time, per-question feedback with explanation, stable question ids, XP-for-improvement breakdown, mastery labels, kind celebration
- `src/components/lumio/screens/Progress.tsx` — completion vs mastery (charts.csv row 19), subject mastery map, 28-day consistency calendar (row 5), 14-day XP trend (row 1), table alternatives for every chart
- `src/components/lumio/screens/Achievements.tsx` — all 17 rules with unlock dates or live progress, kind copy
- `src/components/lumio/Shell.tsx` — band nav keys (3.2), header settings gear, bottom nav capped at 5
- `src/components/lumio/LumioApp.tsx` — async hydration (replay events → fallback mirror), single `dispatch` mutation path, reader/quiz overlays, SW update banner. HARD RULE: all derived values (`tz/calm/theme/density`) declared above every `useEffect`
- `public/sw.js` — cache v2, `SKIP_WAITING` message handshake for the update prompt

### Chunk 3
- `src/components/lumio/Shell.tsx` — sidebar rebuilt: full-height rail pinned to the very left viewport edge (like desktop apps), collapse to a 68 px icon rail with `sr-only` labels, header now spans only the content column; mobile keeps the bottom nav
- `src/lib/lumio/types.ts` — `SrsCard`, `PracticeKind`, `MistakeTag`, `LEITNER_INTERVALS`; state gains `srs`, `practice`, `mistakes`; events `game-won` (XP-once via ledger ref), `card-reviewed` (Leitner box + due date), `practice-done` (XP once per kind/day), `legendary-completed` (+40 once ever), `mistake-tagged`
- `src/lib/lumio/events.ts` — applyEvent cases for all of the above (replay-safe dedupe)
- `src/lib/lumio/storage.ts` — normalizeState defaults for the new fields (older snapshots replay safely)
- `src/lib/lumio/domain.ts` — `GAME_XP`, `PRACTICE_XP`, `LEGENDARY_XP`, `gameXpGranted`, `practiceDoneToday`, `legendaryDone`, `masteredCount`, `weakTopics` (2/3/1/2/1/2 weights), `dueCards`
- `src/components/lumio/games/GameShell.tsx` — shared game shell: honest model notes, XP-once badge, back navigation
- `src/components/lumio/games/registry.ts` — 23 games/labs with the prototype's band gates (`gamesForBand`)
- `src/components/lumio/screens/Practice.tsx` — practice engine, 8 tabs: Leitner flashcards (due-only session, box promotion 1/2/4/8/16 days, daily XP), weak-topic hub, 60-second timed drill (+ untimed round, 30 s/10 s announcements), adaptive practice (correct → later chapter, miss → same), mixed revision (≥ 2 completed chapters), legendary challenge (2 mastered, +40 once), error-analysis lab (5 worked steps from explanations), mistake notebook (4 tags, re-click clears)
- `src/components/lumio/screens/Games.tsx` — games hub: PracticeHub on top, band-gated game grid with XP-once badges, games open in place
- 23 game/lab components in `src/components/lumio/games/` — Number Hop, Match the Pictures, Spell the Word, Sharp Eyes, Fraction Puzzles, Ecosystem Builder, Pendulum Lab, Capital Challenge (all 28 states + 8 UTs), History Timeline (click-in-order, no drag), Algebra Challenges, Virtual Chemistry Lab (live atom tallies), Genetics Lab (Punnett), Modelling Lab (quadratic max), Budget Planner (50-30-20), Circuit Lab (series/parallel, target current), Projectile Lab (range/height missions), Engineering Lab (beam moments), Dataset Explorer (labelled sample data), Build Your Own Spaceship (rocket equation, prediction required; low-orbit honestly unreachable in one stage), AI Lab (decision stump, train/test gap), AI Fairness Lab (approval-gap mission), Coding Lab, Web Workspace
- `src/components/lumio/games/CodingLab.tsx` — JS runs in a Blob-URL Web Worker (2 s hard terminate, deep-equal tests); Python via Pyodide 0.26.4 from CDN on first use (3 s execution race, honest offline state, main-thread loop warning); 3-level hint ladder (average/maxOf/total_even ported verbatim); drafts in `lumio-code-drafts`
- `src/components/lumio/games/WebWorkspace.tsx` — sandboxed iframe live preview (400 ms debounce), real checked challenge (bold + red-dominant colour via computed styles), drafts in `lumio-web-drafts`
- `src/components/lumio/LumioApp.tsx` — games screen wiring: `winGame`/`reviewCard`/`finishPractice`/`finishLegendary`/`tagMistake` all through `dispatch`

### Chunk 4A
- `src/lib/lumio/types.ts` — `FocusDay`, `MockResult`, `FreezeState`; state gains `focusLog`, `mocks`, `freeze`, `planOverrides`; events `focus-block-done` (XP 5/block capped 4/day enforced in applyEvent), `mock-recorded` (XP once/day), `freeze-used` (inventory-validated), `session-rescheduled` (override or null-clear); `XpEntry.source` gains `mock`
- `src/lib/lumio/domain.ts` — `streakFrom` shields missed days via spent freezes; full 8-quest set (daily plan-review / focus block / cards; weekly 3-days / practice / mock; monthly 100 XP / 8 days) with real-activity progress; `FOCUS_PRESETS` (classic 25/5/15, deep 50/10/20, quick 15/3/10), `FOCUS_BLOCK_XP`, `FOCUS_DAILY_BLOCK_CAP`, `MOCK_XP`, `focusBlocksOn`/`focusXpBlocksLeft`; `planDayWithOverrides`, `rescheduleOptions` (15-min-aligned, commitment- and overlap-safe), `subjectForSession` (comp-subject pairing: odd sessions = compSub, even rotate core daily), `weekDatesOf`, `monthCells`, `zonedMinutesToUtc` (iterative offset, DST-safe), `buildIcs` (RFC-5545, escaped text, UTC instants); `weakTopics` merges mock-marked weak chapters; `subjectPool`
- `src/lib/lumio/events.ts` — applyEvent cases for all four new events (replay-safe: focus ledger id `focus-<date>-<blockIndex>`, mock XP dedupe by date, freeze inventory guard, override maps)
- `src/lib/lumio/storage.ts` — defaults + normalizeState for the four new fields; `projectState` wires `focusBlocks` into the achievements snapshot (Focus starter / Steady focus now unlock) and grants +1 freeze per reached 7-day streak milestone (`freeze.granted` marker prevents replay re-grants)
- `src/lib/lumio/focusSounds.ts` — procedural Web Audio engine: brown noise (integrated buffer), rain (bandpass noise + 0.15 Hz breathing LFO), binaural pulse (200/204 Hz hard-panned sines + 0.1 Hz amplitude LFO); one master gain, try/catch-safe, zero audio files
- `src/components/lumio/screens/Planner.tsx` — .ics export of the next 7 days (Blob download, verified output); 7-day plan with per-session Reschedule (valid-time chips from `rescheduleOptions`, reset to plan default, honest "no free window" state); month calendar (Monday-start, learned/review/focus-minutes markers, today ring); complementary-subject pairing badges
- `src/components/lumio/screens/Focus.tsx` — presets, 4-block cycle strip, timestamp-only timer (1 s tick recomputes `target − (Date.now() − startedAt)`, zero drift), run persisted in `lumio-focus-run` with closed-app recovery crediting blocks completed while away, auto-start toggle (`lumio-focus-prefs`), strict mode voids on `visibilitychange` hidden, XP status with daily cap, ambient sound card (engine above + volume), 7-day focus-minutes chart (tabular-nums, sr-only list alternative)
- `src/components/lumio/screens/Mocks.tsx` — self-reported mock flow: subject chips, date validation (never future), score/total, weak-chapter chips; history list with percentage and weak-topic badges
- `src/components/lumio/screens/Practice.tsx` — hub accepts an extra `mocks` tab node
- `src/components/lumio/screens/Games.tsx` — passes the mock panel through to the hub
- `src/components/lumio/screens/Home.tsx` — streak uses freeze-aware `streakFrom`; freeze inventory pill + "Use freeze" redemption banner for the most recent missed day; Planner and Focus entry points
- `src/components/lumio/Shell.tsx` — `planner`/`focus` nav entries (icon + label) appended after the band nav; mobile bottom-nav note now counts hidden tools
- `src/components/lumio/LumioApp.tsx` — `finishFocusBlock`/`recordMock`/`useFreeze`/`rescheduleSession` dispatch paths; Planner/Focus screens wired into the router; MockTests mounted inside Games

### Chunk 4B
- `src/lib/lumio/i18n.ts` — EN/HI/HINGLISH dictionaries (~150 keys covering nav, common, Home, quests, Planner, Focus, Games, Study, Settings, Guardian, Tools), strict fallback `t()` (hi -> hi-Latn -> en; hinglish -> en), `tFor`, `questTitle`/`questDesc` id-to-key mapping
- `src/lib/lumio/types.ts` — `LearnerNote` (sanitised plain text), `StudyVideo` (validated YouTube id only); state gains `notes`, `videos`; events `note-added`/`note-removed`/`video-added`/`video-removed` (dedupe by id) and `profile-patched` (bounded: language only)
- `src/lib/lumio/domain.ts` — `sanitizeNoteText` (control chars stripped, HTML chars escaped, 200 KB clamp), `sanitizeFileName`, `isNoteExtension`, `NOTE_MAX_BYTES`/`MAX_NOTES`/`MAX_VIDEOS`, `youtubeIdFromUrl` (https only, youtube/youtu.be/shorts/embed/live forms, strict 11-char id), `youtubeEmbedUrl` (nocookie + rel=0)
- `src/lib/lumio/storage.ts` — defaults + normalizeState for `notes`/`videos`
- `src/components/lumio/screens/StudyTools.tsx` — worksheet generator (chapter + count chips, `.print-area` paper preview with ruled lines, answer key on its own printed page, window.print), note upload (extension/size/cap validation, sanitised, expandable plain-text `<pre>` — never HTML), study video (validated URLs only, honest refusals, duplicate guard, nocookie iframe with no-referrer + lazy)
- `src/components/lumio/screens/Guardian.tsx` — consent-gated read-only weekly/all-time summary (days, XP, focus mins, mocks, chapters, freeze-aware streak) wrapped in `.print-area`, print button; privacy dashboard: data inventory, export backup, clear drafts (5 localStorage keys), full reset behind AlertDialog
- `src/components/lumio/screens/Reader.tsx` — read-aloud state machine: idle/playing/paused + `resumeIdx`; exact-position Pause (speechSynthesis.pause), Stop keeps the current sentence, "Resume (sentence N)" + "Start over", honest capability note; stale flashcard paragraph removed (PARITY Partial row resolved)
- `src/components/lumio/screens/Settings.tsx` — new Language card (en/hi/hinglish chips -> `profile-patched`)
- `src/app/layout.tsx` + `src/app/globals.css` — Noto Sans Devanagari paired via `--font-devanagari`; `html.lang-hi` raises line-height to 1.75 (body) / 1.6 (headings) — zero clipping; print CSS (`.print-area`/`.print-hide`)
- `src/components/lumio/Shell.tsx` + `Home/Planner/Focus/Games/Practice` — i18n applied via `tFor(state.profile?.lang)`; Shell takes a `lang` prop and maps nav ids to `nav.*` keys
- `src/components/lumio/LumioApp.tsx` — `tools`/`guardian` screens wired; `addNote`/`removeNote`/`addVideo`/`removeVideo` dispatch paths; `lang` class effect on `<html>` (`lang-hi`/`lang-hinglish`/`lang-en` + `lang` attribute); `onLang` dispatches `profile-patched`

### Chunk 4C
- `src/components/lumio/screens/XpStreak.tsx` (NEW) — the XP & Streak dashboard: level + progress bar (`levelInfo`), XP today/this-week/longest-streak cards, daily-goal ring with "streak-active" label, at-risk banner, 10-week activity heatmap (`heatmapWeeks`, intensity by XP, tz rollover note), Streak Saver inventory (cap icons, earn-rule progress, XP purchase fallback), "How XP works" rule reference, recent XP activity feed (per-source icons, red negative entries, scrollable)
- `src/lib/lumio/domain.ts` — `quizXpBreakdown` (replaces `quizXpGain`: base 15 + improvement + 80%/100% bonuses, anti-farm qualifies rule), `levelInfo` (100+50·(n−1) curve, tier titles), `xpThisWeek`, `xpPerDay`, `heatmapWeeks`/`HeatCell`, `weekKeyOfDate`, `totalXp`/`xpOn` raw-sum semantics (purchase negatives); constants `DAILY_XP_GOAL`, `QUIZ_*`, `LAB_FIRST_CLEAR_BONUS`, `SCHEDULE_*`, `SAVER_*`, `LAB_GAME_IDS`
- `src/lib/lumio/types.ts` — `FreezeState` gains `weekXp`/`weekScore`/`weekPlan`/`bought` (per-week earn markers); `XpEntry.source` gains `'schedule' | 'purchase'`; state gains `sessionDone`; events `session-done`, `saver-bought`; `game-won` gains `lab`/`firstClear`
- `src/lib/lumio/events.ts` — `quiz-attempted` uses the breakdown + grants a score saver at ≥ 90%; `game-won` adds the lab first-clear bonus + lab-pass saver; new `session-done` (XP once per date#index, on-time bonus) and `saver-bought` (cap + balance guarded, −100 XP 'purchase' entry); shared `grantScoreSaver` helper
- `src/lib/lumio/storage.ts` — defaults/normalize for `sessionDone` + saver fields; `projectState` evaluates the weekly-XP milestone and full-schedule-week saver rules per ISO week (below cap only, logged when granted)
- `src/components/lumio/Shell.tsx` — `xpstreak` ScreenId + Zap icon + nav entry (always reachable)
- `src/lib/lumio/i18n.ts` — `nav.xpstreak` keys ×3; freeze strings rebranded to "Streak Saver" (saver / savers / Use Saver) in EN/HI/Hinglish
- `src/components/lumio/LumioApp.tsx` — `completeSession`/`buySaver` dispatch paths; `winGame` sends `lab`/`firstClear`; `xpstreak` route; Streak Saver earn/use/purchase toasts in `dispatch`; Home gains `onSessionDone` + `onOpenXpStreak`
- `src/components/lumio/screens/Home.tsx` — "Done" mark-complete button on unlocked sessions (future slots stay locked), daily-goal pill (45/50, success-tinted when met), at-risk banner after 17:00, XP pill is a dashboard link (mobile entry), saver pill rebrand
- `src/components/lumio/screens/Planner.tsx` — "Done" button on today's started sessions with "done" badge; past/future slots honestly not markable
- `src/components/lumio/screens/Quiz.tsx` — outcome carries the full XP breakdown (base/improvement/bonus80/bonus100), result screen explains each part

### Chunk 4D
- `src/components/lumio/games/class11/` (NEW, 21 files) — 20 Class 11 labs + `shared.tsx` (PredictFirst "predict first" card, ChapterRef honest NCERT pointer, LabReport observation table). Physics: ProjectilePlayground (ghost path, drag toggle, 3 challenges), FrictionIncline (angle of repose μ = tan θ), ShmExplorer (x–v–a graphs, KE/PE bars), VernierGauge (zero error / least count). Chemistry: TitrationSim (pH curve, endpoint), GasLawsChamber (pin-one-variable + particles), PeriodicTrends (property heatmap), SaltAnalysis (randomized unknowns). Math: UnitCircleLab, ConicSlicer, PermCombBuilder, LimitsVisualizer. CS: NumberSystems (step-animated conversion + two's complement), LogicGateBuilder (truth-table canvas + challenges), PythonTracer (mini Python-subset interpreter, ≤ 10k steps), SortingVisualizer (5 algorithms + swap race). AI: DecisionTreeBuilder, TrainClassifier, BiasFairnessExplorer, DataCleaning
- `src/components/lumio/games/registry.ts` — 20 new entries, bands SENIOR_DROPPER, subject keywords per discipline, xp 25 each
- `src/lib/lumio/domain.ts` — GAME_XP gains the 20 new ids

## Verified in this chunk (Agent Browser, Chromium)

### Chunk-4D verification (Class 11 labs)
- Onboarding golden path as a Class 11 learner (CBSE, Physics + Chemistry + Mathematics + Computer Science + Artificial Intelligence): the Games hub lists all 20 new labs alongside the existing senior set, subject-filtered with the "Show all games" toggle still available
- Projectile Motion Playground deep-verified end-to-end: predict-first answered with kind feedback, ghost-path + analytic-parabola reference rendered, all three challenges solved live (C1 landed 47.2 m within 2 m of 48 m; C2 complementary-angle range match; C3 drag shot 42.8 m near 43 m) → +25 XP awarded once, badge flipped to "collected", zero console errors
- Python Code Tracer: tokenizer bug found and fixed (':' was missing from single-char operators — `while n > 0:` failed to parse); after the fix the Countdown program ran, prediction "5…1, Liftoff!" committed, Run-to-end graded **Matched**, report row written
- Sorting & Searching Visualizer: autoplay stops honestly at the end (Play disabled at the final step); swap-race recording verified for both paths — manual stepping (bubble: 29 recorded) and autoplay (selection: 8 recorded, 2/3); fixed during verification: stale-closure race recording (record now takes the finished index), playback stop moved into the timer callback, `submitCh1` → `submitNum` mis-call
- Number Systems: target-base switch verified live (45 in base 2 = 101101, base 8 = 55) — fixed during verification: `decToBaseSteps` was called without the base argument
- Unit Circle Lab: angle dragged to 90° → sin θ 1.0000 / cos θ 0.0000 / tan θ undefined with the honest "tan 90° is undefined" note; radians toggle present
- All 20 labs render-checked in a clean-cache browser session (fresh profile): every h1 correct, zero page errors; lint clean; `tsc --noEmit` clean (project code); contrast audit 33/33
- Fixed before wiring: 4 React lint errors (set-state-in-effect) across NumberSystems/PythonTracer/SortingVisualizer moved into timer/event callbacks; 20 TypeScript errors fixed (union narrowing in LogicGateBuilder, lucide `Variable` icon, private-token access in the ExprParser, Val index narrowing, missing useRef import)

### Chunk-4C verification
- Dashboard: onboarding golden path (Class 6) → quest claim +10 XP → dashboard shows Level 1 · Spark · 10 XP total, level bar 10/100, daily goal 10/50, XP today/week cards, longest streak, 10-week heatmap (Mon-start columns, today ringed, intensity legend, tz rollover note "Days roll over at midnight in Asia/Kolkata")
- Quiz XP rules: Fractions 2/2 perfect → result screen breakdown "+60 XP = 15 completion base + 20 improvement (best 0 → 2) + 25 perfect-score bonus"; result also fired the **Streak Saver earned!** toast (100% ≥ 90% rule, once per ISO week)
- Schedule XP: with a +2.5 h clock shift past session 1 start, Home's "Done" button appeared on the unlocked slot only (session 2 still honestly Locked); marked done → +15 XP (10 + 5 on-time bonus), "Done" badge replaces the button, dashboard feed shows "Planned session +15"
- Streak Saver purchase: after the second perfect quiz (145 XP balance) → Buy Saver → "Streak Saver purchased" toast, owned 2/3, ledger entry "Streak Saver bought −100 XP" rendered red in the feed, balance 45 XP, level recalculated 2 → 1 (raw sum)
- Redemption: Home banner "Missed Saturday? Use a Streak Saver to keep your 1-day streak alive" → "Use Saver" → "Streak Saver used" toast; dashboard streak/best both recompute to 2 (shielded day counts), inventory 1/3, "1 used · 1 bought" counters
- Anti-farm: retaking the same mastered quiz with the same 2/2 result → "+0 XP — You matched your best. Repeating a perfect quiz gives nothing — by design."
- Honest gating: Buy Saver disabled below cap/balance with a specific reason ("Need 30 more XP to buy a Saver" / "inventory is full"); saver earn rows show live per-week progress (60/150 XP, 0/14 sessions, earned/in-progress badges)
- Mobile 390 px: bottom nav caps at 5; the hero XP pill on Home is a button opening the dashboard (mobile entry point); desktop sidebar shows the new "XP & Streak" nav item
- `bun run lint` clean; zero fresh browser console errors; dev.log clean; fixed during verification: weekly "Earned this week" card now counts ALL earned XP (purchases excluded) while the Saver milestone row keeps activity-only XP — the two numbers are labelled separately
- Screenshots: docs/shots/xp-streak-dashboard.png, xp-streak-savers.png, xp-streak-feed.png

### Chunk-4B verification
- Study tools: worksheet preview renders ("Lumio worksheet", subject band, ruled lines) with question-count chips; note upload verified end-to-end in-browser via a DataTransfer File — `<script>alert(1)</script>` stored and displayed as escaped inert text (no execution), char count + date + remove button all present; video: `https://evil.com/watch?v=abc` refused with the honest message, `youtube.com/watch?v=...` accepted and embedded as `https://www.youtube-nocookie.com/embed/<id>?rel=0` (iframe src verified)
- Guardian: consent off -> only privacy dashboard (counts + records line + export/clear-drafts/reset); consent on -> weekly/all-time summaries with freeze-aware streak; print button present
- Reader read-aloud (with a synthesiser stub because headless Chromium fires synthesis-failed honestly): Listen -> Pause + Stop; Pause -> exact-position Resume; Resume -> playing; Stop keeps the place — buttons become "Resume (sentence 1)" + "Start over from the first sentence". PARITY Partial row resolved
- i18n: Hindi -> html class `lang-hi`, body font-family resolves Noto Sans Devanagari first, line-height 28px/16px = 1.75 (no clipping), nav = होम/पढ़ाई/खेल/प्रगति; Hinglish -> `lang-hinglish`, Roman transliteration (Home/Padhai/Games); English restores cleanly; language persists via `profile-patched` through the event log
- Persistence: notes 1 + videos 1 + 70 XP intact across reload through the IndexedDB event log; zero browser console errors; `bun run lint` clean; `tsc --noEmit` clean (project code)
- Screenshots: docs/shots/chunk4-morning-desktop.png, chunk4-evening-desktop.png, chunk4-night-desktop.png, chunk4-mobile-night.png, chunk4-hindi-home.png

### Chunk-4A verification
- Domain sanity (bun eval, pure): `streakFrom` freeze shield (0 -> 4 with one spent freeze); reschedule options exclude the slot's own start and honour commitments; comp-subject pairing (Maths, Python, Science, Python); `monthCells` (35 cells for Nov 2025); `buildIcs` output RFC-5545 with escaped commas/semicolons; 16:00 IST -> 10:30Z UTC conversion; focus XP cap (1 block left at 3)
- Planner: 7-day plan renders with subject badges; reschedule session 1 -> 5:00 PM applied with "rescheduled" marker, Reset restores 3:15 PM; .ics download produced `lumio-plan.ics` (14 VEVENTs, valid VCALENDAR, correct UTC times); month calendar with prev/next month
- Focus: preset radio group; cycle strip "Block 1 of 4"; started a Quick block — timer 14:57 timestamp-based; navigating away and back resumed at 14:53 (no drift); with strict mode ON, hiding the tab voided the block with the honest message and zero credit; **closed-app recovery**: a saved run 26 min old was credited on reload (+5 XP, 1/4 blocks, "Completed while you were away"); ambient rain started with zero console errors; 7-day chart with sr-only alternatives
- Mocks: recorded Mathematics 62/100 with 2 weak chapters -> "+10 XP", history shows percentage; weak-topic tab now lists both mock-marked chapters; Mock check-in weekly quest became claimable and was claimed (+30 XP)
- Quests: full 8-quest set renders on Home (3 daily / 3 weekly / 2 monthly)
- Persistence: 70 XP (game 25 + focus 5 + mock 10 + quest 30) intact across reload through the IndexedDB event log; `freeze`/`focusLog`/`mocks` all present in the projection
- Mobile 390 px: no horizontal scroll; bottom nav still caps at 5 with the honest "more tools" note
- `bun run lint` clean; `tsc --noEmit` clean (project code); zero browser console errors

### Chunk-3 verification (previous chunk, retained)
- Sidebar: pinned to x=0, full viewport height (240 px open / 68 px collapsed rail with sr-only labels); header spans only the content column; 390 px mobile keeps the bottom nav with zero horizontal scroll
- Full school wizard re-run (Class 8, CBSE): onboarding → Home → Games screen
- Capital Challenge: 5-in-a-row win, badge flips to "+20 XP collected"; wrong answers show the correct capital and reset the streak
- Pendulum Lab: 3 missions (1.5/2.0/2.5 s targets within ±0.05 s) → "+25 XP collected"
- Flashcards: full due session of 11 cards, flip → "I knew it" → box promotion, "Reviewed 11 cards" summary, +10 XP once for the day
- Timed drill: 60 s countdown (timestamp-based), score increments, option feedback; untimed toggle present
- Coding Lab: JS `isEven` fixed → 3/3 tests pass in the Web Worker, "+25 XP collected"; Python exercise ran REAL Pyodide (starter fails honestly, `is_even` fix → 3/3 pass, "Ran in local Python (Pyodide, WebAssembly)"); hint ladders present
- Web Workspace: live sandboxed preview; kind progressive check feedback ("bold — now make it red") → pass state → "+25 XP collected"
- XP ledger: 105 XP total after geo 20 + pend 25 + srs 10 + code 25 + web 25; reload persistence through the IndexedDB event log (105 XP intact)
- Mixed revision and Legendary show their honest locked states with zero progress data; mistake notebook empty state is kind
- Contrast audit 33/33 WCAG AA; `bun run lint` clean; `tsc --noEmit` clean (project code); zero browser console errors
- Fixed during verification: sidebar flex-column root wrapped the content below the rail (root now `md:flex-row`); CodingLab Pyodide load was cancelled by its own effect cleanup on pyStatus change (now ref-guarded); two corrupted lines in subagent-written games (BudgetPlanner savings setter, ChemistryLab coefficient indexing); CodingLab run footer mislabelled JS runs as "local Python"

### Chunk-2 verification (previous chunk, retained)
- Full school wizard (Class 8 + Class 5 runs): board, class, year/language, catalogue subjects + custom, textbooks skip, day times (wake/school/dinner/bed validated), structured commitment block (cricket 17:00-18:00) respected by the schedule preview, outside-hours step, goal + complementary subject, guardian defaults by age (required Class 5, default-on Class 8), live preview "All N sessions fit today"
- Quest loop: mark reviewed → claim +10 XP → day marked → streak 1
- Study loop: path states correct (completed unlocks next), header search, reader tabs, flashcards flip + reviewed marker, quiz with wrong/right feedback, results screen showing +30 XP = 10 improvement (0→1) + 20 first-attempt bonus, "Collect and continue"
- Reload persistence through the event log (localStorage cleared → IndexedDB replay restores everything)
- Migration: chunk-1 snapshot written to localStorage with no event log → bootstrap event seeds the log and replays (profile, 120 XP, chapter result preserved); replays with localStorage removed
- Profile edit from Settings: wizard reopens pre-filled (name/board intact), cancel keeps progress
- Board guide with real band data and honest confidence line
- Themes: manual override applies `theme-*` classes on `<html>`; night/density classes verified; 33/33 contrast audit still passes
- Mobile 390 px: no horizontal scroll; bottom nav 5 items max with honest note for `board`
- Achievements: 2/17 unlocked after the demo loop; Weekly champion and Any-light learner show live progress bars
- Lint clean; `tsc --noEmit` clean (project code)

## Known issues / bugs (open)

- None open in chunk-4C scope.
- Streak-break-with-no-saver path: the dashboard/Home show the honest at-risk warning (goal unmet after 17:00) and the streak simply ends when no saver is held — verified logically; a full calendar-day rollover to observe the broken streak live was not waited for in the demo session (clock-shift was used for the redemption path instead).
- Chunk-4A open items retained below (freeze redemption e2e now RESOLVED — see 4C verification).
- Strict mode voids on tab hide (`visibilitychange`) — SPA navigation away from the Focus screen resumes the block from timestamps instead of voiding (the learner is still in Lumio); noted as intentional.
- Read-aloud audio itself cannot be verified headless (synthesis-failed is the honest error state there); the state machine was verified with a synthesiser stub — real-device check stays in KNOWN_LIMITS.
- Study content (chapters/questions) remains English; only interface chrome is translated (chunk 4B).
- Chunk-3/2 history retained below (official links, Pyodide CDN, etc.).

## Decisions taken (see docs/DESIGN.md Decision Log and docs/ADR/)

- Chunk 4C: `totalXp`/`xpOn` now sum the ledger RAW — 'purchase' is the only negative kind; clamping would make XP purchases free. Purchases are excluded from weekly-XP displays and quest progress, so XP milestones still measure learning activity
- Chunk 4C: XP rule set = quiz base 15 (first attempt ≥ 1 or beat-best only) + 10/improved-question + 10 at 80%+ / 25 at 100%; labs pay once-ever + 10 first-clear bonus; planned sessions pay 10 + 5 on-time, XP once per date#index; retakes with no improvement pay nothing (spec's anti-farm rule)
- Chunk 4C: level curve = 100 + 50·(n−1) XP per level (100, 150, 200 …), titles Spark → Luminary; levels are derived from total XP, never stored
- Chunk 4C: Streak Saver cap 3; earn rules each pay at most once per ISO week (weekly 150 activity-XP milestone, 90%+ quiz / lab pass, full schedule week = plan.sessions × 7 session-done marks) and are evaluated in the projection; the 7-day-streak milestone rule from 4A is unchanged; redemption stays learner-confirmed ("never spent silently"), with earn/use toasts
- Chunk 4C: session completion is only markable once the slot has started (Home + Planner), so future sessions can never be ticked for dishonest XP
- Chunk 4C: the full schedule week counts session-done marks per week key against `plan.sessions × 7` — an honest approximation documented here since plans can change mid-week
- Event log (IndexedDB/Dexie) is the source of truth; localStorage `lumio-v2` becomes a projected snapshot mirror for boot/export/fallback — ADR 0002 (chunk-2 part)
- Bootstrap event acts as a mid-log checkpoint: imports and resets replay as snapshot overrides, keeping the append-only model
- Quiz attempts mark streak days only when they earn XP (improvement or first-attempt bonus) — matches 3.6 "XP-earning activity"
- Wrong answers keyed by stable ids `${chapterId}#${questionIndex}` (3.7 weakness fix, ready for weak-topic ranking in chunk 3)
- Reader material (key points, flashcards, glossary picks) derived by pure functions from the verbatim content; `content.ts` untouched so provenance stays intact
- Board guide ships as text-only confidence/guide content; official links wait for the link checker (7.2, no invented links)
- Charts chosen from `charts.csv` rows 19/5/1 with table alternatives; trend falls back to numbers under 4 active points per row 1
- Chunk 4A: freezes are granted by the projection (+1 per 7-day streak milestone, `freeze.granted` marker) and redeemed explicitly by the learner from Home — redemption is a visible choice, never automatic
- Chunk 4A: focus runs persist in utility localStorage (`lumio-focus-run`), not the event log — like code drafts, only completed blocks (XP) enter the log; the timer is timestamp-only (`Date.now()` deltas), so closing the app never loses or drifts a block
- Chunk 4A: `.ics` exports UTC instants converted from the learner zone (iterative offset) instead of shipping a VTIMEZONE block — every calendar app accepts it and DST stays honest
- Chunk 4A: reschedule overrides are stored per date+session index (`planOverrides`) so the base plan stays the single source of truth; option generation validates commitments/overlap, so an override can never collide

## Next steps (chunk 5, only after the user says continue)

1. Minimal accounts (register, login, email verification, recovery codes, delete) against the local server
2. Parent link by invite; friend codes and friends; weekly league and leaderboard; focus rooms
3. Cross-device sync of the event log (two-device verification); ranked and unranked attempts
4. Optional AI-lite and free-tier integrations (uploads/OCR, speech, open data) with the degradation matrix
5. Final acceptance minus capstone-cut items; final report and docs sweep

## Chunk 5A: Accounts and email OTP (done)

**Slices:** (A) foundations — additive Prisma models (`EmailOtp`, `Session`,
`RecoveryCode`; `User` extended with nullable/defaulted columns only),
`db.ts` query logging removed (`['error','warn']`), env resolution that boots
with zero env vars, shared `callExternal()` wrapper, email layer (`console`
fake + `smtp` real, templates EN+HI, dev outbox), capability table. (B) auth
API — 12 route handlers under `/api/auth/*` + `/api/capabilities`. (C) UI —
`AccountFlow` (entry/verify/recovery/forgot/newpass/manage), header badge,
Settings Account card, device-prompt guard, i18n EN/HI/Hinglish.

**Files:** `src/lib/auth/{constants,env,crypto,ratelimit,http,session,otp}.ts`,
`src/lib/email/{callExternal,index,templates}.ts`,
`src/lib/lumio/accountClient.ts`,
`src/components/lumio/account/{AccountFlow,AccountCard}.tsx`,
`src/app/api/auth/**`, `src/app/api/capabilities`, `src/app/api/dev/outbox`,
`src/components/lumio/{LumioApp,Shell}.tsx` + `screens/Settings.tsx` wiring,
`prisma/schema.prisma`, `public/sw.js` (cache bump `lumio-v2-5a`, explicit
`/api/` never-cache), `.env.example`, `docs/ADR/0004`,
`docs/EMAIL_SETUP.md`, `docs/INTEGRATIONS.md` (email row), this file.

**Verified with curl (evidence in transcript):** signup -> outbox code ->
verify -> 8 recovery codes shown once; wrong code x4 then correct succeeds;
5 wrong kills the code (new send required); 60 s resend cooldown; hourly send
cap returns `RATE_LIMITED` with retryAfter; duplicate signup identical
response + "already have an account" notice email; unknown-email otp-request
indistinguishable; 5 wrong passwords -> 15 min lockout, code route still
works while locked and clears the lock; forgot password -> reset ticket
(single-use) -> password set -> ALL sessions revoked; recovery sign-in works
once, fails second time, remaining count reported; regenerate needs re-auth;
logout and logout-everywhere; delete account requires typed DELETE +
password, user row gone (cascades verified), local data untouched.

**Verified in the browser (agent-browser):** golden path onboarding -> header
badge "Sign in" -> create account -> verify view with labelled dev-mode code
-> recovery codes screen (copy/download/ack) -> signed-in badge with initial
avatar -> manage view (sign out works, badge returns); Settings > Account
card signed-out and Hindi states; degradation with `/api/**` network-blocked
(badge honestly says accounts unavailable, whole app still usable, no
horizontal scroll at 390 px); zero console errors; contrast audit still 33/33.

**Fixes found during verification:** scrypt needs `maxmem: 64 MiB` (Node
default 32 MiB rejects N=2^15/r=8); Next dev compiles route bundles
separately so cross-route state (dev secret, rate buckets, ticket set, email
outbox) must live on `globalThis`; `/api/auth/me` needed `ok: true` in its
JSON for the typed client wrapper.

## Chunk 5B — Phase 2: free-tier AI features behind the gateway (VERIFIED with fake)

**Shipped (vertical slices D→F per the prompt):**
- **D — gateway/budgets/safety:** additive Prisma models `AiUsage` + `AiReport`
  (db:push, schema untouched elsewhere); `src/lib/ai/` server-only:
  `env.ts` (zero-env boot, honest capability), `gateway.ts` (complete/stream/
  completeJson with one Zod-4 repair retry, closed error taxonomy, fallback
  chain), `fake.ts` (deterministic fixture adapter, FAKE_LATENCY_MS/
  FAKE_FAIL_RATE, EN/HI/Hinglish fixtures), `openai.ts` (OpenAI-compatible
  adapter incl. SSE parsing, Retry-After), `budget.ts` (AiUsage ledger,
  per-user/day + per-IP/hour + global caps, response cache by content hash),
  `safety.ts` (scrub emails/phones/URLs/names, pseudonyms, crisis pre-filter
  → Tele-MANAS 14416 deterministic reply — number verified via web search
  2026-02, `HELPLINE_VERIFIED` switch, number-free variant exists, injection
  fences, output policy check), versioned prompts `prompts/*.v1.ts`.
- **E — API:** `/api/ai/{chat,mistake,notes,practice,plan,nudge,report,budget,enable}`
  + capabilities `ai` block (mode/reason/features). Gate order: verified
  sign-in → aiEnabled opt-in → guardian consent (minors = young/middle/sec by
  ACCOUNT ageBand) → budget. Practice route double-solves every generated
  item and drops disagreements; plan route validates against scheduler-valid
  starts and ≤1 move/day.
- **E — UI (Tier 1 + 2 + 3):** `src/components/lumio/ai/` (AiMarkdown
  allowlist renderer + AiLabel + report control, StudyBuddy floating panel
  with hint ladder/read-aloud/dictation/budget line, AiMistakeCard, AiPracticeBeta,
  AiPlanCoach); Reader "Ask Study Buddy" + beta practice; Quiz + Mistake
  Notebook explainers (authored fallback on any failure); StudyTools notes AI
  (consent → generate → Save via new `ai-generated` event, cap 30, deduped,
  reload-safe, no XP); CodingLab nudge after hint ladder; Planner Plan Coach
  (accept → existing `session-rescheduled`); Settings AI section (opt-in
  switch, privacy explainer, fake-mode line, budget); Home Daily Coach line
  (local template); i18n `ai.*` keys ×3 languages.
- **Verification (evidence):** curl — full signup→verify→enable→budget flow;
  SSE chat (streaming + hint ladder + Hindi + crisis reply + injection
  treated as data); mistake/notes/practice/plan/nudge/report; OVER_BUDGET
  proven by restarting with `AI_USER_DAILY_CALLS=1` (429 with usage+caps);
  signed-out 401 `SIGN_IN_REQUIRED`; fresh account 403 `AI_DISABLED`.
  Browser — golden onboarding → sign-in → Study Buddy streaming reply with
  DEMO badge + budget "28 of 40"; hint ladder to level 2; beta practice with
  "Beta practice — AI-written, not reviewed" + "Practice only, no XP" and XP
  total unchanged (0 XP) after answering; mistake card with LIKELY MIX-UP +
  remedial question; notes consent → AI summary card → Save → reload shows
  SAVED chip (event-log replay); Plan Coach suggestion accepted → real
  reschedule; CodingLab nudge; Settings switch (fixed: consent gate now uses
  account ageBand, was wrongly disabling for adult accounts — caught in
  browser verification); AI-off honest states ("Turn on AI help in Settings");
  Hindi chat + coach line; 390px no horizontal scroll; no console errors.
  Screenshots in `docs/shots/phase2-*.png`.
- **Fixes found during verification:** chat route originally iterated its SSE
  generator twice (budget recorder stole deltas — reassembled text was
  whitespace-only); nudge route required ≥1 failing test but the button is
  reachable pre-run (schema relaxed to 0 with honest fixture copy); Storage
  freeze-defaults TS2783; Settings minor gate used the local profile band
  instead of the account band.
- **Honest status:** LLM row stays FAKE-ONLY (no key in this environment;
  network IS available — only the key is missing). Double-solve vacuous under
  fake. Coach line is template-only. See KNOWN_LIMITS.md §Chunk 5B and
  AI_SETUP.md for the manual real-provider test sheet.

**Files:** `prisma/schema.prisma` (+2 models), `src/lib/ai/**`,
`src/app/api/ai/**`, `src/app/api/capabilities/route.ts`,
`src/lib/lumio/{aiClient,i18n,types,events,storage}.ts`,
`src/components/lumio/ai/**`, `src/components/lumio/{LumioApp,Shell}.tsx`,
`screens/{Reader,Quiz,Practice,StudyTools,Planner,Settings,Home}.tsx`,
`games/CodingLab.tsx`, `GameShell.tsx`, `docs/AI_SETUP.md`,
`docs/ADR/0005-llm-gateway.md`, `docs/INTEGRATIONS.md`, `docs/KNOWN_LIMITS.md`,
`docs/ASSUMPTIONS.md`, `docs/PARITY.md`, `.env.example`, screenshots.

### Chunk 6 — Syllabus Tracker (Class 11) with AI Daily Plan

Built per `upload/Pasted Content_1794973793725.txt`. A new sidebar screen, "Syllabus",
shows the CBSE Class 11 (2026-27) syllabus for Mathematics, Physics, Chemistry,
Computer Science and Artificial Intelligence; the learner marks every topic with one
of five states, flags and a short note, and a deterministic planner turns those marks
into an explainable "Today's plan", optionally refined by AI behind the existing
gateway (fake adapter).

- **A — lib (`src/lib/lumio/syllabus/`):** `types.ts` (data + marks + plan types,
  `deriveMark`, `sanitizeSyllabusNote`, `sanitizeFlags`), `class11.ts` (full Appendix A
  dataset transcribed faithfully — 5 subjects, 529 stable ids, marks sums 80/70/70/70/50),
  `index.ts` (`syllabusFor` gate, topic/chapter/unit helpers, grouped-marks share),
  `progress.ts` (five-state derivation, counts, needs-attention), `planner.ts`
  (deterministic `buildSyllabusPlan` with named scoring constants, reason codes,
  `scoreTopics`, `validatePlan`). Audit script `scripts/syllabus-audit.mjs`
  (run `bun scripts/syllabus-audit.mjs`) — ALL PASS.
- **B — state:** `LumioState.syllabus` (`topics`, `plans`, `hiddenSubjects`) with
  defaults + `normalizeState` forward migration; five new replay-safe events
  (`syllabus-topic-updated`, `syllabus-topics-bulk` capped 60, `syllabus-plan-accepted`,
  `syllabus-plan-cleared`, `syllabus-subject-visibility`) with reducer invariants
  (confidence only on completed, completedOn on first completion, lastReviewedOn on
  re-confidence, note sanitised 280, flags deduped ≤8, last write wins, no-op identity).
  **No XP, streak days or achievements** from syllabus marks — verified 0 XP after
  marking, bulk actions and plan acceptance.
- **C — UI:** `SyllabusScreen` (overview: pinned Today's plan card, overall progress
  with text value, five subject cards with segmented five-state bars + text counts,
  hide-subjects + formative-counts controls; subject view: provenance header, badge
  legend, Theory/Practical tabs, unit→chapter accordion, "Mark whole chapter" with
  downgrade confirm + Undo (compensating events), per-topic 5-state radio group
  (44px, icon+text, screen-reader names), flags popover (8 chips), note dialog with
  280 counter, filters/search/sort). Nav item gated to CBSE Class 11 (hidden
  otherwise — no dead items). EN/HI/Hinglish complete (96 keys × 3).
- **D — plan surfaces:** accepted plan = "Today's focus" on Home (tick → confidence
  prompt: Confident / Not confident / Skip) and under each of today's sessions in the
  Planner. Plan acceptance gives no XP.
- **E — AI refinement:** `/api/ai/syllabus-coach` + prompt `syllabus-day-coach.v1.ts`
  behind the existing gate (verified sign-in → aiEnabled → minor consent → budget).
  Request carries ONLY public syllabus ids/titles, status/flag enums, unit mark shares,
  exam buckets, slot lengths and the band; notes only when the learner opts in
  (sanitised, fenced as data). Hard validation server- and client-side: unknown topic
  ids, duplicates, minutes over slot and subject mismatch are dropped; all dropped →
  deterministic plan with "Showing your standard plan." Fake adapter echoes the route's
  deterministic candidate keys (plancoach pattern). AI plans carry the AI badge,
  "AI can make mistakes." and a working Report control.
- **Verification (evidence):** `bun scripts/syllabus-audit.mjs` ALL PASS (529 ids);
  `bun run lint` + `bunx tsc --noEmit` clean; browser (agent-browser): onboarding as
  Class 11 CBSE → Syllabus nav appears → deterministic plan with reason codes →
  five states set, flags + HTML-like note (renders as plain text, no execution) →
  reload persists (12 of 403) → localStorage wipe → replay restores (13 of 403) →
  bulk-mark chapter 12/12 → downgrade AlertDialog → Undo restores → XP 0 throughout →
  accept plan → Home "Today's focus" + Planner session focus items → sign in →
  "Refine with AI" → AI-labelled plan with reasons + Report → accept → Report works →
  no XP; gate check: Class 10/ICSE/Class 12 → `syllabusForProfile` null (nav hidden);
  planner determinism: identical inputs → identical JSON; export includes `syllabus`;
  390px no horizontal scroll; night theme applies; no console errors.
- **Honest status:** AI stays FAKE-ONLY (no provider key — same limit as chunk 5B).
  Physics practical list was not captured in the source document and is honestly
  absent with an on-screen note (KNOWN_LIMITS §Chunk 6). Syllabus topic titles stay
  English (chunk 4B decision). AI Part A is unit-level only (the supplied document
  lists just unit names — stated on screen).

**Files:** `src/lib/lumio/syllabus/{types,class11,index,progress,planner}.ts`,
`scripts/syllabus-audit.mjs`, `src/lib/lumio/{types,events,storage,i18n,aiClient}.ts`,
`src/app/api/ai/syllabus-coach/route.ts`, `src/lib/ai/prompts/syllabus-day-coach.v1.ts`,
`src/lib/ai/fake.ts`, `src/app/api/capabilities/route.ts`,
`src/components/lumio/screens/{Syllabus,Home,Planner}.tsx`,
`src/components/lumio/{LumioApp,Shell}.tsx`, `docs/*` updates.

## Chunk 5-AI (in progress)

- **5-AI-0 (done):** z-ai platform adapter (`src/lib/ai/zai.ts`) as the real model path
  (`AI_PROVIDER=zai`), wired through the existing gateway (timeout/retry/failover/fake
  fallback); `.env.example`; honest AI status chip in the header (AI on / Demo AI / AI off,
  click → Settings); `ai.realMode` + chip keys in EN/HI/Hinglish. Verified: capabilities
  reports zai; real SSE chat through /api/ai/chat (live model, Socratic reply); tsc/lint/contrast green.
- **5-AI-1 (done):** feature 1 chapter content engine (`/api/ai/lesson` + `AiLesson` panel in
  Reader: full/simpler/example/translate modes, save via `ai-content-saved`), feature 2 fresh
  quiz generator (`/api/ai/quiz` with independent re-solve + MCQ sanity checks, AI quiz mode in
  Quiz.tsx, `ai-quiz-attempted` event with per-chapter best across sets + 40 XP daily cap,
  `ai:<hash>#<idx>` stable ids, difficulty picker + "more like the ones I got wrong"), feature 3
  AI worksheet (`/api/ai/worksheet` mixed types + answer key + marking scheme, mode toggle in
  StudyTools, printable `.print-area`). Schema normalizers (quiz/practice/worksheet/lesson) make
  structured output robust to real-model shape drift; dev-only schema-issue logging in the gateway.
  Browser-verified: lesson generate + Explain simpler + Save; AI quiz play → 2/4 → +20 XP
  ("AI quiz (capped)" in XP dashboard); worksheet generate → answer key → Saved.
  curl-verified: lesson 6 sections/8 kp/8 glossary/10 cards; quiz 5 gen → 2 dropped → 3 kept;
  worksheet 8 items mixed types with marks.
- **5-AI-2 (done):** feature 4 Ask Lumi everywhere — the floating Study Buddy panel now
  grounds on the open chapter in Reader AND Quiz; "explain my wrong answer" (AiMistakeCard)
  was already on every quiz question and Error Lab, now including AI-generated quiz items
  (`ai:<hash>#<idx>` ids keep wrong answers + mistakes working). Feature 6 smart notes:
  `/api/ai/ocr` (z-ai vision, NOT_TEXT guard, scrubbed output) + "Scan a photo of notes"
  in StudyTools with client-side downscale (≤1280px JPEG) and a mandatory editable
  "Check the extracted text" step before `note-added` (nothing auto-saved). Feature 7
  mistake intelligence: `MistakeOutputSchema.suggestedTag` (optional), AiMistakeCard shows
  "AI thinks this was a <tag>" + Confirm (learner confirms → existing `mistake-tagged`
  event; suggestion never writes by itself) + "3 questions on this slip" via the practice
  route (practice-only, no XP). curl-verified OCR (exact transcription of a test image);
  tsc/lint green.
- **5-AI-3 (done):** feature 5 mock paper generator — `/api/ai/mock` (exam style school/jee/
  neet/cuet, chapter-tagged questions, per-question independent re-solve, honest dropped
  count) + AiMockPaper in Mocks: answer in-app → instant grading → weakness analysis →
  record via the EXISTING self-reported mock flow (`mock-recorded`, weak chapters feed
  weakTopics). Feature 8 study coach — `/api/ai/coach` (why-this-plan / weekly reflection,
  aggregates only, cached) + AiCoachPanel in Planner; the schedule itself stays produced by
  planDay (AI explains, never moves sessions). Feature 9 guardian narrative — `/api/ai/guardian`
  (only the aggregate numbers already shown) + AiGuardian behind the existing consent switch,
  printable via .print-area. curl-verified all three (coach + guardian texts; mock 6 gen →
  1 dropped → 5 kept across 3 sections). Browser-verified: Planner coach renders + honest
  gating; Guardian AI summary hidden until consent ON. Normalizers added for mock field drift
  (`correct_option`, `section_name`, missing explanations derived from the model's own key).
- **Gates at end of 5-AI-3:** tsc 0 src errors · eslint clean · contrast 33/33 ·
  `/api/capabilities` reports ai.mode=zai · screenshots in docs/shots/5ai-*.
- **Open for 5-AI-4:** feature 10 (AI game rounds for text games, Code Lab AI exercises with
  server-validated reference solutions, labs feedback on LabReport/PredictFirst) and Tier 3
  (TTS read-aloud route, ASR, image-led lessons, video helper, semantic search) — not started,
  no dead UI was added for them.
- **Sign-in-free AI (post 5-AI-3, user request):** every AI feature now works without an
  account. Server: `aiGate` no longer requires sign-in/opt-in/guardian consent — signed-in
  learners keep their account id as budget owner, guests get a stable per-IP guest id
  (`guest:<ipHash>`, no personal data; AiUsage.userId is a plain string so no schema change);
  `/api/ai/budget` serves guests, `/api/ai/report` accepts anonymous reports, `/api/ai/enable`
  is a no-op success for guests (kept for older clients). Client: removed `signedIn` /
  `aiEnabled` gating props and gate UI from StudyBuddy, AiLesson, AiPracticeBeta, AiMockPaper,
  AiGuardian, AiMistakeCard, AiCoachPanel, AiPlanCoach, Quiz (aiGateOk), Syllabus (canRefine),
  CodingLab, StudyTools/NoteAiBlock, MockTests, Guardian, Games/Practice/GameShell, Reader,
  Planner, Settings (AI section is now informational — always on, shows true budget) and all
  LumioApp call sites; stale "AI help is off by default" copy updated in en/hi/hinglish.
  Budget/rate limits unchanged — they are the only remaining gate. Verified in browser signed
  out: Study Buddy streamed a real reply (39/40 left), Plan Coach returned valid suggestions,
  Settings shows budget, Reader AI lesson button visible. tsc/lint green.
