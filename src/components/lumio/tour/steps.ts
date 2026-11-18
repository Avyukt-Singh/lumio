// Guided product tour — typed step list.
// Every step names the EXACT screen it lives on (loc) and a `data-tour`
// target. Targets that do not exist for the learner's band/device are hidden
// automatically by the controller (missing target -> centred card), and steps
// filtered out by showIf never render at all — the tour never points at
// something that does not exist.
//
// Content rules: bodies are short (< ~30 words), honest, second person, and
// every string lives in i18n as `tour.<id>.t` / `tour.<id>.b` (en/hi/hinglish).
// The tour never performs destructive or account-changing actions and never
// auto-clicks — "try" steps only invite the learner.

import type { Band } from '@/lib/lumio/content';
import type { Profile } from '@/lib/lumio/types';
import type { ScreenId } from '../Shell';

/** Everything the step list (and the tour card) knows about this learner. */
export interface TourCtx {
  band: Band;
  name: string;
  xp: number;
  streak: number;
  hasPlan: boolean;
  syllabusAvailable: boolean;
  aiAvailable: boolean;
  /** 'board' is in this band's nav (every band except young) */
  hasBoard: boolean;
  /** bands with simulation/code labs beyond the basic games */
  hasLabs: boolean;
}

/** Where the app must be when this step is shown — exact, so Back restores it. */
export interface TourLoc {
  screen: ScreenId;
  reader: number | null;
  quiz: number | null;
  /** open game id on the Games hub (null = hub); undefined is treated as null */
  game?: string | null;
}

export type TourSection =
  | 'welcome' | 'home' | 'study' | 'quiz' | 'practice' | 'syllabus'
  | 'progress' | 'xp' | 'planner' | 'focus' | 'tools' | 'board'
  | 'guardian' | 'ai' | 'settings' | 'finish';

export interface TourStep {
  id: string;
  sec: TourSection;
  /** 'explain' = highlight + text · 'try' = highlight + invitation (Next never blocked) */
  type: 'explain' | 'try';
  loc: TourLoc;
  /** value of the `data-tour` attribute to spotlight; undefined = centred card */
  target?: string;
  titleKey: string;
  bodyKey: string;
  showIf?: (c: TourCtx) => boolean;
  /** arriving at this step closes the Study Buddy panel opened by the AI try-step */
  closeBuddy?: boolean;
}

const HOME: TourLoc = { screen: 'home', reader: null, quiz: null };
const notYoung = (c: TourCtx) => c.band !== 'young';

