// Lumio event log (chunk 2, ADR 0002): append-only events in IndexedDB are the
// source of truth; the state snapshot is a pure projection. All state changes
// go through applyEvent — no other code path may mutate state fields directly.
// Dependencies point one way: events.ts -> storage.ts -> domain.ts.

import {
  quizXpBreakdown, weekKeyOfDate,
  FOCUS_BLOCK_XP, FOCUS_DAILY_BLOCK_CAP, MOCK_XP,
  LAB_FIRST_CLEAR_BONUS, SAVER_CAP, SAVER_XP_COST,
  SCHEDULE_XP, SCHEDULE_ONTIME_BONUS, AI_QUIZ_XP_DAILY_CAP,
} from './domain';
import { defaultState, projectState } from './storage';
import { dbAppendEvent, dbGetEvents, deviceId } from './db';
import { LEITNER_INTERVALS } from './types';
import type { LumioEvent, LumioState, Profile, StoredEvent } from './types';
import { emptyTopicProgress, sanitizeFlags, sanitizeSyllabusNote } from './syllabus/types';
import type { SyllabusTopicPatch, TopicProgress } from './syllabus/types';

/**
 * Apply one event to a state snapshot (pure: state in, new state out).
 * Derived values (XP total, best scores, streak) are only ever recomputed here,
 * never written by callers (master prompt 5.4).
 */
