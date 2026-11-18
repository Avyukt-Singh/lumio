# AI Setup (chunk 5B) — free-tier LLM for Lumio's AI help features

Lumio's AI features (Study Buddy, Explain my mistake, Notes-to-study, Practice
generator beta, Plan Coach, Code Lab nudge) run behind one server-only gateway
(`src/lib/ai/`). With **no configuration at all** they run on the deterministic,
clearly-labelled **fake adapter** — every screen is demoable and verifiable with
no key and no network. To use a real model, pick ONE free option below and set
three env lines. **Status: FAKE-ONLY** — no real provider has been exercised
end-to-end from this environment yet (no API key available during the build),
so everything below the table is documented-but-`VERIFY`. **Chunk 5-AI
update: the REAL path is now `AI_PROVIDER=zai` (the platform z-ai gateway,
backend-only SDK — no key needed), and it is the verified configuration:
every AI feature (chat, lesson, quiz, worksheet, mock, coach, guardian, OCR)
was exercised against the live model with curl + browser evidence (see
PROGRESS.md and ADR 0006). The openai-compatible options below remain for
self-hosting / other keys and stay `VERIFY` until exercised with a key.

## The three env lines (any option)

```bash
AI_PROVIDER=openai-compatible
AI_BASE_URL=<base URL from the table below>
AI_API_KEY=<your free key>
# optional, recommended:
AI_MODEL=<a current model name from the provider's docs — never trust a hardcoded one>
```

Never commit real values. The gateway talks plain OpenAI-compatible
`POST {BASE_URL}/chat/completions`, so any provider speaking that protocol
works without provider-specific code.

## Free options (verify limits before relying on them — they change)

| Option | Typical base URL | Notes to VERIFY |
| --- | --- | --- |
| Google Gemini (AI Studio free tier) | `https://generativelanguage.googleapis.com/v1beta/openai/` | Free-tier rate limits; **whether free-tier data may be used for training** — matters for children's data. Prefer a paid/data-against-training tier for production. |
| Groq (free tier) | `https://api.groq.com/openai/v1` | Per-minute and per-day limits; fast Llama-family models. |
| OpenRouter free models | `https://openrouter.ai/api/v1` | Only models whose IDs end in `:free`; heavily rate-limited; availability changes. |
| Ollama (self-hosted, truly free) | `http://localhost:11434/v1` | Needs the owner's own machine; no key; no data leaves the device (best privacy for a children's product). |

## One-line smoke test per option

```bash
curl -s "$AI_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $AI_API_KEY" -H "content-type: application/json" \
  -d '{"model":"'$AI_MODEL'","messages":[{"role":"user","content":"Say OK"}],"max_tokens":5}'
# expect a JSON body with choices[0].message.content — then restart Lumio and
# confirm GET /api/capabilities reports ai.mode = "openai-compatible".
```

## Automatic failover (optional, recommended with two free tiers)

```bash
AI_FALLBACK_BASE_URL=<second provider base URL>
AI_FALLBACK_API_KEY=<second key>
AI_FALLBACK_MODEL=<second model>
```
On primary `429`/`5xx` the gateway retries once against the fallback; if both
fail it degrades to the labelled fake so learner screens never show raw errors.

## Budgets and caps

```bash
AI_USER_DAILY_CALLS=40        # calls per signed-in user per day
AI_USER_DAILY_TOKENS=30000    # prompt+completion tokens per user per day
AI_IP_HOURLY_CALLS=60         # calls per client-IP hash per hour (in-memory)
AI_GLOBAL_DAILY_CALLS=2000    # whole deployment per day
```
Exceeding any cap returns `OVER_BUDGET`; the UI shows "AI help is resting
until tomorrow" honestly. AI requires a **verified signed-in account** and the
**aiEnabled opt-in** (guardian-consent-gated for minors).

## Fake-adapter tuning

```bash
FAKE_LATENCY_MS=350   # artificial latency so loading states are visible
FAKE_FAIL_RATE=0      # 0..1 — set 1 to verify every error path end to end
```

## Privacy (children's product — read before enabling a real provider)

- Prompts never contain the learner's name, email, phone number or account id;
  free text is scrubbed (emails/phones/URLs removed) before it reaches the
  gateway; a per-request pseudonym is used.
- Learner notes and chapter text are fenced as **data** (`<DATA>` blocks) and
  the system prompt states they are never instructions; the model has no tools.
- Prefer a provider/plan whose free tier does **not** train on API data (check
  the provider's current terms — Gemini's free tier has historically allowed
  training; Groq/OpenRouter free tiers state their own policies; Ollama
  guarantees nothing leaves the machine).
- Every AI surface shows the label "AI can make mistakes. Check with your
  textbook or teacher." and a working Report-a-problem control (`AiReport`).

## What is still FAKE-ONLY (honest status)

The gateway, adapters, budgets and safety layers are implemented and verified
with the fake adapter (curl + browser evidence in PROGRESS.md). No real
provider was exercised (no key in this environment), so:
- `docs/INTEGRATIONS.md` LLM row stays `FAKE-ONLY`;
- the second-independent-solve accuracy check is **vacuous under the fake**
  (the solver fixture echoes the key) — with a real provider it genuinely
  re-solves and drops disagreeing items;
- before production use, run the manual test sheet at the bottom of
  `docs/EMAIL_SETUP.md`-style checklists for each feature with a real key and
  only then upgrade the row to `VERIFIED`.
