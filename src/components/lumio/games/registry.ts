// Games and labs registry (chunk 3). Band eligibility mirrors the prototype's
// vGames gates; XP values come from domain.GAME_XP. Every component receives
// GameProps and renders inside GameShell.

import type { ComponentType } from 'react';
import type { Band } from '@/lib/lumio/content';
import type { GameProps } from './GameShell';
import { NumberHopGame } from './NumberHop';
import { MatchPicturesGame } from './MatchPictures';
import { SpellWordGame } from './SpellWord';
import { SharpEyesGame } from './SharpEyes';
import { FractionPuzzlesGame } from './FractionPuzzles';
import { EcosystemBuilderGame } from './EcosystemBuilder';
import { PendulumLabGame } from './PendulumLab';
import { CapitalChallengeGame } from './CapitalChallenge';
import { HistoryTimelineGame } from './HistoryTimeline';
import { AlgebraChallengesGame } from './AlgebraChallenges';
import { ChemistryLabGame } from './ChemistryLab';
import { GeneticsLabGame } from './GeneticsLab';
import { ModellingLabGame } from './ModellingLab';
import { BudgetPlannerGame } from './BudgetPlanner';
import { CircuitLabGame } from './CircuitLab';
import { ProjectileLabGame } from './ProjectileLab';
import { EngineeringLabGame } from './EngineeringLab';
import { DatasetExplorerGame } from './DatasetExplorer';
import { SpaceshipGame } from './Spaceship';
import { AiLabGame } from './AiLab';
import { AiFairnessLabGame } from './AiFairnessLab';
import { CodingLabGame } from './CodingLab';
import { WebWorkspaceGame } from './WebWorkspace';
import { ProjectilePlaygroundLab } from './class11/ProjectilePlayground';
import { FrictionInclineLab } from './class11/FrictionIncline';
import { ShmExplorerLab } from './class11/ShmExplorer';
import { VernierGaugeLab } from './class11/VernierGauge';
import { TitrationSimLab } from './class11/TitrationSim';
import { GasLawsChamberLab } from './class11/GasLawsChamber';
import { PeriodicTrendsLab } from './class11/PeriodicTrends';
import { SaltAnalysisLab } from './class11/SaltAnalysis';
import { UnitCircleLabGame } from './class11/UnitCircleLab';
import { ConicSlicerLab } from './class11/ConicSlicer';
import { PermCombBuilderLab } from './class11/PermCombBuilder';
import { LimitsVisualizerLab } from './class11/LimitsVisualizer';
import { NumberSystemsLab } from './class11/NumberSystems';
import { LogicGateBuilderLab } from './class11/LogicGateBuilder';
import { PythonTracerLab } from './class11/PythonTracer';
import { SortingVisualizerLab } from './class11/SortingVisualizer';
import { DecisionTreeBuilderLab } from './class11/DecisionTreeBuilder';
import { TrainClassifierLab } from './class11/TrainClassifier';
import { BiasFairnessExplorerLab } from './class11/BiasFairnessExplorer';
import { DataCleaningLab } from './class11/DataCleaning';

export interface GameDef {
  id: string;
  title: string;
  icon: string;
  blurb: string;
  bands: Band[];
  /** Subject keywords (lowercase). A game is shown when one of these matches
   *  one of the learner's chosen subjects; "Show all games" lifts the filter. */
  subj: string[];
  xp: number;
  Component: ComponentType<GameProps>;
}

const YOUNG_ONLY: Band[] = ['young'];
const MIDDLE_ONLY: Band[] = ['middle'];
const YOUNG_MIDDLE: Band[] = ['young', 'middle'];
const MID_ALL: Band[] = ['middle', 'sec', 'senior', 'dropper'];
const SEC_UP: Band[] = ['sec', 'senior', 'dropper', 'above'];
const SENIOR_DROPPER: Band[] = ['senior', 'dropper'];
const MID_MOST: Band[] = ['middle', 'sec', 'senior', 'dropper', 'above'];
const MID_WEB: Band[] = ['middle', 'sec', 'senior', 'above'];

