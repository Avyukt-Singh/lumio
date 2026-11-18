# Task 4B-d — i18n dictionary applied to Shell + screens

## Work record

Wired the chunk-4B i18n dictionary (`src/lib/lumio/i18n.ts`) into the Shell and the following screens, using the `tFor(lang)` / `questTitle` / `questDesc` pattern. Minimal diffs only; no logic, effects or handlers touched; no aria attributes removed.

### Per-file summary

1. **`src/components/lumio/Shell.tsx`**
   - Added required prop `lang: UiLang` (imported type from `@/lib/lumio/i18n`), destructured in `Shell`.
   - Deleted the `NAV_LABELS` const; added `navLabel(id)` inside the component mapping every `ScreenId` to its `nav.*` dict key (incl. `settings: 'nav.settings'`), used by `label(id)`.
   - Collapse/Expand button aria-label, title and visible "Collapse" text now use `t(lang,'nav.collapse')` / `t(lang,'nav.expand')`.
   - Bottom-bar note now renders `{NAV.length - 5} {t(lang,'nav.moreTools')}`.
   - LumioWordmark text untouched (brand).
   - PRE-EXISTING FIX (deviation): the lucide import used `Tools`, which is not exported by the installed lucide-react (build-breaking, error in this file predates the task). Changed to `Wrench as Tools` — one-token diff, references unchanged.

2. **`src/components/lumio/screens/Home.tsx`**
   - Added `const lang = state.profile?.lang ?? 'en'` and `const tr = tFor(lang)`.
   - Translated: hour-based greeting (`home.goodMorning/Afternoon/Evening`), streak pill (`common.noStreak` / `{streak} {tr('common.streakDays')}`), XP pill (`common.xpLabel`), freeze pill (`home.freezePill`/`freezesPill` by count), freeze banner assembled from `home.freezeAsk + weekdayLong + home.freezeOffer + {streak} + home.freezeAlive`, `home.useFreeze`, `home.focusCta`, `home.nextUp`, `home.studyPath`, `home.improve`/`home.ready`, `home.masteredAll`, `home.todaysPlan`, `home.planner`, `home.reviewed`/`home.markReviewed`, `home.noRoom`, `home.setUpDay`, `home.didNotFit` (count prepended), `home.thisWeek`, `home.weekNote`, `home.quests`.
   - Quest titles/descriptions via `questTitle(lang, q.quest.id, q.quest.title)` / `questDesc(lang, q.quest.id, q.quest.description)`; progressbar aria-label still uses the original `q.quest.title` (unchanged per "don't touch beyond listed items").
   - Claim/Claimed buttons + claim aria now use `common.claimed` / `common.claim` / `quest.notReady`.

3. **`src/components/lumio/screens/Settings.tsx`**
   - Added `const lang`/`const tr`; new required prop `onLang: (lang: 'en' | 'hi' | 'hinglish') => void`.
   - Translated: `settings.title`, `settings.appearance`, `settings.calm` (label + Switch aria-label), `settings.sounds` (label + Switch aria-label), `settings.profile`, `settings.editProfile`, `settings.data`, `settings.export`, `settings.import`, `settings.reset`, `settings.privacy`.
   - `THEME_OPTIONS` labels changed to `DictKey` values (`settings.themeAuto/Morning/Evening/Night`), rendered with `tr(label)`; `radiogroup` aria-label "Theme" left English (no key).
   - NEW "Language" section card inserted immediately after the Appearance section: `settings.language` heading with the `Languages` lucide icon, `role="radiogroup"` + matching aria-label, three chip buttons (`role="radio"`, `aria-checked`, `min-h-[44px]`) for en/hi/hinglish using `settings.lang.en/hi/hinglish`, active chip = `border-primary bg-primary/5`, `onClick={() => onLang(value)}`, note text `settings.langNote`.

