# Task 2-b — Tier 2 + Tier 3 AI features (work record)

## Status: COMPLETE (lint 0 problems, tsc clean for project code, dev server compiles, GET / 200)

## Files created
- `src/components/lumio/ai/AiPracticeBeta.tsx` — "More questions like this" (beta practice generator):
  trigger button on the Reader chapter header; gated states identical to StudyBuddy
  (hidden when aiAvailable=false, ai.needSignIn / ai.optInFirst + settings link otherwise);
  calls aiApi.practice with chapter summary + keyPointsFor + first chapter question as sample;
  renders 1–5 answerable items (44px option buttons, per-item local reveal, no answer changes
  after pick), ai.noXp line, big `ai.betaLabel` beta banner, honest `ai.betaDropped {n}` when
  the server dropped items, Save (`practice#{band}#{index}#{lang}#{Date.now()}` via the existing
  `ai-generated` path → onSaveAi=saveAiContent) with `ai.savedChip` (state prefix-match), Regenerate,
  budget line, AiLabel(feature='practice'). No XP/quiz/practice events ever dispatched.
- `src/components/lumio/ai/AiPlanCoach.tsx` — collapsible "Plan Coach (AI)" section rendered by
  Planner when a plan exists and AI is available. Aggregates ONLY local deterministic facts:
  weakTopics (chapter subjects/titles from state.mistakes questionIds, falling back to the band's
  not-yet-mastered chapters), mockSummary (latest state.mocks %), examDate (profile.examDate ?? ''),
  freeWindows (school/dinner/bed/wake via minToLabel), commitments (plan.busy ?? profile.commitments,
  "HH:MM-HH:MM label"), sessions = next 7 days via planDayWithOverrides + subjectForSession +
  state.sessionDone with validStarts from rescheduleOptions. Every returned suggestion is
  re-validated against validStarts (done sessions and invalid moves are discarded and counted in
  `ai.planDropped {n}`); cards show date · subject · old→new time (minToLabel) + reason through
  AiMarkdown, with Accept (reuses the existing onReschedule → `session-rescheduled` event) and
  Dismiss per card. ai.planSchedulerRule shown; loading skeleton, ai.planEmpty state, calm error
  card, Regenerate, AiBadge + AiLabel(feature='plancoach').
- `docs/agent-ctx/2b-frontend-ai-tier2.md` — this record.

## Files modified
- `src/lib/lumio/i18n.ts` — 25 new ai.* keys in EN + HI (Devanagari) + HINGLISH:
  betaMore, betaLabel, betaDropped, planTitle, planRun, planSchedulerRule, planEmpty, planAccept,
  planDismiss, planDropped, nudgeBtn, nudgeTitle, settingsTitle, consentExplain, privacyExplain,
  fakeMode, coachLineSessions, coachLineDue, coachLineRest, enabledToast, disabledToast, regenerate.
- `src/components/lumio/screens/Reader.tsx` — optional AI props (aiAvailable/signedIn/aiEnabled/
  demo/onSaveAi/onGoSettings); renders AiPracticeBeta under the chapter header actions; computes
  betaSaved (state.aiContent id prefix `practice#{cid}#{lang}#`) + betaToday locally.
- `src/components/lumio/screens/Planner.tsx` — optional AI props; renders AiPlanCoach between the
  .ics card and the 7-day plan (only when aiAvailable && plan).
- `src/components/lumio/games/GameShell.tsx` — GameProps extended minimally with optional AI props
  (aiAvailable/signedIn/aiEnabled/lang/demo); other games are unaffected.
- `src/components/lumio/games/CodingLab.tsx` — AI nudge after the authored 3-level hint ladder is
  fully shown (hints.length === 3 && hintsShown === 3): ai.nudgeBtn (Sparkles) → aiApi.nudge with
  title, honest statement (title + "Write a function that passes these tests: " + the real test
  cases), learner code (drafts[ex.id] ?? ex.starter) and failingTests from the last run; nudge text
  through AiMarkdown + AiLabel(feature='codelab') + ai.noXp; gated lines (needSignIn/optInFirst;
  hidden entirely when unavailable); cached per exercise id in component state; nudge state reset
  on exercise switch. Explains only — never grants XP, never writes the solution.
