'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Shell, type ScreenId } from './Shell';
import { StudyBuddy, type BuddyChapter } from './ai/StudyBuddy';
import {
  Onboarding, draftFromProfile, EMPTY_DRAFT,
  type FirstRunResult, type WizardDraft,
} from './screens/Onboarding';
import { Home } from './screens/Home';
import { SettingsScreen } from './screens/Settings';
import { Study, BoardGuide } from './screens/Study';
import { SyllabusScreen } from './screens/Syllabus';
import { Reader } from './screens/Reader';
import { Quiz, type QuizOutcome } from './screens/Quiz';
import { ProgressScreen } from './screens/Progress';
import { AchievementsScreen } from './screens/Achievements';
import { GamesScreen } from './screens/Games';
import { Planner } from './screens/Planner';
import { Focus } from './screens/Focus';
import { MockTests } from './screens/Mocks';
import { StudyTools } from './screens/StudyTools';
import { GuardianScreen } from './screens/Guardian';
import { Mascot } from './Mascot';
import { XpStreakDashboard } from './screens/XpStreak';
import { Tour } from './tour/Tour';
import { tourCtxFrom } from './tour/steps';
import { AccountBadge, AccountSettingsCard, DevicePrompt } from './account/AccountCard';
import { authApi, type AccountUser } from '@/lib/lumio/accountClient';
import { aiApi } from '@/lib/lumio/aiClient';
import type { NotesAiResult, PracticeAiItem, LessonAiResult, WorksheetAiResult } from '@/lib/lumio/aiClient';
import { dbMetaGet, dbMetaSet } from '@/lib/lumio/db';
import { BANDS } from '@/lib/lumio/content';
import { dayKey, hourOf, planDayWithOverrides, streakFrom, themeAt, totalXp } from '@/lib/lumio/domain';
import { toast } from '@/hooks/use-toast';
import { tFor } from '@/lib/lumio/i18n';
import {
  syllabusForProfile,
  syllabusSubjectById,
  unitMarksShare,
} from '@/lib/lumio/syllabus';
import { ACTIVITY_MINUTES, buildSyllabusPlan } from '@/lib/lumio/syllabus/planner';
import type { SyllabusPlan as SyllabusPlanT } from '@/lib/lumio/syllabus/planner';
import { deriveMark } from '@/lib/lumio/syllabus/types';
import type {
  AcceptedPlan,
  SyllabusTopicPatch,
  TopicId,
  TopicMark,
} from '@/lib/lumio/syllabus/types';
import type { TourLoc } from './tour/steps';
import {
  DEFAULT_SETTINGS, DEFAULT_TZ, defaultState, loadState, normalizeState, parseImport,
  projectState, resetAllStorage, saveState,
} from '@/lib/lumio/storage';
import { appendEvent, applyEvent, loadEventsAndSeed, replayEvents } from '@/lib/lumio/events';
import { requestPersistence } from '@/lib/lumio/db';
import { GAME_XP, LAB_GAME_IDS, PRACTICE_XP } from '@/lib/lumio/domain';
import type { LumioEvent, LumioState, MistakeTag, PracticeKind, Profile, Settings, ThemeName } from '@/lib/lumio/types';

/**
 * LumioApp (chunk 2): single-route client app. Owns the typed state (a pure
 * projection of the IndexedDB event log), the theme engine, screen switching
 * and all mutations via `dispatch` — every change is an appended event (ADR
 * 0002). Persistence: event log -> projection -> snapshot mirror.
 */