export const GAMES: GameDef[] = [
  { id: 'count', title: 'Number Hop', icon: '🍎', blurb: 'Count and add with pictures. Get 5 right in a row.', bands: YOUNG_ONLY, subj: ['math'], xp: 20, Component: NumberHopGame },
  { id: 'memory', title: 'Match the Pictures', icon: '🃏', blurb: 'Memory game: match each picture with its word.', bands: YOUNG_ONLY, subj: ['english', 'hindi'], xp: 20, Component: MatchPicturesGame },
  { id: 'word', title: 'Spell the Word', icon: '🔤', blurb: 'Reading game: pick the right spelling for each picture.', bands: YOUNG_ONLY, subj: ['english', 'hindi'], xp: 20, Component: SpellWordGame },
  { id: 'obs', title: 'Sharp Eyes', icon: '👀', blurb: 'Observation puzzles: spot the odd one out and finish the pattern.', bands: YOUNG_MIDDLE, subj: ['math', 'science', 'evs'], xp: 20, Component: SharpEyesGame },
  { id: 'geo', title: 'Capital Challenge', icon: '🗺️', blurb: 'Match Indian states to their capitals; 5 right in a row.', bands: MID_ALL, subj: ['social', 'geography'], xp: 20, Component: CapitalChallengeGame },
  { id: 'time', title: 'History Timeline', icon: '📜', blurb: 'Order key events of Indian history, then see the dates.', bands: MID_ALL, subj: ['social', 'history'], xp: 20, Component: HistoryTimelineGame },
  { id: 'frac', title: 'Fraction Puzzles', icon: '🧩', blurb: 'Shade a bar to match a fraction and see equivalent fractions.', bands: MIDDLE_ONLY, subj: ['math'], xp: 20, Component: FractionPuzzlesGame },
  { id: 'eco', title: 'Ecosystem Builder', icon: '🌿', blurb: 'Follow energy up a food chain with the 10% rule (an approximation).', bands: MIDDLE_ONLY, subj: ['science', 'biology', 'evs'], xp: 20, Component: EcosystemBuilderGame },
  { id: 'pend', title: 'Pendulum Lab', icon: '⏱️', blurb: 'Change the string length and discover how it affects the time of a swing.', bands: MIDDLE_ONLY, subj: ['science', 'physics'], xp: 25, Component: PendulumLabGame },
  { id: 'alg', title: 'Algebra Challenges', icon: '⚖️', blurb: 'Balance linear equations on a scale and find x.', bands: ['sec'] as Band[], subj: ['math'], xp: 20, Component: AlgebraChallengesGame },
  { id: 'chem', title: 'Virtual Chemistry Lab', icon: '⚗️', blurb: 'Balance real equations with live atom counts and the law of conservation of mass.', bands: MID_ALL, subj: ['science', 'chemistry'], xp: 25, Component: ChemistryLabGame },
  { id: 'bio', title: 'Genetics Lab', icon: '🧬', blurb: 'Predict offspring from Punnett squares: dominant and recessive alleles.', bands: MID_ALL, subj: ['science', 'biology'], xp: 25, Component: GeneticsLabGame },
  { id: 'math', title: 'Modelling Lab', icon: '📐', blurb: 'Turn a fencing problem into a quadratic and find the maximum area.', bands: MID_ALL, subj: ['math'], xp: 25, Component: ModellingLabGame },
  { id: 'circ', title: 'Circuit Lab', icon: '⚡', blurb: 'Build a series or parallel circuit, see resistance, current and voltage, then hit a target current.', bands: MID_ALL, subj: ['science', 'physics'], xp: 25, Component: CircuitLabGame },
  { id: 'proj', title: 'Projectile Lab', icon: '🎯', blurb: 'Choose speed and angle to land a ball on the target, then see range and height.', bands: SEC_UP, subj: ['science', 'physics'], xp: 25, Component: ProjectileLabGame },
  { id: 'eng', title: 'Engineering Lab', icon: '🏗️', blurb: 'Predict support forces on a loaded beam using moments (torque balance).', bands: SENIOR_DROPPER, subj: ['science', 'physics'], xp: 25, Component: EngineeringLabGame },
  { id: 'biz', title: 'Budget Planner', icon: '💰', blurb: 'Balance needs and savings on a fixed income.', bands: SEC_UP, subj: ['economics', 'business', 'account', 'entrepreneur', 'financial'], xp: 20, Component: BudgetPlannerGame },
  { id: 'dx', title: 'Dataset Explorer', icon: '📊', blurb: 'Filter a made-up dataset and work out means and medians.', bands: SEC_UP, subj: ['data', 'math', 'computer', 'informat'], xp: 20, Component: DatasetExplorerGame },
  { id: 'ship', title: 'Build Your Own Spaceship', icon: '🚀', blurb: 'Design a rocket, predict its Δv, then fly real missions (Physics: momentum, energy, gravitation).', bands: SENIOR_DROPPER, subj: ['science', 'physics'], xp: 25, Component: SpaceshipGame },
  { id: 'ai', title: 'AI Lab', icon: '🤖', blurb: 'Train a simple classifier, compare training and test accuracy, and see overfitting and fairness.', bands: SEC_UP, subj: ['computer', 'artificial', 'informat', 'data', 'ai'], xp: 25, Component: AiLabGame },
  { id: 'aif', title: 'AI Fairness Lab', icon: '⚖️', blurb: 'Explore how a simple model can treat groups differently, using made-up data.', bands: SEC_UP, subj: ['computer', 'artificial', 'informat', 'ai'], xp: 25, Component: AiFairnessLabGame },
  { id: 'code', title: 'Coding Lab', icon: '💻', blurb: 'Write Python, run it against automated tests with Pyodide, get debugging hints. Saved on this device.', bands: MID_MOST, subj: ['computer', 'informat', 'artificial', 'python', 'data'], xp: 25, Component: CodingLabGame },
  { id: 'web', title: 'Web Workspace', icon: '🌐', blurb: 'Write HTML/CSS with a live, sandboxed preview and a checked challenge.', bands: MID_WEB, subj: ['computer', 'informat', 'web'], xp: 25, Component: WebWorkspaceGame },

  // ---- Class 11 lab set (senior band). Every lab carries a "predict first"
  // prompt, an honest linked-chapter reference and an observation table. ----

  // Physics
  { id: 'projplay', title: 'Projectile Motion Playground', icon: '🎈', blurb: 'Set angle, speed and height, compare a ghost path, and toggle air resistance against the textbook parabola.', bands: SENIOR_DROPPER, subj: ['science', 'physics'], xp: 25, Component: ProjectilePlaygroundLab },
  { id: 'friction', title: 'Friction & Inclined Plane Lab', icon: '🧱', blurb: 'Tilt a ramp, change mass and surface, watch force vectors live, and find the angle of repose (μ = tan θ).', bands: SENIOR_DROPPER, subj: ['science', 'physics'], xp: 25, Component: FrictionInclineLab },
  { id: 'shm', title: 'Simple Harmonic Motion Explorer', icon: '🌀', blurb: 'Spring-mass and pendulum side by side with live x–v–a graphs and a KE/PE energy bar. Test the amplitude claim yourself.', bands: SENIOR_DROPPER, subj: ['science', 'physics'], xp: 25, Component: ShmExplorerLab },
  { id: 'vernier', title: 'Vernier Calipers & Screw Gauge', icon: '📏', blurb: 'Read virtual instruments and get feedback on zero error, least count and reading errors — practical-exam practice.', bands: SENIOR_DROPPER, subj: ['science', 'physics'], xp: 25, Component: VernierGaugeLab },

  // Chemistry
  { id: 'titration', title: 'Titration Simulator', icon: '🧪', blurb: 'Add titrant drop by drop, watch the pH curve and colour change, find the endpoint and calculate the unknown concentration.', bands: SENIOR_DROPPER, subj: ['science', 'chemistry'], xp: 25, Component: TitrationSimLab },
  { id: 'gaslaws', title: 'Gas Laws Chamber', icon: '♨️', blurb: 'Pin one of P, V, T or n and watch the others respond with particle animation and a live P–V / V–T graph.', bands: SENIOR_DROPPER, subj: ['science', 'chemistry'], xp: 25, Component: GasLawsChamberLab },
  { id: 'periodic', title: 'Periodic Trends Visualizer', icon: '🧮', blurb: 'Heatmap or line view of radius, ionization enthalpy, electronegativity and electron gain enthalpy — anomalies included.', bands: SENIOR_DROPPER, subj: ['science', 'chemistry'], xp: 25, Component: PeriodicTrendsLab },
  { id: 'salt', title: 'Qualitative Salt Analysis', icon: '🔬', blurb: 'Run flame and reagent tests on a randomized unknown salt, record observations and deduce the cation and anion.', bands: SENIOR_DROPPER, subj: ['science', 'chemistry'], xp: 25, Component: SaltAnalysisLab },

  // Mathematics
  { id: 'unitcircle', title: 'Trigonometric Unit Circle Lab', icon: '⭕', blurb: 'Drag a point around the unit circle and watch sin, cos and tan trace as waves, with sign-by-quadrant highlighting.', bands: SENIOR_DROPPER, subj: ['math'], xp: 25, Component: UnitCircleLabGame },
  { id: 'conic', title: 'Conic Sections Slicer', icon: '🍉', blurb: 'Tilt a cutting plane through a double cone and watch circle, ellipse, parabola and hyperbola morph with their equations.', bands: SENIOR_DROPPER, subj: ['math'], xp: 25, Component: ConicSlicerLab },
  { id: 'permcomb', title: 'Permutations & Combinations Builder', icon: '🔤', blurb: 'Arrange letters or seats and enumerate outcomes visually — with repetition, restrictions and nPr vs nCr toggles.', bands: SENIOR_DROPPER, subj: ['math'], xp: 25, Component: PermCombBuilderLab },
  { id: 'limits', title: 'Limits & Derivatives Visualizer', icon: '📉', blurb: 'Zoom into a point and watch the secant become the tangent as h shrinks — first-principles differentiation made concrete.', bands: SENIOR_DROPPER, subj: ['math'], xp: 25, Component: LimitsVisualizerLab },

  // Computer Science
  { id: 'numsys', title: 'Number System Converter', icon: '🔢', blurb: 'Binary, octal, decimal and hex with every step animated, plus binary addition, two\'s complement and practice problems.', bands: SENIOR_DROPPER, subj: ['computer', 'informat', 'python', 'data'], xp: 25, Component: NumberSystemsLab },
  { id: 'logic', title: 'Logic Gate Circuit Builder', icon: '🔌', blurb: 'Wire AND, OR, NOT, NAND and NOR gates on a canvas, see the truth table live, and take expression challenges.', bands: SENIOR_DROPPER, subj: ['computer', 'informat'], xp: 25, Component: LogicGateBuilderLab },
  { id: 'pytrace', title: 'Python Code Tracer', icon: '🐍', blurb: 'Predict the output, then step through loops, conditionals and lists line by line with live variables and call flow.', bands: SENIOR_DROPPER, subj: ['computer', 'informat', 'python', 'artificial'], xp: 25, Component: PythonTracerLab },
  { id: 'sorting', title: 'Sorting & Searching Visualizer', icon: '📶', blurb: 'Bubble, selection, insertion sort and linear/binary search animated with comparison and swap counters — feed it your own data.', bands: SENIOR_DROPPER, subj: ['computer', 'informat', 'data'], xp: 25, Component: SortingVisualizerLab },

  // Artificial Intelligence
  { id: 'dtree', title: 'Decision Tree Builder', icon: '🌳', blurb: 'Split a small dataset by hand and watch impurity and accuracy change — then race the automatically built tree.', bands: SENIOR_DROPPER, subj: ['computer', 'artificial', 'informat', 'ai', 'data'], xp: 25, Component: DecisionTreeBuilderLab },
  { id: 'traincls', title: 'Train-Your-Own Classifier', icon: '🎯', blurb: 'Teach a tiny in-browser classifier with your own examples, test it, and see how biased data leads to bad predictions.', bands: SENIOR_DROPPER, subj: ['computer', 'artificial', 'informat', 'ai', 'data'], xp: 25, Component: TrainClassifierLab },
  { id: 'bias11', title: 'Bias & Fairness Explorer', icon: '🧭', blurb: 'Adjust a simulated admissions model\'s training data and see how outcomes differ across groups — ethics made tangible.', bands: SENIOR_DROPPER, subj: ['computer', 'artificial', 'informat', 'ai'], xp: 25, Component: BiasFairnessExplorerLab },
  { id: 'dataclean', title: 'Data Cleaning & Visualization Lab', icon: '🧹', blurb: 'Fix a messy dataset step by step — missing values, duplicates, outliers — then plot it and see how choices change conclusions.', bands: SENIOR_DROPPER, subj: ['computer', 'artificial', 'informat', 'ai', 'data', 'math'], xp: 25, Component: DataCleaningLab },
];

/** Prototype parity: sec band sees Algebra (MID2 was unused). */
export function gamesForBand(band: Band): GameDef[] {
  return GAMES.filter((g) => g.bands.includes(band));
}

/** True when one of the game's subject keywords matches one chosen subject.
 *  Empty / undefined subject list means "no filter" — every band game shows. */
function matchesSubjects(g: GameDef, subjects: string[]): boolean {
  if (subjects.length === 0) return true;
  return g.subj.some((tag) =>
    subjects.some((raw) => {
      const s = raw.toLowerCase();
      // "Social Science" is history/geography, not natural Science — skip
      // that one keyword overlap so Social-Science learners don't get labs.
      if (s.startsWith('social') && tag === 'science') return false;
      return s.includes(tag) || tag.includes(s);
    })
  );
}

/** Band-eligible games limited to the learner's chosen subjects. */
export function gamesForBandAndSubjects(
  band: Band,
  subjects: string[] | undefined
): GameDef[] {
  const chosen = subjects ?? [];
  return gamesForBand(band).filter((g) => matchesSubjects(g, chosen));
}
