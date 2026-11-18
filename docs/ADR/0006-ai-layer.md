# ADR 0006: The AI layer (chunk 5-AI) — real provider, additive features, deterministic rules

Date: 2026-02 (chunk 5-AI) · Status: accepted

## Context

Chunk 5B shipped a provider-agnostic LLM gateway (ADR 0005) with the
deterministic fake as the only exercised adapter (no key was available). The
5-AI prompt asks for a real AI layer across generation (lessons, quizzes,
worksheets, mocks), coaching (plan explanations, guardian narrative) and
multimodal input (photo notes) — without breaking the offline-first event
log, the deterministic domain rules, or the honesty rules (R1/R8/R10).

## Decision

1. **Real adapter = z-ai platform gateway** (`src/lib/ai/zai.ts`, mode
   `AI_PROVIDER=zai`). The sandbox provides `z-ai-web-dev-sdk` server-side
   only (R2: no key ships; R8: free in this environment). It implements the
   same `StreamingAdapter` contract (SSE parsed from the SDK's `stream:true`
   body; `complete` for JSON tasks) plus `zaiVision` for the photo-notes OCR.
   The fake remains the zero-config default and the universal last-resort
   fallback (degrades, never crashes); the OpenAI-compatible adapter stays
   documented for real keys (AI_SETUP.md). Platform message convention:
   'system' prompts ride as 'assistant' messages per the LLM skill.
2. **Structured output is normalised before validation, validated, and
   never trusted.** Real models drift around wrapper/field names
   (`items`/`questions`, `text`/`question`, `answer` as index, letter or
   option text; `correct_option`; missing explanations). Each prompt file
   v1 owns a `z.preprocess` normaliser that maps observed shapes into the
   canonical one using ONLY the model's own content (deriving a flashcard or
   an "answer key" line from it is not inventing), clamps lengths, and drops
   unusable items. Dev-only schema-issue logging in `gateway.tryParse` shows
   drift in the server log. After validation: MCQ sanity (unique options,
   one key in range), deterministic output check, and an independent
   re-solve agreement per checkable item (drop + honest `dropped` count).
3. **AI never touches the domain.** New events: `ai-content-saved` /
   `ai-content-removed` (same 30-cap + dedupe as `ai-generated`) and
   `ai-quiz-attempted`. XP from AI quizzes is computed by the reducer with
   the deterministic improvement rule, a per-chapter best across ALL
   generated sets (`state.aiQuizBest` — regeneration can never reset it) and
   a hard daily cap (`AI_QUIZ_XP_DAILY_CAP = 40`), ledger source `aiquiz`.
   `domain.ts` stays pure and AI-free; the coach and plan-suggestion routes
   read aggregates only and can never move sessions or grant anything.
4. **Additive content with provenance.** AI lessons/worksheets/mocks render
   only through the labelled AI components (`AiBadge`, `AiLabel`,
   `AiMarkdown` allowlist); the deterministic `chapterContent.ts` and
   `content.ts` remain untouched and stay the visible fallback on every
   screen. Accepted artefacts persist via the event log (replay-safe,
   offline after saving) — never HTML, never official claims.
5. **Photo notes are never auto-saved.** `/api/ai/ocr` returns scrubbed text
   (`NOT_TEXT` guard, output check); the client always shows an editable
   "Check the extracted text" step before the existing `note-added` event.

## Consequences

- Real-model shape drift is handled in production code (normalisers +
  validation + re-solve) rather than by prompt hoping.
- `AI_PROVIDER=zai` needs zero secrets; a production deployment can swap to
  `openai-compatible` + key by env alone.
- The `simpler`/`example`/`translate` lesson modes cost one generation call
  each; the lesson route caches by content hash (6 h TTL).
- AI-quiz XP is bounded (40/day) and improvement-only; streak days count
  only when XP > 0, exactly like authored quizzes.
- What the real provider was NOT asked to do: image generation (Tier 3, not
  built), long-context video transcription (not built).

## Alternatives considered

- Keeping fake-only until a paid key exists — rejected: the platform gateway
  is free here and lets every real-model path be exercised and verified.
- Trusting model JSON with prompt-only shape control — rejected: observed
  drift (5 different shapes in one afternoon) makes runtime normalisation
  mandatory.
- Writing AI-quiz XP through `quiz-attempted` — rejected: it would bypass
  the daily cap and the cross-set best tracking.
