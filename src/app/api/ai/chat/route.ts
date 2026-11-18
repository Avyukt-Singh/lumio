// POST /api/ai/chat — Study Buddy over Server-Sent Events. Grounded on the
// open chapter (context built by the client from public content and fenced
// as DATA), Socratic hint ladder, persona by band. Crisis disclosures are
// answered deterministically without any model call. History stays in the
// client session; the server stores nothing about the learner except the
// anonymous budget ledger.
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody } from '@/lib/ai/route';
import { recordUsage } from '@/lib/ai/budget';
import { checkOutput, crisisReply, preFilter, pseudonym, scrubText } from '@/lib/ai/safety';
import { stream } from '@/lib/ai/gateway';
import { studyBuddyPrompt } from '@/lib/ai/prompts/studybuddy.v1';

const BodySchema = z.object({
  chapterId: z.string().min(1).max(40),
  chapterTitle: z.string().min(1).max(200),
  subject: z.string().max(40),
  summary: z.string().max(2000),
  keyPoints: z.array(z.string().max(400)).max(6),
  glossary: z.array(z.tuple([z.string().max(60), z.string().max(200)])).max(8),
  question: z.string().min(1).max(1200),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(1500) }))
    .max(12),
  hintLevel: z.number().int().min(1).max(4),
  band: z.enum(['young', 'middle', 'sec', 'senior', 'dropper', 'above']),
  lang: z.enum(['en', 'hi', 'hinglish']),
});

export async function POST(req: Request) {
  const gate = await aiGate(req);
  if ('res' in gate) return gate.res;

  const parsed = await aiParseBody(req, BodySchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.body;

  const scrub = scrubText(body.question);
  const filter = preFilter(body.question);

  // Crisis path: deterministic supportive reply, zero model calls, zero cost.
  if (filter.crisis) {
    const reply = crisisReply(body.lang);
    return sseFrom(
      (async function* (): AsyncGenerator<
        { delta?: string; done?: boolean; code?: string },
        void,
        unknown
      > {
        yield { delta: reply };
        yield { done: true };
      })()
    );
  }

  const learner = pseudonym();
  const prompt = studyBuddyPrompt;
  const recent = body.history.slice(-8);
  const userContent = `${learner}: ${prompt.buildUser({
    chapterId: body.chapterId,
    chapterTitle: body.chapterTitle,
    subject: body.subject,
    summary: scrubText(body.summary).text,
    keyPoints: body.keyPoints.map((k) => scrubText(k).text),
    glossary: body.glossary,
    question: scrub.text,
    history: recent,
    hintLevel: body.hintLevel,
    lang: body.lang,
    declineScope: true,
  })}`;

  const gen = stream({
    feature: 'studybuddy',
    messages: [
      { role: 'system', content: prompt.system({ band: body.band, lang: body.lang }) },
      ...recent.map((m) => ({ role: m.role, content: scrubText(m.content).text })),
      { role: 'user', content: userContent },
    ],
    maxTokens: 500,
    meta: {
      lang: body.lang,
      band: body.band,
      hintLevel: body.hintLevel,
      chapterTitle: body.chapterTitle,
      subject: body.subject,
      decline: false,
      keyPoint: body.keyPoints[0] ?? 'the main idea of this chapter',
    },
  });

  // Budget counts attempts: recorded by the single SSE consumer when the
  // stream settles (one generator, one consumer — double iteration would
  // steal deltas from the learner).
  const { userId, ip } = gate.gate;
  const approxIn = userContent.length / 4;

  return sseFrom(gen, (full, code) => {
    void recordUsage({
      userId,
      feature: 'studybuddy',
      ip,
      tokensIn: Math.round(approxIn),
      tokensOut: Math.round(full.length / 4),
      now: new Date(),
    }).catch(() => undefined);
  });
}

function sseFrom(
  gen: AsyncGenerator<{ delta?: string; done?: boolean; code?: string }, void, unknown>,
  onDone?: (full: string, code?: string) => void
): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      let full = '';
      try {
        for await (const ev of gen) {
          if (ev.delta) {
            full += ev.delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: ev.delta })}\n\n`));
          }
          if (ev.done) {
            // Final deterministic output check; a policy failure swaps the
            // code so the client can replace the reply with calm fallback copy.
            const check = checkOutput(full);
            const code = ev.code ?? (check.ok ? undefined : 'BLOCKED_BY_POLICY');
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true, code })}\n\n`)
            );
            onDone?.(full, code);
            break;
          }
        }
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, code: 'UNAVAILABLE' })}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-store',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
