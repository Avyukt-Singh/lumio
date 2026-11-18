'use client';

import { useState, type ReactNode } from 'react';
import {
  BarChart3, BookOpen, CalendarRange, Gamepad2, Home, Landmark, ListChecks, Settings as SettingsIcon,
  Flame, ShieldCheck, Sparkles, Timer, Wrench as Tools, Trophy, PanelLeftClose, Zap,
} from 'lucide-react';
import { Mascot, LumioWordmark } from './Mascot';
import { cn } from '@/lib/utils';
import { t, type DictKey, type UiLang } from '@/lib/lumio/i18n';
import { BANDS, type Band } from '@/lib/lumio/content';
import type { ThemeName, DensityProfile } from '@/lib/lumio/types';

export type ScreenId =
  | 'home'
  | 'study'
  | 'syllabus'
  | 'games'
  | 'progress'
  | 'ach'
  | 'xpstreak'
  | 'board'
  | 'planner'
  | 'focus'
  | 'tools'
  | 'guardian'
  | 'settings';

const NAV_ICONS: Record<string, typeof Home> = {
  home: Home,
  study: BookOpen,
  syllabus: ListChecks,
  games: Gamepad2,
  progress: BarChart3,
  ach: Trophy,
  xpstreak: Zap,
  board: Landmark,
  planner: CalendarRange,
  focus: Timer,
  tools: Tools,
  guardian: ShieldCheck,
};

/**
 * App shell (chunk 2): navigation follows the band's nav keys (3.2 — young
 * learners see only home/study/games/ach). Sidebar on desktop; bottom nav on
 * phones capped at 5 items (ux-guidelines), extra keys live in the sidebar;
 * Settings is always reachable from the header. Sticky header; content
 * scrolls; no dead items.
 */
