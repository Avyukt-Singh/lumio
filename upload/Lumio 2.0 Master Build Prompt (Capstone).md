# Lumio 2.0: Master Build Prompt

*How to use: paste this whole document into the building LLM (a coding agent such as Claude Code or Cursor works best) and attach (1) `lumio-project-final.zip`, (2) the UI UX Pro skill files: `SKILL.md`, `colors.csv`, `typography.csv`, `charts.csv`, `ui-reasoning.csv`, `ux-guidelines.csv`, and (3) the brand images in `assets/original/` (`l.png`, `l1.png`, `l2.png`, `l3.png`).*

## 0. Your role and the outcome

You are a principal-level product engineer, product designer and content engineer working as one person. Rebuild **Lumio**, a gamified learning app for Indian school students (Nursery to Class 12), exam droppers and post-Class-12 learners, starting from an existing capstone prototype. Deliver a production-grade, installable, offline-first progressive web app (PWA) with an optional backend, an optional AI layer, a real content pipeline, and a design system derived from evidence (the attached UI UX Pro skill), not from habit.

Outcome in one sentence: every feature of the prototype still exists and works, each one is clearly better, and everything the prototype could not do because it needed an external service (AI, SMS, email, push, OCR, transcripts, a real database, real data feeds) is now built behind a safe adapter that degrades gracefully when the service, the key or the network is missing.

You succeed when all of the following are true and you can prove each with artefacts (tests, screenshots, reports), not claims:

1. **Parity.** Every item in Sections 3 and 7 works and is covered by an automated test.
2. **Upgrade.** The gaps listed in Section 4 are closed.
3. **Design.** The interface is the product of the UI UX Pro protocol in Section 2 and the brand lock in Section 6, and passes the anti-slop review.
4. **Honesty.** Nothing on screen pretends to be official, verified, social or AI-free/AI-powered when it is not (Rule R1).
5. **Resilience.** The app is fully usable with no backend, no API keys and no network after first load. Every external dependency fails soft (Section 8).
6. **Evidence.** You ship the test suite, an accessibility report, Lighthouse results and a parity table with real pass/fail status.

## 0.5 Capstone scope: what this project is and is not (overrides conflicting text elsewhere)

**This is a capstone (academic) project, not a production deployment.** It is graded on working, visible features, honest engineering, design quality and a convincing demo — not on production hardening. The consequences are stated once here so the rest of this document can stay as written.

**1. Hidden infrastructure that no normal user can see is cut.** Wherever the following appear in this document (Sections 1, 5, 8, 10.3, 11, 13, 14, 15), that specific requirement is void for this build:

- Production security and privacy engineering: the original body of Section 9 (threat model, OWASP ASVS, CSP/HSTS/security headers, authorisation and IDOR test suites, CSRF and XSS fuzz tests, SSRF, supply chain, SBOM, DPDP compliance engineering, breach-response runbook, audit log, admin moderation queue).
- Encryption and hardening beyond the minimum: argon2id parameter documentation, session rotation, CSRF tokens, device-list revoke, breached-password checks, CAPTCHA, rate-limiting infrastructure, 'refuse insecure production settings', HTTPS-only enforcement, build-time secret scanning.
- Real paid or registration-heavy messaging: TRAI DLT SMS templates and SMS pumping defence, Web Push with VAPID, SPF/DKIM/DMARC, bounce and complaint webhooks, suppression lists. Visible substitutes stay: email verification, recovery codes, in-app and service-worker notifications while the app is open, a fake push adapter.
- Operational machinery: nightly backups and restore drills, Prometheus/Sentry/observability, k6 load testing, Postgres/Redis production paths, object storage with signed URLs, virus scanning, EXIF and decompression-bomb defences, Docker production deployment guides.
- Keep R5's **spirit** only: no ads, no trackers, no dark patterns, kind tone, age-appropriate language, and guardian consent kept as the UI flow it already is. The compliance engineering and legal language around it are cut.

**2. Minimal auth is in, because accounts are a visible feature.** Implement simple, honest auth: password hashing with a standard library function, a basic session token in an httpOnly cookie, simple lockout after repeated failed attempts, recovery codes, and **email verification on sign-up** (a free provider, or the fake/console adapter in development). Nothing more.

**3. Free-tier rule.** Every external API or service actually used in the final build must be free to use: no paid plans, no paid registration, no paid quotas. If a capability needs a paid key, it ships fake-only, with its real adapter documented but disabled. Free providers already in scope (Wikimedia, Open-Meteo, the YouTube IFrame embed, self-hosted Pyodide, Mailpit locally) stay.

**4. Visible features are not cut by any of the above.** Anything a normal user can see and feel stays: honest labelling (R1), all games and labs, the offline PWA, three themes, accessibility, guardian summary, friend codes, leaderboard and league, focus rooms, email verification, recovery codes, export and import, and the degradation messages. When in doubt: a feature visible to the learner is in scope; an invisible backend property is out of scope.

**Precedence.** This section wins over any conflicting sentence elsewhere in the document. Checklist items in Sections 13 and 15 that refer to cut items are read as satisfied by their visible substitutes or removed from the build.

## 1. Operating rules (non-negotiable)

- **R1 Truth in the UI.** This is the prototype’s best trait; keep and strengthen it. Every learning item carries provenance (author, source, licence, review status). Never invent official links, chapter lists, marks, rankings, friends, testimonials, user counts or ‘official’ badges. Sample content, AI-generated content and unreviewed content are labelled as such on screen. Official board links are validated by a build-time link checker; if a link cannot be verified, omit it and say so in `docs/INTEGRATIONS.md`.
- **R2 No secrets in the client.** API keys, signing secrets and provider credentials exist only on the server (or in a serverless function). The browser never calls a paid or keyed API directly. Provide `.env.example`; never commit real values.
- **R3 Adapters for everything external.** Each external service sits behind a typed interface with at least a real adapter and a deterministic fake adapter. The fake adapter is the default in dev and tests. See Section 8.
- **R4 Fail soft.** If a service is down, unconfigured, rate-limited, over budget or blocked by the browser, the learner sees a calm, specific message and a working alternative, never a blank screen or a stack trace.
- **R5 Minors first.** Most users are children. Apply data minimisation, no third-party trackers or ads in any learner flow, parental consent flows, and age-appropriate language. Align with India’s Digital Personal Data Protection Act 2023 and its Rules (children are under 18; verifiable parental consent; no tracking or behavioural monitoring of children). Verify current commencement dates and obligations before claiming compliance, and state clearly that this is engineering alignment, not legal advice.
- **R6 Accessibility is a ship gate.** WCAG 2.2 AA, keyboard-complete, screen-reader tested where possible, reduced-motion respected, colour never the only signal, touch targets at least 44 px (larger for the youngest band).
- **R7 No slop.** See the anti-slop checklist in Section 6.6. Generic gradient-card dashboards, emoji used as icons, unexplained lorem-style microcopy, and default framework look are failures.
- **R8 No stubs.** No lorem ipsum, no TODO in shipped paths, no buttons that do nothing. If something cannot be built, hide it or label it ‘Not available yet’ with the true reason, and list it in `docs/KNOWN_LIMITS.md`.
- **R9 Test what you build, report what you could not.** Run the code. If your environment cannot run something (real devices, real SMS, paid APIs), say so explicitly and provide a manual test sheet.
- **R10 Your knowledge of third-party APIs is dated.** Prices, quotas, endpoints and policies change. Before depending on any service, read its current official documentation if you can browse. If you cannot, isolate it behind its adapter and mark the entry `VERIFY` in `docs/INTEGRATIONS.md`.
- **R11 Few questions.** State assumptions in `docs/ASSUMPTIONS.md` and proceed. Ask at most one batch of five questions, and only for true blockers.
- **R12 Vertical slices, complete files.** Build thin end-to-end slices (UI, state, storage, tests) rather than layers. Never output files with ellipses or ‘rest unchanged’ placeholders.
- **R13 Never lose learner data.** Ship a migration that imports a prototype `lumio-s1` localStorage export and a prototype `accounts.json`, `social.json` and `leaderboard.json`. Add export and import (JSON) for all users.
- **R14 Licences.** Use only content you may use. NCERT, CBSE, CISCE and state-board materials are copyrighted: link to them, never scrape or redistribute them. Open material (for example OpenStax under CC BY, Wikipedia under CC BY-SA) needs correct attribution stored in the content’s provenance fields.

## 2. Mandatory design intelligence: the UI UX Pro skill

The user attached the actual skill pack: `SKILL.md`, `ui-reasoning.csv`, `colors.csv`, `typography.csv`, `charts.csv`, `ux-guidelines.csv`. You must use it as the evidence base for design decisions and follow its own workflow. Do not substitute your habits.

### 2.1 What the files actually contain (columns confirmed against the real files)

| File | Confirmed contents | Where you must consult it |
| --- | --- | --- |
| `SKILL.md` | A searchable design-intelligence skill: a query script (`scripts/search.py`) with modes `--design-system`, `--domain <domain>`, `--stack <stack>`, `--persist` (writes `design-system/<slug>/MASTER.md` plus per-page overrides), design dials `--variance`/`--motion`/`--density`, a 10-priority rule table (accessibility and touch first, charts last), and a pre-delivery checklist in `references/pro-rules.md` | Follow its Workflow section exactly and in order before writing any UI code |
| `ui-reasoning.csv` | 192 product types. Columns: UI_Category, Recommended_Pattern, Style_Priority, Color_Mood, Typography_Mood, Key_Effects, Decision_Rules (JSON if/then constraints), Anti_Patterns, Severity, Reasoning, Confidence | First: overall pattern, style priority and anti-patterns per audience (row mapping in 2.2) |
| `colors.csv` | 192 token-ready palettes. Columns: Product Type, Primary, On Primary, Secondary, On Secondary, Accent, On Accent, Background, Foreground, Card, Card Foreground, Muted, Muted Foreground, Border, Destructive, On Destructive, Ring, Notes | Token design per theme and per density profile; the column names are the token roles |
| `typography.csv` | 74 font pairings. Columns: Font Pairing Name, Category, Heading Font, Body Font, Mood/Style Keywords, Best For, Google Fonts URL, CSS Import, Tailwind Config, Notes | Type scale and font choice per band; must be reconciled with Devanagari (confirmed gap, see 2.3) |
| `charts.csv` | 25 chart types. Columns: Data Type, Keywords, Best Chart Type, Secondary Options, When to Use, When NOT to Use, Data Volume Threshold, Color Guidance, Accessibility Grade, Accessibility Risk, Accessibility Notes, A11y Fallback, Library Recommendation, Interactive Level | Every chart in Progress, Focus analytics, quests, mastery map, league and parent views; cite the row number |
| `ux-guidelines.csv` | 120 numbered guidelines. Columns: Category, Issue, Platform, Description, Do, Don't, Code Example Good, Code Example Bad, Severity | Per-screen UX audit and a pre-merge checklist |

