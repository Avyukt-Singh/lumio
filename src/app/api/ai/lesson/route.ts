// POST /api/ai/lesson — chunk 5-AI feature 1 (chapter content engine).
// Grounded on the chapter summary + key points + glossary; supports the
// follow-up modes (simpler / example / translate) plus the full study set.
// Schema-validated, output-checked, budgeted; the deterministic Reader
// material stays the fallback in the client.
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail, normLang } from '@/lib/ai/route';
import { recordUsage, cacheKey, cacheGet, cachePut } from '@/lib/ai/budget';
import { checkOutput, outputHash, preFilter, scrubText } from '@/lib/ai/safety';
import { completeJson } from '@/lib/ai/gateway';
import { LessonOutputSchema, lessonPrompt, type LessonMode } from '@/lib/ai/prompts/lesson.v1';

const BodySchema = z.object({
  chapterId: z.string().min(1).max(40),
  chapterTitle: z.string().min(1).max(200),
  subject: z.string().max(40),
  summary: z.string().max(2000),
  keyPoints: z.array(z.string().max(400)).max(6),
  glossary: z.array(z.tuple([z.string().max(60), z.string().max(200)])).max(8),
  mode: z.enum(['full', 'simpler', 'example', 'translate']),
  point: z.string().max(400).optional(),
  interest: z.string().max(60).optional(),
  band: z.enum(['young', 'middle', 'sec', 'senior', 'dropper', 'above']),
  lang: z.enum(['en', 'hi', 'hinglish']),
});

export async function POST(req: Request) {
  const gate = await aiGate(req);
  if ('res' in gate) return gate.res;

  const parsed = await aiParseBody(req, BodySchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.body;
  const lang = normLang(body.lang);

  if (preFilter(body.summary + ' ' + (body.point ?? '')).crisis) {
    return aiOk({ data: null, crisis: true });
  }

  // Non-personal generation: cache by content hash (same inputs => same lesson).
  const hash = outputHash(
    JSON.stringify([body.chapterId, body.mode, body.lang, body.band, body.point ?? '', body.interest ?? '', body.summary])
  );
  const cached = cacheGet(cacheKey('lesson', 'v1', hash));
  if (cached) {
    try {
      const data = LessonOutputSchema.parse(JSON.parse(cached.text));
      return aiOk({ data, label: 'ai_generated_unreviewed', cached: true, outputHash: hash });
    } catch {
      /* stale/incompatible cache entry — regenerate below */
    }
  }

  const res = await completeJson(
    {
      feature: 'lesson',
      messages: [
        { role: 'system', content: lessonPrompt.system({ band: body.band, lang, mode: body.mode as LessonMode }) },
        {
          role: 'user',
          content: lessonPrompt.buildUser({
            chapterId: body.chapterId,
            chapterTitle: scrubText(body.chapterTitle).text,
            subject: body.subject,
            summary: scrubText(body.summary).text,
            keyPoints: body.keyPoints.map((k) => scrubText(k).text),
            glossary: body.glossary,
            mode: body.mode as LessonMode,
            point: body.point ? scrubText(body.point).text : undefined,
            interest: body.interest,
            band: body.band,
            lang,
          }),
        },
      ],
      maxTokens: 2200,
      meta: { lang, topic: body.chapterTitle, mode: body.mode },
    },
    LessonOutputSchema,
    { timeoutMs: 45_000, retries: 1 }
  );
  if (!res.ok || !res.value) {
    console.error('[lesson] failed:', res.code, res.detail);
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }

  const data = res.value.value;
  // Deterministic output check on every free-text field; one bad field drops
  // the whole response (the client falls back to the authored material).
  const allText = [
    ...data.sections.map((s) => `${s.heading} ${s.text}`),
    ...data.keyPoints,
    ...data.glossary.map((g) => `${g.term} ${g.meaning}`),
    ...data.flashcards.map((f) => `${f.front} ${f.back}`),
  ].join(' ');
  const check = checkOutput(allText);
  if (!check.ok) return aiFail('BLOCKED_BY_POLICY', 422);

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'lesson',
    ip: gate.gate.ip,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    now: new Date(),
  });

  cachePut(cacheKey('lesson', 'v1', hash), {
    text: JSON.stringify(data),
    adapter: res.value.adapter,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
  });
  return aiOk({ data, label: 'ai_generated_unreviewed', outputHash: hash });
}
