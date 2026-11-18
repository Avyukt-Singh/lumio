# Phase 2 AI features — frontend integration contract (chunk 5B)

Read this FIRST. Then read: `src/lib/lumio/aiClient.ts` (typed client, all endpoint shapes),
`src/lib/ai/safety.ts` + `src/lib/ai/fake.ts` (what the server returns),
`src/components/lumio/LumioApp.tsx` (declaration-order rule: all derived consts above every useEffect),
`src/components/lumio/Shell.tsx`, `src/lib/lumio/i18n.ts` (i18n pattern), `src/lib/lumio/types.ts` + `events.ts` + `storage.ts` (event recipe).

## Backend endpoints (already built, curl-verified — do NOT modify them)

All via `aiApi` in `src/lib/lumio/aiClient.ts`. Error codes: SIGN_IN_REQUIRED, AI_DISABLED,
CONSENT_REQUIRED, OVER_BUDGET, UNCONFIGURED, UNAVAILABLE, RATE_LIMITED, INVALID_RESPONSE,
BLOCKED_BY_POLICY. Every failure resolves `{ ok:false, code }` — map to calm i18n copy `ai.err.<CODE>`.
- `aiApi.chat(...)` — SSE stream; onDelta per chunk; resolves `{ text }` or error code. Hint ladder:
  hintLevel 1..4 (1 nudge → 2 bigger hint → 3 worked step → 4 answer). Server declines
  out-of-scope questions itself and answers crisis disclosures deterministically (helpline 14416).
- `aiApi.mistake(...)` → `{ explanation, misconception, practice:{text,options,answer,explanation} }`
- `aiApi.notes(...)` → `{ summary[1..6], glossary[≤8], flashcards[≤10], questions[≤5] }` (answer index)
- `aiApi.practice(...)` → `{ items[1..5] }` (server already double-solve-checked)
- `aiApi.plan(...)` → `{ suggestions: {date, sessionIndex, newStartMin, reason}[] }` (server validated
  against rescheduleOptions; client still previews)
- `aiApi.nudge(...)` → `{ data: string }` (a nudge text)
- `aiApi.report({feature, output, note?})` — Report-a-problem control
- `aiApi.budget()` → `{ callsLeft, callsCap, enabled }`
- `aiApi.enable(bool)` — opt-in toggle (minor without consent → CONSENT_REQUIRED)

## Hard rules

1. **No XP, no streak, no mastery, no SRS for AI practice.** Any AI-generated question/card the
   learner answers is rendered by AI components with local state only (or `ai-generated` events);
   never dispatch quiz-attempted/practice-done/etc. Show "Practice only, no XP" (`ai.noXp`).