export function applyEvent(state: LumioState, e: LumioEvent): LumioState {
  switch (e.type) {
    case 'bootstrap':
      return e.state;

    case 'onboarding-finished':
      return { ...state, profile: e.profile, plan: e.plan };

    case 'settings-changed':
      return { ...state, settings: { ...state.settings, ...e.patch } };

    case 'plan-changed':
      return { ...state, plan: e.plan };

    case 'quiz-attempted': {
      const prev = state.res[e.chapterId];
      const prevBest = prev?.best ?? 0;
      const firstAttempt = !prev;
      const bd = quizXpBreakdown(prevBest, e.score, e.nq, firstAttempt);
      const gain = bd.total;
      const res = {
        ...state.res,
        [e.chapterId]: {
          best: Math.max(prevBest, e.score),
          att: (prev?.att ?? 0) + 1,
          last: e.date,
        },
      };
      const wrong = { ...state.wrong };
      for (const id of e.wrongIds) wrong[id] = 1;
      // XP rules (chunk 4C): base + improvement + score bonus; a retake that
      // does not beat the best score earns nothing (anti-farm).
      const xpLedger =
        gain > 0
          ? [
              ...state.xpLedger,
              {
                id: `quiz-${e.chapterId}-${e.date}-${state.xpLedger.length}`,
                date: e.date,
                amount: gain,
                source: 'quiz' as const,
                ref: e.chapterId,
              },
            ]
          : state.xpLedger;
      const days =
        gain > 0 && !state.days.includes(e.date) ? [...state.days, e.date] : state.days;
      const themes =
        e.score >= 1 && !state.themes.includes(e.theme) ? [...state.themes, e.theme] : state.themes;
      // Streak Saver earn rule: score 90%+ on a quiz (once per ISO week, capped).
      const pct = e.nq > 0 ? e.score / e.nq : 0;
      const freeze = pct >= 0.9 ? grantScoreSaver(state.freeze, e.date) : state.freeze;
      return { ...state, res, wrong, xpLedger, days, themes, freeze };
    }

    case 'quest-claimed': {
      // XP-once: the same quest in the same period can never be claimed twice.
      if (state.quests.some((c) => c.questId === e.questId && c.periodKey === e.periodKey)) {
        return state;
      }
      const next: LumioState = {
        ...state,
        xpLedger: [
          ...state.xpLedger,
          {
            id: `quest-${e.questId}-${e.periodKey}`,
            date: e.date,
            amount: e.xp,
            source: 'quest' as const,
            ref: e.questId,
          },
        ],
        quests: [
          ...state.quests,
          { questId: e.questId, claimedOn: e.date, periodKey: e.periodKey, xp: e.xp },
        ],
      };
      if (!next.days.includes(e.date)) next.days = [...next.days, e.date];
      return next;
    }

    case 'plan-reviewed': {
      if (state.planReviews[e.date]) return state;
      return { ...state, planReviews: { ...state.planReviews, [e.date]: true } };
    }

    case 'draft-saved':
      return { ...state, draft: e.draft };

    // chunk 4B: bounded profile edits from Settings (language switcher)
    case 'profile-patched': {
      if (!state.profile) return state;
      const safe: Partial<Profile> = {};
      if (e.patch.lang === 'en' || e.patch.lang === 'hi' || e.patch.lang === 'hinglish') {
        safe.lang = e.patch.lang;
      }
      if (Object.keys(safe).length === 0) return state;
      return { ...state, profile: { ...state.profile, ...safe } };
    }

    case 'flashcards-reviewed': {
      if (state.flashcardDays[e.date]) return state;
      return { ...state, flashcardDays: { ...state.flashcardDays, [e.date]: true } };
    }

    // ---- chunk 3: games, labs and the practice engine ----

    case 'game-won': {
      // XP-once per game: the ledger ref dedupes, a repeat win grants nothing.
      if (state.xpLedger.some((x) => x.source === 'game' && x.ref === e.gameId)) return state;
      // First-clear bonus on labs (chunk 4C): the one-time win IS the first clear.
      const bonus = e.lab && e.firstClear ? LAB_FIRST_CLEAR_BONUS : 0;
      const next: LumioState = {
        ...state,
        xpLedger: [
          ...state.xpLedger,
          {
            id: `game-${e.gameId}`,
            date: e.date,
            amount: e.xp + bonus,
            source: 'game' as const,
            ref: e.gameId,
          },
        ],
      };
      if (!next.days.includes(e.date)) next.days = [...next.days, e.date];
      // Streak Saver earn rule: passing a lab = a 100% score (once per week, capped).
      if (e.lab) next.freeze = grantScoreSaver(next.freeze, e.date);
      return next;
    }

    case 'session-done': {
      // XP once per planned session: the sessionDone key dedupes.
      const key = `${e.date}#${e.index}`;
      if (state.sessionDone[key]) return state;
      const amount = SCHEDULE_XP + (e.onTime ? SCHEDULE_ONTIME_BONUS : 0);
      const next: LumioState = {
        ...state,
        sessionDone: { ...state.sessionDone, [key]: true },
        xpLedger: [
          ...state.xpLedger,
          {
            id: `schedule-${key}`,
            date: e.date,
            amount,
            source: 'schedule' as const,
            ref: key,
          },
        ],
      };
      if (!next.days.includes(e.date)) next.days = [...next.days, e.date];
      return next;
    }

    case 'saver-bought': {
      // Fallback purchase: needs XP balance, needs inventory room below the cap.
      const balance = state.xpLedger.reduce((s, x) => s + x.amount, 0);
      if (state.freeze.owned >= SAVER_CAP || balance < SAVER_XP_COST) return state;
      return {
        ...state,
        freeze: {
          ...state.freeze,
          owned: state.freeze.owned + 1,
          bought: (state.freeze.bought ?? 0) + 1,
        },
        xpLedger: [
          ...state.xpLedger,
          {
            id: `purchase-${e.date}-${state.xpLedger.length}`,
            date: e.date,
            amount: -SAVER_XP_COST,
            source: 'purchase' as const,
            ref: 'saver',
          },
        ],
      };
    }

    case 'card-reviewed': {
      const prev = state.srs[e.cardId];
      const prevBox = prev?.box ?? 0;
      const box = e.correct ? Math.min(5, prevBox + 1) : 1;
      const interval = LEITNER_INTERVALS[Math.max(0, box - 1)] ?? 1;
      const base = e.date;
      // due date = review date + the box interval (simple day arithmetic)
      const [y, m, d] = base.split('-').map(Number);
      const dueDate = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
      dueDate.setUTCDate(dueDate.getUTCDate() + interval);
      const due = dueDate.toISOString().slice(0, 10);
      return {
        ...state,
        srs: { ...state.srs, [e.cardId]: { box, due } },
      };
    }

    case 'practice-done': {
      // XP once per kind per day; the marker map keeps replay honest.
      const key = `${e.kind}#${e.date}`;
      if (state.practice[key]) return state;
      const next: LumioState = {
        ...state,
        practice: { ...state.practice, [key]: true },
        xpLedger: [
          ...state.xpLedger,
          {
            id: `practice-${key}`,
            date: e.date,
            amount: e.xp,
            source: 'practice' as const,
            ref: e.kind,
          },
        ],
      };
      if (!next.days.includes(e.date)) next.days = [...next.days, e.date];
      return next;
    }

    case 'legendary-completed': {
      // +40 XP once ever.
      if (state.xpLedger.some((x) => x.source === 'practice' && x.ref === 'legendary')) return state;
      const next: LumioState = {
        ...state,
        xpLedger: [
          ...state.xpLedger,
          {
            id: 'practice-legendary',
            date: e.date,
            amount: 40,
            source: 'practice' as const,
            ref: 'legendary',
          },
        ],
      };
      if (!next.days.includes(e.date)) next.days = [...next.days, e.date];
      return next;
    }

    case 'mistake-tagged': {
      if (e.tag === null) {
        if (!state.mistakes[e.questionId]) return state;
        const mistakes = { ...state.mistakes };
        delete mistakes[e.questionId];
        return { ...state, mistakes };
      }
      if (state.mistakes[e.questionId]?.tag === e.tag) return state;
      return { ...state, mistakes: { ...state.mistakes, [e.questionId]: { tag: e.tag } } };
    }

    // ---- chunk 4A: focus suite, mocks, streak freezes, reschedule ----

    case 'focus-block-done': {
      // XP 5 per block, capped at 4 blocks per day (7.9 daily limit guard).
      const day = state.focusLog[e.date] ?? { blocks: 0, mins: 0 };
      const ledgerId = `focus-${e.date}-${day.blocks}`;
      const earnsXp = day.blocks < FOCUS_DAILY_BLOCK_CAP;
      const focusLog = {
        ...state.focusLog,
        [e.date]: { blocks: day.blocks + 1, mins: day.mins + Math.max(0, e.mins) },
      };
      const next: LumioState = earnsXp
        ? {
            ...state,
            focusLog,
            xpLedger: [
              ...state.xpLedger,
              {
                id: ledgerId,
                date: e.date,
                amount: FOCUS_BLOCK_XP,
                source: 'focus' as const,
                ref: `${e.date}#${day.blocks}`,
              },
            ],
          }
        : { ...state, focusLog };
      if (earnsXp && !next.days.includes(e.date)) next.days = [...next.days, e.date];
      return next;
    }

    case 'mock-recorded': {
      const xpAlready = state.xpLedger.some((x) => x.source === 'mock' && x.date === e.mock.date);
      const next: LumioState = {
        ...state,
        mocks: [...state.mocks, e.mock],
      };
      if (!xpAlready) {
        next.xpLedger = [
          ...state.xpLedger,
          {
            id: `mock-${e.mock.date}`,
            date: e.mock.date,
            amount: MOCK_XP,
            source: 'mock' as const,
            ref: e.mock.date,
          },
        ];
        if (!next.days.includes(e.mock.date)) next.days = [...next.days, e.mock.date];
      }
      return next;
    }

    case 'freeze-used': {
      // honest redemption: needs inventory, and the day must not already be shielded
      if (state.freeze.owned <= 0 || state.freeze.used[e.date]) return state;
      return {
        ...state,
        freeze: {
          ...state.freeze,
          owned: state.freeze.owned - 1,
          used: { ...state.freeze.used, [e.date]: true },
        },
      };
    }

    case 'session-rescheduled': {
      const dayOverrides = { ...(state.planOverrides[e.date] ?? {}) };
      if (e.startMin === null) {
        if (!(String(e.index) in dayOverrides)) return state;
        delete dayOverrides[String(e.index)];
      } else {
        if (dayOverrides[String(e.index)] === e.startMin) return state;
        dayOverrides[String(e.index)] = e.startMin;
      }
      return {
        ...state,
        planOverrides: { ...state.planOverrides, [e.date]: dayOverrides },
      };
    }

    // ---- chunk 4B: study tools (7.14) ----

    case 'note-added': {
      if (state.notes.some((n) => n.id === e.note.id)) return state;
      return { ...state, notes: [...state.notes, e.note] };
    }

    case 'note-removed': {
      if (!state.notes.some((n) => n.id === e.noteId)) return state;
      return { ...state, notes: state.notes.filter((n) => n.id !== e.noteId) };
    }

    case 'video-added': {
      if (state.videos.some((v) => v.id === e.video.id)) return state;
      return { ...state, videos: [...state.videos, e.video] };
    }

    case 'video-removed': {
      if (!state.videos.some((v) => v.id === e.videoId)) return state;
      return { ...state, videos: state.videos.filter((v) => v.id !== e.videoId) };
    }

    // ---- chunk 5B: AI practice-only saves (no XP, deduped by id, capped at 30) ----

    case 'ai-generated': {
      if (state.aiContent[e.id]) return state;
      const aiContent = {
        ...state.aiContent,
        [e.id]: { kind: e.kind, date: e.date, payload: e.payload, label: e.label },
      };
      // Cap: keep at most the 30 most recent ids — events replay in order, so
      // the oldest keys are simply the first inserted.
      const keys = Object.keys(aiContent);
      if (keys.length > 30) {
        for (const k of keys.slice(0, keys.length - 30)) delete aiContent[k];
      }
      return { ...state, aiContent };
    }

    // ---- chunk 5-AI: lesson/worksheet saves share the ai-generated cap; the
    // prompt's "ai-content-saved" name is served by this same reducer path so
    // one honest cap covers every saved AI artefact.

    case 'ai-content-saved': {
      if (state.aiContent[e.id]) return state;
      const aiContent = {
        ...state.aiContent,
        [e.id]: { kind: e.kind, date: e.date, payload: e.payload, label: e.label },
      };
      const keys = Object.keys(aiContent);
      if (keys.length > 30) {
        for (const k of keys.slice(0, keys.length - 30)) delete aiContent[k];
      }
      return { ...state, aiContent };
    }

    case 'ai-content-removed': {
      if (!state.aiContent[e.id]) return state;
      const aiContent = { ...state.aiContent };
      delete aiContent[e.id];
      return { ...state, aiContent };
    }

    case 'ai-quiz-attempted': {
      // Anti-farm: the best score per CHAPTER across every generated set lives
      // in aiQuizBest — regenerating can never reset it. XP is the deterministic
      // improvement rule (max(0, score - best) x 10) with a hard daily cap.
      const prevBest = state.aiQuizBest[e.chapterRef] ?? 0;
      const rawGain = Math.max(0, e.score - prevBest) * 10;
      const xpToday = state.xpLedger
        .filter((x) => x.source === 'aiquiz' && x.date === e.date)
        .reduce((n, x) => n + x.amount, 0);
      const gain = Math.min(rawGain, Math.max(0, AI_QUIZ_XP_DAILY_CAP - xpToday));
      const aiQuizBest = { ...state.aiQuizBest, [e.chapterRef]: Math.max(prevBest, e.score) };
      const wrong = { ...state.wrong };
      for (const id of e.wrongIds) wrong[id] = 1;
      const xpLedger =
        gain > 0
          ? [
              ...state.xpLedger,
              {
                id: `aiquiz-${e.quizHash}-${e.date}-${state.xpLedger.length}`,
                date: e.date,
                amount: gain,
                source: 'aiquiz' as const,
                ref: e.quizHash,
              },
            ]
          : state.xpLedger;
      const days =
        gain > 0 && !state.days.includes(e.date) ? [...state.days, e.date] : state.days;
      return { ...state, aiQuizBest, wrong, xpLedger, days };
    }

    // ---- chunk 6: syllabus tracker (self-reported marks — never any XP) ----

    case 'syllabus-topic-updated':
      return applyTopicUpdate(state, e.topicId, e.patch, e.date);

    case 'syllabus-topics-bulk': {
      // max 60 ids per bulk action (prompt section 3); last write wins, and
      // ids the dataset never heard of are simply never rendered anywhere.
      const ids = e.topicIds.slice(0, 60);
      let next = state;
      for (const topicId of ids) {
        next = applyTopicUpdate(next, topicId, e.patch, e.date);
      }
      return next;
    }

    case 'syllabus-plan-accepted':
      return {
        ...state,
        syllabus: { ...state.syllabus, plans: { ...state.syllabus.plans, [e.date]: e.plan } },
      };

    case 'syllabus-plan-cleared': {
      if (!state.syllabus.plans[e.date]) return state;
      const plans = { ...state.syllabus.plans };
      delete plans[e.date];
      return { ...state, syllabus: { ...state.syllabus, plans } };
    }

    case 'tour-updated': {
      const base: LumioState['tour'] = state.tour ?? { done: false, stepId: null };
      return {
        ...state,
        tour: { ...base, ...e.patch },
      };
    }

    case 'syllabus-subject-visibility': {
      const hidden = state.syllabus.hiddenSubjects;
      if (e.hidden && hidden.includes(e.subjectId)) return state;
      if (!e.hidden && !hidden.includes(e.subjectId)) return state;
      return {
        ...state,
        syllabus: {
          ...state.syllabus,
          hiddenSubjects: e.hidden ? [...hidden, e.subjectId] : hidden.filter((id) => id !== e.subjectId),
        },
      };
    }

    default:
      return state;
  }
}