export function Shell({
  screen,
  onScreen,
  theme,
  density,
  calm,
  band,
  syllabusAvailable,
  xp,
  streak,
  lang,
  bare,
  aiStatusSlot,
  accountSlot,
  aiSlot,
  children,
}: {
  screen: ScreenId;
  onScreen: (s: ScreenId) => void;
  theme: ThemeName;
  density: DensityProfile;
  calm: boolean;
  band: Band;
  /** chunk 6: CBSE Class 11 gate — no dead nav items for other classes/boards */
  syllabusAvailable: boolean;
  xp: number;
  streak: number;
  lang: UiLang;
  /** first-run onboarding: no sidebar, no bottom nav, no header tools —
   *  nothing clickable that cannot work yet */
  bare?: boolean;
  /** chunk 5A: honest account indicator rendered before the settings button */
  accountSlot?: ReactNode;
  /** chunk 5-AI-0: honest AI status chip rendered before the account indicator */
  aiStatusSlot?: ReactNode;
  /** chunk 5B: floating AI slot (Study Buddy panel + trigger) rendered as a
   *  sibling of <main> so it floats above every screen without per-screen wiring */
  aiSlot?: ReactNode;
  children: ReactNode;
}) {
  const navLabel = (id: ScreenId): string => {
    const m: Record<string, DictKey> = {
      home: 'nav.home', study: 'nav.study', syllabus: 'nav.syllabus', games: 'nav.games', progress: 'nav.progress',
      ach: 'nav.ach', xpstreak: 'nav.xpstreak', board: 'nav.board', planner: 'nav.planner',
      focus: 'nav.focus', tools: 'nav.tools', guardian: 'nav.guardian', settings: 'nav.settings',
    };
    return t(lang, m[id]);
  };
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bandNav = BANDS[band].nav; // typed nav keys per band
  // chunk 4A/4B/4C/6: xpstreak, planner, focus, tools and guardian are always
  // reachable; the syllabus tracker is CBSE Class 11 only (hidden otherwise).
  const NAV: ScreenId[] = [
    ...bandNav,
    ...(syllabusAvailable ? (['syllabus'] as ScreenId[]) : []),
    'xpstreak', 'planner', 'focus', 'tools', 'guardian', 'settings',
  ] as ScreenId[];

  /** compact = bottom bar (icon over label) · rail = collapsed desktop rail (icon only) */
  const navButton = (id: ScreenId, label: string, Icon: typeof Home, mode: 'compact' | 'rail' | 'full') => (
    <button
      key={id}
      onClick={() => onScreen(id)}
      aria-current={screen === id ? 'page' : undefined}
      title={mode === 'rail' ? label : undefined}
      className={cn(
        mode === 'compact' &&
          cn(
            'press flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-3 py-2',
            screen === id ? 'text-primary' : 'text-muted-foreground'
          ),
        mode === 'rail' &&
          cn(
            'press flex min-h-[44px] w-full items-center justify-center rounded-xl px-2',
            screen === id
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
          ),
        mode === 'full' &&
          cn(
            'press flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium',
            screen === id
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
          )
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className={mode === 'compact' ? 'text-xs font-semibold' : mode === 'rail' ? 'sr-only' : 'truncate'}>
        {label}
      </span>
    </button>
  );

  const label = (id: ScreenId) => navLabel(id);
  const icon = (id: ScreenId) => (id === 'settings' ? SettingsIcon : NAV_ICONS[id]);

  const navList = (mode: 'full' | 'rail') => (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map((id) => navButton(id, label(id), icon(id), mode))}
    </nav>
  );

  const pills = (
    <div className="flex items-center gap-2" data-tour="header-xp">
      <span
        className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-primary/10 px-3 text-sm font-semibold text-primary"
        title="Total experience points"
      >
        <Sparkles className="size-4" aria-hidden="true" /> {xp.toLocaleString('en-IN')} XP
      </span>
      <span
        className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-accent/15 px-3 text-sm font-semibold text-accent"
        title="Current streak of learning days"
      >
        <Flame className="size-4" aria-hidden="true" /> {streak} day{streak === 1 ? '' : 's'}
      </span>
    </div>
  );

  return (
    <div
      data-theme={theme}
      data-density={density}
      className={cn(
        'theme-root flex min-h-dvh w-full flex-col bg-background text-foreground md:flex-row',
        `theme-${theme}`,
        // shadcn dark variant hook
        theme === 'night' && 'night',
        calm && 'calm'
      )}
    >
      {/* Desktop sidebar — pinned to the very left edge of the viewport,
          full height like most desktop apps. On phones it is hidden and the
          bottom navigation takes over. Hidden entirely during onboarding. */}
      {!bare && (
      <aside
        data-tour="nav-main"
        className={cn(
          'sticky left-0 top-0 z-40 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar pb-3 md:flex',
          sidebarOpen ? 'w-60' : 'w-[68px]'
        )}
      >
        <button
          className="press flex min-h-[56px] items-center gap-2 px-4"
          onClick={() => onScreen('home')}
          aria-label="Lumio home"
        >
          <Mascot pose="icon" size="sm" />
          {sidebarOpen && <LumioWordmark className="text-xl tracking-tight text-foreground" />}
        </button>
        <div className="flex-1 overflow-y-auto px-2 py-2">{navList(sidebarOpen ? 'full' : 'rail')}</div>
        <button
          className="press mx-2 flex min-h-[44px] items-center justify-center rounded-xl text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? t(lang, 'nav.collapse') : t(lang, 'nav.expand')}
          title={sidebarOpen ? t(lang, 'nav.collapse') : t(lang, 'nav.expand')}
        >
          <PanelLeftClose className={cn('size-5 transition-transform', !sidebarOpen && 'rotate-180')} aria-hidden="true" />
          {sidebarOpen && <span className="ml-2 text-sm font-medium">{t(lang, 'nav.collapse')}</span>}
        </button>
      </aside>
      )}

      {/* Content column: header spans the area right of the sidebar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-sidebar-border bg-sidebar/90 backdrop-blur supports-[backdrop-filter]:bg-sidebar/75">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
            {bare ? (
              /* onboarding: a calm wordmark only — nothing clickable that
                 cannot work before the profile exists */
              <span className="flex min-h-[44px] items-center gap-2">
                <Mascot pose="icon" size="sm" />
                <LumioWordmark className="text-xl tracking-tight text-foreground" />
              </span>
            ) : (
            <button
              className="press flex min-h-[44px] items-center gap-2 md:hidden"
              onClick={() => onScreen('home')}
              aria-label="Lumio home"
            >
              <Mascot pose="icon" size="sm" />
              <LumioWordmark className="text-xl tracking-tight text-foreground" />
            </button>
            )}
            <span className="hidden text-xs font-medium text-muted-foreground md:inline">
              Learn · Practice · Grow
            </span>
            {!bare && (
            <div className="ml-auto flex items-center gap-1.5">
              {pills}
              {aiStatusSlot}
              {accountSlot}
              <button
                className={cn(
                  'press inline-flex min-h-[44px] items-center rounded-xl px-2',
                  screen === 'settings' ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onScreen('settings')}
                aria-label="Settings"
                data-tour="settings-btn"
                aria-current={screen === 'settings' ? 'page' : undefined}
              >
                <SettingsIcon className="size-5" aria-hidden="true" />
              </button>
            </div>
            )}
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 sm:px-6 md:pb-10">
          {children}
        </main>
      </div>

      {/* chunk 5B: floating AI trigger/panel (fixed, right side only on mobile
          so it never overlaps the SW-update toast at bottom-24 inset-x-3) */}
      {aiSlot}

      {/* Bottom navigation (phones, max 5 items per ux-guidelines) */}
      {!bare && (
      <nav
        aria-label="Main"
        data-tour="nav-main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 py-1">
          {NAV.slice(0, 5).map((id) => navButton(id, label(id), icon(id), 'compact'))}
        </div>
        {NAV.length > 5 && (
          <p className="pb-1 text-center text-[10px] text-muted-foreground">
            {NAV.length - 5} {t(lang, 'nav.moreTools')}
          </p>
        )}
      </nav>
      )}
    </div>
  );
}
