# ADR 0002 — localStorage-first storage for chunk 1; IndexedDB event log in chunk 2

Status: accepted (chunk 1)
Supersedes: master prompt 5.4 (event-sourced IndexedDB) for chunk 1 only
Related: docs/ARCHITECTURE.md, docs/ASSUMPTIONS.md 2, src/lib/lumio/types.ts,
src/lib/lumio/storage.ts

## Context

The target architecture (master prompt 5.4) requires an append-only event log in
IndexedDB (Dexie): every learner action is an immutable event; XP, streaks, mastery
and achievements are pure-function projections; sync is a union of event sets. The
chunk-1 gate (section 12) likewise lists "schemas, event log and Dexie".

This environment permits localStorage but the Dexie/IndexedDB migration is scheduled
with the chunk-2 quiz loop, where the event types (`quiz.finished`, `card.reviewed`,
`quest.claimed`) first acquire producers. Building the log in chunk 1 would mean
inventing event types with no writers and no consumer.

## Decision

1. Chunk 1 persists one schema-versioned JSON document under
   `localStorage["lumio-v2"]` (`LumioState`, `schema: 2`), validated at every
   boundary; saves surface quota and failure errors, never silently drop them.
2. XP is already a **ledger** (`xpLedger: XpEntry[]`, per-entry source and date);
   total XP, streak, best streak and achievements are **derived** by `projectState`,
   never stored as trusted counters. This is the 5.4 projection rule applied early,
   so the chunk-2 migration converts a document into a log rather than unwinding
   mutable counters.
3. Export/import (R13) ships now: `exportBlob` produces a `lumio-v2-export` JSON;
   `parseImport` accepts both v2 exports and prototype `lumio-s1` exports.
4. The legacy importer (`importLegacyState`) preserves profile answers, plan times,
   `days`, `res` (best/att/last) and settings (`sch`, `calm`, `consent`); XP arrives
   as one `import`-source ledger entry anchored to the earliest known day, excluded
   from activity-quest progress; unknown keys are collected in a `LegacyReport` and
   reported, never dropped silently.
5. Chunk 2 migrates to IndexedDB with the append-only event log; `schema: 2` plus the
   ledger/projection design are the stable source that migration reads.

## Consequences

- Positive: simplest storage that satisfies chunk 1's demo and the R13 duty; export/
  import and legacy data safety are real now, not later; derived-value discipline
  removes the riskiest part of the future migration.
- Negative / accepted: ~5 MB origin quota (surfaced on error, not hidden); no
  structured indexing or partial writes; no multi-device merge until the event log
  exists; localStorage is synchronous and string-based, so chunk 2 must re-implement
  `saveState`/`loadState` behind the same typed boundary.
- Reversal plan: the storage boundary is two functions plus a schema constant;
  swapping the backing store touches one module.
