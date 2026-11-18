# ADR 0005: Provider-agnostic LLM gateway with a deterministic fake

Date: 2026-02 (chunk 5B) · Status: accepted

## Context
Lumio wants AI help for learners (Socratic tutor, mistake explainer, notes
study-set builder, practice generator, plan coach, code nudge) on free-tier
LLM APIs, while being a children's product: quotas are precious, failures are
normal on free tiers, and the app must stay fully functional offline.

## Decision
1. One server-only seam, `src/lib/ai/gateway.ts`: `complete()`, `stream()`
   (async generator) and `completeJson(schema)` (Zod 4, ONE repair retry, then
   typed failure → authored-content fallback). Nothing in the browser sees a
   key; all calls go through `/api/ai/*` route handlers.
2. Adapters chosen by `AI_PROVIDER`: `fake` (default, deterministic, labelled,
   fixture-driven via `req.meta` that real adapters ignore),
   `openai-compatible` (covers Gemini/Groq/OpenRouter/Ollama with three env
   lines), optional second config as fallback chain (failover on 429/5xx),
   and last-resort fake degradation so demos never break.
3. `callExternal()` (chunk 5A) provides the shared timeout/retry/jitter/
   Retry-After behaviour and the closed error taxonomy
   (`UNCONFIGURED | UNAVAILABLE | RATE_LIMITED | OVER_BUDGET | INVALID_RESPONSE
   | BLOCKED_BY_POLICY`) mapped to calm EN/HI/Hinglish copy.
4. Budgets need an owner: verified signed-in account required; per-user/day +
   per-IP/hour + global/day caps; non-personal generations cached by content
   hash. `AiUsage` (SQLite) is the ledger; the IP limiter is in-memory.
5. Safety: opt-in `aiEnabled` (guardian-consent-gated for minors), prompt
   scrubbing (no names/emails/phones/ids, per-request pseudonym), fenced data
   blocks + no-tools system policy, deterministic crisis pre-filter
   (Tele-MANAS 14416 reply without any model call), deterministic output check,
   react-markdown allowlist rendering, AI practice never grants
   XP/streak/mastery/SRS, every surface labelled + Report control (`AiReport`).

## Alternatives considered
- Direct client calls to providers — rejected: leaks keys, cannot budget.
- Provider-specific SDKs — rejected: N integrations to maintain; the
  OpenAI-compatible surface covers all free options.
- next-auth + a hosted AI middleware — rejected as off-spec (ADR 0004 custom
  auth is the identity base; budgets are local).
- Streaming via WebSocket — rejected: SSE over fetch is enough and degrades
  cleanly.

## Consequences
- Fake outputs are only as good as their fixtures; under the fake the
  double-solve accuracy check is vacuous (documented in KNOWN_LIMITS).
- The `req.meta` fixture channel must stay out of real prompts — enforced by
  construction (only `FakeAdapter` reads it).
- UPGRADING to a real provider is three env lines + a smoke test (AI_SETUP.md).