export const TOUR_STEPS: TourStep[] = [
  // ---- 1 · Welcome ----
  {
    id: 'welcome', sec: 'welcome', type: 'explain', loc: HOME,
    titleKey: 'tour.welcome.t', bodyKey: 'tour.welcome.b',
  },

  // ---- 2 · Home (one step per card group, not per button) ----
  {
    id: 'nav', sec: 'home', type: 'explain', loc: HOME, target: 'nav-main',
    titleKey: 'tour.nav.t', bodyKey: 'tour.nav.b',
  },
  {
    id: 'home-hero', sec: 'home', type: 'explain', loc: HOME, target: 'home-hero',
    titleKey: 'tour.home-hero.t', bodyKey: 'tour.home-hero.b',
  },
  {
    id: 'home-quests', sec: 'home', type: 'try', loc: HOME, target: 'home-quests',
    titleKey: 'tour.home-quests.t', bodyKey: 'tour.home-quests.b',
  },

  // ---- 3 · Study & chapters (path + reader in one pass) ----
  {
    id: 'study-nav', sec: 'study', type: 'explain', loc: { screen: 'study', reader: null, quiz: null },
    target: 'study-head',
    titleKey: 'tour.study-nav.t', bodyKey: 'tour.study-nav.b',
  },
  {
    id: 'reader-open', sec: 'study', type: 'explain', loc: { screen: 'study', reader: 0, quiz: null },
    target: 'reader-root',
    titleKey: 'tour.reader-open.t', bodyKey: 'tour.reader-open.b',
  },

  // ---- 4 · Quizzes (open chapter 0's quiz for real) ----
  {
    id: 'quiz-question', sec: 'quiz', type: 'try', loc: { screen: 'study', reader: null, quiz: 0 },
    target: 'quiz-options',
    titleKey: 'tour.quiz-question.t', bodyKey: 'tour.quiz-question.b',
  },

  // ---- 5 · Practice & games ----
  {
    id: 'practice-root', sec: 'practice', type: 'explain', loc: { screen: 'games', reader: null, quiz: null },
    target: 'practice-root', showIf: notYoung,
    titleKey: 'tour.practice-root.t', bodyKey: 'tour.practice-root.b',
  },
  {
    id: 'games-games', sec: 'practice', type: 'explain', loc: { screen: 'games', reader: null, quiz: null },
    target: 'games-games',
    titleKey: 'tour.games-games.t', bodyKey: 'tour.games-games.b',
  },
  {
    id: 'game-open', sec: 'practice', type: 'try', loc: { screen: 'games', reader: null, quiz: null },
    target: 'game-first',
    titleKey: 'tour.game-open.t', bodyKey: 'tour.game-open.b',
  },

  // ---- 6 · Syllabus tracker (CBSE Class 11 only) ----
  {
    id: 'syllabus-root', sec: 'syllabus', type: 'explain',
    loc: { screen: 'syllabus', reader: null, quiz: null },
    target: 'syllabus-root', showIf: (c) => c.syllabusAvailable,
    titleKey: 'tour.syllabus-root.t', bodyKey: 'tour.syllabus-root.b',
  },

  // ---- 7 · Progress & awards ----
  {
    id: 'progress-cm', sec: 'progress', type: 'explain',
    loc: { screen: 'progress', reader: null, quiz: null },
    target: 'progress-cm', showIf: notYoung,
    titleKey: 'tour.progress-cm.t', bodyKey: 'tour.progress-cm.b',
  },
  {
    id: 'ach-root', sec: 'progress', type: 'explain',
    loc: { screen: 'ach', reader: null, quiz: null },
    target: 'ach-root',
    titleKey: 'tour.ach-root.t', bodyKey: 'tour.ach-root.b',
  },

  // ---- 8 · XP & streak (explain-only; the tour never spends XP) ----
  {
    id: 'xps-root', sec: 'xp', type: 'explain',
    loc: { screen: 'xpstreak', reader: null, quiz: null },
    target: 'xps-root', showIf: notYoung,
    titleKey: 'tour.xps-root.t', bodyKey: 'tour.xps-root.b',
  },

  // ---- 9 · Planner ----
  {
    id: 'planner-root', sec: 'planner', type: 'explain',
    loc: { screen: 'planner', reader: null, quiz: null },
    target: 'planner-root', showIf: (c) => c.hasPlan && notYoung(c),
    titleKey: 'tour.planner-root.t', bodyKey: 'tour.planner-root.b',
  },

  // ---- 10 · Focus ----
  {
    id: 'focus-root', sec: 'focus', type: 'explain',
    loc: { screen: 'focus', reader: null, quiz: null },
    target: 'focus-root', showIf: notYoung,
    titleKey: 'tour.focus-root.t', bodyKey: 'tour.focus-root.b',
  },

  // ---- 11 · Study tools (worksheet generator & friends) ----
  {
    id: 'tools-root', sec: 'tools', type: 'explain',
    loc: { screen: 'tools', reader: null, quiz: null },
    target: 'tools-root', showIf: notYoung,
    titleKey: 'tour.tools-root.t', bodyKey: 'tour.tools-root.b',
  },

  // ---- 12 · Board guide (in nav for every band except young) ----
  {
    id: 'board-root', sec: 'board', type: 'explain',
    loc: { screen: 'board', reader: null, quiz: null },
    target: 'board-head', showIf: (c) => c.hasBoard,
    titleKey: 'tour.board-root.t', bodyKey: 'tour.board-root.b',
  },

  // ---- 13 · Guardian (explain only — never flips consent) ----
  {
    id: 'guardian-young', sec: 'guardian', type: 'explain',
    loc: { screen: 'guardian', reader: null, quiz: null },
    target: 'guardian-root', showIf: (c) => c.band === 'young',
    titleKey: 'tour.guardian-young.t', bodyKey: 'tour.guardian-young.b',
  },
  {
    id: 'guardian-root', sec: 'guardian', type: 'explain',
    loc: { screen: 'guardian', reader: null, quiz: null },
    target: 'guardian-root', showIf: notYoung,
    titleKey: 'tour.guardian-root.t', bodyKey: 'tour.guardian-root.b',
  },

  // ---- 14 · AI helpers (only when the capability probe says AI is on) ----
  {
    id: 'ai-trigger', sec: 'ai', type: 'explain', loc: HOME, target: 'ai-trigger',
    showIf: (c) => c.aiAvailable,
    titleKey: 'tour.ai-trigger.t', bodyKey: 'tour.ai-trigger.b',
  },
  {
    id: 'ai-open', sec: 'ai', type: 'try', loc: HOME, target: 'ai-trigger',
    showIf: (c) => c.aiAvailable && notYoung(c),
    titleKey: 'tour.ai-open.t', bodyKey: 'tour.ai-open.b',
  },

  // ---- 15 · Account & settings (one step covers themes → replay) ----
  {
    id: 'settings-appearance', sec: 'settings', type: 'explain',
    loc: { screen: 'settings', reader: null, quiz: null },
    // follows the AI section: closes the Study Buddy panel the tour opened
    closeBuddy: true,
    target: 'settings-appearance',
    titleKey: 'tour.settings-appearance.t', bodyKey: 'tour.settings-appearance.b',
  },

  // ---- 16 · Finish ----
  {
    id: 'finish', sec: 'finish', type: 'explain', loc: HOME, closeBuddy: true,
    titleKey: 'tour.finish.t', bodyKey: 'tour.finish.b',
  },
];

/** Sections in display order (for "Section n: label" + skip-section). */
export const SECTION_ORDER: TourSection[] = [
  'welcome', 'home', 'study', 'quiz', 'practice', 'syllabus', 'progress',
  'xp', 'planner', 'focus', 'tools', 'board', 'guardian', 'ai', 'settings', 'finish',
];

/** Context builder used by LumioApp — keeps profile knowledge in one place. */
export function tourCtxFrom(
  profile: Profile,
  xp: number,
  streak: number,
  aiAvailable: boolean,
  syllabusAvailable: boolean
): TourCtx {
  const band = profile.band;
  return {
    band,
    name: profile.name?.trim() || '',
    xp,
    streak,
    hasPlan: true, // onboarding-finished always stores a plan
    syllabusAvailable,
    aiAvailable,
    hasBoard: band !== 'young',
    hasLabs: band !== 'young',
  };
}
