// The one real adapter (chunk 5B): any OpenAI-compatible endpoint — Google
// Gemini (AI Studio free tier), Groq, OpenRouter free models, or self-hosted
// Ollama — via AI_BASE_URL / AI_API_KEY / AI_MODEL. Provider-specific code
// is deliberately avoided; free-tier limits live in docs/AI_SETUP.md, never
// hard-coded here. Errors are mapped to the closed taxonomy; provider
// internals never leave this file.
import 'server-only';
import { aiModel } from './env';
import {
  fakeShouldFail,
  type LlmAdapter,
  type LlmMessage,
  type LlmRequest,
  type LlmResult,
  type StreamEvent,
  type StreamingAdapter,
} from './gateway';

interface AdapterConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ChatChoiceMessage {
  content?: string | null;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: ChatChoiceMessage }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAiCompatibleAdapter implements StreamingAdapter {
  readonly name = 'openai-compatible';
  constructor(private cfg: AdapterConfig) {}

  private endpoint(): string {
    const base = this.cfg.baseUrl.replace(/\/+$/, '');
    return `${base}/chat/completions`;
  }

  private body(req: LlmRequest, stream: boolean): string {
    return JSON.stringify({
      model: this.cfg.model || aiModel(),
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      stream,
      ...(req.json ? { response_format: { type: 'json_object' } } : {}),
      ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
    });
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${this.cfg.apiKey}`,
    };
  }

  async complete(req: LlmRequest): Promise<LlmResult> {
    let res: Response;
    try {
      res = await fetch(this.endpoint(), {
        method: 'POST',
        headers: this.headers(),
        body: this.body(req, false),
        signal: AbortSignal.timeout(7500),
      });
    } catch {
      return { ok: false, code: 'UNAVAILABLE', detail: 'network', retryable: true };
    }
    if (res.status === 429) {
      const ra = Number.parseInt(res.headers.get('retry-after') ?? '', 10);
      return {
        ok: false,
        code: 'RATE_LIMITED',
        retryable: true,
        retryAfterSec: Number.isFinite(ra) ? ra : undefined,
      };
    }
    if (res.status >= 500) {
      return { ok: false, code: 'UNAVAILABLE', detail: `status-${res.status}`, retryable: true };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, code: 'UNCONFIGURED', detail: 'auth-rejected' };
    }
    if (!res.ok) {
      return { ok: false, code: 'INVALID_RESPONSE', detail: `status-${res.status}` };
    }
    let json: ChatCompletionResponse;
    try {
      json = (await res.json()) as ChatCompletionResponse;
    } catch {
      return { ok: false, code: 'INVALID_RESPONSE', detail: 'bad-json' };
    }
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
  }

  async *stream(req: LlmRequest): AsyncGenerator<StreamEvent, void, unknown> {
    // Configured-but-broken providers (no key, wrong endpoint) must surface
    // immediately; the fake-fail knob also applies for reproducible demos.
    if (fakeShouldFail()) {
      yield { done: true, code: 'UNAVAILABLE' };
      return;
    }
    let res: Response;
    try {
      res = await fetch(this.endpoint(), {
        method: 'POST',
        headers: { ...this.headers(), accept: 'text/event-stream' },
        body: this.body(req, true),
        signal: AbortSignal.timeout(55_000),
      });
    } catch {
      yield { done: true, code: 'UNAVAILABLE' };
      return;
    }
    if (!res.ok || !res.body) {
      // 401/403 = the key or endpoint is wrong: surface UNCONFIGURED, not
      // UNAVAILABLE, so the local user is told to check .env instead of
      // "the AI is temporarily down".
      const code = res.status === 429
        ? 'RATE_LIMITED'
        : res.status === 401 || res.status === 403
          ? 'UNCONFIGURED'
          : 'UNAVAILABLE';
      yield { done: true, code };
      return;
    }
    const reader = res.body.getReader();
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
            error?: { message?: string };
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

function approx(messages: LlmMessage[]): number {
  return Math.round(messages.reduce((n, m) => n + m.content.length, 0) / 4);
}
