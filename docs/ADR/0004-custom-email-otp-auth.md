# ADR 0004: Custom email OTP auth (no NextAuth)

- **Status:** Accepted
- **Date:** chunk 5A
- **Deciders:** Lumio build agent, per the chunk-5 prompt

## Context

Chunk 5A adds optional accounts with a working email OTP verification flow
(sign up, verify, sign in, code sign-in, forgot password, recovery codes,
sign out, delete account) to a local-first, single-route SPA. The stack lists
`next-auth` v4 as installed, and the product rules demand: the app works with
no account and no network, nothing may gate the learning loop, and the capstone
scope keeps auth "minimal and honest".

## Decision

**Hand-rolled auth on Prisma + Node `crypto`.** `next-auth` stays installed
but unused.

Why not NextAuth:

1. Its credentials/email provider flows assume route-based redirects and CSRF
   callbacks that fight the single-route SPA (ADR 0001: no UI routes). An
   in-app dialog flow would need adapters against the library rather than
   with it.
2. The OTP lifecycle here is bespoke and small: HMAC-hashed 6-digit codes,
   single active code per (email, purpose), 5-attempt retirement, 60-second
   resend cooldown, hourly send caps, anti-enumeration responses, 15-minute
   lockout with an always-open code route. Modelling this inside NextAuth's
   callbacks would hide, not simplify, the logic.
3. The dependencies are zero: `node:crypto` covers scrypt passwords, SHA-256
   session token hashes, HMAC OTP hashes and HMAC-signed reset tickets.

## Details

- **Passwords:** `crypto.scrypt` (N=2^15, r=8, p=1, 64-byte key, 16-byte
  salt, `maxmem: 64 MiB` — the default 32 MiB ceiling rejects these params),
  stored self-describing as `scrypt$N$r$p$salt$hash`, verified with
  `timingSafeEqual`. Min length 8, max 128, no composition rules.
- **Sessions:** 32 random bytes (base64url) in the `lumio_session` cookie
  (`HttpOnly; SameSite=Lax; Path=/; Secure` in production). The database
  stores only the SHA-256 hash. 30-day sliding expiry, refreshed at most once
  per hour. State-changing routes reject a mismatched `Origin` header as the
  cheap CSRF defence (capstone cut — no token infrastructure).
- **OTPs:** 6 digits from `crypto.randomInt`; stored as
  `HMAC-SHA256(AUTH_SECRET, email:purpose:code)`. 10-minute expiry (env
  `OTP_TTL_MS` for verification runs), 5 wrong attempts kill the code, one
  active code per (email, purpose), 60-second resend cooldown, 5 sends/email
  per hour and 20 sends/IP-hash per hour (in-memory, globalThis-backed —
  ADR note below), constant-time compare, consumed codes never reusable.
- **Reset tickets:** HMAC-signed `email:expiry:nonce` blobs (10-minute TTL),
  single-use via a process-wide consumed set; consuming one revokes every
  session.
- **Recovery codes:** 8 × `XXXX-XXXX` from an unambiguous alphabet
  (no 0/O/1/I), HMAC-hashed, single-use; shown once with copy/download and an
  acknowledgement checkbox.
- **Anti-enumeration:** signup/otp-request answers are identical for known and
  unknown emails; duplicate verified-email signups quietly receive an
  "already have an account" login-code email (with the notice line) so the
  response shape never reveals existence. Sign-in failures are always
  "That email or password didn't match".
- **Cross-bundle state caveat (dev):** Next dev compiles each route handler
  into its own module graph, so module-level state (dev AUTH_SECRET, rate
  buckets, ticket sets, dev outbox) is NOT shared across routes. All of it
  lives on `globalThis` keys (`__lumioDevSecret`, `__lumioBuckets`,
  `__lumioUsedTickets`, `__lumioOutbox`) — same pattern as the Prisma
  singleton. In a production standalone build the same code is process-wide.
- **Email delivery:** a typed `EmailProvider` boundary with the deterministic
  `console` fake (default; prints to the server console + in-memory outbox,
  exposed via `GET /api/dev/outbox` in dev) and a real `smtp` adapter
  (nodemailer — chosen because it is the de-facto standard, tiny, and works
  with every free relay: Gmail app passwords, Brevo free tier, local Mailpit).
  Messages are plain-text-first + minimal HTML, contain no links and no
  tracking pixels, and carry an English + Hindi pair.
- **Minors:** "Whose email is this?" at signup; a guardian-owned verified
  email records `guardianConsentAt`; masked email everywhere; no extra
  personal data.

## Consequences

- Session and OTP state survive route recompilation in dev only via
  `globalThis`; a dev server restart regenerates the dev secret and clears
  in-memory buckets (documented in KNOWN_LIMITS).
- `next-auth` remains in `package.json` unused; removing it is a later
  cleanup, not part of this chunk.
- The `User` table is extended additively (nullable/defaulted columns only);
  the existing `User` and `Post` models and data are untouched.
