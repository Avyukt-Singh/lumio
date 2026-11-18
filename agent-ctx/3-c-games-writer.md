# Task 3-c — Twelve game/lab components (Algebra → AI Fairness)

Agent: games writer (task 3-c). Date: 2026 session.

## What was built
Twelve self-contained game components in `src/components/lumio/games/`, each
exporting a `*Game(props: GameProps)` component that renders inside the shared
`GameShell` (title, blurb, honest modelNote, xp, won, onBack):

1. `AlgebraChallenges.tsx` — CSS balance scale, numeric entry, working steps, 5-in-a-row win.
2. `ChemistryLab.tsx` — 6 real equations, coefficient buttons 1-4, live atom tallies, 3 balanced -> win.
3. `GeneticsLab.tsx` — AA/Aa/aa parent pickers, live Punnett 2x2, phenotype % prediction, 5-in-a-row win.
4. `ModellingLab.tsx` — fencing problem P ∈ {40, 60, 26}, slider x, A = x(P/2−x), submit within ±0.5 of P/4, 3 missions.
5. `BudgetPlanner.tsx` — income slider ₹8k-40k, editable needs + savings, live 50-30-20 percentages, 3 distinct incomes passed.
6. `CircuitLab.tsx` — series/parallel, V/R1/R2 sliders, live Rtot/I/per-resistor readings, bulb brightness by current, target current ±0.05 A per mode, both modes -> win.
7. `ProjectileLab.tsx` — speed/angle sliders, SVG trajectory, R = v²sin2θ/g, H = v²sin²θ/2g, target 10-140 m ±2 m, 3 hits.
8. `EngineeringLab.tsx` — 6 m beam, W/a sliders, predict R_A = W(L−a)/L within ±5% before reveal, 3 successes.
9. `DatasetExplorer.tsx` — 12 invented villages (labelled sample data), water toggle + distance slider, mean/median questions (tolerance ±1), 3 correct.
10. `Spaceship.tsx` — 3 engines (Solid 500 kN/250 s/3 t, Liquid 900/340/6, Ion 60/3000/2), fuel/hull/payload/engine-count sliders, Δv = Isp·9.81·ln(m0/dry)/1000, tanks 8% of fuel, TWR = thrust·n/(m0·9.81), predict Δv within ±10% before flying, 2 distinct mission successes.
11. `AiLab.tsx` — decision-stump threshold on clean + noisy made-up datasets; live train/test accuracy, confusion matrix, overfit gap warning; test ≥ 80% -> win.
12. `AiFairnessLab.tsx` — 20 invented applicants (groups A/B), threshold slider, live per-group approval/correct/qualified-approved + gap bar; gap < 10 pp && overall accuracy ≥ 60% -> win.

## Key decisions / assumptions
- `GameShell` untouched; only imported from `./GameShell`, `@/lib/utils` (cn), shadcn `Button`/`Input`, lucide icons.
- No `useEffect`/`useMemo`/timers in any file; all derivations are plain consts above handlers; `onWin` called from event handlers only.
- Native `<input type="range">` with `min-h-[44px]` + `press` + visible value labels; feedback lines use `role="status"` + `aria-live="polite"`; success accents emerald; no indigo/blue custom colors.
- Spaceship missions use the spec values (9.4/1.2, 3.2/0.3, 6.0/0.8). Verified by computation: with tanks at 8% of fuel, a single stage tops out near ~8.7 km/s Δv with the Liquid engine, so the 9.4 km/s low-orbit mission is intentionally unreachable with one stage — this is real physics (staging) and is explained honestly in the mission note; the game is winnable via the Moon-transfer and Heavy-satellite missions. Prototype MIS (9.0/1.2, 3.2/0.005) was superseded by the task spec.
- AiLab noisy dataset is constructed so the training labels are perfectly separable by a shifted threshold (100% train) while the clean-pattern test set drops to ~50% — teaching overfitting with a stump that cannot per-point memorise; this is stated in the modelNote.
- No lint/tsc/build was run per instructions (parallel agents in flight).

## Files touched (all new)
src/components/lumio/games/{AlgebraChallenges,ChemistryLab,GeneticsLab,ModellingLab,BudgetPlanner,CircuitLab,ProjectileLab,EngineeringLab,DatasetExplorer,Spaceship,AiLab,AiFairnessLab}.tsx

No other files modified.
