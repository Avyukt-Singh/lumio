# ADR 0003 — Automated tests cut by platform rule; evidence strategy for chunk 1

Status: accepted (chunk 1)
Supersedes: master prompt 5.2 Quality row, 11, 12 gates (for this environment)
Related: docs/KNOWN_LIMITS.md 1, scripts/contrast-audit.mjs

## Context

The master prompt requires tests as ship gates: "packages/domain ... 100 percent
branch coverage on XP, streaks, mastery, scheduling, spaced repetition, quests and
focus rules" (5.3), Vitest/Testing Library/Playwright/axe-core (5.2), and chunk gates
such as "domain tests green; importer round-trip test" (12, chunk 1).

This platform forbids writing test code. No Vitest, Playwright, axe or CI runner can
be shipped from this environment. Claiming those gates would violate rule R9 ("never
claim something is tested when it was not run") and rule 14.4.

## Decision

1. Ship no test files; say so honestly in docs/KNOWN_LIMITS.md and every affected
   gate row in PARITY.md.
2. Keep domain logic **pure and test-ready**: functions take state and injected time,
   return values, perform no I/O, DOM or clock access (`domain.ts`, and the pure
   parts of `storage.ts` such as `importLegacyState` given raw input). The future
   suites are drop-in with no refactor.
3. Provide one piece of runnable, non-test evidence that the platform allows:
   `scripts/contrast-audit.mjs` — a WCAG AA contrast audit over all 11 token
   foreground/background pairs in all three themes. Result: 33/33 pass
   (morning, evening, night). It is a build script, not test code, and exits non-zero
   on failure so it can gate CI later unchanged.

## Consequences — unmet gates, stated exactly

Unmet acceptance gates from the master prompt (section 12, chunk 1 gate; section 5.3):
- "domain tests green" — no unit tests exist for `quizXpGain`, `streakFrom`,
  `streakMilestone`, `themeAt`, `planDay`, `questProgress` (incl. import-XP
  exclusion), `chapterState`, `weekKey`, `dayKey`.
- "importer round-trip test" — the `lumio-s1` importer's preservation and
  unknown-key reporting is unverified by automation.
- "CI green" — no CI pipeline exists in this environment.
- Axe/Lighthouse/Playwright evidence (11, 15) — absent; likewise real-device and
  screen-reader passes.

Closure plan: the moment the platform allows test code, add (in order) the Vitest
domain suite, the importer round-trip test, Playwright shell/theme/settings/export
flows, axe-core and Lighthouse CI — all against the existing pure functions and
`data-testid` hooks, with no production-code rewrite. Until then, every claim of
correctness is bounded by this ADR and KNOWN_LIMITS.md.