4. **`src/components/lumio/screens/Planner.tsx`**
   - Added `const tr = tFor(state.profile?.lang)`.
   - Translated: `planner.title`, `planner.subtitle`, `planner.exportTitle`, `planner.exportNote`, `planner.exportBtn`, timezone line assembled from `planner.exportTz + (tz) + planner.anyCalendar` (disabled-state export text left English), `planner.sevenDay`, `planner.compNote`, `planner.reschedule` (button), `planner.noWindow`, `planner.monthTitle`, `planner.prevMonth`/`planner.nextMonth` (aria-labels), legend items `planner.legendLearned`/`legendReviewed`/`legendFocus`, `common.today` badge, `common.rescheduled` marker, Reset button label via `common.reset`.
   - Left English (no keys): dynamic session aria-labels ("Reschedule session N on …", "Move session N to …", "Reset session N …"), day headings, "No daily plan yet…", "No sessions planned for this day.", "{n} session(s) did not fit.", weekday/month names.

5. **`src/components/lumio/screens/Focus.tsx`**
   - Added `const tr = tFor(state.profile?.lang)` in the derived-consts block (before first use in `modeLabel`).
   - Translated: `focus.title`, `focus.subtitle`, `focus.preset`, cycle strip (`focus.blockOf` / `focus.of` / `focus.nextPause`), `focus.timer` (sr-only), `modeLabel` via `focus.idle/focusing/shortBreak/longBreak`, `focus.timestampNote`, `focus.startBlock`, `focus.abandon`, `focus.rules`, `focus.autoStart`, `focus.strict`, strict warning ternary (`focus.strictWarn` when off; "Strict mode is active…" left English), `focus.togglesLocked`, `focus.todayXp`, `{xpLeft} {tr('focus.xpBlocksLeft')}`, `focus.capReached`, `focus.sound`, SOUNDS labels now `DictKey` (`focus.brown/rain/pulse`) rendered with `tr`, `focus.volume`, `focus.startSound`/`focus.stopSound`, `focus.soundNote`, `focus.weekChart`.
   - Left English: all status messages ("Completed while you were away…", voided message, etc.), preset cards' internal labels, chart aria-labels.

6. **`src/components/lumio/screens/Games.tsx`**
   - Added `const tr = tFor(state.profile?.lang)`.
   - Translated: `games.gamesLabs` heading, subtitle ternary (`games.xpOnce` / `games.matchingSubjects`), collected pill `` `+${g.xp} ${tr('games.collected')}` ``, `games.noSubjects` empty state, toggle button `games.mySubjects` / `` `${tr('games.showAll')} (${allBandGames.length})` `` (count suffix kept).

7. **`src/components/lumio/screens/Practice.tsx`**
   - Only the hub header: added `tFor` import and `const tr = tFor(state.profile?.lang)` in `PracticeHub`; "Practice" -> `tr('games.practice')`, subtitle -> `tr('games.practiceNote')`. Tab labels and everything else left untouched (Mocks headings left English per instruction).

### Deviations / notes
- **Expected tsc errors (do NOT fix here — parent wires it):**
  - `LumioApp.tsx(417,12): error TS2741: Property 'onLang' is missing … required in type '{ … onLang: (lang: "en" | "hi" | "hinglish") => void; }'`
  - `LumioApp.tsx(448,8): error TS2741: Property 'lang' is missing … required in type '{ … lang: UiLang; children: ReactNode; }'`
- Pre-existing error NOT in my files, left alone: `src/lib/lumio/events.ts(105,27): error TS2304: Cannot find name 'Profile'.`
- Fixed pre-existing build-breaking error inside my file Shell.tsx: lucide-react has no `Tools` export -> `Wrench as Tools` (minimal alias, all `NAV_ICONS.tools` references unchanged).
- Planner legend wording in English now matches the dictionary's English values ("Learned that day" / "Plan reviewed" / "Focus minutes recorded") instead of the previous paraphrases — required by the task's key list.
- Planner Reset button label uses `common.reset` (key exists; visible string was plain "Reset"). Its detailed aria-label left English (no key).
- Quest progressbar aria-label still uses the English `q.quest.title` (not in the task's key list).
- Lint: clean (`bun run lint` exits with no findings).
- tsc (excluding examples/ and skills/): exactly the two expected LumioApp errors plus the pre-existing events.ts error.
