# Email setup (chunk 5A)

Lumio sends only one kind of email today: 6-digit OTP codes (signup, sign-in,
password reset, account deletion). Codes are `VERIFY` rows in
`docs/INTEGRATIONS.md` — free quotas and app-password rules change, so check
the provider's current docs before trusting any limit below.

Copy the matching block into `.env` (create it next to `package.json`), then
restart the dev server.

## Default: console adapter (no configuration)

With no `EMAIL_PROVIDER` set, Lumio uses the **console** adapter:

- No email is really sent. Every message is printed to the server console and
  kept in an in-memory outbox readable at `GET /api/dev/outbox`
  (development only).
- The verify screen shows a clearly labelled "Development mode: no email is
  really sent" notice with the code.
- In production with this adapter, email signup is disabled honestly via the
  capability table.

## Real option 1: Gmail with an App Password (free)

1. Enable 2-Step Verification on the Google account.
2. Create an App Password (Google Account → Security → App passwords).
   Note: Google's rules for app passwords change — `VERIFY` against current
   docs.
3. `.env`:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@gmail.com
SMTP_PASS=your-16-char-app-password
EMAIL_FROM=Lumio <you@gmail.com>
```

4. One-line smoke test after restart:

```sh
curl -s -X POST http://localhost:3000/api/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@gmail.com","purpose":"login"}'
```

then read the message in your Gmail inbox (and the server console log).

## Real option 2: Brevo free SMTP relay (free tier)

1. Create a Brevo account; free tier includes a daily email allowance
   (`VERIFY` the current quota).
2. SMTP & API → create an SMTP key.
3. `.env`:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-brevo-login@example.com
SMTP_PASS=your-smtp-key
EMAIL_FROM=Lumio <verified-sender@example.com>
```

4. Same smoke test as above. Brevo requires a verified sender address — set
   `EMAIL_FROM` to the sender you verified.

## Local option 3: Mailpit (development inbox, truly free)

Run the Mailpit binary/Docker image (`VERIFY` current install docs):

```sh
docker run -p 8025:8025 -p 1025:1025 axllent/mailpit
```

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
EMAIL_FROM=Lumio <dev@lumio.local>
```

Read delivered mail at `http://localhost:8025`.

## Rules the email layer enforces (all modes)

- 8-second timeout, two retries with backoff inside the SMTP adapter.
- Provider errors never reach the client — only the closed error taxonomy and
  calm copy.
- Messages contain the code on its own line, the purpose in words, a
  10-minute validity line and a "didn't ask for this" line — in English and
  Hindi. **No links, no tracking pixels.**
- Sending is rate-capped: 5 per email/hour, 20 per IP-hash/hour, 60-second
  resend cooldown.
- Nothing under `/api/` is cached by the service worker.

## Status honesty

Unless you complete one of the real setups above and send yourself a code,
`docs/INTEGRATIONS.md` keeps the email row at `FAKE-ONLY` — that is the
default state of this repository.
