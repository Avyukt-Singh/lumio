// z-ai platform adapter (chunk 5-AI-0). The REAL model path for this
// environment: the server-side z-ai-web-dev-sdk (R2 — no key ever reaches the
// client; R8 — free tier in this environment). Implements the same
// StreamingAdapter contract as the OpenAI-compatible adapter, so the gateway,
// budgets, safety layers and every feature are provider-agnostic.
//
// Adapter notes (verified against the SDK dist + SKILL.md):
// - `chat.completions.create` passes messages through verbatim; the platform
//   convention is that the system prompt rides in an 'assistant' message
//   (LLM SKILL.md "Use the 'assistant' role for system prompts"), so 'system'
//   messages are mapped to 'assistant' here.
// - `stream: true` returns the raw SSE body — parsed with the same data-line
//   grammar as the OpenAI-compatible adapter.
// - Vision uses `chat.completions.createVision` with image_url content parts.
// - The SDK throws on HTTP errors with the status embedded in the message;
//   mapped to the closed error taxonomy below.
import 'server-only';
import ZAI from 'z-ai-web-dev-sdk';
import {
  fakeShouldFail,
  type LlmAdapter,
  type LlmMessage,
  type LlmRequest,
  type LlmResult,
  type StreamEvent,
  type StreamingAdapter,
} from './gateway';

interface ChatChoiceMessage {
  content?: string | null;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: ChatChoiceMessage }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** 'system' -> 'assistant' per the platform convention; others pass through. */
function platformMessages(messages: LlmMessage[]): Array<{ role: string; content: string }> {
  return messages.map((m) => ({ role: m.role === 'system' ? 'assistant' : m.role, content: m.content }));
}

function mapHttpError(status: number, body: string): LlmResult {
  if (status === 429) return { ok: false, code: 'RATE_LIMITED', retryable: true };
  if (status === 401 || status === 403) return { ok: false, code: 'UNCONFIGURED', detail: 'auth-rejected' };
  if (status >= 500) return { ok: false, code: 'UNAVAILABLE', detail: `status-${status}`, retryable: true };
  return { ok: false, code: 'INVALID_RESPONSE', detail: `status-${status}: ${body.slice(0, 120)}` };
}

export class ZaiAdapter implements StreamingAdapter {
  readonly name = 'zai';

  private body(req: LlmRequest, stream: boolean): Record<string, unknown> {
    return {
      messages: platformMessages(req.messages),
      thinking: { type: 'disabled' },
      ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
      // The platform gateway may not honour response_format; the gateway's
      // extractJson already tolerates prose + fences, and the JSON mode of
      // completeJson repairs once. Belt-and-braces instruction appended.
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      ...(stream ? { stream: true } : {}),
    };
  }

  async complete(req: LlmRequest): Promise<LlmResult> {
    let zai: Awaited<ReturnType<typeof ZAI.create>>;
    try {
      zai = await ZAI.create();
    } catch {
      return { ok: false, code: 'UNCONFIGURED', detail: 'z-ai-config-missing' };
    }
    try {
      const json = (await zai.chat.completions.create(this.body(req, false) as never)) as ChatCompletionResponse;
      const text = json.choices?.[0]?.message?.content ?? '';
      if (!text.trim()) return { ok: false, code: 'INVALID_RESPONSE', detail: 'empty-content' };
      return {
        ok: true,
        value: {
          text,
          tokensIn: json.usage?.prompt_tokens ?? approx(req.messages),
          tokensOut: json.usage?.completion_tokens ?? Math.round(text.length / 4),
          adapter: this.name,
        },
      };
    } catch (err) {
      return sdkError(err);
    }
  }

  async *stream(req: LlmRequest): AsyncGenerator<StreamEvent, void, unknown> {
    // Shared fail knob so every adapter can be exercised for error paths.
    if (fakeShouldFail()) {
      yield { done: true, code: 'UNAVAILABLE' };
      return;
    }
    let zai: Awaited<ReturnType<typeof ZAI.create>>;
    try {
      zai = await ZAI.create();
    } catch {
      yield { done: true, code: 'UNCONFIGURED' };
      return;
    }
    let body: ReadableStream<Uint8Array> | null;
    try {
      const res = await zai.chat.completions.create(this.body(req, true) as never);
      // Streaming returns the raw body; non-streaming returns a JSON object
      // (some deployments ignore stream) — degrade to a single-shot emit.
      if (res instanceof ReadableStream) {
        body = res;
      } else {
        const json = res as ChatCompletionResponse;
        const text = json.choices?.[0]?.message?.content ?? '';
        if (text.trim()) {
          for (const chunk of chunkSentences(text)) yield { delta: chunk };
        }
        yield { done: true };
        return;
      }
    } catch (err) {
      const mapped = sdkError(err);
      yield { done: true, code: mapped.ok ? 'UNAVAILABLE' : mapped.code ?? 'UNAVAILABLE' };
      return;
    }
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') {
          yield { done: true };
          return;
        }
        try {
          const j = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string | null } }>;
          };
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) yield { delta };
        } catch {
          // keep-alive or partial line — ignore
        }
      }
    }
    yield { done: true };
  }
}

/** Vision call for the smart-notes photo pipeline (chunk 5-AI-2). Returns the
 *  extracted text or a typed failure; input is a data URL or https URL. */
export async function zaiVision(prompt: string, imageUrl: string, maxTokens?: number): Promise<LlmResult> {
  let zai: Awaited<ReturnType<typeof ZAI.create>>;
  try {
    zai = await ZAI.create();
  } catch {
    return { ok: false, code: 'UNCONFIGURED', detail: 'z-ai-config-missing' };
  }
  try {
    const res = (await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    } as never)) as ChatCompletionResponse;
    const text = res.choices?.[0]?.message?.content ?? '';
    if (!text.trim()) return { ok: false, code: 'INVALID_RESPONSE', detail: 'empty-content' };
    return {
      ok: true,
      value: {
        text,
        tokensIn: res.usage?.prompt_tokens ?? 0,
        tokensOut: res.usage?.completion_tokens ?? Math.round(text.length / 4),
        adapter: 'zai-vision',
      },
    };
  } catch (err) {
    return sdkError(err);
  }
}

function sdkError(err: unknown): LlmResult {
  const msg = err instanceof Error ? err.message : String(err);
  const m = /status (\d{3})/.exec(msg);
  if (m) return mapHttpError(Number(m[1]), msg.slice(0, 200));
  return { ok: false, code: 'UNAVAILABLE', detail: msg.slice(0, 120), retryable: true };
}

/** Sentence-sized chunks so the SSE reader emits something readable. */
function chunkSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]+|\S+/g) ?? [text];
}

function approx(messages: LlmMessage[]): number {
  return Math.round(messages.reduce((n, m) => n + m.content.length, 0) / 4);
}