### 2.2 Required process (the skill's own workflow applied to Lumio)

1. Write a one-page product brief (audiences, jobs to be done, emotional goals, constraints).
2. Read `SKILL.md` completely and run its search script by its full path (replace `${CLAUDE_PLUGIN_ROOT}` with the folder where the pack lives; try `python3` if `python` is missing). Never invent search output: on 0 results retry once with a narrower query or an explicit `--domain`, then fall back to the priority table in `SKILL.md` and label the recommendation as a built-in default, not a database match. One dominant intent and 2–5 meaningful terms per query; a separate stack query never replaces the UX outcome search.
3. Run the design-system query for this product and persist it with the Master + overrides pattern (SKILL.md Steps 2 and 2b):
   `python3 <skill-folder>/scripts/search.py "gamified education learning app school students" --design-system --persist -p "Lumio" --output-dir <project-root>`
   Then re-run per **density profile** with the design dials and a `--page` override each: young band `--density 3 --motion 6` (spacious, playful, 56 px targets); school and dropper `--density 5`; adult `--density 6 --motion 3` (compact, minimal). Never pass `--force`; read an existing `MASTER.md` first. Retrieval while building: read `MASTER.md`, then the page override if it exists — the page file wins.
4. Consult these **confirmed rows** and cite file plus row number in the Decision Log:
   - `ui-reasoning.csv` row 9 (Educational App: Recommended_Pattern Feature-Rich Showcase, Style_Priority Claymorphism + Micro-interactions, Decision_Rules `if_gamification → add-progress-animation`, `if_children → increase-playfulness`, Anti_Patterns Dark modes + Complex jargon). Also rows 43 (Online Course), 78 (Language Learning), 103 (Flashcard & Study Tool), 107 (Timer & Pomodoro, for Focus), 121 (Trivia & Quiz Game), 152 (Kids Learning) wherever a screen matches that product type.
   - `colors.csv` rows 9 (Educational App: Primary #4F46E5, Accent orange), 103 (Flashcard & Study Tool: Primary #7C3AED, correct green #059669), 121 (Trivia & Quiz: blue + gold leaderboard), 152 (Kids Learning: blue + play yellow + fun pink), 107 (Timer & Pomodoro: focus red on dark, break green) for the Focus screen. Rows 9 and 103 agree with the brand lock seeds #4F46E5 and #7C3AED: record that agreement in the Decision Log instead of inventing new hex values, and treat the CSV's role columns (Primary, On Primary, Muted Foreground, Ring, ...) as the token skeleton.
   - `typography.csv` row 13 (Friendly SaaS: Plus Jakarta Sans — matches the brand sheet) for the school and adult profiles; row 45 (Kids/Education: Baloo 2 + Comic Neue) or row 6 (Playful Creative: Fredoka + Nunito) for the young band; row 48 (Accessibility First: Atkinson Hyperlegible) for the dyslexia-friendly comfort setting.
   - `charts.csv`: consistency calendar and mastery heatmap → row 5 (Heat Map; calendar heatmaps max 365 cells per SVG; print values or symbols in cells); XP and accuracy trends → row 1 (Line; fewer than 4 points use a stat card instead); completion versus mastery → row 19 (Waffle) or row 2 (Bar, sorted descending); planned versus done toward the exam date → row 8 (Gauge/Bullet) or row 13 (Waterfall); league and leaderboard comparisons → row 2 (Bar); Spaceship Δv budget → row 2. Use each row's **A11y Fallback** column as the text or table alternative, and its **Library Recommendation** column when choosing between Recharts, visx and D3.
5. For implementation detail, use the stack query (`--stack react`; `--stack html-tailwind` for chip, badge and text-layout bugs) only after the UX outcome search, per SKILL.md's query contract.
6. Produce `docs/DESIGN.md` containing a **Decision Log** table with these columns: Decision | Evidence (file name and row number or exact quote from the skill) | Alternatives rejected | Brand-lock reconciliation. At least one entry per: overall style, each theme palette, type pairing, icon style, motion style, each chart type used, each major pattern (navigation, onboarding, quiz, dashboard, game shell, empty states).
7. Generate the design tokens (colour, type scale, spacing, radius, elevation, motion durations and easings, z-index) from those decisions into a single source of truth (`packages/ui/tokens.ts` exported to CSS variables). Map the `colors.csv` role columns directly to token names. No ad hoc hex codes in components.
8. Apply `ux-guidelines.csv` as a screen-by-screen audit. Commit `docs/UX_AUDIT.md`: a table of screen × guideline ID (1–120) with Pass, Fail-fixed or Not-applicable (with reason). High-severity failures block the phase. Give special attention to rows 100–108 (WCAG 2.2: focus not obscured, 24 CSS px web target minimum, dragging-movement alternatives, accessible authentication), row 112 (text reflow) and row 19 (content jumping). Row 22 sets the web minimum at 24 CSS px; our own standard stays at 44 px (56 px for the young band).
9. For every chart, cite the `charts.csv` row that justifies the chart type, and add the row's text or table alternative for screen readers.
10. At the end of every phase, re-read the guideline rows you touched, run the anti-slop review (Section 6.6), and before delivering app UI run the pre-delivery checklist in `references/pro-rules.md`.

### 2.3 Conflict and gap policy (with the conflicts we already know about)

- **Brand is locked** (Section 6.1): the mascot, logo, name, tagline, the family of indigo and violet primaries, and the three time-of-day themes. Everything else is open to the skill. When a skill recommendation conflicts with the brand lock, brand wins for identity elements and the skill wins for everything else. Record each conflict in the Decision Log. Conflicts already visible in the files, each needing its own Decision Log entry:
  - `ui-reasoning.csv` row 9 lists **Dark modes** as an anti-pattern, but the brand lock requires a night theme: brand wins for the night theme; apply the row's remaining guidance (playful colours, clear hierarchy, soft press ~200 ms) to light themes.
  - `colors.csv` gives one light palette per product type, while Lumio needs three time-of-day themes: keep the row's role structure and re-map the roles per theme (morning/evening/night), passing the AA contrast audit in Section 6.1.
  - `ui-reasoning.csv` rows for quiz and game products (121, 122, 125) recommend dark or high-saturation treatments that suit the games hub, not the young learner's home: apply them inside the games hub only.
- **Devanagari is mandatory, and the skill cannot supply it.** `typography.csv` covers Japanese, Korean, Chinese, Arabic, Thai and Hebrew but has **no Devanagari pairing** — this is a confirmed gap, not a reason to skip Hindi. Keep the skill pairing for Latin text and add a matching Devanagari family (for example Noto Sans Devanagari or a better-fitting open-licence face) as a clearly labelled provisional addition with mixed Hindi and English line-height and clipping tests.
- **Never fabricate skill content.** If a file or a needed row is missing or unreadable, stop that decision, say which file or row, and use clearly labelled provisional values that you replace once the file is available.

## 3. The prototype, reverse-engineered (parity spec)

Read the code yourself; this section tells you where to look and what it does. Practical tip: `lumio/lumio.html` is one file (about 290 KB: roughly 235 KB of JavaScript, 9 KB of CSS, embedded base64 WebP images). Extract the `<script>`, strip `data:image/...;base64,...` strings, and run Prettier to read it. The server is `lumio/server.js` (dependency-free Node). Also read `README.md`, `HANDOFF.md`, `TESTING.md` and skim `tests/` (about 100 Playwright scripts; they encode the intended behaviour).

### 3.1 Product

AI-free, offline-first, no-cost learning app. Everything lives in the browser (`localStorage` key `lumio-s1`, one JSON object). An optional server provides leaderboard, social features, accounts and parent links. Content is **Lumio-written sample material**, labelled as such; there is no official curriculum, textbook or past-paper content, and the app says so.

### 3.2 Learner types, bands and navigation

- `S.cat` is `school`, `dropper` or `above`. `S.band` is one of `young` (Nursery to Class 5), `middle` (6 to 8), `sec` (9 to 10), `senior` (11 to 12), `dropper`, `above`.
- Navigation keys: `home`, `study`, `games`, `progress`, `ach`, `board`. The `young` band sees only home, study, games, ach. Other screens are reached from within: `focus`, `social`, `account`, `settings`, `guardian` (parent summary), and each game.
- Themes by time of day, hour boundaries configurable (`S.sch=[6,17,19]`): **morning** 06:00 to 16:59 (light, indigo), **evening** 17:00 to 18:59 (warm peach and red-orange), **night** 19:00 to 05:59 (dark). Manual override. A ‘calm’ mode disables animation (and honours `prefers-reduced-motion`). Collapsible sidebar on desktop; bottom navigation on phones.

### 3.3 Onboarding wizard (per learner type, every step validated)

- **School:** name (optional); board (CBSE, ICSE/CISCE, UP Board, Other State Board, NIOS, Other/International); state or union territory (for Other State Board; auto for UP Board); curriculum text for international; class (Nursery to 12); academic year (defaults to current Indian academic year); preferred language; subjects (board-, class- and state-aware catalogue plus custom); prescribed textbooks; school start and end; dinner; bedtime; other commitments; study time outside school (Classes 10 to 12, sets a 1.5x target); next school exam and date; competitive-exam goal and date (from Class 9); learning goal; complementary subject; guardian step by age (Nursery to 5: a guardian must confirm and summary sharing defaults on; 6 to 8: recommended, default on; 9 to 12: optional, default off).
- **Dropper:** target exam (JEE Main, JEE Advanced, NEET, CUET, Other) and date; previous attempts; subjects; syllabus covered; strong and weak areas; previous preparation; mocks taken and latest score with total; current and available study hours; best time of day; wake time; bedtime; dinner; commitments; goals.
- **Above Class 12:** type of learner; area of interest (24 topic areas plus custom goal); level; goal; target date; hours per week; preferred time; bedtime; commitments; topics. Never asks for a parent’s phone number.
- Validation: required fields, number ranges, future dates only, school end after start, mock score not above total. Answers generate the study schedule automatically; if the day is too full the app says so instead of guessing. Settings, Learning profile reopens the same wizard pre-filled and keeps all progress.

### 3.4 Study Area (the learning loop)

- **Chapter path** with four states: locked, available, completed, mastered. A chapter unlocks when the previous one is completed (best score of at least 1). Header search across chapters.
- **Chapter page:** source line (who wrote it, not official), glossary, notes with **Listen** (read-aloud: sentence by sentence, pause/resume, saved speed, Hindi voice for Devanagari text), key points, mind map (built from notes, tap to expand), flashcards (tap to flip), revision checklist, quiz with per-question explanations.
- **Consolidation:** two revision sessions per chapter; mock tests with review of missed questions and ‘flag’ of weak chapters (clearing a flagged chapter is rewarded); a 15-minute **complementary subject** session unlocked by a completed chapter.
- **Practice engine:** spaced-repetition flashcards (Leitner, 5 boxes at 1, 2, 4, 8, 16 days, self-rated, cards built from attempted chapters, XP once per day); weak-topic hub; adaptive practice; mixed-topic revision (interleaving); legendary challenge; timed 60-second drills; error-analysis lab (five worked solutions); remedial lesson built from the learner’s own misses; mistake notebook with tags (concept gap, careless slip, calculation error, forgot the fact); question-paper section that holds only official links and a self-reported attempt log.
- **Utilities:** printable worksheet with answer key; local note upload (.txt, .md; PDFs rejected with a clear message); study reminder (browser notification while the tab is open); Study Video (paste a YouTube link, watch beside notes); Board and class guide with assessment patterns and confidence lines; CBSE Class 11 Physics outline with official facts and a link to the official PDF.

### 3.5 Games and labs (eligibility by band; read `vGames` for the authoritative gates)

Number Hop, Match the Pictures, Spell the Word, Sharp Eyes (odd-one-out and patterns), Capital Challenge, History Timeline, Pendulum Lab, Fraction Puzzles, Ecosystem Builder, Projectile Lab, Algebra Challenges, Virtual Chemistry Lab (balancing equations with live atom counts), Genetics Lab (Punnett squares), Budget Planner, Circuit Lab (series, parallel, target current), Engineering Lab (beam support forces by moments), Dataset Explorer (made-up data), Build Your Own Spaceship, Coding Lab (JavaScript in a Worker with 2 s limit; Python in Pyodide with 3 s limit; tests; hints; three debugging exercises), AI Lab and AI Fairness Lab (made-up data, overfitting and bias), Web Workspace (HTML and CSS with sandboxed live preview and a checked challenge). Each game awards XP once (typically +20 or +25 for five correct in a row; +25 for a passing code exercise). Physics models are intentionally simplified and say so on screen:

- Rocket: dv = Isp × g0 × ln(m0 / m\_dry), with m\_dry = hull + engine mass × count + payload + 0.08 × fuel; thrust-to-weight = thrust × count / (m0 × g0). Engines (thrust kN, Isp s, mass t): Chem-S 3000 / 310 / 3, Hydro-X 1800 / 420 / 3.5, Ion-Z 5 / 3000 / 1. Missions: low Earth orbit from the ground needs dv at least 9.0 km/s and thrust-to-weight above 1.2; lunar transfer from orbit needs 3.2 km/s and thrust-to-weight above 0.005. A winning design exists (for example 2 Hydro-X, 220 t fuel, 2 t hull, 1 t payload). Keep that solvability as a test.
- Projectile, pendulum, Ohm’s law (series and parallel), beam moments, equation balancing (smallest whole numbers), Punnett crosses (nine verified): re-implement and unit test every formula.

### 3.6 Core mechanics (must be preserved exactly unless Section 7 says otherwise)

- **XP on quiz finish:** gain = max(0, score − previous best) × 10, plus 20 on the first scored attempt with score of at least 1. XP is for improvement only; repeating a perfect quiz gives nothing.
- **Mastery:** best score equal to the number of questions is mastered; best above 0 is completed. Progress separates completion from mastery.
- **Streak:** consecutive calendar days (device-local date) on which an XP-earning activity was completed; counts back from today, or from yesterday if today is not yet done. Opening the app does not count. Best streak is stored; milestones at 3, 7, 14, 30, 60 and 100 days.
- **Scheduler:** per-day session slots from `plan` (start, session length, number of sessions defaulting to the band goal, 15-minute gaps, optional 1.5x on Sundays). A chapter session is locked until its slot starts and counts once per new chapter. Busy windows are school hours and dinner (45 minutes). Reschedule moves missed sessions to the next free time that avoids busy windows and bedtime, and reports how many were dropped. Also: 7-day plan, month calendar of studied days, adaptive daily target from the last 7 days.
- **Weak-topic ranking** weights: 2 per missed question; 3 if quiz not passed, 1 if not perfect; 2 if flagged in a mock; 1 per missed flashcard; 2 if practice accuracy is below 60% over at least 3 attempts.
- **Adaptive practice:** difficulty level starts 0.5 (0.9 for legendary), rises on correct and falls on wrong; next question is the unseen one whose difficulty is closest to the level, with a penalty for repeating the same chapter; 8 questions (6 legendary). **Legendary challenge** unlocks after mastering two chapters, two lives, +40 XP on first win only.
- **Quests:** daily, weekly (week starts Monday) and monthly, computed from real activity, claimable once for XP, with four quest achievements.
- **Achievements (about 21):** quest finisher, weekly champion, monthly master, quest hunter, focus starter, steady focus, first lesson, first mastery, streak milestones 3/7/14/30/60/100, path complete, legend, flashcard habit, revision starter, mock tester, fix the gaps, any-light learner (finished quizzes in all three themes).
- **Focus (Lock-In wellbeing):** Pomodoro-style presets Short 15/3 (default for young and middle), Classic 25/5, Deep 45/10, Custom; 4-block cycle with a longer break; XP 5 per completed block, capped at 4 blocks per day; **Strict Mode** blocks Practice and Games, Leaderboard and Friends behind a mascot blocking screen and makes ending early a 10-second wait; auto-start when a timetable slot begins (only if the app is open, within the first 2 minutes); away detection through page visibility with a kind message; sessions survive reload; a block that ended while the app was closed for over 2 minutes is not counted; self-set daily time limit that shows a rest reminder and never locks; generated focus sounds (brown noise, rain-like noise, gentle tones) with Web Audio, no audio files; 7-day screen-time analytics. Timers use timestamps, not tick counts, so background-tab throttling cannot corrupt them.
- **Guardian summary:** consent flag, this-device printable weekly report; with accounts, a parent sees a summary only while the learner’s consent is on.

### 3.7 Data model (browser)

One JSON object `S`. Profile: `name, cat, board, state, intl, cls, band, subs, lang, year, exam, edate, compSub, weak, prev, goalTxt`. UI: `mode, sch, calm, col, owl`. Progress: `xp, days[], themes[], res{chapterId:{best,att,last}}` (chapterId is band plus chapter index), `used{date:n}, shift{date:min}, rs{date:slots}, plan{st,len,n,bed,cur,sun,sh1,sh2,dn}`. Practice: `fc{cardId:{b,d}}, rev, mocks[], wrong{chapterId+questionText:1}, flag, cleared, qs{id:{a,c}}, mt (mistake tags), mis (one-time awards and claimed quests), papers[], comp`. Tools: `fo` (focus object), `code`, `ships[]`, `chk`, `up` (uploaded notes), `rem, remd`. Social: `consent, dn, lbOut, lid`.

Weakness to fix: wrong answers are keyed by the question’s text, so editing a question orphans its history. v2 uses stable question IDs.

### 3.8 Prototype server (`server.js`)

Dependency-free Node 18+, JSON files (`leaderboard.json`, `social.json`, `accounts.json`), atomic writes. Endpoints (all under the API prefix): `lb`; social `sync, state, add, accept, decline, remove, room/create|join|state|start|leave`; accounts `register, login, logout, me, delete, profile/set, phone/request, phone/verify, login/otp/request, login/otp/verify, recover/code, recover/otp/request, recover/otp/confirm, sync/pull, sync/push, parent/invite, parent/link, parent/unlink, parent/children, msg/send, msg/inbox, msg/read`.

Behaviour to keep: friend codes with request, accept, decline, remove (max 30); shared friend streak; cooperative weekly friend quest (team 300 XP and both learning on 4 days); activity feed of milestones; weekly league of up to 10 learners in the same band ranked by weekly XP; focus rooms with a shared server-timed countdown, host-only start, up to 10 members, rooms expire after 6 hours; password hashing with scrypt; 30-day hashed session tokens; lockout after 5 wrong attempts; recovery codes (8, one-time, shown once); phone OTP (6 digits, 10-minute expiry, 5 tries, resend limits, no account enumeration); cross-device sync with merge (best scores, larger XP, union of days, flashcards by box and date, mocks, papers; schedule and settings come from the device that syncs; uploaded notes stay local); parent link by learner-created single-use invite code valid 24 hours; in-app messages with unread count; leaderboard counting at most 800 XP per account per day. Environment: `PORT, SOCDB, ACCDB, SMS_WEBHOOK_URL, OTP_GAP_MS, XP_DAY_CAP, RATE_PER_MIN (120), REGISTER_PER_HOUR (10), TRUST_PROXY, BACKUP_DIR, BACKUP_KEEP (14), BACKUP_EVERY_MS (6 h)`, plus `/healthz`, security headers, per-client rate limits and automatic backups.

### 3.9 What the prototype could not do (your upgrade surface)

Official syllabus, notes and question banks; AI tutor, document and image understanding, OCR, YouTube-to-notes, AI-generated lessons; real SMS, email and push; a managed database and hosting; true server-side XP verification; native app and website blocking; Hindi and Hinglish content; real device and Safari/Firefox testing; question banks of only two or three items per chapter, so adaptive practice and drills repeat quickly.

## 4. Gap analysis: what must be better

| Area | Prototype | Required in v2 |
| --- | --- | --- |
| Architecture | One 290 KB file, global mutable state, many document-level click listeners (attribute clashes such as `data-ob` vs `data-obw` already happened) | Typed, modular monorepo; routed feature modules; component library; no global listener collisions |
| Storage | One `localStorage` blob, about 5 MB cap, silent failure on save | IndexedDB with schema versions and migrations, quota handling, storage-persistence request, export and import, sync queue |
| Content | Two or three questions per chapter; a handful of chapters | Content schema, pipeline, review states, 15 to 40 items per shipped chapter, lazy-loaded content packs, calibrated difficulty |
| Integrity | Answer keys and XP computed in the browser | Server-graded ranked attempts and an XP ledger; unranked offline mode stays available |
| Time | UTC weeks on the server, device date in the browser | Learner time zone stored in the profile (default Asia/Kolkata); server computes days and Monday-start weeks in that zone |
| Server data | JSON files | SQL database, migrations, backups, HTTPS, httpOnly session cookies with CSRF protection |
| Notifications | Only while the tab is open | Web Push (VAPID), email and optional SMS digests with consent; honest handling of iOS (push needs an installed PWA) |
| AI | None | Optional AI layer (Section 8.3), fully grounded, labelled, budgeted and switchable off |
| Language | English; Hindi voice only for read-aloud | Hindi and Hinglish interface and content slots; Devanagari typography |
| Visuals | Emoji as icons, hand-written CSS, 10.5 px nav labels, little data visualisation | Design system from the skill, SVG icon set, charts chosen from `charts.csv`, minimum 12 px for any label |
| Offline | Works by being one file | Service worker, installable PWA, versioned offline content packs, update prompt |
| Python lab | Pyodide from a CDN at runtime | Self-hosted pinned Pyodide with integrity check, background preload on good networks, visible progress, cached |
| Fonts | Google Fonts at runtime | Self-hosted, subsetted, `font-display: swap` (privacy and offline) |
| Realtime | Focus rooms poll every 3 s | Server-Sent Events with polling fallback |
| Identity | Social features use unverified nicknames | Account-based identity, block and report, preset reactions only (no free chat) for minors |
| Tests | Chromium only; nine known-stale tests; selectors tied to markup | Chromium, Firefox and WebKit; stable `data-testid`; CI; a11y and visual tests |

## 5. Target architecture

### 5.1 Principles

Local-first (the app works from IndexedDB alone), server optional, adapters for every external service, pure domain logic separated from UI and I/O, schema-validated at every boundary.

### 5.2 Stack (decisive; deviate only with a written ADR)

- TypeScript in strict mode everywhere; pnpm workspaces.
- **Web:** Vite, React 18, a typed router (React Router or TanStack Router), Tailwind CSS driven by the generated tokens, Radix UI primitives for accessible behaviour (dialog, tabs, popover, toast), Motion for animation (with reduced-motion handling), Zustand for UI state, TanStack Query for server state, Dexie for IndexedDB, `vite-plugin-pwa` (Workbox), KaTeX for maths, i18next for translations, MiniSearch for offline search, CodeMirror 6 for code editing (lighter and better on phones than Monaco), an SVG icon library chosen per the skill. Chart library chosen per `charts.csv` needs (Recharts, visx or D3).
- **API:** Node 20 or newer, Hono or Fastify, Zod validation with generated OpenAPI, Drizzle ORM. SQLite (libsql or better-sqlite3) by default and Postgres for production. Redis is optional (rate limits, queues) with in-process fallbacks. A small job queue for slow work (LLM, OCR, ASR, email) with an in-process fallback. Server-Sent Events for rooms and feeds.
- **Content:** YAML and Markdown sources validated by Zod, compiled to versioned JSON packs.
- **Quality:** Vitest, Testing Library, Playwright (Chromium, Firefox, WebKit), axe-core, Lighthouse CI, MSW for HTTP fakes, k6 for load.
- **Delivery:** Docker and docker-compose (web, api, database, MinIO for object storage, Mailpit for email), GitHub Actions, and a deployment guide for a free-tier host.

### 5.3 Repository layout

```
lumio/
  apps/
    web/               Vite + React PWA (src/app, src/features/*, public/)
    api/               HTTP API (src/routes, src/domain, src/jobs)
  packages/
    ui/                tokens.ts, components, Mascot, icons, chart wrappers
    schemas/           Zod schemas shared by web, api and content tools
    domain/            pure logic: xp, streak, mastery, scheduler, srs, adaptive, quests, focus
    adapters/          interface + real + fake for every external service
    content-tools/     validate, build, import, link-check, generate CLIs
  content/             source files by board / class / subject / chapter, with provenance
  e2e/                 Playwright suites
  legacy/              prototype importer and fixtures
  docs/                DESIGN, UX_AUDIT, ARCHITECTURE, INTEGRATIONS, CONTENT_GUIDE,
                       SECURITY, TESTING, KNOWN_LIMITS, ASSUMPTIONS, PARITY, ADR/
  docker-compose.yml  .env.example  .github/workflows/
```

`packages/domain` has no I/O, no DOM and no clock access (time is injected), and has 100 percent branch coverage on XP, streaks, mastery, scheduling, spaced repetition, quests and focus rules.

### 5.4 Event-sourced local-first data and sync

Replace the prototype’s ad hoc `mergeState` with an append-only **event log**.

- Every learner action is an immutable event: `id` (UUIDv7), `type`, `payload`, `deviceId`, `clientTime`, `tz`. Examples: `quiz.finished`, `card.reviewed`, `focus.block.completed`, `quest.claimed`, `game.won`, `session.rescheduled`.
- Current state (XP, streak, mastery, due cards, achievements) is a **projection** computed by pure functions in `packages/domain`. Monotonic values such as XP and best scores are derived, never set directly.
- Sync is the union of event sets, idempotent by event ID, so multi-device merge is automatic and safe. Settings and schedule fields use last-writer-wins per field with timestamps.
- Uploaded notes sync only if the learner opts in (object storage). Everything else is stored locally first and queued for sync with exponential backoff.
- Provide a one-time **legacy importer**: paste or upload a prototype `lumio-s1` export and it is converted to events, preserving XP, days, results, flashcards, mocks, mistakes and settings.

### 5.5 Ranked and unranked play

- **Unranked (default, offline):** graded locally, counts for personal progress, never for leagues or leaderboards.
- **Ranked (online, account required):** the server issues an attempt (item IDs without answer keys), grades each answer as it arrives, returns the explanation, and writes the XP ledger entry itself. Offline attempts are queued as `unverified` and excluded from leagues. Keep the daily XP cap and anomaly flags (the prototype capped at 800 XP per day).

### 5.6 Time and locale

Store the learner’s IANA time zone. A ‘day’ is the learner’s local calendar day; weeks start on Monday; the Indian academic year runs April to March. Format dates and numbers with `en-IN` and `hi-IN`. Never compare dates as strings without normalising zone.

## 6. Design direction

### 6.1 Brand lock (from the supplied images and the prototype)

- **Name and tagline:** Lumio. *Learn · Practice · Grow.*
- **Mascot:** a purple owl with oversized eyes, orange beak and feet, and a black hoodie with a glowing ‘L’ and a four-point sparkle. Expressions on the sheet: happy, excited, curious, thinking, wink, surprised, sad, cool. Poses: standing, flying, reading, teaching, cheering, with backpack. The logo is the owl mark plus the ‘Lumio’ wordmark with a sparkle; the app icon is the owl on a dark navy rounded square.
- **Palette sheet A:** primary purple `#6C63FF`, secondary blue `#00D4FF`, accent pink `#FF6B9D`, accent yellow `#FFD166`, dark `#0B0F1A`, light `#F8FAFF`.
- **Palette sheet B:** primary `#4F46E5`, secondary `#7C3AED`, accent `#06B6D4`, highlight `#EC4899`, dark `#0F172A`, muted `#64748B`, background `#E0E7FF`, surface `#F8FAFC`.
- **Prototype theme seeds:** morning (background `#f4f3ff`, surface `#fff`, text `#1d1b3a`, muted `#6a678c`, line `#e3e0f7`, primaries `#4f46e5` and `#7c3aed`); evening (background `#fff1ea`, surface `#fffaf6`, text `#3a1d1d`, primaries `#c23b27` and `#9a3ab8`); night (background `#0f1024`, surface `#191a38`, text `#ecebff`, muted `#a3a1cf`, primaries `#6c8cff` and `#a78bfa`). Success `#16a34a` (night `#4ade80`), warning `#f59e0b` (night `#fbbf24`).
- **Type on the brand sheet:** Plus Jakarta Sans for headings, Inter for body. Treat as the preferred starting point that the skill may refine, always with a Devanagari companion.
- **Time-of-day wallpapers:** morning (bright floating-island castle), evening (warm sunset), night (stars and moon). Use optimised versions as optional hero backgrounds.
- **Voice:** warm, brief, encouraging, never guilt-tripping. Sheet examples: ‘Great job! You completed a lesson!’, ‘Keep going! Your streak is 5 days!’, ‘New achievement unlocked!’

The seeds are starting points, not finished tokens. The prototype’s own audit found text and button colours below 4.5:1 in morning and evening and white-on-bright-gradient failures in night. Your tokens must pass an automated contrast audit in all three themes, for text, controls, focus rings and chart series.

### 6.2 Three density profiles of one system

|  | Young (Nursery to 5) | School and dropper (6 to 12) | Adult (above 12) |
| --- | --- | --- | --- |
| Type and targets | Large type, 56 px or bigger touch targets | Standard, 44 px targets | Compact, 44 px targets |
| Navigation | 4 items, icon plus word, no hidden menus | 5 to 6 items, bottom bar on phones | Sidebar on desktop, bottom bar on phones |
| Copy | Very short, picture-led, read-aloud on every screen | Short, direct, exam-aware | Plain, professional, goal-led |
| Rewards | Frequent, gentle, mascot-led | Streaks, XP, leagues | Progress, goals, minimal flourish |
| Motion and sound | Playful but calm; sound off until enabled | Purposeful; reduced-motion respected | Minimal |
| Parent or guardian | Required, simple summary | Recommended or optional | Not applicable |

### 6.3 Mascot system

Build one `Mascot` component with `pose`, `expression` and `size` props. Use the supplied PNG art (cut out, then export AVIF and WebP at 1x to 3x). If art for a needed pose or expression does not exist, use the nearest one and log it in `docs/ASSET_REQUESTS.md`. **Never redraw the owl as an approximate SVG.** Mapping: correct answer, excited or cheering; wrong answer, thinking (never sad or shaming); lost streak, a gentle sad with an immediate path to recover; focus block, reading; Strict Mode blocking screen, cool; empty states, curious; onboarding, standing and waving. Use the owl for milestones, empty states, errors and focus screens, not on every card. Idle motion (blink, bob) uses CSS transforms and stops under reduced motion.

### 6.4 Screens and patterns that must exist

Onboarding wizard; Home (continue card, today’s sessions, streak, week strip, quests, focus pill); Study path (a visual progress path, not a plain list); chapter reader; quiz and results with a celebration; revision and mock tests; practice hub; games hub and a shared game shell; Progress dashboard; Achievements; League and friends; Focus; Account and parent views; Settings and privacy dashboard. Each has designed loading, empty, error, offline and permission-denied states.

### 6.5 Interaction and motion

Micro-interactions 100 to 250 ms, with one easing family from the tokens. Reward moments (XP count-up, streak flame, level-up) happen only for real accomplishments. Sound and vibration are opt-in. No confetti on trivial clicks. Every animation has a reduced-motion equivalent that keeps the meaning.

### 6.6 Anti-slop checklist (any item true fails the phase)

- Default component-library look, default blue-purple gradient on every card, or a hero with a stock gradient blob.
- Emoji used as navigation or functional icons.
- Identical rounded cards stacked with no hierarchy or rhythm.
- Lorem ipsum, vague microcopy (‘Something went wrong’), or exclamation marks everywhere.
- Colour as the only status signal; text under 12 px; contrast below AA.
- Charts with no justification from `charts.csv`, no axis labels, no text alternative.
- Mascot pasted on every screen, or a distorted or redrawn owl.
- Fake or inflated social proof, fake leaderboards, fake ‘official’ badges.
- Dark patterns on minors: guilt copy for missed days, countdown pressure, loot-box mechanics, notifications late at night.
- Any decision in the UI that has no row in the Decision Log.

## 7. Feature specification by module (parity plus upgrades)

For every module: **Keep** means parity with Section 3 and a test; **Upgrade** means required improvement.

### 7.1 Onboarding and profile

**Keep:** all steps and validations in 3.3. **Upgrade:** resumable (progress saved per step); skip-and-finish-later for optional steps; live schedule preview before finishing; convert ‘other commitments’ free text into structured time blocks (the prototype left this open), plus wake time and all meals; one question per screen on phones; the youngest band is completed by a guardian with large, simple screens.

### 7.2 Subject and board catalogue

**Keep:** board-, class- and state-aware subject lists, the Board and class guide, confidence lines, assessment patterns, official links. **Upgrade:** catalogue as data in `content/` with provenance; a build-time link checker (no invented links); clear ‘not mapped’ states; add textbook mapping only where an official source is cited; never present guessed content as official.

### 7.3 Scheduler

**Keep:** slots, locks, busy windows, reschedule, 7-day plan, month calendar, adaptive target. **Upgrade:** calendar export (`.ics`); conflict explanations in plain language; exam countdown planning (spread chapters across days until the exam date and show planned versus done); optional reminder notifications through the push adapter.

### 7.4 Content and lessons

**Keep:** notes, glossary, key points, mind map, flashcards, checklist, source line, two revision sessions, complementary session. **Upgrade:** content comes from validated packs (Section 8.4); maths with KaTeX; images with alt text and licence; Hindi and Hinglish slots per field; lesson blocks (explain, worked example, try-it, recap); worked examples with stepwise reveal; fuzzy search across chapters, glossary and notes, offline.

### 7.5 Quiz and mastery

**Keep:** the XP-for-improvement rule, mastery definitions, explanations, flags. **Upgrade:** item types beyond multiple choice (multi-select, numeric with unit and tolerance, fill-in-the-blank, ordering, matching, image hotspot, short answer with a self-check rubric); three-level hint ladder (an assisted answer counts for completion but not for mastery); stable question IDs; concept tags per item so mastery is tracked per **concept** as well as per chapter; keep the chapter completed and mastered labels.

### 7.6 Practice engine

**Keep:** Leitner flashcards with the due-only rule, weak-topic ranking weights, adaptive practice, mixed revision, legendary challenge, timed drills, error-analysis lab, remedial lesson, mistake notebook, papers log. **Upgrade:** difficulty calibrated from real attempts (1PL item-response or Elo-style rating), falling back to authored difficulty when data is thin; optional FSRS scheduling (the `ts-fsrs` library) for Class 6 and above, Leitner remaining the default for young learners; large item pools so repeats are rare; interleaving that respects prerequisites; error analysis that links each mistake to a concept and a remedial item.

### 7.7 Games and labs

**Keep:** every game in 3.5 with its model and its XP-once rule. **Upgrade:** one shared game shell (instructions, difficulty, hint, score, keyboard and screen-reader alternative, reduced motion, XP-once ledger entry); seeded generators so levels do not repeat (fractions, algebra, counting, patterns); formulas in `packages/domain` with unit tests; Spaceship gets an optional multi-stage mode and a Δv budget chart while keeping the single-stage solvability test; Dataset Explorer can use real open data (Section 8.6) with a clear ‘real data’ or ‘made-up data’ label; Capital Challenge uses a complete state and union-territory dataset instead of ten items.

### 7.8 Coding, AI and technical labs

**Keep:** JavaScript and Python exercises with tests and hints, three debugging exercises, Web Workspace, AI Lab, AI Fairness Lab. **Upgrade:** CodeMirror 6 editor; at least 30 exercises across JavaScript, Python, HTML/CSS and SQL (SQLite compiled to WebAssembly in the browser); sandboxed execution in Workers or a sandboxed iframe with a strict CSP; hard timeouts by terminating the Worker; progressive hints; optional AI hint through the gateway (Section 8.3).

### 7.9 Focus (Lock-In wellbeing)

**Keep:** everything in 3.6 Focus. **Upgrade:** Screen Wake Lock during a focus block; Notifications through the service worker so they work from a backgrounded or installed app; server-sent Web Push for scheduled reminders; keep the honest ‘What Lumio cannot do’ panel (no blocking of other apps or sites from a web app; document the native path in `docs/KNOWN_LIMITS.md`); no notifications to minors late at night (quiet hours defaults).

### 7.10 Gamification

**Keep:** XP, streaks, achievements, quests, legendary challenge. **Upgrade:** earned streak freezes (the prototype listed these as unbuilt) with kind defaults that protect a streak after one missed day; league tiers with weekly promotion and demotion among real learners only; cosmetic mascot customisation (hoodie colours, accessories) unlocked by XP; no purchases, no ads, no random rewards, no pressure timers.

### 7.11 Progress and analytics

**Keep:** completion versus mastery, mock history, consistency, subject mastery map, screen-time and focus analytics. **Upgrade:** chart types chosen and justified from `charts.csv`: a mastery heatmap (subject by chapter or concept), a consistency calendar, XP and accuracy trends, time-on-task, and planned-versus-done toward the exam date; every chart has a table or text alternative; printable and PDF-exportable summaries.

### 7.12 Social

**Keep:** friend codes, requests, shared friend streak, cooperative weekly quests, activity feed, weekly league, focus rooms. **Upgrade:** Server-Sent Events with polling fallback; collaborative challenges; block and report; preset reactions only (no free-text chat for minors); display-name filtering; privacy defaults to private; everything works with the server absent (the social tab explains why and offers local-only features).

### 7.13 Accounts, parents and privacy

**Keep:** learner and parent accounts, recovery codes, phone verification, parent link by invite, summaries only while consent is on, in-app messages, delete account. **Upgrade:** under-18 accounts are created or approved by a parent with a recorded consent; email and phone sign-in with one-time codes; session list with device revoke; data export and erasure for learner and parent; consent log; weekly parent email digest (opt-in); no tracking of children.

### 7.14 Study tools

**Keep:** worksheet with answer key, note upload, study reminder, read-aloud, Study Video. **Upgrade:** worksheet built from the item bank with a seed, printed with print CSS or exported to PDF; uploads of `.txt`, `.md`, `.pdf` (PDF.js text extraction) and images (OCR) with size limits and content-type checks; read-aloud with a voice picker, a highlighted current sentence and a Hindi voice; Study Video uses the YouTube IFrame Player API, timestamped notes, and never scrapes transcripts (Section 8.7).

### 7.15 Settings and data

Theme (auto and manual with the time boundaries), comfort (calm mode, larger text, a dyslexia-friendly font option, colour-blind-safe chart palette), language, notifications and quiet hours, export and import, delete, a privacy dashboard that shows exactly what is stored and where.

### 7.16 Stretch (only after every gate in Section 12 passes)

Teacher classroom (class code, assignments, class analytics, content packs); download manager for offline content packs by board and class; Hinglish tutor persona; multi-stage and atmospheric Spaceship mode.

## 8. External services, data feeding and real-world quirks

This section is what turns the prototype’s ‘not possible here’ list into working, honest features. Follow it closely. Remember R10: verify current provider documentation, limits and pricing before depending on anything below.

### 8.1 The adapter pattern (applies to every integration)

In `packages/adapters`, define one typed interface per capability: `LlmGateway`, `SmsProvider`, `EmailProvider`, `PushProvider`, `OcrProvider`, `TtsProvider`, `AsrProvider`, `ObjectStore`, `YoutubeProvider`, `OpenDataProvider`, `CodeRunner`, `CaptchaProvider`, `ModerationProvider`. Each has:

- one or more **real adapters** and a **fake adapter** (deterministic, fixture-driven, with failure injection through `FAKE_FAIL_RATE` and `FAKE_LATENCY_MS`);
- a Zod config schema validated at boot, which prints a **capability table** (what is on, what is off, why);
- exposure of capability flags at `GET /api/capabilities` so the interface shows or hides features truthfully.

Every outbound call goes through one shared `callExternal()` wrapper that provides: a timeout (default 8 s; streaming LLM calls 60 s); retries with exponential backoff and jitter for idempotent calls only; a circuit breaker (open after repeated failures, half-open probe); a concurrency limit; a per-provider rate limiter that honours `429` and `Retry-After`; idempotency keys for sends (OTP, email, push); log redaction; metrics for latency, errors and cost; response caching with stale-while-error for read-only data; and a closed error taxonomy: `UNCONFIGURED`, `UNAVAILABLE`, `RATE_LIMITED`, `OVER_BUDGET`, `INVALID_RESPONSE`, `BLOCKED_BY_POLICY`, each mapped to a calm learner-facing message.

Health: `/healthz` (liveness), `/readyz` (database and required adapters), and an authenticated admin page listing each adapter’s status, last success, error rate and quota used.

### 8.2 Degradation matrix (implement and test every row)

| If this is missing or failing | The app must |
| --- | --- |
| Backend unreachable | Stay fully usable from local data; queue sync; hide leagues and rooms with a plain reason |
| No LLM key, provider down, or over budget | Hide or disable AI actions with ‘AI help is off’; every non-AI path is unchanged; authored hints stay |
| LLM returns invalid structured output | One repair retry, then fall back to authored content |
| SMS provider down | Offer email code or recovery codes; never reveal whether an account exists |
| Email provider down | Queue and retry; show the message in-app |
| Push unsupported or denied | In-app banner, optional email digest, and install guidance on iOS |
| No speech voice for a language | Say which voice is missing and how to add it; use cloud TTS only if configured |
| Pyodide fails to load | JavaScript exercises keep working; Python shows progress, retry and an offline message |
| OCR unavailable | Offer pasted text instead |
| YouTube embed blocked or disabled by owner | Explain it and offer ‘open on YouTube’ |
| Open-data API down | Use the bundled snapshot, labelled ‘sample data’ with its date |
| Storage full or evicted | Warn, request persistent storage, offer export |

### 8.3 The LLM layer (optional, grounded, budgeted)

**Principles.** Server-side only. A provider-agnostic gateway configured by `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`; an OpenAI-compatible base URL also allows self-hosted models. Never hard-code a model name. Everything works with AI switched off.

**Features** (each behind its own flag):

1. **Tutor.** Socratic by default: a hint ladder before answers. Grounded by retrieval over approved content packs only (BM25 or embeddings). Out-of-scope questions are declined and the learner is told what the tutor can help with. Cites chapter IDs. Persona by band: young, at most two short sentences and read-aloud; school, concise; adult, detailed. Replies in the learner’s language (English, Hindi, Hinglish).
2. **Explain my mistake.** Given the item, the learner’s answer and the key, explain at the learner’s level and propose a remedial item.
3. **Question and lesson generator** (a content-tools CLI plus an admin review queue). Generates items to the schema with concept tags, difficulty, hints, explanations and rationale for each distractor. Automated checks: a second-pass independent solve must agree with the key; numeric answers in maths and physics are verified by executing code in a sandbox; readability fits the band. Output status is `ai_generated_unreviewed`. It reaches learners only in a labelled beta practice mode until a human marks it `reviewed`.
4. **Document to notes and flashcards,** for the learner’s own uploaded text, labelled ‘AI summary of your document’, with per-document consent.
5. **Video notes,** from a learner-pasted transcript or consented speech-to-text (see 8.6).
6. **Study-plan suggestions** returned as structured data and validated against scheduler constraints. The deterministic scheduler stays the source of truth.

**Engineering requirements.**

- Structured outputs: JSON Schema, Zod validation, one repair retry, then fail soft. Stream tutor replies over SSE.
- Prompts are versioned files in `packages/adapters/llm/prompts/` with tests. No prompt strings scattered in code.
- **Prompt-injection defence:** uploaded documents and retrieved text are data, delimited and never treated as instructions; the model has no tools and cannot fetch URLs; output is sanitised (safe Markdown, no raw HTML, no auto-loaded images or links).
- **Child safety:** a minor-specific system policy; a moderation pass on input and output for under-18 users; a supportive, non-judgemental response with trusted-adult and helpline guidance when a learner expresses self-harm or abuse (verify current India helpline details before publishing); no romantic, violent or adult content; no personal advice beyond learning.
- **Privacy:** no names, phone numbers or emails in prompts (scrub, and use pseudonymous IDs); choose provider settings that do not train on learner data and document it; store AI outputs only as long as needed.
- **Budgets:** per-user daily token cap, per-IP cap, a global monthly cap with alerts, and a cost log. Cache generation tasks by hash of prompt version plus content version.
- **Evaluation harness:** a golden set of at least 100 cases per feature with rubrics (correctness against the content, refusal when out of scope, safety, language fidelity). Runs in CI against the fake gateway and nightly against the real one.
- Label every AI output with an ‘AI’ marker and a ‘Report a problem’ control.
- **STEM quirk:** models make arithmetic and unit errors. Verify numeric answers programmatically. **Board quirk:** models are unreliable about specific Indian board syllabi. Ground in content packs and never claim board alignment the content does not have.

### 8.4 Feeding data: the content pipeline

**Schema** (Zod, in `packages/schemas`):

- *Chapter:* `id`, `boards[]`, `classes[]`, `subject`, `title{en,hi,hinglish}`, `prerequisites[]`, `concepts[]`, `lessons[]` (typed blocks), `glossary[]`, `keyPoints[]`, `flashcards[]`, `items[]`.
- *Item:* stable `id` (ULID), `type`, `stem{lang}`, `media[]` (with alt text and licence), `options[]`, `answer`, `unit` and `tolerance` for numeric, `explanation`, `hints[3]`, `difficultyAuthored` (1 to 5), `concepts[]`, `bloom`, `timeSec`, `provenance`.
- *Provenance:* `author`, `createdAt`, `source` (`type`: `original`, `ai_generated`, `open_licence`, `official_link` or `licensed`; plus `url`, `title`, `licence`, `attribution`), `reviewStatus` (`draft`, `ai_generated_unreviewed`, `peer_reviewed`, `teacher_reviewed`), `reviewer`, `reviewedAt`, `version`.

**Formats and importers** (`packages/content-tools`): YAML and Markdown as the native format; importers for CSV, XLSX, JSON, GIFT and Moodle XML (formats teachers already use), and optionally QTI 2.1. Importers produce schema-valid files or a per-row error report; they never write half-valid content.

**CLI commands:**

- `content:validate`: schema; unique IDs; answer index in range; no duplicate or empty options; distractor sanity; reading level for the band; blocked-word list for children; media alt text and licence present; KaTeX compiles; Devanagari renders; links valid.
- `content:build`: compile immutable, hashed packs by board, class and subject with a manifest; compress; size budget of 300 KB per pack.
- `content:import`, `content:generate` (LLM, Section 8.3), `content:link-check`, and `content:report` (a coverage matrix: chapters × items × percent reviewed).

**Sources policy:**

| Source | Allowed use | Quirk |
| --- | --- | --- |
| Lumio-original (human) | Preferred | Record author |
| AI-generated | After validation, labelled | Reviewed before any ‘reviewed’ status |
| OpenStax | Reference and explanations for Class 11 to 12 and adult topics | Most titles are CC BY 4.0; check each book’s licence page; attribute; its curriculum is not Indian-board aligned, so map concepts and never claim alignment |
| Wikipedia and Wikimedia | Short glossary snippets and images | CC BY-SA share-alike; per-file licence metadata; attribute and link |
| NCERT, CBSE, CISCE, state boards, NIOS | **Link out only** | Copyrighted; never scrape or redistribute. If an institution holds a licence, support importing a licensed pack (`source.type: licensed`) with the licence note stored; disabled by default |
| Past papers | Official links and the learner’s own attempt log only | Do not host or copy |
| Teacher or learner content | Private packs by default | Ownership and consent; moderation before any public sharing |

**Volume target for this build.** Port every prototype chapter and question into the schema verbatim with ‘Lumio-written’ provenance. Then deliver a complete vertical slice: CBSE Class 11 Physics (the five Lumio-written chapters expanded to at least 30 items each across three difficulty tiers, with worked examples), at least one chapter per other band, and the Python chapter. Ship the generation pipeline so volume can scale, and report the coverage matrix honestly.

**Versioning and delivery.** Packs are immutable and content-hashed. A manifest endpoint lists them. The client downloads packs for the selected board, class and subject, caches them in the service worker, and checks for updates on launch. When an item is removed keep a tombstone so history stays valid.

**Calibration feed.** A nightly job aggregates anonymised attempts (item ID, correct, time) and updates item difficulty once an item has at least 30 attempts. No personal data in the aggregate.

### 8.5 Data in and out of Lumio

- **Legacy import:** prototype `lumio-s1` JSON, `accounts.json`, `social.json`, `leaderboard.json` become events and database rows through `legacy/` with fixtures and tests. Never drop unknown keys silently; list what was skipped.
- **Learner export and import:** one JSON file with all events and settings, versioned, validated on import, with a preview of what will change.
- **Calendar:** `.ics` export of the study plan. **Print and PDF:** worksheets, weekly guardian report, progress summary.
- **Interchange:** content in and out through the formats in 8.4. Teachers can export a class’s anonymised results as CSV.

### 8.6 Open data and reference APIs (optional adapters; cached; attributed)

| Provider | Use | Quirks to handle |
| --- | --- | --- |
| Wikimedia REST (page summaries) | Glossary ‘learn more’ snippets | Send a descriptive User-Agent with contact details as Wikimedia policy requires; respect rate limits; CC BY-SA attribution; cache for at least 24 hours; bundled glossary as offline fallback |
| Wikimedia Commons and Wikidata | Images; complete lists such as states, union territories and capitals | Per-file licence metadata; live SPARQL queries can time out, so take a **build-time snapshot** into `content/datasets/` rather than querying at runtime |
| data.gov.in (Open Government Data) | Real datasets for Dataset Explorer | API key required; schemas differ per dataset and availability is uneven, so snapshot at build time; show source name and retrieval date; if unavailable use the bundled ‘made-up data’ set with its label |
| Open-Meteo | Weather data for data-handling and graph lessons | No key for non-commercial use (check terms if the product becomes commercial); cache; attribute |
| NASA open APIs (for example Astronomy Picture of the Day) | Space-themed content | Key required (the shared demo key is heavily rate-limited); cache daily; the media may be a video rather than an image; respect any copyright field on an entry |

Do not scrape ISRO, board or news sites. Every external dataset shown to a learner carries a ‘Source, licence, retrieved on’ line.

### 8.7 YouTube and media (Study Video, video notes)

- Playback uses the **IFrame Player API** (no key needed), preferably through the privacy-enhanced embed domain. Handle embed errors (video removed, embedding disabled by the owner, age-restricted) with a clear message and an ‘open on YouTube’ link.
- The Data API (needs a key and has a daily quota; verify current numbers) is used only for metadata by video ID. Avoid search calls because they cost far more quota than lookups.
- **Captions are the trap.** Downloading captions through the official API requires authorisation by the video’s owner, so there is no official way to fetch an arbitrary video’s transcript. **Do not** scrape transcripts or use unofficial libraries (terms-of-service risk and constant breakage). Offer these honest paths: the learner pastes a transcript; the learner uploads audio they have rights to, processed by the speech-to-text adapter with explicit consent; or timestamped manual notes (note stored with the current player time).
- Never download videos. For the youngest band, disable free-form links and offer only a teacher or parent-approved list.
- This feature does not block YouTube elsewhere, and the UI says so.

### 8.8 Speech

- `speechSynthesis` quirks: the voice list loads asynchronously (wait for `voiceschanged`); some browsers cut long utterances, so chunk by sentence (the prototype does); iOS needs a user gesture; Hindi voices depend on the device. Detect a voice by `lang` starting with `hi`, show a precise message when none exists, and use the optional cloud TTS adapter if configured.
- Cloud TTS: pre-generate audio for static content at build time and store it content-hashed; for dynamic text cache by hash of text plus voice to control cost.
- `SpeechRecognition` is not available in all browsers and often needs a network and microphone permission. Use it only for optional spelling or pronunciation games, always with a keyboard alternative, never storing audio.
- Autoplay policies: unlock the `AudioContext` on the first gesture. Keep the generated focus sounds (brown noise, rain-like noise, tones) and give them a volume control.

### 8.9 Files, PDF and OCR

- Limits and checks: default 10 MB; detect type by magic bytes, not by extension; reject executables and archives; guard against decompression bombs; strip image EXIF location data; store in the object store under random keys with private access and short-lived signed URLs; optional virus scan (ClamAV).
- PDF text extraction in the browser (PDF.js in a Worker). If a PDF has no text layer, route to OCR.
- OCR: Tesseract.js (WebAssembly, English plus Hindi language data, lazy-loaded and cached) or a server OCR adapter. State plainly that handwriting and low-quality scans work poorly.
- Extracted text stays on the device by default. Sending it to an AI feature needs explicit per-document consent. Warn against uploading images of people or identity documents.

### 8.10 Code execution

- **JavaScript:** a Worker or sandboxed iframe, terminated on timeout. Apply a strict CSP and **write a test proving that `fetch`, `XMLHttpRequest` and `WebSocket` fail inside the sandbox**; do not assume it.
- **Python:** self-hosted, pinned Pyodide in a Worker, with an integrity check. Stop runaway code by terminating the Worker and reloading from cache. (Pyodide’s interrupt mechanism needs cross-origin isolation headers that can break third-party embeds such as YouTube, so do not enable isolation globally.) Show download progress; respect `navigator.connection.saveData` and warn on metered data before a roughly 10 MB first download.
- **SQL:** SQLite compiled to WebAssembly in the browser.
- **Other languages (optional, off by default):** a server runner adapter for a self-hosted sandbox such as Judge0 CE or Piston, with CPU, memory and time limits, no network, a queue and per-user rate limits.

### 8.11 Messaging (India-specific quirks)

- **SMS OTP:** transactional SMS in India requires sender and message-template registration under the TRAI DLT framework, and providers expose it differently. The adapter therefore takes `templateId` and variables, and config includes `SMS_SENDER_ID`, `SMS_DLT_ENTITY_ID`, `SMS_OTP_TEMPLATE_ID`. The prototype prints codes to the console when no provider is set; keep that **only** outside production, and make production refuse to start with phone sign-in enabled and no real provider.
- **OTP security:** 6 digits, hashed at rest, 10-minute expiry, 5 tries, resend gap, per-phone and per-IP limits, identical responses whether or not the account exists. Guard against **SMS pumping** (fraudulent traffic to premium numbers): cap sends per number, per IP and per country prefix, add CAPTCHA before sending, and alert on spikes.
- **Email:** adapter for a transactional provider or SMTP; document SPF, DKIM and DMARC; handle bounce and complaint webhooks with a suppression list; separate transactional mail from the weekly digest; include a one-click unsubscribe. Use Mailpit in development.
- Prefer email or passkeys for adult learners and phone mainly for parents. WhatsApp OTP is optional and needs approved templates.
- **Web Push:** VAPID keys and the `web-push` library; delete a subscription on a `410 Gone`; ask permission only after a user gesture and a plain explanation; quiet hours and per-category toggles; minimal payloads with nothing sensitive. iOS and iPadOS deliver Web Push only to a PWA installed to the Home Screen (16.4 or newer); Android battery optimisation may delay delivery; browsers cannot schedule local notifications reliably, so scheduled reminders come from a server job.

### 8.12 Identity, sessions and abuse

- Password hashing with argon2id (or scrypt with documented parameters). Session cookies `HttpOnly; Secure; SameSite=Lax`, CSRF tokens on state-changing requests, rotating sessions, a device list with revoke.
- Lockout plus a privacy-friendly CAPTCHA adapter (for example Cloudflare Turnstile or hCaptcha) after repeated failures; the prototype had none. Optional breached-password check through a k-anonymity range API so the full hash is never sent.
- Optional Google sign-in (OIDC) for adults only. Under-18 accounts always follow the parent flow.
- Rate limits by IP and by account; honour `TRUST_PROXY` behind a proxy.

### 8.13 Storage, PWA and browser quirks (handle and test each)

- **Safari storage eviction:** script-writable storage of a site not installed to the Home Screen can be cleared after about seven days without use. Call `navigator.storage.persist()`, show install guidance, remind learners to sync or export, and verify behaviour on real iOS.
- `QuotaExceededError`: catch it, tell the learner, never store blobs in `localStorage`.
- **Service worker updates:** show ‘New version available’ and never swap versions during an active quiz or focus block.
- iOS has no install prompt event: show manual ‘Add to Home Screen’ steps.
- **Timers** are throttled in background tabs: use timestamps, the Page Visibility API and the Screen Wake Lock (re-acquire after visibility changes; not supported everywhere).
- Use `100dvh` and safe-area insets. Regex lookbehind failed on Safari before 16.4 in the prototype: add a lint rule and a compatibility test, and provide fallbacks for `color-mix()`. Declare support as the last two versions of Chrome, Edge and Firefox, Safari 15.4 or newer, and Samsung Internet; test on a low-end Android phone with about 2 GB of RAM.
- **Dates:** the prototype used a locale trick to produce `YYYY-MM-DD`. Replace it with one date utility that takes an explicit time zone.
- **Clock skew:** server time is the truth for ranked play, leagues and rooms. Never trust client time for them.
- **Multiple tabs:** use Web Locks or `BroadcastChannel` so only one tab writes state, runs a focus timer or auto-starts a block.
- **Networks:** school and corporate networks may block YouTube or Google Fonts (self-host fonts); Indian mobile data is variable, so keep packs small, use skeleton screens, retry with backoff and honour the data-saver setting.
- **Notifications denied:** the app must work fully and explain how to re-enable.

### 8.14 Observability, analytics, deployment and backups

- Structured logs (for example pino) with PII redaction and request IDs; Prometheus-style metrics; alerts on adapter failure rate and AI cost.
- Error reporting (Sentry-compatible) optional, with scrubbing, no session replay, and off by default for minors unless a parent consents.
- Product analytics: self-hosted, aggregate only, no cross-site identifiers, no behavioural profiling of children.
- `.env.example` grouped as: core (`PORT`, `BASE_URL`, `NODE_ENV`, `DATABASE_URL`, `SESSION_SECRET`, `TRUST_PROXY`); limits (`RATE_PER_MIN`, `REGISTER_PER_HOUR`, `XP_DAY_CAP`); LLM (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_DAILY_TOKENS_PER_USER`, `LLM_MONTHLY_BUDGET`); SMS (`SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_DLT_ENTITY_ID`, `SMS_OTP_TEMPLATE_ID`); email (`EMAIL_PROVIDER`, `SMTP_URL`, `EMAIL_FROM`); push (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`); storage (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`); other providers (`OCR_*`, `ASR_*`, `TTS_*`, `YOUTUBE_API_KEY`, `NASA_API_KEY`, `DATA_GOV_IN_API_KEY`, `WIKIMEDIA_CONTACT`, `CAPTCHA_SITE_KEY`, `CAPTCHA_SECRET`, `SENTRY_DSN`); backups (`BACKUP_DIR`, `BACKUP_KEEP`, `BACKUP_EVERY_MS`).
- At boot validate config, print the capability table, and **refuse insecure production settings**: non-HTTPS base URL, default or short secrets, dev OTP mode on.
- Backups: nightly database dump and object-store copy to a different location, retention policy, and a **tested restore drill** documented in `docs/`.

## 9. Security and privacy (minors are the default user)

**Cut for capstone scope — see Section 0.5.** The original requirements of this section (threat model, OWASP ASVS Level 2, strict CSP and security headers, IDOR and authorisation test suites, SSRF, supply chain, DPDP-aligned compliance engineering, moderation admin queue, audit log) are out of scope for this build. What remains:

- **Minimal auth only (Section 0.5, point 2):** standard-library password hashing, a basic session token in an httpOnly cookie, simple lockout after repeated failed attempts, recovery codes, and email verification on sign-up with a free provider or the fake/console adapter.
- Keep the user-visible safety features as features: report and block, name filtering, preset reactions only for minors. No admin moderation queue, no audit log.
- Keep data minimisation in spirit: no ads, no third-party trackers, no photo uploads for minors (avatars are the mascot's customisation options), self-service export and delete, plain-language privacy notice in English and Hindi.

## 10. Accessibility, internationalisation and performance

### 10.1 Accessibility (WCAG 2.2 AA is a release gate)

- Everything operable by keyboard with a visible focus indicator that is never hidden behind sticky UI (2.4.11); target size of at least 24 px by rule and 44 px by our standard (2.5.8); **drag alternatives** for ordering and timeline games (2.5.7); consistent help placement (3.2.6); no re-asking known information (3.3.7); **accessible authentication**: allow paste and password managers, no puzzle-only CAPTCHA (3.3.8).
- Screen readers: landmarks, correct heading order, labelled controls, live regions for quiz feedback, and timer announcements at sensible intervals (not every second). Every game has a non-visual or keyboard path, or an equivalent alternative activity, documented in its spec.
- Maths via KaTeX with MathML output. Captions or transcripts for any audio or video that carries information.
- Timed activities (drills, rooms) have an untimed or extended option (2.2.1). Reduced motion keeps meaning. Content reflows at 400 percent zoom, survives user text-spacing overrides, and works in forced-colours mode.
- Comfort settings: larger text, dyslexia-friendly font option, colour-blind-safe chart palette and patterns.
- Keep and extend the prototype’s automated audits: contrast in all three themes, accessible name on every control, heading order.

### 10.2 Internationalisation

- Externalise every string (ICU MessageFormat with plurals). Ship English, Hindi (Devanagari) and Hinglish (Roman-script Hindi) for the interface and for the fields the content schema marks translatable. Fallback chain Hinglish or Hindi to English, with a visible label when a fallback is used.
- No text baked into images. Layouts tolerate about 40 percent text expansion. A pseudo-locale test catches hard-coded strings. Language switch needs no reload. `lang` attributes are set on mixed-language text so screen readers and read-aloud choose the right voice. Test Indic input methods in every form.

### 10.3 Performance budgets (verify in CI)

- On a mid-range Android over throttled 4G: LCP at most 2.5 s, INP at most 200 ms, CLS at most 0.1.
- Shell JavaScript at most 170 KB gzipped; route-level code splitting; games, labs, editors and large libraries (Pyodide, Tesseract, CodeMirror languages) load on demand and are cached. First-load transfer at most 400 KB excluding images. Subsetted fonts at most 100 KB. AVIF or WebP images with `srcset`.
- Lighthouse performance and PWA scores of at least 90; automated accessibility checks clean. Virtualise long lists. Respect data-saver preferences.

## 11. Testing and quality assurance

- **Domain:** unit tests plus property-based tests (fast-check) for invariants: XP never decreases; repeating a perfect quiz yields 0 XP; the streak equals the length of the run in the day set; the scheduler never places a session inside a busy window or past bedtime; event merge is commutative and idempotent; legacy import preserves totals.
- **Parity:** port the intent of the prototype’s Playwright scenarios, using a controllable clock: onboarding for CBSE Class 11, ICSE 7 and 8, UP Board 10, Class 2, UKG, dropper and above-12; session lock and unlock; quiz updating XP, streak, mastery and achievements; reload persistence; revision; mock tests; complementary session; best streak; theme at six clock times plus override; reset; worksheet; note upload and PDF handling; JavaScript and Python labs and debugging exercises; leaderboard join, remove and unreachable server; every game opens without errors and awards XP once; keyboard focus; **390 px layout on every screen with no horizontal scroll**; flashcards, weak hub, adaptive practice, legendary challenge, drills, error lab, mistake notebook; reschedule; Circuit Lab; Study Video; quests; the full focus suite (cycle, XP cap, strict mode, auto-start, closed-app handling, daily limit); read-aloud; mind map; account API (at least the prototype’s 46 checks); social features with three browser contexts; server hardening.
- **Integration and resilience:** contract tests against recorded fixtures (MSW); chaos runs with fake adapters set to fail, time out and rate-limit; offline tests (Playwright offline mode); two-device sync; two-tab concurrency; migration from real prototype exports.
- **Security:** authorisation and IDOR tests, rate-limit and lockout tests, CSRF tests, XSS payloads, upload fuzzing, the sandbox no-network test.
- **Load:** k6 scenario for sync and ranked attempts at 500 concurrent learners with a stated latency target; publish the result.
- **Visual regression:** three themes by three density profiles by mobile and desktop for the main screens.
- **Accessibility:** axe on every route and state, keyboard-only end-to-end paths, and a manual screen-reader script (carry over and update the prototype’s `TESTING.md` sheet).
- **Cross-browser:** Chromium, Firefox and WebKit in CI, plus a real-device checklist (iOS Safari, Android Chrome, Samsung Internet).
- **AI:** the evaluation harness from 8.3. **Content:** `content:validate` in CI and a scheduled link check.
- **Gates in CI:** lint, type check, unit, end-to-end smoke, accessibility, bundle size, Lighthouse, content validation, dependency audit. **No skipped or known-stale tests on the main branch** (the prototype carried nine); fix or delete with a written reason.

## 12. Chunked delivery plan (5 chunks; each gate must pass before the next chunk)

This build is delivered in **five chunks**. A chunk is a demo milestone: at the end of every chunk the app runs and shows a reviewer something new. Never build ahead of the current chunk, and never start the next chunk until the current gate passes and the user says continue.

| Chunk | Demo milestone at the end | Build | Gate |
| --- | --- | --- | --- |
| 1. Shell and Home | A themed app shell opens on a working Home screen, fed by real data from the prototype importer | Prototype recon; run the prototype; read the skill files and brand images; write `ASSUMPTIONS.md`, `PARITY.md` (one row per feature in Section 3 with status), Decision Log v1, ADRs; scaffold the monorepo and CI; `packages/domain` with tests, schemas, event log and Dexie; content pipeline and port of prototype content; legacy importer; design system, `Mascot`, shell, three themes, three density profiles, PWA basics; Home (continue card, today’s sessions, streak, week strip) | Parity table complete; tokens generated from the skill; domain tests green; importer round-trip test; accessibility baseline; CI green |
| 2. The working quiz loop | A learner can onboard, open a chapter, take a quiz and watch XP, mastery, streak and progress move | Onboarding (all learner types), subject and board catalogue, scheduler (basic slots and locks), study path, chapter reader, quiz with explanations, mastery, XP-for-improvement, streak, progress dashboard, achievements | Parity rows for this slice pass; axe clean; works fully offline; reload persistence |
| 3. Playable games | Every game and lab opens, is playable and awards XP once | Practice engine (flashcards, weak-topic hub, adaptive practice, timed drills, error-analysis lab, mistake notebook), shared game shell, every game and lab, coding labs (JavaScript, Python, SQL, Web Workspace) | Each game awards XP once and has tests; sandbox no-network test; Python offline path |
| 4. Full study tools | The whole study toolkit works: plans, revision, focus, quests, tools, languages | Scheduler complete (7-day plan, reschedule, month calendar, `.ics` export), revision and mock tests, complementary session, Focus suite (strict mode, auto-start, daily limit, generated sounds), quests, streak freezes, study tools (worksheet, note upload, read-aloud, Study Video), guardian summary, settings and privacy dashboard, Hindi and Hinglish | Focus suite passes with a controllable clock; parity rows pass; i18n fallback chain works |
| 5. Backend-lite and final report | Accounts, social and leaderboard work against the local server; the final report is delivered | Minimal accounts (register, login, email verification, recovery codes, delete), parent link by invite, friend codes and friends, weekly league and leaderboard, focus rooms, cross-device sync, ranked and unranked attempts, optional AI-lite and free-tier integrations (uploads and OCR, speech, open data), all remaining docs, final acceptance minus capstone-cut items | API tests at least equal to the prototype’s; two-device sync; every row of the degradation matrix (minus cut services) tested; Section 15 fully ticked minus capstone-cut items |

### 12.1 The chunk protocol (non-negotiable)

1. **One chunk at a time, in order.** Finish chunk N completely — including its gate — before starting chunk N+1. Never leave a chunk half-built at a chat boundary.
2. **End-of-chunk output in chat.** After finishing a chunk, output in the chat: (a) complete code of every file created or changed in this chunk (complete files, no ellipses, no ‘rest unchanged’ — this extends R12 to chat output); (b) a file tree of everything built so far; (c) the chunk report in the Section 14 shape; (d) the current content of `PROGRESS.md`.
3. **Pause.** Then stop and wait for the user’s explicit ‘continue’ before starting the next chunk. If the user opens a new chat instead, the resume path in 12.2 must work.
4. **End-of-chunk files on disk.** At the end of every chunk, update two files at the repository root:
   - `PROGRESS.md`: a status table of the five chunks (Done / In progress / Not started); the list of files built so far, grouped by chunk, one line per file; known issues and bugs; decisions taken (with a pointer to the Decision Log); the exact next steps for the next chunk. Keep it under about 200 lines so it is easy to paste into a new chat.
   - `RESUME.md`: a ready-to-paste continuation prompt for a fresh chat (template in 12.2).
5. **Never rely on chat memory.** Write every file to disk in full, and record every assumption in `PROGRESS.md` or `docs/ASSUMPTIONS.md` as you go, so a fresh chat can continue with no other context.

### 12.2 Resuming from a new chat

If a chat ends at (or inside) a chunk, a new chat resumes with this paste — it is kept up to date in `RESUME.md`:

> I am resuming the Lumio 2.0 capstone build. Attach the master build prompt, then read `PROGRESS.md` and `RESUME.md` in the repository. Chunks 1 to N are done and must not be rebuilt or re-scaffolded. Continue with chunk N+1 following Section 12 and the chunk protocol. First reply with your understanding of the current state: last completed chunk, what is built, what is next.

The repository plus the master prompt plus `PROGRESS.md` must be enough for a completely fresh chat to continue with no other context.

Every chunk ends with: a demo script, screenshots (three themes, mobile and desktop) in `docs/shots/`, an updated `PARITY.md` and `UX_AUDIT.md`, the test report, and an honest list of what could not be verified.

## 13. Deliverables

- The monorepo, runnable in three steps: install, start, open. `docker compose up` brings up the whole stack including a database, object storage and a mail catcher. `pnpm demo` creates demo accounts with synthetic data that is clearly labelled as such.
- `docs/`: `DESIGN.md` (with the Decision Log), `UX_AUDIT.md`, `ARCHITECTURE.md`, `INTEGRATIONS.md`, `CONTENT_GUIDE.md`, `SECURITY.md`, `TESTING.md`, `KNOWN_LIMITS.md`, `ASSUMPTIONS.md`, `PARITY.md`, `ASSET_REQUESTS.md`, `DEPLOY.md`, `ADR/`.
- `INTEGRATIONS.md` has one row per service with: purpose, adapter name, environment variables, quotas and cost notes, privacy notes, fallback behaviour, and a status of **VERIFIED** (tested against the real service), **FAKE-ONLY** (only tested against the fake) or **VERIFY** (documentation not confirmed).
- `CONTENT_GUIDE.md` explains how to add a chapter, import a question bank, generate and review AI items, and publish a pack.

## 14. How to work and how to report

1. Start by replying with your understanding of the task, your assumptions, and the Phase 0 plan. Ask at most one batch of five blocking questions, then proceed.
2. Work in vertical slices and run everything you build. If your environment cannot execute code, say so up front and deliver complete files phase by phase.
3. Report each phase in this shape: **What changed**; **Parity delta** (rows passing and failing); **Evidence** (test summary, screenshot paths, Lighthouse and axe numbers); **Decision Log entries added**; **Risks and unverified items**; **Next**.
4. Never claim something is tested when it was not run, or that a real provider works when only the fake was used. Label each integration VERIFIED, FAKE-ONLY or UNTESTED.
5. When credentials are missing, use the fake adapter, keep going, and document exactly where the user plugs in real keys.
6. Protect the prototype’s strengths: honest labelling, XP-once rules, improvement-only XP, the kind tone, no dark patterns.
7. Prefer correctness of the learning mechanics and accessibility over decoration, but visual quality is part of the job and is judged against the anti-slop checklist.

## 15. Final acceptance checklist (every box must be true and evidenced)

- [ ] Every row of `PARITY.md` is Pass, or has a written, honest reason in `KNOWN_LIMITS.md`.
- [ ] The Decision Log cites the UI UX Pro skill files for every design decision, and `UX_AUDIT.md` has no open high-severity failure.
- [ ] Brand lock respected: mascot art unmodified, three time-of-day themes, tagline, Plus Jakarta Sans and Inter or a skill-justified replacement with a Devanagari companion.
- [ ] All text and control colours pass WCAG AA in all three themes; no text under 12 px; automated and manual accessibility checks clean.
- [ ] The app is installable, fully usable offline after first load, and works with no backend and no API keys.
- [ ] Every external service is behind an adapter with a fake, and every row of the degradation matrix has a passing test.
- [ ] No secret in the client bundle (checked by a build-time scan).
- [ ] Ranked XP is server-computed; unranked play never reaches leagues; the daily XP cap holds.
- [ ] A prototype `lumio-s1` export imports with totals preserved and a report of anything skipped.
- [ ] Content: every item has provenance and a review status; AI and sample content is labelled on screen; official links pass the link checker; no copyrighted board material is copied.
- [ ] AI features are optional, grounded, budgeted, moderated for minors, evaluated, and labelled.
- [ ] Hindi and Hinglish work for the interface and for translated content, including read-aloud.
- [ ] Performance budgets met on a throttled mid-range Android profile.
- [ ] Chromium, Firefox and WebKit pass the end-to-end suite; real-device checklist delivered.
- [ ] Security tests pass; production boot refuses insecure configuration; backup and restore drill documented and run.
- [ ] Zero skipped tests; zero lorem ipsum; zero TODO in shipped code paths; zero dead buttons.
- [ ] The final report lists every item still VERIFY, FAKE-ONLY or UNTESTED, with the exact manual steps for the user to close each one.
