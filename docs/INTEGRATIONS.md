# INTEGRATIONS.md — Lumio 2.0, chunk 1

One row per external service. Status values per master prompt 13: **VERIFIED**
(tested against the real service), **FAKE-ONLY** (only the fake was exercised),
**VERIFY** (not confirmed), plus **NOT-USED-IN-CHUNK-1** for planned services and
**VERIFY (carried from prototype)** for links inherited from the prototype without
re-validation. Rule R10 applies: nothing here is trusted without confirmation.

| Purpose | Adapter | Env vars | Quotas/cost | Privacy | Fallback | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Fonts (Plus Jakarta Sans, Inter) | `next/font` build-time bundling | none | Free (Google Fonts licence, OFL); no runtime fetch, no per-view calls | No third-party request at runtime; fonts ship inside the app bundle | System font stack if the bundle fails | VERIFIED-LOCAL-BUILD (bundled at build time; offline after load) |
| Board link: CBSE | Direct `<a>` link-out (no embed, no scraping) | none | Free | Learner leaves the app; no data sent by us | Link renders as text with the URL visible; link checker owed (R1) | VERIFY (carried from prototype, not re-validated in this environment) |
| Board link: CISCE / ICSE | Direct `<a>` link-out | none | Free | As above | As above | VERIFY (carried from prototype) |
| Board link: NIOS | Direct `<a>` link-out | none | Free | As above | As above | VERIFY (carried from prototype) |
| Board link: CBSE Class 11 Physics official PDF (outline facts) | Link-out from the CBSE Class 11 Physics outline screen; facts from CBSE's own listing, no copied board material (R14) | none | Free | As above | As above | VERIFY (carried from prototype) |
| Self-hosted Pyodide (Python coding lab) | none yet | none | Free, self-hosted planned | Runs locally in the learner's browser | Not used in chunk 1 | NOT-USED-IN-CHUNK-1 (chunk 3; self-hosted pinned build with integrity check) |
| YouTube IFrame (Study Video beside notes) | none yet | none | Free | Third-party embed loads only when a learner pastes a link; labelled | Feature hidden until chunk 4 | NOT-USED-IN-CHUNK-1 |
| Web Push (VAPID) | none yet | planned: VAPID keys server-side only (R2) | Free tier | Consent-gated; iOS requires installed PWA (honest handling owed) | In-app + service-worker notification while the tab is open | NOT-USED-IN-CHUNK-1 (chunk 5) |
| Email (verification OTPs) | Typed `EmailProvider`: `console` fake (default) + `smtp` real adapter (nodemailer) | `EMAIL_PROVIDER, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, EMAIL_FROM` | Free options documented in `docs/EMAIL_SETUP.md` (Gmail app password, Brevo free relay, Mailpit) — each `VERIFY` | Codes only; email address used for delivery; masked in UI; no links/tracking pixels; 5 emails/hour/email cap | Calm in-app failure message; recovery-code route always available; console adapter always works in dev | FAKE-ONLY (fake adapter verified end-to-end via dev outbox + browser flows; no real SMTP credentials in this sandbox) |
| SMS | none yet | planned: provider webhook | Free-tier rule applies; fake-only if no free provider | Never asked for a parent's phone number (3.3) | Fake adapter; feature degrades to in-app | FAKE-ONLY-PLANNED (chunk 5) |
| LLM gateway (AI help, chunk 5B) | server-only `src/lib/ai/` — fake adapter (default) + OpenAI-compatible adapter (Gemini/Groq/OpenRouter/Ollama) + optional fallback chain | free-tier keys never ship; server-side only, budgeted (per-user/day, per-IP/hour, global), opt-in (`aiEnabled`), guardian-consent for minors | Grounded on Lumio chapters, scrubbed prompts (no names/emails/phones/ids), fenced data blocks (injection defence), output check + react-markdown allowlist, helpline crisis path (Tele-MANAS 14416) | Signed-out: "Sign in to use AI help"; aiEnabled off: "Turn on AI help in Settings"; OVER_BUDGET: calm rest message; provider down: labelled fake, never raw errors; `AI_PROVIDER=off` hides everything | **VERIFIED (zai)** — chunk 5-AI: `AI_PROVIDER=zai` runs the platform z-ai gateway (backend-only SDK, no key) as the real adapter; chat SSE, lesson/quiz/worksheet/mock/coach/guardian generation and vision OCR all exercised end-to-end with the live model (curl + browser evidence in PROGRESS.md); fake fallback retained; OpenAI-compatible adapter remains documented-but-`VERIFY` in `docs/AI_SETUP.md` |
| Open-Meteo (weather-context examples) | none yet | none | Free, no key | No personal data | Static example data | NOT-USED-IN-CHUNK-1 |
| data.gov.in (open data datasets) | none yet | none | Free | Public data only | Made-up labelled datasets (Dataset Explorer) | NOT-USED-IN-CHUNK-1 |
| Wikimedia (attribution-backed content) | none yet | none | Free | CC BY-SA attribution stored in provenance fields | Link-out only | NOT-USED-IN-CHUNK-1 |

## Notes

- Chunk 1 has exactly one runtime-affecting external dependency: fonts, resolved at
  build time via `next/font` (no runtime Google Fonts request). This satisfies the
  gap-table row "Fonts: self-hosted, subsetted, privacy and offline".
- The four board links are the only official references in the app. They exist as
  plain link-outs; no board material is copied (R14). Their URLs were not re-validated
  in this environment; the build-time link checker required by R1 is owed (KNOWN_LIMITS.md).
- Every future service lands here first with an adapter interface plus a deterministic
  fake (R3), and its row gains VERIFIED/FAKE-ONLY status only with evidence (14.4).
