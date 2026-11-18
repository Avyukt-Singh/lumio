// LlmGateway (chunk 5B, server-only). The one seam between Lumio and any
// language model. Adapters never see learner identity; prompts are already
// scrubbed by the caller (safety.ts). Errors use the closed taxonomy shared
// with the email layer so every failure maps to one calm learner string.
import 'server-only';
import type { z } from 'zod';
import { callExternal, type ExternalErrorCode, type ExternalResult } from '@/lib/email/callExternal';
import { aiCapability, aiFallbackConfigured, aiModel, fakeTuning } from './env';
import { FakeAdapter } from './fake';
import { OpenAiCompatibleAdapter } from './openai';
import { ZaiAdapter } from './zai';

export type AiErrorCode = ExternalErrorCode;

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  /** Feature id, used by the fake adapter to pick a fixture and by logs. */
  feature: string;
  messages: LlmMessage[];
  maxTokens?: number;
  /** Ask the model for JSON (openai-compatible sets response_format). */
  json?: boolean;
  /** Approximate tokens charged to the budget when the provider omits usage. */
  approxTokensIn?: number;
  /**
   * Fixture inputs for the deterministic fake adapter (hint level, chapter
   * title, language…). Real adapters NEVER read this — prompts stay the
   * single source of truth for real models.
   */
  meta?: Record<string, string | number | string[] | boolean>;
}

export interface LlmReply {
  text: string;
  tokensIn: number;
  tokensOut: number;
  adapter: string;
}

export type LlmResult = ExternalResult<LlmReply>;

export interface LlmAdapter {
  readonly name: string;
  complete(req: LlmRequest): Promise<LlmResult>;
}

/** A text chunk event from stream(); done=true marks the end. */
export interface StreamEvent {
  delta?: string;
  done?: boolean;
  code?: AiErrorCode;
}

export interface StreamingAdapter extends LlmAdapter {
  /** Yields text deltas then one done event. Falls back to complete() when unsupported. */
  stream(req: LlmRequest): AsyncGenerator<StreamEvent, void, unknown>;
}

export function primaryAdapter(): StreamingAdapter {
  const cap = aiCapability();
  if (cap.effective === 'openai-compatible') {
    return new OpenAiCompatibleAdapter({
      baseUrl: (process.env.AI_BASE_URL ?? '').trim(),
      apiKey: (process.env.AI_API_KEY ?? '').trim(),
      model: aiModel(),
    });
  }
  if (cap.effective === 'zai') {
    return new ZaiAdapter();
  }
  return new FakeAdapter();
}

function fallbackAdapter(): StreamingAdapter | null {
  if (!aiFallbackConfigured()) return null;
  return new OpenAiCompatibleAdapter({
    baseUrl: (process.env.AI_FALLBACK_BASE_URL ?? '').trim(),
    apiKey: (process.env.AI_FALLBACK_API_KEY ?? '').trim(),
    model: (process.env.AI_FALLBACK_MODEL ?? '').trim() || aiModel(),
  });
}

const RETRYABLE: ReadonlySet<string> = new Set(['UNAVAILABLE', 'RATE_LIMITED']);

/**
 * One gateway completion with: timeout + retry via the shared callExternal,
 * automatic failover to the fallback provider on 429/5xx, and the fake as
 * the last resort when a real provider is configured but down (so demos
 * never break). The caller still surfaces UNAVAILABLE honestly in the UI.
 */
export interface CompleteOpts {
  /** Hard timeout for the primary call (generation tasks pass more than the 8 s default). */
  timeoutMs?: number;
  /** Retry count for retryable codes (default 2). */
  retries?: number;
}

