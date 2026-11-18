// Shared external-call wrapper (chunk 5A). One place for the timeout, retry
// and error taxonomy that both the email layer (Phase 1) and the AI gateway
// (Phase 2) reuse. Failures never carry provider internals past this boundary
// — callers receive the closed taxonomy plus a retryable flag only.
import 'server-only';

export type ExternalErrorCode =
  | 'UNCONFIGURED'
  | 'UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'INVALID_RESPONSE'
  | 'OVER_BUDGET'
  | 'BLOCKED_BY_POLICY';

export interface ExternalResult<T> {
  ok: boolean;
  code?: ExternalErrorCode;
  /** Calm, log-safe detail for server logs (redacted by the caller's adapter). */
  detail?: string;
  value?: T;
  retryable?: boolean;
  /** Seconds the caller should wait before retrying (from Retry-After). */
  retryAfterSec?: number;
}

export interface CallExternalOptions {
  /** Total timeout budget in ms. */
  timeoutMs: number;
  /** Extra attempts after the first try (2 = up to three sends). */
  retries: number;
  /** Base backoff in ms; doubles per retry with jitter. */
  backoffMs?: number;
  /** Only called when it returns true and the code is retryable. */
  shouldRetry?: (code: ExternalErrorCode, attempt: number) => boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run one attempt with a hard timeout, mapping exceptions to UNAVAILABLE.
 * `attempt` is the async work; it should already return ExternalResult.
 */
export async function callExternal<T>(
  attempt: () => Promise<ExternalResult<T>>,
  opts: CallExternalOptions
): Promise<ExternalResult<T>> {
  const maxAttempts = opts.retries + 1;
  let last: ExternalResult<T> = { ok: false, code: 'UNAVAILABLE', retryable: false };

  for (let a = 0; a < maxAttempts; a++) {
    last = await withTimeout(attempt, opts.timeoutMs);
    if (last.ok) return last;
    const retryable = last.retryable === true;
    const wantsRetry = opts.shouldRetry ? opts.shouldRetry(last.code ?? 'UNAVAILABLE', a) : retryable;
    if (!wantsRetry || a === maxAttempts - 1) return last;
    const base = opts.backoffMs ?? 500;
    const jitter = Math.floor(Math.random() * 250);
    await sleep(base * 2 ** a + jitter);
  }
  return last;
}

async function withTimeout<T>(
  attempt: () => Promise<ExternalResult<T>>,
  timeoutMs: number
): Promise<ExternalResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      attempt(),
      new Promise<ExternalResult<T>>((resolve) => {
        timer = setTimeout(
          () => resolve({ ok: false, code: 'UNAVAILABLE', detail: 'timeout', retryable: true }),
          timeoutMs
        );
      }),
    ]);
  } catch (err) {
    // Network-level throw: never propagate provider internals.
    const detail = err instanceof Error ? err.name : 'error';
    return { ok: false, code: 'UNAVAILABLE', detail, retryable: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
