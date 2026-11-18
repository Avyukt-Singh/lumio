'use client';

import { Lock, Sparkles, Trophy } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Mascot } from '../Mascot';
import { cn } from '@/lib/utils';
import { BANDS } from '@/lib/lumio/content';
import { ACHIEVEMENT_RULES, chapterTally, dayKey, streakFrom } from '@/lib/lumio/domain';
import type { LumioState } from '@/lib/lumio/types';

/**
 * Achievements (chunk 2): every rule with its unlocked date or live progress
 * toward the target. Kind tone — nothing is framed as failure, locked rows say
 * what they are waiting for.
 */
export function AchievementsScreen({ state, now }: { state: LumioState; now: Date }) {
  const tz = state.profile?.tz ?? 'Asia/Kolkata';
  const today = dayKey(now, tz);
  const streak = streakFrom(state.days, today);
  const band = state.profile?.band ?? 'sec';
  const tally = chapterTally(band, state.res);

  const snapshot = {
    daysCount: state.days.length,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    questsClaimed: state.quests.length,
    weeklyQuests: state.quests.filter((c) => c.questId === 'weekly-3-days').length,
    monthlyQuests: state.quests.filter((c) => c.questId === 'monthly-100xp').length,
    themesCount: state.themes.length,
    focusBlocks: 0,
    masteredChapters: tally.mastered,
    completedPath: tally.completed >= tally.total && tally.total > 0,
    anyQuiz: Object.keys(state.res).length > 0,
    fullScore: Object.entries(state.res).some(([k, v]) => {
      const idx = Number(k.split('#')[1]);
      const nq = BANDS[band].chapters[idx]?.questions.length ?? 0;
      return nq > 0 && v.best === nq;
    }),
  };

  const progressFor = (id: string): number | null => {
    const s = snapshot as unknown as Record<string, number>;
    switch (id) {
      case 'Quest hunter': return s.questsClaimed;
      case 'Steady focus': return s.focusBlocks;
      case '3-day streak': case '7-day streak': case '14-day streak':
      case '30-day streak': case '60-day streak': case '100-day streak':
        return Math.max(s.streak, s.bestStreak);
      case 'Weekly champion': return s.weeklyQuests;
      case 'Monthly master': return s.monthlyQuests;
      case 'Any-light learner': return s.themesCount;
      default: return null; // boolean achievements show unlocked / waiting
    }
  };

  const unlockedCount = ACHIEVEMENT_RULES.filter((a) => state.ach[a.id]).length;

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="ach-head" data-tour="ach-root" className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <Mascot pose="cheering" size="md" />
          <div className="min-w-0">
            <h1 id="ach-head" className="flex items-center gap-2 font-heading text-2xl font-bold">
              <Trophy className="size-6 text-primary" aria-hidden="true" /> Achievements
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {unlockedCount} of {ACHIEVEMENT_RULES.length} unlocked. Milestones are gentle — they
              celebrate steady habits, never guilt.
            </p>
          </div>
        </div>
      </section>

      <ul className="grid gap-3 sm:grid-cols-2">
        {ACHIEVEMENT_RULES.map((a) => {
          const unlockedOn = state.ach[a.id];
          const live = unlockedOn ? null : progressFor(a.id);
          const pct = live !== null && a.target > 0 ? Math.min(100, Math.round((live / a.target) * 100)) : null;
          return (
            <li
              key={a.id}
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-4',
                unlockedOn ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
              )}
            >
              <span
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-full',
                  unlockedOn ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                {unlockedOn ? <Trophy className="size-5" aria-hidden="true" /> : <Lock className="size-5" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {a.id}
                  {unlockedOn && (
                    <span className="inline-flex items-center rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success-soft-foreground">
                      <Sparkles className="mr-1 size-3" aria-hidden="true" /> {unlockedOn}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{a.description}</p>
                {!unlockedOn && live !== null && (
                  <div className="mt-2">
                    <Progress value={pct ?? 0} className="h-1.5" aria-label={`${a.id} progress: ${live} of ${a.target}`} />
                    <p className="mt-1 text-xs text-muted-foreground">{live} / {a.target}</p>
                  </div>
                )}
                {!unlockedOn && live === null && (
                  <p className="mt-1 text-xs text-muted-foreground">Waiting for the right moment — no rush.</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted-foreground">
        Focus, revision and mock-test achievements arrive with their activities in later chunks —
        locked rows never pretend an activity exists.
      </p>
    </div>
  );
}
