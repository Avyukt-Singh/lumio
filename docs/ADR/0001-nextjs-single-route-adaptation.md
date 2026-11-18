# ADR 0001 — Next.js single-route adaptation instead of the Vite monorepo

Status: accepted (chunk 1)
Supersedes: master prompt 5.2 stack row for the web app in this environment
Related: docs/ARCHITECTURE.md, docs/ASSUMPTIONS.md 1

## Context

The master prompt (5.2) specifies a decisive stack: Vite + React 18 + React Router
(or TanStack Router), a pnpm-workspace monorepo with `packages/domain`, `packages/ui`,
`packages/schemas`, Dexie for IndexedDB, and Vite-plugin-PWA. Deviation is allowed
"only with a written ADR".

The build sandbox mandates a fixed, pre-installed stack: Next.js 16 App Router +
TypeScript + Tailwind CSS 4 + shadcn/ui + Prisma/SQLite, with bun (not pnpm) as the
package manager. It also exposes exactly one HTTP route, so multi-route routing and
per-route code splitting are unavailable regardless of framework choice.

## Decision

1. Build the app as a Next.js 16 App Router project with a single page (`/`) that
   switches screens in client state (SPA-style screen keys mirroring the prototype's
   navigation keys). Consequence: no deep links or per-screen URLs in chunk 1.
2. Substitute the monorepo's package boundaries with module boundaries inside one app:
   `src/lib/lumio/*` plays the role of `packages/domain` + `packages/schemas`
   (pure logic and typed state), `src/components/lumio/*` plays `packages/ui`
   (Mascot, Shell, screens).
3. Keep everything the monorepo existed to protect: TypeScript strict mode; pure
   domain functions with injected time and no I/O/DOM; typed state validated at every
   boundary; design tokens as CSS variables (not ad hoc hex); provenance fields on
   content. These make a later extraction into packages mechanical, not a rewrite.
4. Use bun for install/run; Next.js APIs (`next/font`, `next/image`) replace Vite
   equivalents; lucide-react replaces the prototype's emoji icons.

## Consequences

- Positive: the whole chunk-1 slice (themes, densities, Home, Settings, importer,
  PWA basics) ships inside the sandbox constraints; the purity rule and typed
  boundaries survive intact; `next/font` gives build-time-bundled fonts.
- Negative / accepted: no URL-per-screen (deep links lost until the platform allows
  more routes); Next.js server machinery (Prisma/SQLite scaffold) is present but
  unused in chunk 1 — the app is fully local-first; pnpm workspaces and
  vite-plugin-pwa are not available, so the service worker is a plain hand-written
  basic shell cache rather than a Workbox build.
- Migration path: screens are pure functions of a screen key; if multi-route becomes
  available, each screen key maps to a route file with no logic change.
