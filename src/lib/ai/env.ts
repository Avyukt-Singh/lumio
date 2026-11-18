// AI gateway environment resolution (chunk 5B; 5-AI-0 adds the z-ai mode).
// The app MUST boot with zero env vars: the deterministic fake adapter is the
// default, and every cap has a safe default. `AI_PROVIDER=zai` selects the
// platform z-ai gateway (backend-only SDK, no key ships to the client, free
// tier in this environment — R2/R8). In production an openai-compatible
// provider without a key degrades to the fake with an honest reason, it
// never crashes the app.
import 'server-only';

export type AiProviderMode = 'fake' | 'zai' | 'openai-compatible' | 'off';

export interface AiCapability {
  mode: AiProviderMode;
  /** Adapter actually in use after config validation ('fake' when degraded). */
  effective: 'fake' | 'openai-compatible' | 'zai';
  /** Honest one-line reason shown in the capability table. */
  reason: string;
}

export function aiCapability(): AiCapability {
  const raw = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();
  if (raw === 'off' || raw === 'none') {
    return {
      mode: 'off',
      effective: 'fake',
      reason: 'AI help is switched off by configuration (AI_PROVIDER=off).',
    };
  }
  if (raw === 'openai-compatible') {
    const key = (process.env.AI_API_KEY ?? '').trim();
    const base = (process.env.AI_BASE_URL ?? '').trim();
    if (!key || !base) {
      return {
        mode: 'openai-compatible',
        effective: 'fake',
        reason:
          'AI_PROVIDER=openai-compatible is set but AI_BASE_URL/AI_API_KEY are missing — using the labelled fake so demo screens still work.',
      };
    }
    return {
      mode: 'openai-compatible',
      effective: 'openai-compatible',
      reason: `OpenAI-compatible gateway configured (model ${aiModel()}), with the labelled fake as fallback when unavailable.`,
    };
  }
  if (raw === 'zai' || raw === 'z-ai') {
    return {
      mode: 'zai',
      effective: 'zai',
      reason:
        'z-ai platform gateway active (backend-only SDK, no key in the client), with the labelled fake as fallback when unavailable.',
    };
  }
  if (!raw) {
    return {
      mode: 'fake',
      effective: 'fake',
      reason:
        'No provider configured — AI features run on the deterministic, clearly-labelled fake adapter (set AI_PROVIDER=zai for the real model).',
    };
  }
  return {
    mode: 'fake',
    effective: 'fake',
    reason: `Unknown AI_PROVIDER "${raw}" — using the labelled fake.`,
  };
}

/** The fallback chain (two free tiers chained for resilience) is on when both base+key exist. */
export function aiFallbackConfigured(): boolean {
  const base = (process.env.AI_FALLBACK_BASE_URL ?? '').trim();
  const key = (process.env.AI_FALLBACK_API_KEY ?? '').trim();
  return Boolean(base && key);
}

export function aiModel(): string {
  // Never hard-code one provider's model name here as a requirement; this is
  // just the OpenAI-compatible request body default and is overridable.
  return (process.env.AI_MODEL ?? '').trim() || 'llama-3.3-70b-versatile';
}

function intEnv(name: string, dflt: number): number {
  const raw = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : dflt;
}

export const aiCaps = {
  /** Calls per signed-in user per day (all features combined). */
  userDailyCalls: () => intEnv('AI_USER_DAILY_CALLS', 40),
  /** Total prompt+completion tokens per user per day. */
  userDailyTokens: () => intEnv('AI_USER_DAILY_TOKENS', 30000),
  /** Calls per client-IP hash per hour (in-memory; resets on restart in dev). */
  ipHourlyCalls: () => intEnv('AI_IP_HOURLY_CALLS', 60),
  /** Calls for the whole deployment per day. */
  globalDailyCalls: () => intEnv('AI_GLOBAL_DAILY_CALLS', 2000),
};

/** Fake-adapter tuning (demo + verification: set FAKE_FAIL_RATE=1 to test errors). */
export const fakeTuning = {
  latencyMs: () => {
    const raw = Number.parseInt(process.env.FAKE_LATENCY_MS ?? '', 10);
    return Number.isFinite(raw) && raw >= 0 ? raw : 350;
  },
  failRate: () => {
    const raw = Number.parseFloat(process.env.FAKE_FAIL_RATE ?? '');
    return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0;
  },
};