- `src/components/lumio/screens/Games.tsx` — game call site passes the new optional AI props
  (safe defaults via ?? in the game).
- `src/components/lumio/screens/Settings.tsx` — new `AiHelpSection` right after accountSlot
  (rendered only when aiMode !== 'off' — hidden honestly while the probe says off): Switch bound to
  accountUser.aiEnabled calling aiApi.enable(next) then onAiEnabled(next); success toast
  (ai.enabledToast/disabledToast); CONSENT_REQUIRED → ai.consentExplain toast; minor band
  (young/middle/sec) without guardianConsent → Switch disabled + inline ai.consentExplain;
  ai.privacyExplain plain-language explainer; ai.fakeMode gold line when aiMode === 'fake';
  budget line (useAiBudget) when signed in + enabled; ai.needSignIn when signed out.
- `src/components/lumio/screens/Home.tsx` — Daily Coach line card (Sparkles, aria-live polite)
  right after the hero: ONE kind sentence computed locally from deterministic stats —
  due SRS count (state.srs due <= today), today's session count (planDayWithOverrides for today),
  streak — template precedence due → sessions → rest (ai.coachLineDue/ coachLineSessions/
  coachLineRest via fillVars). No server call, not labelled as AI output (it is a local template),
  never guilt-trips, never mentions rank.
- `src/components/lumio/LumioApp.tsx` — threaded AI props to Reader + Planner + SettingsScreen;
  added refreshAccount (re-probe /api/auth/me) and aiToggled (optimistic accountUser.aiEnabled
  mirror + refreshAccount) — both plain callbacks after the existing handlers; declaration-order
  rule untouched (all derived consts still above every useEffect); Reader gets onSaveAi=saveAiContent.

## Key decisions / deviations
- Practice beta lives on Reader ONLY (the spec explicitly prefers this to keep scope tight);
  Practice.tsx hub tabs were left untouched.
- "best < 80" interpreted as "not yet mastered" (best < questions.length) because ChapterResult.best
  is a correct-answer count, not a percentage — the fallback weakTopics stay honest.
- Plan Coach is gated to signed-in+opted-in inside the section, and the whole section is hidden
  when aiAvailable=false or no plan exists (matches the "AI actions hidden when mode is off" rule).
- AiPlanCoach heading is a real <h2> beside a 44px chevron toggle button (no heading-inside-button
  nesting).
- The freeWindows string describes the day rhythm from plan fields (domain.freeWindows is not
  exported and was not modified — lib/domain untouched).
- Settings toggle: ui calls aiApi.enable itself (same client used everywhere), then LumioApp
  mirrors + re-probes; optimistic update keeps the switch responsive on slow networks.
- Daily Coach line precedence: due cards first (time-sensitive), else sessions+streak, else rest.
- Extra keys beyond the required list: planRun (initial CTA), planDropped, nudgeTitle,
  enabledToast/disabledToast, regenerate.

## New i18n keys (all EN + HI + HINGLISH)
ai.betaMore, ai.betaLabel, ai.betaDropped, ai.planTitle, ai.planRun, ai.planSchedulerRule,
ai.planEmpty, ai.planAccept, ai.planDismiss, ai.planDropped, ai.nudgeBtn, ai.nudgeTitle,
ai.settingsTitle, ai.consentExplain, ai.privacyExplain, ai.fakeMode, ai.coachLineSessions,
ai.coachLineDue, ai.coachLineRest, ai.enabledToast, ai.disabledToast, ai.regenerate

## Verification
- `bun run lint` — 0 problems.
- `bunx tsc --noEmit` — only the pre-existing examples/ + skills/ errors; project code clean.
- dev.log — clean compiles, GET / 200, /api/capabilities + /api/auth/me 200.
- Not done (per instructions): bun run build, tests.

## Could not do / honest gaps
- The AI-rephrased variant of the Daily Coach line (Tier 3 "AI-coached" version) was NOT built —
  the Home line is template-only by design; noted here as agreed.
- Interactive verification of live AI responses (SSE/practice/plan/nudge with a real provider)
  was not possible in this sandbox; server contract shapes were matched to aiClient.ts exactly.
- read-aloud/dictation style extras were out of scope for these features.
