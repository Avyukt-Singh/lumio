// POST /api/ai/notes — Notes to summary/flashcards/quiz. Input is the already
// sanitised note text (client sanitises at upload; this route re-scrubs).
// Results are cached by content hash (non-personal once scrubbed) so the same
// note never burns the free quota twice. Saved client-side through bounded
// practice-only events — never XP, never SRS.
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail, normLang } from '@/lib/ai/route';
import { cacheGet, cacheKey, cachePut, recordUsage } from '@/lib/ai/budget';
import { checkOutput, outputHash, preFilter, scrubText } from '@/lib/ai/safety';
import { completeJson } from '@/lib/ai/gateway';
import { NotesOutputSchema, notesPrompt } from '@/lib/ai/prompts/notes.v1';

const MAX_PROMPT_CHARS = 12_000;

const BodySchema = z.object({
  noteId: z.string().min(1).max(64),
  noteName: z.string().min(1).max(200),
  noteText: z.string().min(20).max(200_000),
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

  if (preFilter(body.noteText).crisis) {
    return aiOk({ data: null, crisis: true });
  }

  const scrubbed = scrubText(body.noteText).text.slice(0, MAX_PROMPT_CHARS);
  const prompt = notesPrompt;
  const key = cacheKey(
    `notes.v${prompt.version}`,
    `${lang}:${body.band}`,
    `${body.noteName}::${scrubbed}`
  );
  const hit = cacheGet(key);
  if (hit) {
    const cached = JSON.parse(hit.text) as unknown;
    const check = NotesOutputSchema.safeParse(cached);
    if (check.success) {
      return aiOk({ data: check.data, label: 'ai_generated_unreviewed', cached: true, outputHash: outputHash(hit.text) });
    }
  }

  const res = await completeJson(
    {
      feature: 'notes',
      messages: [
        { role: 'system', content: prompt.system({ band: body.band, lang }) },
        {
          role: 'user',
          content: prompt.buildUser({ noteName: body.noteName, noteText: scrubbed, band: body.band, lang }),
        },
      ],
      maxTokens: 1600,
      meta: { lang, topic: body.noteName },
    },
    NotesOutputSchema
  );

  if (!res.ok || !res.value) {
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }

  const out = res.value.value;
  for (const q of out.questions) {
    if (q.answer >= q.options.length) return aiFail('INVALID_RESPONSE', 502);
  }
  const check = checkOutput(out.summary.join(' '));
  if (!check.ok) return aiFail('BLOCKED_BY_POLICY', 502);

  cachePut(key, { text: JSON.stringify(out), adapter: res.value.adapter, tokensIn: res.value.tokensIn, tokensOut: res.value.tokensOut });

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'notes',
    ip: gate.gate.ip,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    now: new Date(),
  });

  return aiOk({
    data: out,
    label: 'ai_generated_unreviewed',
    cached: false,
    outputHash: outputHash(JSON.stringify(out)),
  });
}
