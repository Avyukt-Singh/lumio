// POST /api/ai/ocr — chunk 5-AI feature 6 (smart notes, photo input). Reads a
// photo/scan of handwritten or printed notes via the vision model and returns
// the extracted plain text. The CLIENT always shows an explicit
// "check the extracted text" step before anything is saved — the extraction
// is never written to the learner's notes automatically (spec: untrusted
// data, minors first).
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail } from '@/lib/ai/route';
import { recordUsage } from '@/lib/ai/budget';
import { checkOutput, preFilter, scrubText } from '@/lib/ai/safety';
import { zaiVision } from '@/lib/ai/zai';

const BodySchema = z.object({
  /** data URL (image/jpeg|png|webp), already downscaled by the client */
  image: z
    .string()
    .startsWith('data:image/')
    .max(1_600_000),
  band: z.enum(['young', 'middle', 'sec', 'senior', 'dropper', 'above']),
  lang: z.enum(['en', 'hi', 'hinglish']),
});

const OCR_PROMPT = [
  'You transcribe study notes from photos for a student.',
  'Extract ALL text visible in the image, preserving the original wording, line breaks, headings and any formulas.',
  'Write plain text only — no markdown syntax, no commentary, no explanations of your own.',
  'If a word is illegible, write [?] in its place; never guess whole sentences.',
  'If the image contains no study notes or text (e.g. it is a photo of a person, place or object), reply with exactly: NOT_TEXT',
  'Never add facts that are not visible in the image.',
].join('\n');

export async function POST(req: Request) {
  const gate = await aiGate(req);
  if ('res' in gate) return gate.res;

  const parsed = await aiParseBody(req, BodySchema, 1_700_000);
  if (!parsed.ok) return parsed.res;
  const body = parsed.body;

  const res = await zaiVision(OCR_PROMPT, body.image, 1500);
  if (!res.ok || !res.value) {
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'ocr',
    ip: gate.gate.ip,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    now: new Date(),
  });

  const raw = res.value.text.trim();
  if (/^NOT_TEXT\b/i.test(raw)) {
    return aiFail('INVALID_RESPONSE', 422, { reason: 'no_text' });
  }

  // Deterministic output check on the transcription (crisis/policy guard).
  const check = checkOutput(raw);
  if (!check.ok) return aiFail('BLOCKED_BY_POLICY', 422);

  // Scrub contact details that may have been photographed incidentally
  // (R5 spirit: the learner's own note text, but no emails/phones forwarded).
  const text = scrubText(raw).text;

  return aiOk({ data: { text }, label: 'ai_extracted_unverified' });
}
