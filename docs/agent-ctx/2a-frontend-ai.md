# Task 2-a — Frontend Tier 1 AI features (work record)

## Status: COMPLETE (lint + tsc clean, dev server compiles)

## Files created
- `src/components/lumio/ai/AiMarkdown.tsx` — AiMarkdown (react-markdown, allow-list p/br/strong/em/ul/ol/li/code/pre, unwrapDisallowed, no links/images/html), AiLabel (AI badge + disclaimer + report disclosure → aiApi.report), AiBadge (with Demo chip), aiErrKey (code → DictKey), fillVars ({n}/{cap} interpolation), useAiBudget hook.
- `src/components/lumio/ai/AiMistakeCard.tsx` — trigger/gate/load-skeleton/result card; module-level Map cache per question id; misconception block; 1 practice question with local reveal + ai.noXp; ANY failure → authored q.explanation fallback (never an error card).
- `src/components/lumio/ai/StudyBuddy.tsx` — floating panel (`fixed bottom-24 inset-x-3 z-50 md:bottom-6 md:right-6 md:w-96 max-h-[70vh]`), gates (needSignIn/optInFirst/UNAVAILABLE + onGoSettings), chapter select when not pre-grounded, streaming via aiApi.chat + AbortController, hint ladder 1–4 (same question auto-raises; ai.hintLevelLabel), read-aloud (band 'young' only, hi-IN for Devanagari, stops on close), mic dictation (feature-detect, honest toast fallback), budget line after each reply, BLOCKED_BY_POLICY replaces bubble with calm copy, user-stopped keeps partial text with no error card.

## Files modified
- `src/lib/lumio/i18n.ts` — 57 ai.* keys added to EN, HI (Devanagari), HINGLISH.
- `src/lib/lumio/aiClient.ts` — streamChat gained optional `signal?: AbortSignal` (never-throw contract preserved; abort resolves {ok:false,code:'UNAVAILABLE'}).
- `src/lib/lumio/types.ts` — LumioState.aiContent (AiContentRecord), `ai-generated` event, StoredEvent.id widened to `number | string` (ai-generated events carry their own string id; Dexie ++id accepts it).
- `src/lib/lumio/events.ts` — `ai-generated` case: dedupe by id, insert-ordered cap of 30 ids.
- `src/lib/lumio/storage.ts` — aiContent in defaultState + normalizeState.
- `src/components/lumio/Shell.tsx` — new `aiSlot?: ReactNode` prop rendered between <main>'s column and the bottom nav (mirrors accountSlot).
- `src/components/lumio/screens/Reader.tsx` — optional `onAskAi` prop → "Ask Study Buddy" ghost button (BookOpenText) in the chapter header card.
- `src/components/lumio/screens/Quiz.tsx` — AI props (aiAvailable/signedIn/aiEnabled/demo); per-question AiMistakeCard on wrong answers (chosen = live pick, tracked in a picks record); results screen renders an AiMistakeCard per wrong id.
- `src/components/lumio/screens/Practice.tsx` — NotebookTab rows get AiMistakeCard with chosen=null; AI props threaded through PracticeHubProps.
- `src/components/lumio/screens/Games.tsx` — AI props threaded GamesScreen → PracticeHub.
- `src/components/lumio/screens/StudyTools.tsx` — NoteAiBlock per note: consent Checkbox + send button, result card (summary bullets, glossary rows, flashcards grid with reveal, questions with local reveal + ai.noXp), Save (`notes#${noteId}#${lang}#${date}`) via onSaveAi, Saved chip from `aiContent` id-prefix, Regenerate, AiLabel; AI props threaded.
- `src/components/lumio/LumioApp.tsx` — aiMode state from the existing capabilities probe (default 'unknown' → off until probe resolves; 'fake' shows Demo chip), aiAvailable/signedIn/aiEnabled derived, studyBuddyChapter derived from `reader`, saveAiContent/saveAiNotes mutation wrappers, aiSlot (floating trigger `fixed bottom-24 right-3 z-40 md:bottom-6 md:right-6`, hidden when panel open / firstRun / !aiAvailable) + <StudyBuddy>, props threaded to Quiz/Games/StudyTools/Reader.

## Key decisions / deviations
- `StoredEvent.id` widened to `number | string` instead of renaming the event field — the contract mandates `ai-generated`'s `id: string`; Dexie `++id` uses the supplied string as primary key for those rows only, replay dedupe stays intact.
- Render-time state adjustment (React-recommended pattern) instead of setState-in-effect in StudyBuddy, to satisfy the repo's react-hooks/set-state-in-effect lint rule.
- Notes "Regenerate" button reuses `ai.notesSend` label; Save button turns into the Saved chip after dispatch.
- NoteAiBlock shows the AI block always under each note row (not only when the note is expanded).
- Quiz results screen passes `chosen` via a picks record recorded at check() time (not just null), so aiApi.mistake gets the real chosen index.

## Verification
- `bun run lint` — 0 problems.
- `bunx tsc --noEmit` — only pre-existing examples/ + skills/ errors.
- dev.log — clean compiles, GET / 200.