export function LumioApp() {
  const [state, setState] = useState<LumioState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<ScreenId>('home');
  const [reader, setReader] = useState<number | null>(null);
  const [quiz, setQuiz] = useState<number | null>(null);
  // open game on the Games hub (owned here so the guided tour's Back can restore it)
  const [gameId, setGameId] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const [now, setNow] = useState(() => new Date());
  const [swWaiting, setSwWaiting] = useState<ServiceWorker | null>(null);
  // ---- chunk 5A: account state (never gates the learning loop) ----
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [accountAvail, setAccountAvail] = useState<'unknown' | 'ok' | 'unavailable'>('unknown');
  // ---- chunk 5B: AI capability (unknown -> treated as off until the probe resolves) ----
  const [aiMode, setAiMode] = useState<'unknown' | 'off' | 'fake' | 'zai' | 'openai-compatible'>('unknown');
  const [studyBuddyOpen, setStudyBuddyOpen] = useState(false);
  const [devOutbox, setDevOutbox] = useState(false);
  const [devicePrompt, setDevicePrompt] = useState<{ userId: string; userName: string | null } | null>(null);
  const stateRef = useRef<LumioState | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);

  // ---- derived values: ALL declared above every useEffect hook ----
  // Plain constants (no useMemo). Keeping every binding above the effects
  // guarantees no hoisted effect can ever read them in their temporal dead zone
  // (the chunk-1 TDZ bug — this ordering is a hard rule for this file).
  const tz = state?.profile?.tz ?? DEFAULT_TZ;
  const calm = state?.settings.calm ?? false;
  const themeOverride = state?.settings.theme ?? 'auto';
  const themeSchedule = state?.settings.sch ?? DEFAULT_SETTINGS.sch;
  const theme: ThemeName =
    themeOverride !== 'auto' ? themeOverride : themeAt(hourOf(now, tz), themeSchedule);
  const band = state?.profile?.band;
  const density =
    band === 'young' ? ('young' as const) : band === 'above' ? ('adult' as const) : ('school' as const);
  // chunk 4B: interface language drives translation + Devanagari typography.
  // During first-run onboarding there is no profile yet, so the wizard draft's
  // language answer applies live (question 2 of onboarding).
  const draftLang = (state?.draft as unknown as WizardDraft | null)?.lang;
  const lang = state?.profile?.lang ?? draftLang ?? 'en';
  const tr = tFor(lang);
  // chunk 5B: AI features are hidden entirely until the capability probe says otherwise
  const aiAvailable = aiMode === 'fake' || aiMode === 'zai' || aiMode === 'openai-compatible';

  // hydrate once (client only; never during SSR): replay the event log, seeded
  // from the chunk-1 snapshot when present. Falls back to the snapshot mirror
  // if IndexedDB replay fails entirely.
  useEffect(() => {
    let alive = true;
    requestPersistence();
    queueMicrotask(async () => {
      if (!alive) return;
      try {
        const events = await loadEventsAndSeed();
        const projected = replayEvents(events, new Date(), events.length && (events[events.length - 1] as { tz?: string }).tz ? ((events[events.length - 1] as unknown as { tz: string }).tz) : DEFAULT_TZ);
        if (alive) {
          setState(projected);
          saveState(projected);
        }
      } catch {
        const snapshot = loadState();
        if (alive) setState(snapshot ? projectState(normalizeState(snapshot), new Date(), snapshot.profile?.tz ?? DEFAULT_TZ) : defaultState());
      }
      if (alive) setHydrated(true);
    });
    return () => { alive = false; };
  }, []);

  // minute ticker: keeps the theme engine and scheduler honest without tick-count timers
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Theme + density classes must live on <html> so that font-size (rem scale),
  // body background and touch-target vars resolve globally (chunk-1 bug fix —
  // keep the sync on documentElement, not just the Shell wrapper).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(
      'theme-morning', 'theme-evening', 'theme-night', 'night',
      'density-young', 'density-school', 'density-adult', 'calm'
    );
    root.classList.add(`theme-${theme}`, `density-${density}`);
    if (theme === 'night') root.classList.add('night');
    if (calm) root.classList.add('calm');
  }, [theme, density, calm]);

  // Language class on <html> pairs Noto Sans Devanagari with the brand fonts
  // and keeps assistive tech informed (chunk 4B i18n).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('lang-hi', 'lang-hinglish', 'lang-en');
    root.classList.add(`lang-${lang}`);
    root.setAttribute('lang', lang === 'hi' ? 'hi' : 'en');
  }, [lang]);

  // ---- chunk 5A: account probe — AFTER hydration, never blocking ----
  // The app boots fully from local data; /api/auth/me and /api/capabilities
  // are tried afterwards. Unreachable server => honest 'unavailable' state,
  // every existing feature keeps working (degradation matrix master 8.2).
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    void (async () => {
      const caps = await authApi.capabilities();
      const me = await authApi.me();
      if (!alive) return;
      const unavailable = !caps.ok || !me.ok || me.data.unavailable === true;
      setAccountAvail(unavailable ? 'unavailable' : 'ok');
      if (caps.ok) {
        setDevOutbox(caps.data.devOutbox === true);
        const mode = caps.data.ai?.mode;
        setAiMode(mode === 'fake' || mode === 'zai' || mode === 'openai-compatible' ? mode : 'off');
      } else {
        setAiMode('off');
      }
      if (me.ok && me.data.signedIn && me.data.user) {
        setAccountUser(me.data.user);
        await dbMetaSet('account-user-id', me.data.user.id);
      } else {
        setAccountUser(null);
      }
    })();
    return () => { alive = false; };
  }, [hydrated]);

  const recordAccountId = (id: string) => {
    try {
      localStorage.setItem('lumio-account-last', id);
    } catch {
      /* private mode */
    }
  };

  const handleSignedIn = (user: AccountUser) => {
    const prevId = (() => {
      try {
        return localStorage.getItem('lumio-account-last');
      } catch {
        return null;
      }
    })();
    const hasLocalProgress = !!stateRef.current?.profile;
    if (prevId && prevId !== user.id && hasLocalProgress) {
      // Never merge silently (spec 8): ask the learner what to do.
      setDevicePrompt({ userId: user.id, userName: user.name });
      setAccountUser(user);
      void dbMetaSet('account-user-id', user.id);
      return;
    }
    recordAccountId(user.id);
    setAccountUser(user);
    void dbMetaSet('account-user-id', user.id);
    toast({ title: tr('account.welcome'), description: tr('account.signedInToast') });
  };

  const handleSignedOut = () => {
    setAccountUser(null);
    void dbMetaSet('account-user-id', '');
    toast({ title: tr('account.signedOutToast') });
  };

  const handleDeleted = () => {
    setAccountUser(null);
    try {
      localStorage.removeItem('lumio-account-last');
    } catch {
      /* private mode */
    }
    void dbMetaSet('account-user-id', '');
    toast({ title: tr('account.deletedToast') });
  };

  const accountSlot = (
    <AccountBadge
      lang={lang}
      user={accountUser}
      avail={accountAvail}
      devOutbox={devOutbox}
      onSignedIn={handleSignedIn}
      onSignedOut={handleSignedOut}
      onDeleted={handleDeleted}
    />
  );

  // chunk 5B: when a chapter is open in Reader OR the Quiz the panel grounds on
  // THAT chapter; otherwise StudyBuddy shows a chapter select (chapter = null).
  const studyBuddyChapter: BuddyChapter | null =
    state?.profile?.band && (reader !== null || quiz !== null)
      ? (() => {
          const idx = reader ?? quiz ?? 0;
          const chapters = BANDS[state.profile!.band].chapters;
          const ch = chapters[Math.min(Math.max(0, idx), chapters.length - 1)];
          return ch
            ? { id: `${state.profile!.band}#${idx}`, title: ch.title, subject: ch.subject, chapterIndex: idx }
            : null;
        })()
      : null;
  const aiDemo = aiMode === 'fake';

  // ---- chunk 5-AI-0: honest AI status chip (header) — derived above all effects ----
  const aiStatusChip = (
    <button
      type="button"
      onClick={() => setScreen('settings')}
      title={
        aiMode === 'zai' || aiMode === 'openai-compatible'
          ? tr('ai.chipRealTitle')
          : aiMode === 'fake'
            ? tr('ai.chipDemoTitle')
            : tr('ai.chipOffTitle')
      }
      className={
        'hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex min-h-[32px] ' +
        (aiMode === 'zai' || aiMode === 'openai-compatible'
          ? 'bg-primary/10 text-primary'
          : aiMode === 'fake'
            ? 'bg-gold-soft'
            : 'bg-muted text-muted-foreground')
      }
      style={aiMode === 'fake' ? { color: 'var(--gold)' } : undefined}
      aria-label={aiMode === 'zai' || aiMode === 'openai-compatible'
        ? tr('ai.chipRealTitle')
        : aiMode === 'fake'
          ? tr('ai.chipDemoTitle')
          : tr('ai.chipOffTitle')}
    >
      <Sparkles className="size-3.5" aria-hidden="true" />
      {aiMode === 'zai' || aiMode === 'openai-compatible'
        ? tr('ai.chipReal')
        : aiMode === 'fake'
          ? tr('ai.chipDemo')
          : tr('ai.chipOff')}
    </button>
  );

  // ---- chunk 6: syllabus tracker (CBSE Class 11 gate; derived, never stored) ----
  const syllabusAll = state?.profile ? syllabusForProfile(state.profile.className, state.profile.board) : null;
  const syllabusAvailable = !!syllabusAll;
  const syllabusSubjects = (syllabusAll ?? []).filter(
    (s) => !state?.syllabus.hiddenSubjects.includes(s.id)
  );
  const todayKey = dayKey(now, tz);
  const acceptedSyllabusPlan: AcceptedPlan | null = state?.syllabus.plans[todayKey] ?? null;
  const dueCardsCount = Object.values(state?.srs ?? {}).filter((c) => c.due <= todayKey).length;

  /** Slots for today (from the existing planner, overrides respected). */
  const syllabusSlots = state?.plan ? planDayWithOverrides(state.plan, state.planOverrides[todayKey]).slots : [];

  /** Nearest future exam date the learner gave us — one date for all subjects. */
  const syllabusExamDate = (() => {
    const p = state?.profile;
    const candidates = [p?.nextExamDate, p?.examDate, p?.compExamDate, p?.targetDate].filter(
      (d): d is string => !!d
    );
    return candidates.sort()[0] ?? undefined;
  })();

  const examDatesForSyllabus: Record<string, string | undefined> = {};
  for (const s of syllabusSubjects) examDatesForSyllabus[s.id] = syllabusExamDate;

  /** Topics already planned or marked today are skipped by the planner. */
  const plannedTodaySet: ReadonlySet<TopicId> = new Set([
    ...(acceptedSyllabusPlan?.items.flatMap((i) => i.topicIds) ?? []),
    ...Object.entries(state?.syllabus.topics ?? [])
      .filter(([, rec]) => rec.updatedOn === todayKey)
      .map(([id]) => id),
  ]);

  const buildSyllabusPlanToday = (): SyllabusPlanT =>
    buildSyllabusPlan({
      today: todayKey,
      dayIndex: 0,
      slots: syllabusSlots,
      subjects: syllabusSubjects,
      compSub: state?.profile?.compSub,
      progress: state?.syllabus.topics ?? {},
      examDates: examDatesForSyllabus,
      plannedToday: plannedTodaySet,
      dueCardsCount,
    });

  const deterministicSyllabusPlan: SyllabusPlanT = buildSyllabusPlanToday();

  // service-worker update prompt (chunk 2): never auto-swaps mid-session
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    let reg: ServiceWorkerRegistration | null = null;
    const findWaiting = () => {
      if (reg?.waiting && navigator.serviceWorker.controller) setSwWaiting(reg.waiting);
    };
    navigator.serviceWorker.register('/sw.js')
      .then((r) => {
        reg = r;
        findWaiting();
        r.addEventListener('updatefound', () => {
          const nw = r.installing;
          nw?.addEventListener('statechange', () => {
            if (nw.state === 'installed') findWaiting();
          });
        });
      })
      .catch(() => { /* offline/PWA unsupported — the app still works */ });
  }, []);

  /**
   * The one mutation path: append an event, reapply the projection, mirror the
   * snapshot. Derived values (XP, best scores, streak, achievements) come out
   * of the projection only — never set by callers (5.4).
   */
  const dispatch = useCallback((e: LumioEvent) => {
    const prev = stateRef.current;
    if (!prev) return;
    const zone = prev.profile?.tz ?? DEFAULT_TZ;
    const next = projectState(applyEvent(prev, e), new Date(), zone);
    stateRef.current = next;
    setState(next);
    const res = saveState(next);
    setSaveError(res.ok ? undefined : res.error);
    // Streak Saver notifications (chunk 4C): earned / bought / used.
    const prevOwned = prev.freeze.owned;
    const nextOwned = next.freeze.owned;
    if (nextOwned > prevOwned) {
      toast({
        title: e.type === 'saver-bought' ? 'Streak Saver purchased' : 'Streak Saver earned!',
        description:
          e.type === 'saver-bought'
            ? 'It will protect your streak if a day is missed.'
            : 'Great performance — your streak just got an extra life.',
      });
    } else if (nextOwned < prevOwned) {
      toast({
        title: 'Streak Saver used',
        description: 'Your streak stays alive. Keep learning to earn more.',
      });
    }
    void appendEvent(e, zone).catch(() => {
      // event log unavailable (private mode) — the snapshot mirror keeps the
      // session working; the learner sees an honest error if saving failed.
    });
  }, []);

  // ---- mutations ----
  const finishFirstRun = (r: FirstRunResult) => {
    // A FRESH first-run (not the Settings "edit profile" replay of the wizard)
    // arms the guided tour exactly once. Restored/imported profiles never carry
    // tour.start === true, so the tour never interrupts returning learners.
    const isEdit = !!stateRef.current?.profile;
    dispatch({ type: 'onboarding-finished', profile: r.profile, plan: r.plan });
    if (!isEdit) {
      dispatch({ type: 'tour-updated', patch: { done: false, stepId: null, start: true } });
    }
    setEditProfile(false);
    setScreen('home');
  };

  // guided tour: runs once after a fresh onboarding; replayable from Settings.
  // NOTE (chunk-1 TDZ rule): this block only uses values declared ABOVE it —
  // xp/streak are computed inline from state because the derived bindings live
  // below the hydration early-return.
  const tourActive = !!(state && state.profile && state.tour && state.tour.start === true && !state.tour.done);
  const tourCtx = state?.profile
    ? tourCtxFrom(
        state.profile,
        totalXp(state.xpLedger),
        streakFrom(state.days, dayKey(new Date(), tz), state.freeze.used),
        aiAvailable,
        syllabusAvailable
      )
    : null;
  const tourSetStep = useCallback((stepId: string) => {
    if (stateRef.current?.tour?.stepId !== stepId) {
      dispatch({ type: 'tour-updated', patch: { stepId } });
    }
  }, [dispatch]);
  const tourEnd = useCallback((finished: boolean) => {
    dispatch({ type: 'tour-updated', patch: { done: true, stepId: null } });
    setStudyBuddyOpen(false);
    if (finished) {
      // finished: hand the learner back to Home with a clean slate
      setScreen('home');
      setReader(null);
      setQuiz(null);
      setGameId(null);
    }
    // skipped: leave the learner safely where they are
  }, [dispatch]);
  const tourLoc = useCallback((loc: TourLoc) => {
    setScreen(loc.screen);
    setReader(loc.reader);
    setQuiz(loc.quiz);
    setGameId(loc.game ?? null);
  }, []);

  const saveDraft = (draft: WizardDraft | null) => {
    dispatch({ type: 'draft-saved', draft: draft as unknown as Record<string, unknown> | null });
  };

  const patchSettings = (patch: Partial<Settings>) => {
    dispatch({ type: 'settings-changed', patch });
  };

  const patchPlan = (patch: Partial<NonNullable<LumioState['plan']>>) => {
    if (!state?.plan) return;
    dispatch({ type: 'plan-changed', plan: { ...state.plan, ...patch } });
  };

  const markPlanReviewed = () => {
    if (!state) return;
    const today = dayKey(new Date(), tz);
    if (state.planReviews[today]) return;
    // The activity makes the daily quest claimable; the Claim button grants the XP.
    dispatch({ type: 'plan-reviewed', date: today });
  };

  const claimQuest = (questId: string, periodKey: string, xp: number) => {
    if (!state) return;
    if (state.quests.some((c) => c.questId === questId && c.periodKey === periodKey)) return;
    dispatch({ type: 'quest-claimed', questId, periodKey, xp, date: dayKey(new Date(), tz) });
  };

  const finishQuiz = (chapterIndex: number, outcome: QuizOutcome) => {
    dispatch({
      type: 'quiz-attempted',
      chapterId: `${state?.profile?.band ?? 'sec'}#${chapterIndex}`,
      score: outcome.score,
      nq: outcome.nq,
      wrongIds: outcome.wrongIds,
      theme,
      date: dayKey(new Date(), tz),
    });
    setQuiz(null);
    setReader(null);
    setScreen('home');
  };

  // ---- chunk 5-AI feature 2: AI fresh-quiz completion. XP flows through the
  // deterministic improvement rule with the daily cap + per-chapter best
  // enforced in applyEvent — AI output itself never grants anything.
  const finishQuizAi = (chapterIndex: number, r: { quizHash: string; score: number; nq: number; wrongIds: string[] }) => {
    dispatch({
      type: 'ai-quiz-attempted',
      chapterRef: `${state?.profile?.band ?? 'sec'}#${chapterIndex}`,
      quizHash: r.quizHash,
      score: r.score,
      nq: r.nq,
      wrongIds: r.wrongIds,
      theme,
      date: dayKey(new Date(), tz),
    });
    setQuiz(null);
    setReader(null);
    setScreen('home');
  };

  const flashcardsReviewed = (chapterIndex: number) => {
    dispatch({ type: 'flashcards-reviewed', chapterId: `${state?.profile?.band ?? 'sec'}#${chapterIndex}`, date: dayKey(new Date(), tz) });
  };

  // ---- chunk 3: games, labs and the practice engine ----
  const winGame = (gameId: string) => {
    const prev = stateRef.current;
    const firstClear = !prev?.xpLedger.some((x) => x.source === 'game' && x.ref === gameId);
    dispatch({
      type: 'game-won',
      gameId,
      xp: GAME_XP[gameId] ?? 20,
      date: dayKey(new Date(), tz),
      lab: LAB_GAME_IDS.has(gameId),
      firstClear,
    });
  };
  const reviewCard = (cardId: string, correct: boolean) => {
    dispatch({ type: 'card-reviewed', cardId, correct, date: dayKey(new Date(), tz) });
  };
  const finishPractice = (kind: PracticeKind) => {
    dispatch({ type: 'practice-done', kind, xp: PRACTICE_XP[kind] ?? 10, date: dayKey(new Date(), tz) });
  };
  const finishLegendary = () => {
    dispatch({ type: 'legendary-completed', date: dayKey(new Date(), tz) });
  };
  const tagMistake = (questionId: string, tag: MistakeTag | null) => {
    dispatch({ type: 'mistake-tagged', questionId, tag });
  };

  // ---- chunk 5B: AI practice-only saves (kind 'notes' | 'practice') ----
  // Never touches XP/streak/mastery — the projection keeps the record in
  // state.aiContent (deduped by id, capped at 30, capped by applyEvent).
  const saveAiContent = (
    kind: 'notes' | 'practice',
    id: string,
    date: string,
    payload: NotesAiResult | { items: PracticeAiItem[] },
    label: string,
  ) => {
    dispatch({ type: 'ai-generated', id, kind, date, payload, label });
  };
  const saveAiNotes = (args: {
    id: string;
    kind: 'notes';
    date: string;
    payload: NotesAiResult;
    label: string;
  }) => {
    saveAiContent(args.kind, args.id, args.date, args.payload, args.label);
  };
  // chunk 5-AI: lesson/worksheet saves via the ai-content-saved event (same
  // cap + dedupe as ai-generated; practice-only, never any XP).
  const saveAiContentV2 = (
    kind: 'lesson' | 'worksheet',
    id: string,
    date: string,
    payload: LessonAiResult | WorksheetAiResult,
    label: string,
  ) => {
    dispatch({ type: 'ai-content-saved', id, kind, date, payload, label });
  };

  // ---- chunk 4A: focus suite, mocks, streak freezes, reschedule ----
  const finishFocusBlock = (mins: number) => {
    dispatch({ type: 'focus-block-done', date: dayKey(new Date(), tz), mins });
  };
  const recordMock = (mock: { date: string; subject: string; score: number; total: number; weakChapters: number[] }) => {
    dispatch({ type: 'mock-recorded', mock });
  };
  const useFreeze = (date: string) => {
    dispatch({ type: 'freeze-used', date });
  };
  const rescheduleSession = (date: string, index: number, startMin: number | null) => {
    dispatch({ type: 'session-rescheduled', date, index, startMin });
  };

  // ---- chunk 4C: XP & Streak dashboard ----
  const completeSession = (date: string, index: number, onTime: boolean) => {
    dispatch({ type: 'session-done', date, index, onTime });
  };
  const buySaver = () => {
    dispatch({ type: 'saver-bought', date: dayKey(new Date(), tz) });
  };

  // ---- chunk 4B: study tools ----
  const addNote = (note: { id: string; name: string; text: string; added: string }) => {
    dispatch({ type: 'note-added', note });
  };
  const removeNote = (noteId: string) => {
    dispatch({ type: 'note-removed', noteId });
  };
  const addVideo = (video: { id: string; videoId: string; sourceUrl: string; added: string }) => {
    dispatch({ type: 'video-added', video });
  };
  const removeVideo = (videoId: string) => {
    dispatch({ type: 'video-removed', videoId });
  };

  // ---- chunk 6: syllabus tracker (self-reported marks; never any XP) ----
  const syllabusTopicUpdate = (topicId: string, patch: SyllabusTopicPatch) => {
    dispatch({ type: 'syllabus-topic-updated', topicId, patch, date: dayKey(new Date(), tz) });
  };
  const syllabusTopicsBulk = (topicIds: string[], patch: SyllabusTopicPatch) => {
    dispatch({ type: 'syllabus-topics-bulk', topicIds, patch, date: dayKey(new Date(), tz) });
  };
  const acceptSyllabusPlan = (plan: AcceptedPlan) => {
    dispatch({ type: 'syllabus-plan-accepted', date: dayKey(new Date(), tz), plan });
  };
  const clearSyllabusPlan = () => {
    dispatch({ type: 'syllabus-plan-cleared', date: dayKey(new Date(), tz) });
  };
  const setSyllabusVisibility = (subjectId: string, hidden: boolean) => {
    dispatch({ type: 'syllabus-subject-visibility', subjectId, hidden });
  };

  /**
   * AI refinement of today's deterministic plan (chunk 6, section 5.2).
   * Sends ONLY public syllabus ids/titles, status/flag enums, mark shares,
   * exam buckets and slot lengths — never name, email, user id, and notes
   * only when the learner opts in (sanitised at the event boundary).
   * The deterministic plan always wins: any invalid AI item is dropped here;
   * if nothing valid remains, returns null and the caller shows the
   * deterministic plan with a calm note.
   */
  const refineSyllabusPlan = async (includeNotes: boolean): Promise<AcceptedPlan | null> => {
    const det = buildSyllabusPlanToday();
    if (det.items.length === 0) return null;
    const known = new Set(det.items.flatMap((i) => i.topicIds));
    const slotSubjectOf = new Map(det.items.map((i) => [i.slotIndex, i.subjectId]));
    const titleOf = new Map(det.items.flatMap((i) => i.topicIds.map((id, idx) => [id, i.topicTitles[idx] ?? id] as const)));
    const minutesOf = new Map(det.items.flatMap((i) => {
      const per = Math.max(5, Math.floor(i.minutes / Math.max(1, i.topicIds.length)));
      return i.topicIds.map((id) => [id, per] as const);
    }));
    const nowT = Date.now();
    const examMs = syllabusExamDate ? Date.parse(syllabusExamDate + 'T12:00:00Z') : NaN;
    const examBucket = (id: TopicId): 'none' | 'soon' | 'later' => {
      void id;
      if (!syllabusExamDate || Number.isNaN(examMs)) return 'none';
      const days = Math.round((examMs - nowT) / 86_400_000);
      return days >= 0 && days <= 30 ? 'soon' : 'later';
    };

    const candidates = det.items.flatMap((item) =>
      item.topicIds.map((topicId) => {
        const rec = stateRef.current?.syllabus.topics[topicId];
        const mark: TopicMark = deriveMark(rec);
        const found = syllabusSubjectById(syllabusSubjects, item.subjectId);
        let share = 0;
        if (found) {
          for (const u of found.units) {
            if (u.chapters.some((c) => c.topics.some((t) => t.id === topicId))) {
              share = unitMarksShare(found, u);
              break;
            }
          }
        }
        return {
          topicId,
          title: (titleOf.get(topicId) ?? '').slice(0, 200),
          subjectId: item.subjectId,
          slotIndex: item.slotIndex,
          activity: item.activity,
          minutes: minutesOf.get(topicId) ?? ACTIVITY_MINUTES.learn,
          status: mark,
          flags: rec?.flags ?? [],
          marksShare: share,
          examBucket: examBucket(topicId),
        };
      })
    );

    const notes = includeNotes
      ? det.items
          .flatMap((i) => i.topicIds)
          .map((id) => stateRef.current?.syllabus.topics[id]?.note.trim() ?? '')
          .filter((n) => n.length > 0)
          .slice(0, 8)
      : undefined;

    const res = await aiApi.syllabusCoach({
      band: stateRef.current?.profile?.band ?? 'sec',
      lang: stateRef.current?.profile?.lang ?? 'en',
      includeNotes: includeNotes && !!notes?.length,
      notes,
      slots: syllabusSlots.map((s, i) => ({
        index: i,
        subject: slotSubjectOf.get(i) ?? '',
        minutes: s.endMin - s.startMin,
      })),
      candidates,
    });
    if (!res.ok) return null;

    // Client-side re-validation: the deterministic plan is the source of truth.
    const seen = new Set<TopicId>();
    const items = res.data.data.items
      .filter((it) => {
        if (!slotSubjectOf.has(it.slotIndex)) return false;
        const slot = syllabusSlots[it.slotIndex];
        if (!slot || it.minutes > slot.endMin - slot.startMin) return false;
        if (it.topicIds.length === 0) return false;
        const subject = slotSubjectOf.get(it.slotIndex);
        for (const id of it.topicIds) {
          if (!known.has(id) || seen.has(id)) return false;
          if (det.items.find((d) => d.topicIds.includes(id))?.subjectId !== subject) return false;
          seen.add(id);
        }
        return true;
      })
      .map((it) => ({
        slotIndex: it.slotIndex,
        subjectId: slotSubjectOf.get(it.slotIndex) ?? 'maths',
        topicIds: it.topicIds,
        topicTitles: it.topicIds.map((id) => titleOf.get(id) ?? id),
        activity: (['learn', 'practise', 'revise', 'recall'].includes(it.activity) ? it.activity : 'learn') as 'learn' | 'practise' | 'revise' | 'recall',
        minutes: it.minutes,
        reasonCodes: [],
        reason: it.reason.slice(0, 160),
      }));
    if (items.length === 0) return null;
    return { date: todayKey, source: 'ai', items, summary: res.data.data.summary.slice(0, 200) };
  };

  const importJson = (json: string) => {
    if (!state) return { ok: false as const, error: 'Not ready yet.' };
    const parsed = parseImport(json);
    if ('error' in parsed) return { ok: false as const, error: parsed.error };
    if ('report' in parsed) {
      // legacy lumio-s1 import: report skipped keys honestly (R13)
      dispatch({ type: 'bootstrap', state: projectState(normalizeState(parsed.state), new Date(), parsed.state.profile?.tz ?? DEFAULT_TZ) });
      const skipped = parsed.report.skipped.length
        ? ` Skipped unknown keys: ${parsed.report.skipped.join(', ')}.`
        : ' No unknown keys were skipped.';
      return {
        ok: true as const,
        message: `Prototype import complete. Preserved: ${parsed.report.preserved.join(', ')}.${skipped}`,
      };
    }
    dispatch({ type: 'bootstrap', state: projectState(normalizeState(parsed.state), new Date(), parsed.state.profile?.tz ?? DEFAULT_TZ) });
    return { ok: true as const, message: 'Lumio v2 import complete.' };
  };

  const resetAll = () => {
    void resetAllStorage().then(() => {
      const fresh = defaultState();
      stateRef.current = fresh;
      setState(fresh);
      setSaveError(undefined);
      setScreen('home');
      setReader(null);
      setQuiz(null);
      setEditProfile(false);
    });
  };

  const applySwUpdate = () => {
    swWaiting?.postMessage({ type: 'SKIP_WAITING' });
    setSwWaiting(null);
    // the new worker takes control; a reload follows its controllerchange
    navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  };

  if (!hydrated || !state) {
    // brief hydration shell; content pops in client-side
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground" aria-live="polite">Loading Lumio…</p>
      </div>
    );
  }

  const firstRun = !state.profile;
  const draft = (state.draft as unknown as WizardDraft | null) ?? null;
  const xp = totalXp(state.xpLedger);
  const currentStreak = streakFrom(state.days, dayKey(now, tz));
  const activeBand = state.profile?.band ?? 'sec';

  // pre-filled wizard draft when editing the profile (keeps all progress)
  const editDraft = state.profile
    ? draftFromProfile(state.profile, state.plan, state.settings.theme)
    : null;
  const effectiveDraft: WizardDraft | null = editProfile && editDraft
    ? editDraft
    : firstRun && draft
      ? { ...EMPTY_DRAFT, ...draft }
      : null;

  // chunk 5B: floating AI slot — trigger button (right side only, so it never
  // overlaps the SW-update toast at bottom-24 inset-x-3) + the StudyBuddy panel.
  const aiSlot = (
    <>
      {aiAvailable && !firstRun && !studyBuddyOpen && (
        <button
          type="button"
          onClick={() => setStudyBuddyOpen(true)}
          aria-haspopup="dialog"
          data-tour="ai-trigger"
          className="press fixed bottom-24 right-3 z-40 flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-semibold shadow-lg md:bottom-6 md:right-6"
        >
          <Sparkles className="size-5 text-primary" aria-hidden="true" />
          {tr('ai.askTitle')}
        </button>
      )}
      <StudyBuddy
        open={studyBuddyOpen}
        onOpenChange={setStudyBuddyOpen}
        state={state}
        chapter={studyBuddyChapter}
        aiAvailable={aiAvailable}
        demo={aiDemo}
      />
    </>
  );

  const renderScreen = () => {
    if (firstRun || editProfile) {
      return (
        <Onboarding
          draft={effectiveDraft}
          onDraftChange={saveDraft}
          onFinish={finishFirstRun}
          onCancel={firstRun ? undefined : () => setEditProfile(false)}
          theme={theme}
          onTheme={(o) => patchSettings({ theme: o })}
        />
      );
    }
    if (quiz !== null) {
      const ch = state.profile?.band ? state.profile.band : 'sec';
      return (
        <Quiz
          state={state}
          band={ch}
          chapterIndex={quiz}
          chapter={BAND_CHAPTER(ch, quiz)}
          onBack={() => setQuiz(null)}
          onFinish={(o) => finishQuiz(quiz, o)}
          onFinishAi={(r) => finishQuizAi(quiz, r)}
          onTagMiss={(qid, tag) => dispatch({ type: 'mistake-tagged', questionId: qid, tag })}
          aiAvailable={aiAvailable}
          demo={aiDemo}
        />
      );
    }
    if (reader !== null) {
      return (
        <Reader
          state={state}
          chapterIndex={reader}
          onBack={() => setReader(null)}
          onStartQuiz={() => setQuiz(reader)}
          onFlashcardsReviewed={() => flashcardsReviewed(reader)}
          onAskAi={aiAvailable ? () => setStudyBuddyOpen(true) : undefined}
          aiAvailable={aiAvailable}
          demo={aiDemo}
          onSaveAi={saveAiContent}
          onSaveLesson={saveAiContentV2}
        />
      );
    }
    switch (screen) {
      case 'syllabus':
        return (
          <SyllabusScreen
            state={state}
            now={now}
            subjects={syllabusSubjects}
            allSubjects={syllabusAll ?? []}
            deterministicPlan={deterministicSyllabusPlan}
            acceptedPlan={acceptedSyllabusPlan}
            dueCardsCount={dueCardsCount}
            aiAvailable={aiAvailable}
            demo={aiDemo}
            onTopicUpdate={syllabusTopicUpdate}
            onTopicsBulk={syllabusTopicsBulk}
            onAcceptPlan={acceptSyllabusPlan}
            onClearPlan={clearSyllabusPlan}
            onSubjectVisibility={setSyllabusVisibility}
            onRefineAi={refineSyllabusPlan}
            onGoSettings={() => { setScreen('settings'); setReader(null); setQuiz(null); }}
          />
        );
      case 'study':
        return <Study state={state} onOpenChapter={(i) => setReader(i)} />;
      case 'board':
        return <BoardGuide state={state} />;
      case 'planner':
        return (
          <Planner
            state={state}
            now={now}
            onReschedule={rescheduleSession}
            onSessionDone={completeSession}
            aiAvailable={aiAvailable}
            demo={aiDemo}
          />
        );
      case 'xpstreak':
        return (
          <XpStreakDashboard state={state} now={now} onBuySaver={buySaver} onUseSaver={useFreeze} />
        );
      case 'focus':
        return <Focus state={state} now={now} onFinishBlock={finishFocusBlock} />;
      case 'tools':
        return (
          <StudyTools
            state={state}
            now={now}
            onAddNote={addNote}
            onRemoveNote={removeNote}
            onAddVideo={addVideo}
            onRemoveVideo={removeVideo}
            aiAvailable={aiAvailable}
            demo={aiDemo}
            onSaveAi={saveAiNotes}
            onSaveWorksheet={(a) => saveAiContentV2('worksheet', a.id, a.date, a.payload, a.label)}
          />
        );
      case 'guardian':
        return (
          <GuardianScreen
            state={state}
            now={now}
            onSettings={patchSettings}
            onReset={resetAll}
            aiAvailable={aiAvailable}
            demo={aiDemo}
          />
        );
      case 'progress':
        return <ProgressScreen state={state} now={now} />;
      case 'ach':
        return <AchievementsScreen state={state} now={now} />;
      case 'games':
        return (
          <GamesScreen
            state={state}
            band={activeBand}
            today={dayKey(now, tz)}
            onGameWin={winGame}
            onCardReview={reviewCard}
            onPracticeDone={finishPractice}
            onLegendary={finishLegendary}
            onTagMistake={tagMistake}
            onOpenChapter={(i) => setReader(i)}
            gameOpen={gameId}
            onGameOpen={setGameId}
            aiAvailable={aiAvailable}
            demo={aiDemo}
            mocksPanel={
              <MockTests
                state={state}
                today={dayKey(now, tz)}
                band={activeBand}
                onRecordMock={recordMock}
                aiAvailable={aiAvailable}
                demo={aiDemo}
              />
            }
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            state={state}
            onSettings={patchSettings}
            onPlan={patchPlan}
            onImport={importJson}
            onReset={resetAll}
            onEditProfile={() => setEditProfile(true)}
            saveError={saveError}
            onLang={(l) => dispatch({ type: 'profile-patched', patch: { lang: l } as Partial<Profile> })}
            aiMode={aiMode}
            onReplayTour={() => dispatch({ type: 'tour-updated', patch: { done: false, stepId: null, start: true } })}
            accountSlot={
              <AccountSettingsCard
                lang={lang}
                user={accountUser}
                avail={accountAvail}
                devOutbox={devOutbox}
                onSignedIn={handleSignedIn}
                onSignedOut={handleSignedOut}
                onDeleted={handleDeleted}
              />
            }
          />
        );
      default:
        return (
          <Home
            state={state}
            now={now}
            theme={theme}
            onOpenSettings={() => setScreen('settings')}
            onOpenStudy={() => setScreen('study')}
            onOpenChapter={(i) => setReader(i)}
            onPlanReviewed={markPlanReviewed}
            onQuestClaim={claimQuest}
            onOpenPlanner={() => setScreen('planner')}
            onOpenFocus={() => setScreen('focus')}
            onUseFreeze={useFreeze}
            onSessionDone={(index, onTime) => completeSession(dayKey(now, tz), index, onTime)}
            onOpenXpStreak={() => setScreen('xpstreak')}
            syllabusPlan={acceptedSyllabusPlan}
            onSyllabusTopicUpdate={syllabusTopicUpdate}
          />
        );
    }
  };

  return (
    <>
      <Shell
        screen={screen}
        lang={lang}
        onScreen={(s) => { setScreen(s); setReader(null); setQuiz(null); setGameId(null); }}
        theme={theme}
        density={density}
        calm={calm}
        band={activeBand}
        syllabusAvailable={syllabusAvailable}
        xp={xp}
        streak={currentStreak}
        bare={firstRun}
        accountSlot={accountSlot}
        aiStatusSlot={aiStatusChip}
        aiSlot={aiSlot}
      >
        {renderScreen()}
      </Shell>
      {/* guided product tour — mounted once; only ever active for a fresh
          first-run profile (or an explicit Settings replay) */}
      {tourActive && tourCtx && (
        <Tour
          lang={lang}
          calm={calm}
          ctx={tourCtx}
          screen={screen}
          reader={reader}
          quiz={quiz}
          game={gameId}
          initialStepId={state.tour?.stepId ?? null}
          onLoc={tourLoc}
          onStepChange={tourSetStep}
          onEnd={tourEnd}
          onBuddy={setStudyBuddyOpen}
        />
      )}
      {swWaiting && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-24 z-50 flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg md:bottom-6 md:left-auto md:right-6 md:w-80"
        >
          <RefreshCw className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">New version available</p>
            <p className="text-xs text-muted-foreground">Refresh to get the latest Lumio. Your progress is safe.</p>
          </div>
          <Button size="sm" onClick={applySwUpdate}>Refresh</Button>
        </div>
      )}
      {devicePrompt && (
        <DevicePrompt
          lang={lang}
          onKeep={() => {
            recordAccountId(devicePrompt.userId);
            setDevicePrompt(null);
          }}
          onFresh={() => {
            recordAccountId(devicePrompt.userId);
            setDevicePrompt(null);
            resetAll();
          }}
        />
      )}
    </>
  );
}

// small local helper
function BAND_CHAPTER(band: keyof typeof BANDS, index: number) {
  const chapters = BANDS[band].chapters;
  return chapters[Math.min(Math.max(0, index), chapters.length - 1)];
}