2. **Label every AI output**: AI badge + line `ai.disclaimer` ("AI can make mistakes. Check with
   your textbook or teacher.") + `ai.report` control. Label = `ai_generated_unreviewed` / beta.
3. **AI output rendering**: use the shared `<AiMarkdown text>` component built on `react-markdown`
   (installed) with `allowedElements` limited to p, br, strong, em, ul, ol, li, code, pre. NEVER
   images, links, or raw HTML; never `dangerouslySetInnerHTML`.
4. **Markdown-free input**: learner inputs are plain textareas.
5. i18n: add keys to EN dict in `src/lib/lumio/i18n.ts` under `ai.*` namespace; DictKey is
   compile-checked; add HI + HINGLISH translations for every key (short, natural; code/numbers/URLs stay English).
6. UI: reuse shadcn primitives (`src/components/ui/*`), `press` class on buttons, min 44px targets,
   `rounded-2xl border border-border bg-card p-5` cards, `role="status"`/`aria-live="polite"` for
   async states, `tabular-nums` for numbers. No indigo/blue beyond existing tokens. All screens must
   work at 390px and with `.calm`.
7. LumioApp declaration-order rule: derived consts (`tz, calm, theme, band, density, lang, tr`, …)
   BEFORE all useEffects. New event cases follow the recipe in `events.ts` (dedupe by id in the case).
8. `/api/*` must never be cached by the SW (already true — do not touch sw.js).
9. Signed-out users see `ai.needSignIn` ("Sign in to use AI help") — never a broken button. When
   `aiEnabled` is false: `ai.optInFirst`. Server gate repeats these; client handles codes.
10. Chat history for Study Buddy lives in component state (session-only); nothing persisted.

## Event recipe for saving AI results (practice-only, reload-safe)

Add ONE event type `ai-generated`:
```ts
// types.ts
| { type: 'ai-generated'; id: string; kind: 'notes' | 'practice'; date: string; payload: NotesAiResult | { items: PracticeAiItem[] }; label: string }
```
`events.ts` applyEvent case: dedupe by `state.aiContent?.[e.id]`; store into `state.aiContent[id] = { kind, date, payload, label }`.
`storage.ts`: `aiContent: s.aiContent ?? {}` in normalize + `aiContent: {}` in defaultState (and in
the LumioState type + any state-shape docs). Cap: applyEvent keeps at most the 30 most recent ids
(sort by insertion — simply delete oldest key beyond 30; events are replayed in order).
State gains NOTHING else. No XP ledger touch. Display of saved items lives in the AI panels
(saved notes summary card in StudyTools; saved practice items in the practice panel).

## Component placement

- `src/components/lumio/ai/AiMarkdown.tsx` — shared renderer + `<AiLabel>` (badge, disclaimer, report).
- `src/components/lumio/ai/StudyBuddy.tsx` — floating panel (bottom-right card, `fixed bottom-24 inset-x-3 z-50 md:bottom-6 md:right-6 md:w-96 max-h-[70vh] overflow-y-auto scroll-slim`), opened by a floating "Ask" button; also embeddable inside Reader.
- Quiz + Notebook explainers and Notes AI render inline cards in their screens.

## Study Buddy entry points (spec)

- Floating "Ask" affordance (Shell-level): opens panel; when a chapter is open in Reader, the panel
  grounds on THAT chapter; from Study/home it lists the band's chapters (simple select) —
  grounding context comes from `BANDS[band].chapters[i]` + `keyPointsFor`/`glossaryFor` from
  `src/lib/lumio/chapterContent.ts` (pure client module, fine to import).
- Reader screen: an "Ask Study Buddy" button opens the same panel pre-grounded on the open chapter.
- Hint ladder UI: reply footer buttons: `ai.hintMore` ("Explain a bit more") raises hintLevel
  (1→4); asking the same question twice auto-raises; level 4 answer requires two asks (spec).
- Persona by band: server handles copy; UI sends `band`. Language: send profile lang.
- Read-aloud for band 'young': a speaker button per reply reusing the `speechSynthesis` approach in
  `Reader.tsx` (u.lang = hi-IN for Devanagari) — keep it minimal (speak full reply, stop button).
- Voice dictation (Tier 3): mic button using `webkitSpeechRecognition` guarded by feature check;
  honest `ai.dictationUnsupported` fallback; label `ai.dictationNote` ("Audio is processed by your browser").

## Explain my mistake (spec)

- Quiz screen (wrong answer or results): "Explain my mistake" button → inline card:
  explanation, misconception ("Likely mix-up"), 1 remedial question rendered with option buttons;
  selecting reveals right/wrong — local state only, `ai.noXp` line. Failure → fall back to the
  authored `q.explanation` (show it, no error card). `chosen` = the learner's picked index (live in Quiz);
  from Mistake Notebook (Practice.tsx NotebookTab rows) `chosen` = null.
- Cached per question id in component state; report control on the card.

## Notes AI (spec)

- StudyTools "My notes": per-note consent checkbox (`ai.notesConsent`: "Send this note to the AI
  helper?") + `ai.notesSend` button (disabled until checked). Result card: `ai.notesTitle` ("AI
  summary of your document"), summary bullets, glossary table, flashcard grid, questions
  (answerable, practice-only). Buttons: Save (dispatches `ai-generated`, kind 'notes') +
  Regenerate. Already-saved notes show a "Saved" chip (`ai.savedChip`).

## Honest states (degradation matrix)

- signed out → `ai.needSignIn`; aiEnabled false → `ai.optInFirst` + link text to Settings;
  OVER_BUDGET → `ai.err.OVER_BUDGET` ("AI help is resting until tomorrow") + budget line;
  UNAVAILABLE/INVALID_RESPONSE/BLOCKED_BY_POLICY → calm copy; AI panel actions hidden entirely when
  `/api/capabilities` reports ai.mode 'off' (LumioApp already probes capabilities — thread the flag).
- Show remaining budget on panels: `ai.budgetLeft` ("{n} of {cap} AI helps left today") via aiApi.budget.

## Feature flags summary

capability probe (`authApi.capabilities()`) → `ai.mode: 'off' | 'fake' | 'openai-compatible'`.
Store in LumioApp state `aiMode` (default 'unknown' → treat as off until probe resolves, probe is
post-hydration). Pass `aiAvailable={aiMode !== 'off'}` + `signedIn={!!accountUser}` +
`aiEnabled={accountUser?.aiEnabled}` down to screens. Settings toggle calls aiApi.enable then
refreshes the account probe.
