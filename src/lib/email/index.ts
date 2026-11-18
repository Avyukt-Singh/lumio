// Email layer (chunk 5A, ADR 0004). A typed provider boundary with two
// adapters: `console` (the deterministic fake — default when nothing is
// configured) and `smtp` (the one real adapter, nodemailer). Nothing outside
// this module may know which adapter is active; the capability table exposes
// only the mode. Messages contain no links and no tracking pixels.
import 'server-only';
import { devOutboxAllowed, emailProviderMode } from '@/lib/auth/env';
import { callExternal, type ExternalResult } from './callExternal';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Stable key so adapters can dedupe retries. */
  idempotencyKey: string;
}

export type EmailResult = ExternalResult<{ messageId: string }>;

export interface EmailProvider {
  readonly mode: 'console' | 'smtp';
  send(msg: EmailMessage): Promise<EmailResult>;
}

// ---------- console adapter (the fake) ----------

interface OutboxEntry extends EmailMessage {
  at: string;
}

// Cross-bundle state (Next dev compiles each route separately): the outbox
// must live on globalThis so the dev/outbox reader sees sends made by other
// route handlers in the same process.
const g = globalThis as unknown as { __lumioOutbox?: OutboxEntry[] };
const outbox = (g.__lumioOutbox ??= []);
const OUTBOX_CAP = 50;

const consoleProvider: EmailProvider = {
  mode: 'console',
  async send(msg) {
    const entry: OutboxEntry = { ...msg, at: new Date().toISOString() };
    outbox.push(entry);
    if (outbox.length > OUTBOX_CAP) outbox.shift();
    // Server-console rendering: the code is easy to read for demos and the
    // browser agent. No real network call happens in this adapter.
    console.info(
      [
        '',
        '──────────── [Lumio email — dev console adapter] ────────────',
        `To:      ${msg.to}`,
        `Subject: ${msg.subject}`,
        '────────────',
        msg.text,
        '─────────────────────────────────────────────────────────────',
        '',
      ].join('\n')
    );
    return { ok: true, value: { messageId: `dev-${Date.now()}` } };
  },
};

/** Dev-only outbox reader (see GET /api/dev/outbox). Returns a copy. */
export function readDevOutbox(): OutboxEntry[] {
  return outbox.map((e) => ({ ...e }));
}

// ---------- smtp adapter (the real one) ----------

async function smtpSend(msg: EmailMessage): Promise<EmailResult> {
  const host = (process.env.SMTP_HOST ?? '').trim();
  if (!host) return { ok: false, code: 'UNCONFIGURED', retryable: false };
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = String(process.env.SMTP_SECURE ?? '') === 'true' || port === 465;
  const user = process.env.SMTP_USER ?? '';
  const pass = process.env.SMTP_PASS ?? '';
  const from = process.env.EMAIL_FROM ?? 'Lumio <no-reply@lumio.local>';

  // Lazy require keeps startup fast when SMTP is unused; nodemailer types only.
  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    connectionTimeout: 8000,
  });

  return callExternal(
    async () => {
      const info = await transport.sendMail({
        from: { name: 'Lumio', address: from.replace(/^[^<]*<([^>]*)>.*$/, '$1') || from },
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
      return { ok: true, value: { messageId: info.messageId } };
    },
    { timeoutMs: 8000, retries: 2, backoffMs: 600 }
  );
}

// ---------- selection ----------

/** The active provider, chosen by EMAIL_PROVIDER (see auth/env.ts). */
export function emailProvider(): EmailProvider {
  const mode = emailProviderMode();
  if (mode === 'smtp') {
    // Wrap smtpSend so it satisfies the interface; errors are already mapped.
    return { mode: 'smtp', send: smtpSend };
  }
  return consoleProvider;
}

/** SMTP present but unconfigured? Capabilities reports this honestly. */
export function emailCapability(): {
  mode: 'console' | 'smtp' | 'off';
  reason: string;
} {
  const raw = (process.env.EMAIL_PROVIDER ?? '').trim().toLowerCase();
  const mode = emailProviderMode();
  if (mode === 'off') {
    return { mode: 'off', reason: 'EMAIL_PROVIDER is set to off — email features are disabled.' };
  }
  if (mode === 'smtp') {
    return {
      mode: 'smtp',
      reason: 'Real SMTP delivery via the configured server. Free-tier options are documented in docs/EMAIL_SETUP.md.',
    };
  }
  if (raw === 'smtp') {
    return {
      mode: 'console',
      reason: 'EMAIL_PROVIDER=smtp but SMTP_HOST is missing — falling back to the dev console adapter.',
    };
  }
  return {
    mode: 'console',
    reason: devOutboxAllowed()
      ? 'Development mode: no email is really sent. Codes appear in the server console and at GET /api/dev/outbox.'
      : 'No email provider configured.',
  };
}