/**
 * Pure topic-update shared by the single and bulk syllabus events. Enforces
 * the honest-marks invariants (prompt section 3):
 * - confidence only ever stored on completed topics (else cleared);
 * - completedOn set on the FIRST completion and never overwritten;
 * - lastReviewedOn stamped whenever the learner marks it confident again;
 * - note sanitised and clamped to 280 chars;
 * - flags validated against the bounded union, deduped, capped at 8.
 */
function applyTopicUpdate(
  state: LumioState,
  topicId: string,
  patch: SyllabusTopicPatch,
  date: string
): LumioState {
  if (!topicId) return state;
  const prev: TopicProgress = state.syllabus.topics[topicId] ?? emptyTopicProgress(date);
  const next: TopicProgress = { ...prev };

  if (patch.progress !== undefined) next.progress = patch.progress;
  if (patch.confidence !== undefined) next.confidence = patch.confidence;
  if (patch.flags !== undefined) next.flags = sanitizeFlags(patch.flags);
  if (patch.note !== undefined) next.note = sanitizeSyllabusNote(patch.note);

  // confidence is only meaningful on a completed topic
  if (next.progress !== 'completed') next.confidence = null;

  if (next.progress === 'completed') {
    if (!prev.completedOn && prev.progress !== 'completed') next.completedOn = date;
    else if (prev.completedOn) next.completedOn = prev.completedOn;
  } else {
    delete next.completedOn;
  }

  if (next.confidence === 'confident' && prev.confidence !== 'confident') {
    next.lastReviewedOn = date;
  } else if (prev.lastReviewedOn) {
    next.lastReviewedOn = prev.lastReviewedOn;
  }

  next.updatedOn = date;

  // no-op change: keep identity so replay stays cheap and dedupes naturally
  if (
    next.progress === prev.progress &&
    next.confidence === prev.confidence &&
    next.note === prev.note &&
    next.completedOn === prev.completedOn &&
    next.lastReviewedOn === prev.lastReviewedOn &&
    next.flags.length === prev.flags.length &&
    next.flags.every((f) => prev.flags.includes(f)) &&
    next.updatedOn === prev.updatedOn
  ) {
    return state;
  }

  return {
    ...state,
    syllabus: { ...state.syllabus, topics: { ...state.syllabus.topics, [topicId]: next } },
  };
}

