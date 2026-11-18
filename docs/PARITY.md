# PARITY.md — Lumio 2.0, chunk 4

One row per prototype feature in master prompt Section 3. Status values:
**Pass** (works), **Partial** (built slice exists, remainder scoped),
**Planned chunk N** (not built yet, per the chunk plan in section 12).
This table is updated at the end of every chunk.

| Feature | Prototype behaviour | Chunk-3 status | Notes |
| --- | --- | --- | --- |
| Time-of-day themes | morning 06:00-16:59, evening 17:00-18:59, night 19:00-05:59 | Pass | `themeAt`; boundaries from `settings.sch`; classes synced to `<html>`; 33/33 contrast |
| Manual theme override | Setting forces one theme | Pass | Settings screen; verified for all three themes |
| Calm mode | Disables animation, honours `prefers-reduced-motion` | Pass | Unchanged from chunk 1 |
| Bands and learner types | school/dropper/above; band young/middle/sec/senior/dropper/above | Pass | Band drives nav keys, density, subject catalogue, scheduler goals |
| Navigation keys | home, study, games, progress, ach, board; per-band gating | Pass | Young band sees only home/study/games/ach; bottom nav capped at 5 (ux-guidelines); Settings in header |
| Onboarding wizard (school) | board, state, intl, class, year, language, subjects, textbooks, day times, commitments, outside hours (1.5x note), exams (comp from Class 9), goal, compSub, guardian by age | Pass | Full validated wizard; guardian required Nursery-5, default-on 6-8, optional 9-12, never asks for a phone number |
| Onboarding wizard (dropper) | exam+date, attempts, subjects, syllabus, strong/weak, prev prep, mocks (score <= total), hours, best time, day, commitments, goals | Pass | Validated per 3.3 |
| Onboarding wizard (above) | learner type, interest areas + custom, level, goal, target date, hours/week, preferred time, bedtime, topics; never parent phone | Pass | 24 interest areas from content topics + custom |
| Onboarding validation | required fields, ranges, future dates, end after start, score <= total | Pass | All validated per step; Next disabled until clean |
| Resumable onboarding | progress saved per step; reopens pre-filled | Pass | Draft event per change; Settings reopen pre-fills from profile+plan with cancel |
| Live schedule preview | show the plan before finishing; day-too-full verdict | Pass | Preview step renders slots or the honest "too full" verdict |
| Structured commitments (7.1 upgrade) | convert free text into time blocks | Pass | Commitment adder; `planDay` subtracts blocks from free windows |
| Subject/board catalogue | board-, class-, state-aware lists + custom | Pass | `subjectsForClass`; young/middle see age-appropriate lists, sec/senior/dropper the full catalogue |
| Study area: chapter path | locked / available / completed / mastered; unlock on prev best >= 1 | Pass | Visual path with connector line; state chips; best-score display |
| Header search across chapters | search by title/subject/summary | Pass | Study screen search input |
| Chapter reader | source line, notes, key points, glossary, flashcards (tap to flip) | Pass | All built from verbatim content via pure helpers; sample-material labelling on every screen |
| Read-aloud | sentence by sentence, pause/resume, saved speed, Hindi voice for Devanagari | Pass | Chunk 4B state machine: exact-position Pause (speechSynthesis.pause), Stop keeps the current sentence and Resume continues from it ("Resume (sentence N)" + Start over), saved speed, hi-IN voice for Devanagari; state machine verified with a synthesiser stub in-browser |
| Quiz with explanations | per-question feedback with explanation | Pass | Correct/incorrect states, explanation panel, kind copy |
| XP-for-improvement | gain = max(0, score - best) x 10, +20 one-time first scored attempt; repeating perfect gives nothing | Pass | `quizXpGain` wired via quiz-attempted event; results screen shows the breakdown |
| Mastery | best == nq mastered; best >= 1 completed | Pass | Labels on quiz results, study path, Home, Progress |
| Stable question ids | wrong answers not keyed by question text | Pass | `${chapterId}#${questionIndex}` in `state.wrong` |
| Streaks | XP-earning activity days only; yesterday fallback; opening never counts | Pass | Quiz marks the day only when XP > 0 |
| Scheduler: slots | slots, locks, dinner 45-min busy window, too-full verdict | Pass | Commitment blocks now subtracted too |
| Scheduler: full suite | 7-day plan, month calendar, adaptive target, reschedule, .ics | Pass | Chunk 4A: Planner screen — 7-day plan, per-session reschedule (validated options + reset), month calendar, comp-subject pairing, RFC-5545 .ics export (downloaded file verified: 14 VEVENTs, correct UTC times) |
| Quests | daily/weekly/monthly, claimable once | Pass | Full 8-quest set (chunk 4A): daily plan-review / focus block / cards; weekly 3-days / practice / mock; monthly 100 XP / 8 days — all computed from real activity |
| Achievements (~21) | incl. weekly champion, monthly master, any-light learner | Partial | 17 rules live; Focus starter / Steady focus now unlock from real focus blocks (chunk 4A). The remaining expansion (mock-habit, flashcard-habit rules) is owed with the content-pipeline chunks |
| Progress dashboard | completion vs mastery, subject map, consistency | Pass | charts.csv rows 19/5/1 with table alternatives |
| Weak-topic ranking | weighted ranking | Pass | `weakTopics` ranks chapters by distinct misses with the 2/3/1/2/1/2 emphasis weights; live in the Weak topics tab |
| Adaptive practice / drills / labs | difficulty 0.5 start, legendary after 2 mastered | Pass | Adaptive tab (correct → later chapter, miss → same chapter), 60-second timed drill with untimed option (2.2.1), Legendary locked until 2 mastered, +40 XP once ever |
| Practice engine (Leitner SRS) | 5 boxes, due-only, XP once/day | Pass | `card-reviewed` events drive boxes 1–5 with 1/2/4/8/16-day intervals; daily session XP once (`practice-done`) |
| Mixed revision + error lab + remedial | interleaving, worked solutions, remedial from misses | Pass | Mixed revision interleaves completed chapters (needs ≥ 2); Error lab shows 5 honest worked steps per miss; remedial re-asks misses as a mini-lesson |
| Mistake notebook | tags: concept gap, careless slip, calculation error, forgot the fact | Pass | `mistake-tagged` events; tag chips per missed question, re-click clears |
| Games and labs | 20+ games with XP once | Pass | 23 games/labs in the band-gated registry (prototype vGames gates ported); XP-once enforced by the `game-won` ledger ref; Capital Challenge upgraded to all 28 states + 8 UTs |
| Coding Lab | JS in a Worker with 2 s limit; Python in Pyodide; tests; hints; 3 debug exercises | Pass | Blob-URL Worker, 2 s hard terminate, deep-equal tests; Pyodide 0.26.4 from CDN loaded on first Python exercise, 3 s execution race, honest offline-failure state; hint ladder ported verbatim (average/maxOf/total_even) |
| Web Workspace | sandboxed live preview + checked challenge | Pass | iframe `sandbox="allow-same-origin"` srcDoc boundary; real DOM check (bold + red-dominant colour) with kind progressive feedback |
| Focus suite | Lock-In wellbeing | Pass | Chunk 4A: presets, 4-block Pomodoro cycle, XP 5/block capped 4/day, strict mode (voids on tab hide — verified), auto-start, timestamp-only timing with closed-app recovery (verified: a 26-min-old run credited on reload), procedural Web Audio (brown/rain/binaural, zero files), 7-day screen-time chart |
| Guardian summary | consent + printable weekly report | Pass | Chunk 4B: read-only weekly/all-time summary behind the consent switch, printable via print CSS (.print-area), privacy dashboard with data inventory, export, clear-drafts and reset |
| Social, leaderboard, accounts | server features | Planned chunk 5 | |
| Export/import | v2 export/import + legacy lumio-s1 with skip report | Pass | Import replays as a bootstrap checkpoint in the event log |
| PWA offline | installable, offline-first, update prompt | Pass | SW v2 with SKIP_WAITING handshake; "New version available" banner; content packs bundled so the loop is offline-capable |
| Honest labelling (R1) | sample content labelled everywhere | Pass | Reader source line, board guide, wizard footer |
| Study tools (7.14) | worksheet, notes, read-aloud, Study Video | Pass | Chunk 4B: worksheet generator with print-to-PDF (.print-area) and separate answer key; note upload (.txt/.md, 200 KB cap, sanitised plain text — XSS injection verified inert); Study Video embeds only validated YouTube ids (youtube-nocookie, no-referrer); other hosts refused |
| Mock tests (7.6 upgrade) | self-reported, honest | Pass | Chunk 4A: score/total with breakdown, weak-topic chapter tagging feeding the weak-topic ranking, +10 XP once per day |
| Streak freezes (7.10) | shield one missed day | Pass | Chunk 4A: +1 per 7-day milestone (replay-safe grant), inventory pill + explicit redemption on Home, freeze-aware streak walk |
| Hindi + Hinglish i18n (7.x upgrade) | interface translation | Pass | Chunk 4B: full dictionary with strict fallback chain (hi -> hi-Latn -> en), Noto Sans Devanagari pairing (verified font + 1.75 line height), language switcher in Settings; deep content (chapters) stays English — honest note in KNOWN_LIMITS |
| Class 11 labs (curriculum spec) | 20 senior-band simulation labs across Physics / Chemistry / Math / CS / AI, each with a predict-first prompt, an honest linked-chapter reference and an observation table | Pass | Chunk 4D: ProjectilePlayground (ghost path, drag toggle, 3 challenges), FrictionIncline (angle of repose), ShmExplorer, VernierGauge, TitrationSim, GasLawsChamber, PeriodicTrends, SaltAnalysis (randomized unknowns), UnitCircleLab, ConicSlicer, PermCombBuilder, LimitsVisualizer, NumberSystems (step-animated + two's complement), LogicGateBuilder (truth-table challenges), PythonTracer (subset interpreter), SortingVisualizer (race mode), DecisionTreeBuilder, TrainClassifier, BiasFairnessExplorer, DataCleaning — all band-gated to senior/dropper, XP-once enforced by the existing ledger |

Chunk-3 gate items from section 12: every game/lab opens, is playable and awards XP
once (verified in browser: Capital Challenge win, Pendulum Lab 3 missions, flashcard
session with box promotion, drill round, JS Worker tests 3/3, real Pyodide run 3/3,
Web challenge pass; +105 XP total with streak day). Honestly unmet: automated axe run
(platform has no axe runner; manual keyboard/focus/aria patterns applied throughout —
see UX_AUDIT.md), domain test suite (ADR 0003), Pyodide load time on slow networks
(downloads ~10 MB on first Python use; honest loading state shown).

## Chunk 5B — Accounts + AI features parity delta (verified 2026-02)

**Met (verified with evidence):** email-OTP accounts (Phase 1, previous entry);
Phase 2 AI features — Study Buddy (SSE streaming, chapter-grounded, hint
ladder 1→4, persona/labels EN+HI+Hinglish, read-aloud for young band, honest
gates), Explain my mistake (Quiz + Mistake Notebook, authored fallback),
Notes→summary/flashcards/quiz (per-document consent, save via replay-safe
`ai-generated` events, reload-persistent), Practice generator beta (double-
solve guard, dropped-count honesty, no XP), Plan Coach (aggregates only,
scheduler-validated, accept → existing reschedule event), Code Lab nudge
(after the authored 3-level ladder), Daily Coach line (deterministic
template), Settings AI opt-in (server-enforced, minor consent gate mirrored
from account ageBand), budget display ("26 of 40 AI helps left today"),
crisis path (Tele-MANAS 14416, no model call), injection-as-data test,
markdown allowlist rendering, OVER_BUDGET proven with `AI_USER_DAILY_CALLS=1`.

**Honestly unmet / different:** real-provider runs (FAKE-ONLY — no key in the
sandbox; manual test sheet in AI_SETUP.md); double-solve vacuous under fake;
AI-rephrased coach line (template-only); device/session management lists,
CAPTCHA and full CSRF tokens (capstone cuts, unchanged); automated axe run
still absent (ADR 0003).

**Chunk 6 — Syllabus Tracker (Class 11) with AI Daily Plan:** built this chunk.
Five CBSE Class 11 subjects with every Appendix A topic (529 stable ids incl.
formative-only, not-in-syllabus-doc and advanced badges; physics practicals
honestly absent), five marks + 8 flags + 280-char notes per topic, bulk mark +
downgrade confirm + compensating-event Undo, filters/search/sort, "Today's
plan" deterministic planner with reason codes + AI refinement behind the
gateway (FAKE-ONLY), Today's focus on Home and per-session in Planner,
confidence prompt on tick, no XP/streak/achievement effects, EN/HI/Hinglish
complete, audit script ALL PASS, browser-verified end to end.

## Chunk 5-AI (real AI layer) — honest status

| Feature | Status | Evidence |
| --- | --- | --- |
| Real provider (z-ai gateway, `AI_PROVIDER=zai`) | Pass | capabilities reports zai; live SSE chat, all generation routes curl-verified |
| AI status chip (on/demo/off, honest) | Pass | header chip; Settings real-mode notice; 3 languages |
| Chapter content engine (lesson modes, save) | Pass | Reader panel: generate + Explain simpler + example + Hindi + Save; fallback notes always visible |
| Fresh quiz generator + verification pass | Pass | independent re-solve (2 dropped of 5 in verification); difficulty + misses-driven; `ai:<hash>#<idx>` ids |
| AI-quiz XP (anti-farm) | Pass | per-chapter best across sets + 40 XP/day cap; "AI quiz (capped)" in XP dashboard (+20 XP observed) |
| AI worksheet with answer key + marking scheme | Pass | mixed types, marks, printable; checkable items re-solved |
| Ask Lumi grounding (Reader + Quiz) | Pass | floating panel grounds on the open chapter; explain-my-mistake on authored AND generated questions |
| Smart notes photo scan (VLM OCR) | Pass | curl: exact transcription; editable check step before save; NOT_TEXT guard |
| Mistake intelligence (suggested tag + 3-on-this-slip) | Pass | learner confirms tag → existing mistake-tagged event; slip set practice-only |
| Mock paper generator (auto-graded) | Pass | curl: 5 kept of 6 after re-solve; in-app grading → existing self-reported mock flow |
| Study coach (why-this-plan / reflection) | Pass | aggregates-only prompt; display-only; schedule untouched |
| Guardian narrative (aggregate-only, consent-gated) | Pass | hidden until consent ON; printable |
| AI game rounds, Code Lab AI exercises, labs feedback | Planned 5-AI-4 | no dead UI shipped |
| TTS route, ASR, image lessons, video helper, semantic search | Planned (Tier 3) | hidden per R8 |
