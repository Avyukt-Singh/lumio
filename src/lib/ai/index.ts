// AI layer public surface (chunk 5B). Server-only; the browser never sees a
// key and never talks to a provider directly — every feature goes through
// these gateway + budget + safety seams via /api/ai/* route handlers.
import 'server-only';

export { aiCapability, aiCaps, aiFallbackConfigured, fakeTuning, aiModel } from './env';
export type { AiCapability, AiProviderMode } from './env';
export {
  complete,
  completeJson,
  stream,
  JsonInvalid,
  AI_TIMEOUT_STREAM_MS,
} from './gateway';
export type {
  LlmAdapter,
  LlmMessage,
  LlmReply,
  LlmRequest,
  LlmResult,
  StreamEvent,
  StreamingAdapter,
  AiErrorCode,
} from './gateway';
export {
  budgetRemaining,
  cacheGet,
  cacheKey,
  cachePut,
  checkBudget,
  ipCallsLeft,
  recordUsage,
} from './budget';
export {
  checkOutput,
  crisisReply,
  fenceData,
  INDIA_HELPLINE,
  outputHash,
  preFilter,
  pseudonym,
  scrubText,
} from './safety';
export type { PreFilterResult, ScrubResult } from './safety';