/**
 * Grant a Streak Saver for a 90%+ quiz score or a lab pass: at most once per
 * ISO week, and never above the inventory cap. Pure helper shared by
 * quiz-attempted and game-won.
 */
function grantScoreSaver(freeze: LumioState['freeze'], date: string): LumioState['freeze'] {
  const wk = weekKeyOfDate(date);
  if (freeze.weekScore?.includes(wk)) return freeze;
  if (freeze.owned >= SAVER_CAP) return freeze;
  return {
    ...freeze,
    owned: freeze.owned + 1,
    weekScore: [...(freeze.weekScore ?? []), wk],
  };
}

/** Replay the whole log from the empty state (projection = fold over events). */
export function replayEvents(events: LumioEvent[], now: Date, tz: string): LumioState {
  let s = defaultState();
  for (const e of events) s = applyEvent(s, e);
  return projectState(s, now, tz);
}

/** Wrap a domain event with device metadata and append it to the log. */
export async function appendEvent(e: LumioEvent, tz: string): Promise<void> {
  const row: StoredEvent = {
    ...e,
    deviceId: await deviceId(),
    clientTime: new Date().toISOString(),
    tz,
    synced: 0, // the sync queue drains to the backend-lite server in chunk 5
  };
  await dbAppendEvent(row);
}

/**
 * Load the event log. If the log is empty but a localStorage `lumio-v2`
 * snapshot exists (chunk-1 install), migrate it once by appending a bootstrap
 * event — nothing is lost and the projection stays authoritative.
 */
export async function loadEventsAndSeed(): Promise<LumioEvent[]> {
  const events = await dbGetEvents();
  if (events.length > 0) return events;
  // migration path: read the localStorage snapshot directly (no projection)
  try {
    const raw = localStorage.getItem('lumio-v2');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LumioState;
    if (parsed?.schema === 2) {
      await appendEvent({ type: 'bootstrap', state: parsed }, parsed.profile?.tz ?? 'Asia/Kolkata');
      return [{ type: 'bootstrap', state: parsed }];
    }
  } catch {
    /* corrupted snapshot — start clean */
  }
  return [];
}
