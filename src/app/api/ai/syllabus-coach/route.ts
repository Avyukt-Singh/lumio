// POST /api/ai/syllabus-coach — AI refinement of the deterministic syllabus
// day plan (chunk 6, prompt section 5.2). Privacy: the body carries ONLY the
// candidate topics (public syllabus ids + titles), status/flag enums, unit
// mark shares, exam-proximity buckets, slot lengths and the learner's band —
// never name, email, user id or free-text notes (notes are only included when
// the learner explicitly opts in, sanitised and delimited as data).
// The deterministic planner is the source of truth: this route re-validates
// every returned item against the same candidates and drops violations; an
// empty result means the client shows the deterministic plan.
import 'server-only';
import { z } from 'zod';
import { aiGate, aiParseBody, aiOk, aiFail, normLang } from '@/lib/ai/route';
import { recordUsage } from '@/lib/ai/budget';
import { outputHash } from '@/lib/ai/safety';
import { completeJson } from '@/lib/ai/gateway';
import { SyllabusDayCoachOutputSchema, syllabusDayCoachPrompt } from '@/lib/ai/prompts/syllabus-day-coach.v1';

const BodySchema = z.object({
  band: z.enum(['young', 'middle', 'sec', 'senior', 'dropper', 'above']),
  lang: z.enum(['en', 'hi', 'hinglish']),
  includeNotes: z.boolean().default(false),
  notes: z.array(z.string().max(280)).max(8).optional(),
  slots: z
    .array(
      z.object({
        index: z.number().int().min(0).max(20),
        subject: z.string().max(40),
        minutes: z.number().int().min(5).max(600),
      })
    )
    .max(21),
  candidates: z
    .array(
      z.object({
        topicId: z.string().max(40),
        title: z.string().max(200),
        subjectId: z.string().max(20),
        slotIndex: z.number().int().min(0).max(20),
        activity: z.enum(['learn', 'practise', 'revise', 'recall']),
        minutes: z.number().int().min(5).max(180),
        status: z.enum(['not_started', 'in_progress', 'completed_unrated', 'completed_confident', 'completed_unsure']),
        flags: z.array(z.enum(['lacks_practice', 'concept_unclear', 'formulas', 'careless', 'speed', 'needs_revision', 'needs_help', 'practical_pending'])).max(8),
        marksShare: z.number().min(0).max(1),
        examBucket: z.enum(['none', 'soon', 'later']),
      })
    )
    .min(1)
    .max(60),
});

export async function POST(req: Request) {
  const gate = await aiGate(req);
  if ('res' in gate) return gate.res;

  const parsed = await aiParseBody(req, BodySchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.body;
  const lang = normLang(body.lang);

  const res = await completeJson(
    {
      feature: 'syllabus-day-coach',
      messages: [
        { role: 'system', content: syllabusDayCoachPrompt.system({ lang }) },
        {
          role: 'user',
          content: syllabusDayCoachPrompt.buildUser({
            band: body.band,
            slots: body.slots,
            candidates: body.candidates,
            ...(body.includeNotes && body.notes ? { notes: body.notes } : {}),
            lang,
          }),
        },
      ],
      maxTokens: 900,
      // Deterministic candidate keys (topicId#slotIndex#activity#minutes) —
      // the fake adapter echoes these; the real model proposes its own, which
      // the validator below re-checks against the same rules.
      meta: {
        lang,
        items: body.candidates
          .map((c) => `${c.topicId}#${c.slotIndex}#${c.activity}#${c.minutes}`)
          .slice(0, 8),
      },
    },
    SyllabusDayCoachOutputSchema
  );

  if (!res.ok || !res.value) {
    return aiFail(res.code ?? 'INVALID_RESPONSE', res.code === 'OVER_BUDGET' ? 429 : 502);
  }

  // Hard validation (prompt 5.2): every topicId must exist in the candidate
  // list; no duplicates; minutes must fit the slot; subject must match the
  // slot's subject; activity in the enum (schema already enforces it);
  // reasons length-capped (schema). Any violation drops that item; if ALL
  // items drop, the client falls back to the deterministic plan.
  const bySlot = new Map(body.slots.map((s) => [s.index, s]));
  const candidateById = new Map(body.candidates.map((c) => [c.topicId, c]));
  const seen = new Set<string>();
  const valid = res.value.value.items.filter((item) => {
    const slot = bySlot.get(item.slotIndex);
    if (!slot) return false;
    if (item.minutes > slot.minutes) return false;
    if (item.topicIds.length === 0) return false;
    let slotSubject = '';
    for (const id of item.topicIds) {
      const cand = candidateById.get(id);
      if (!cand) return false; // invented topic id
      if (seen.has(id)) return false; // duplicate across items
      seen.add(id);
      slotSubject = cand.subjectId;
    }
    // every topic in one item must belong to the same subject
    if (!item.topicIds.every((id) => candidateById.get(id)?.subjectId === slotSubject)) return false;
    // the slot is pinned to a subject via the existing rotation; allow the
    // item only when its subject actually matches the slot's subject
    if (slot.subject) {
      const slotSubjectCandidates = body.candidates.filter((c) => c.slotIndex === item.slotIndex);
      if (slotSubjectCandidates.length > 0 && !slotSubjectCandidates.some((c) => c.subjectId === slotSubject)) {
        return false;
      }
    }
    return true;
  });

  await recordUsage({
    userId: gate.gate.userId,
    feature: 'syllabus-day-coach',
    ip: gate.gate.ip,
    tokensIn: res.value.tokensIn,
    tokensOut: res.value.tokensOut,
    now: new Date(),
  });

  return aiOk({
    data: { summary: res.value.value.summary, items: valid },
    dropped: res.value.value.items.length - valid.length,
    outputHash: outputHash(JSON.stringify(valid)),
  });
}