export async function complete(req: LlmRequest, opts?: CompleteOpts): Promise<LlmResult> {
  const timeoutMs = opts?.timeoutMs ?? 8000;
  const retries = opts?.retries ?? 2;
  const primary = primaryAdapter();
  const first = await callExternal(() => primary.complete(req), {
    timeoutMs,
    retries,
    backoffMs: 600,
    shouldRetry: (code) => RETRYABLE.has(code),
  });
  if (first.ok) return first;

  const fb = fallbackAdapter();
  if (fb && (first.code === 'RATE_LIMITED' || first.code === 'UNAVAILABLE')) {
    const second = await callExternal(() => fb.complete(req), {
      timeoutMs,
      retries: 1,
      backoffMs: 500,
    });
    if (second.ok) return second;
  }

  // Last-resort so learner screens degrade to the labelled fake instead of
  // an error card when a real provider is down (spec: calm fallback path).
  if (aiCapability().effective !== 'fake') {
    const fake = await new FakeAdapter().complete(req);
    if (fake.ok) return { ...fake, detail: `primary=${first.code ?? '?'}` };
  }
  return first;
}

/**
 * Streamed completion: tries the primary's stream; on pre-first-token
 * failure yields a single error event so the client can retry non-streamed.
 */
export async function* stream(req: LlmRequest): AsyncGenerator<StreamEvent, void, unknown> {
  const primary = primaryAdapter();
  try {
    let emitted = false;
    for await (const ev of primary.stream(req)) {
      if (ev.done && ev.code) {
        if (!emitted) {
          yield ev; // failure before any token: let the client decide
          return;
        }
        yield { delta: ' ' }; // keep the reply well-formed, then end
        return;
      }
      emitted = true;
      yield ev;
    }
  } catch {
    yield { done: true, code: 'UNAVAILABLE' };
  }
}

export class JsonInvalid extends Error {
  code: AiErrorCode = 'INVALID_RESPONSE';
}

/**
 * completeJson: parse + Zod-validate, ONE repair retry (feed the broken
 * output back and ask for valid JSON), then a typed failure so callers fall
 * back to authored content instead of showing malformed AI text.
 */
export async function completeJson<T>(
  req: LlmRequest,
  schema: z.ZodType<T>,
  opts?: CompleteOpts
): Promise<ExternalResult<{ value: T; tokensIn: number; tokensOut: number; adapter: string }>> {
  const res = await complete({ ...req, json: true }, opts);
  if (!res.ok || !res.value) {
    return { ok: false, code: res.code ?? 'INVALID_RESPONSE', detail: res.detail };
  }
  const parsed = tryParse<T>(res.value.text, schema);
  if (parsed !== null) {
    return {
      ok: true,
      value: { value: parsed, tokensIn: res.value.tokensIn, tokensOut: res.value.tokensOut, adapter: res.value.adapter },
    };
  }
  // One repair retry — the only automatic retry allowed for structure.
  const repair = await complete({
    ...req,
    json: true,
    messages: [
      ...req.messages,
      { role: 'assistant', content: res.value.text.slice(0, 4000) },
      {
        role: 'user',
        content:
          'That was not valid JSON for the required schema. Reply with ONLY the corrected JSON object, no prose, no markdown fences.',
      },
    ],
  }, opts);
  if (repair.ok && repair.value) {
    const reparsed = tryParse<T>(repair.value.text, schema);
    if (reparsed !== null) {
      return {
        ok: true,
        value: { value: reparsed, tokensIn: repair.value.tokensIn, tokensOut: repair.value.tokensOut, adapter: repair.value.adapter },
      };
    }
  }
  return { ok: false, code: 'INVALID_RESPONSE', detail: 'json-schema-failed-after-repair' };
}

function tryParse<T>(text: string, schema: z.ZodType<T>): T | null {
  const json = extractJson(text);
  if (json === null) return null;
  const result = schema.safeParse(json);
  if (!result.success) {
    // Dev-only diagnostics: which fields failed, so prompt/normalizer drift is
    // visible in the server log (never shown to learners).
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ai] schema issues:', JSON.stringify(result.error.issues.slice(0, 6)));
    }
    return null;
  }
  return result.data;
}

/** Tolerates markdown fences and surrounding prose by taking the outermost object/array. */
function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.search(/[[{]/);
    const endObj = trimmed.lastIndexOf('}');
    const endArr = trimmed.lastIndexOf(']');
    const end = Math.max(endObj, endArr);
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

/** Feature-rate tuning knob shared with the fake adapter tests. */
export function fakeShouldFail(): boolean {
  const rate = fakeTuning.failRate();
  return rate > 0 && Math.random() < rate;
}

export const AI_TIMEOUT_STREAM_MS = 60_000;
