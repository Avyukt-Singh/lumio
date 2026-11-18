// CBSE Class 11 (2026-27) syllabus dataset, transcribed faithfully from
// Appendix A of the supplied prompt document (upload/Pasted Content
// 1794973793725.txt, lines 231-395). Data-only module: no I/O, DOM or clock.
//
// IDs are STABLE, human-readable and never renumbered — stored learner
// progress keys on them (`mat.c01.t03`, `phy.c07.t03`, `che.cf01.t01`,
// `cs.p05`, `ai.c06.t02` …). If wording changes, keep the id.
//
// Provenance per subject (R1 — named document, never an invented URL):
// - maths/chemistry/cs/ai: "CBSE curriculum 2026-27, as supplied by the learner".
// - physics: read from a scanned Delhi Directorate of Education support
//   material book (2026-27), so it carries a "verify against your school's
//   copy" note.
//
// Chapter order everywhere is the NCERT order (Appendix A.0) and defines
// "next in order" for the planner. CBSE-only formative-only chapters that the
// rationalised NCERT book dropped (Mathematical Induction, chemistry s/p
// Block, Gaseous State) use `cf` ids with no `ncertNo`.

import type { SyllabusSubject, SyllabusUnit } from './types';

/** CBSE Class 11 (2026-27) — the five subjects the learner supplied.
 *  Chapter order everywhere is the NCERT order (Appendix A.0) and defines
 *  "next in order" for the planner. Data-only module: no I/O, DOM or clock. */

/**
 * Physics periods: Appendix A.2 gives periods per UNIT, but the chunk-6
 * `SyllabusUnit` type carries `periods` on chapters only. The data keeps the
 * periods on the unit as instructed; this local optional extension lets the
 * literal type-check. If `SyllabusUnit` gains `periods` later, this becomes
 * redundant and can be deleted. Structural typing still lets the finished
 * array be exported as `readonly SyllabusSubject[]`.
 */
type UnitWithPeriods = SyllabusUnit & { periods?: number };
type SubjectWithUnitPeriods = Omit<SyllabusSubject, 'units'> & { units: UnitWithPeriods[] };

const CLASS11_DATA: readonly SubjectWithUnitPeriods[] = [
  // ---------------------------------------------------------------- Maths 041
  {
    id: 'maths',
    name: 'Mathematics',
    code: '041',
    catalogueName: 'Mathematics',
    theoryMarks: 80,
    units: [
      {
        id: 'mat.u01',
        title: 'Sets and Functions',
        marks: 23,
        chapters: [
          {
            id: 'mat.c01',
            title: 'Sets',
            ncertNo: 1,
            topics: [
              { id: 'mat.c01.t01', title: 'Sets and their representations', assessment: 'summative' },
              { id: 'mat.c01.t02', title: 'Empty set', assessment: 'summative' },
              { id: 'mat.c01.t03', title: 'Finite and infinite sets', assessment: 'summative' },
              { id: 'mat.c01.t04', title: 'Equal sets', assessment: 'summative' },
              { id: 'mat.c01.t05', title: 'Subsets', assessment: 'summative' },
              { id: 'mat.c01.t06', title: 'Subsets of real numbers, especially intervals (with notation)', assessment: 'summative' },
              { id: 'mat.c01.t07', title: 'Universal set', assessment: 'summative' },
              { id: 'mat.c01.t08', title: 'Venn diagrams', assessment: 'summative' },
              { id: 'mat.c01.t09', title: 'Union and intersection', assessment: 'summative' },
              { id: 'mat.c01.t10', title: 'Difference of sets', assessment: 'summative' },
              { id: 'mat.c01.t11', title: 'Complement and its properties', assessment: 'summative' },
              { id: 'mat.c01.t12', title: 'Practical problems on union and intersection of two sets', assessment: 'formative_only' },
            ],
          },
          {
            id: 'mat.c02',
            title: 'Relations and Functions',
            ncertNo: 2,
            topics: [
              { id: 'mat.c02.t01', title: 'Ordered pairs', assessment: 'summative' },
              { id: 'mat.c02.t02', title: 'Cartesian product and number of elements', assessment: 'summative' },
              { id: 'mat.c02.t03', title: 'Cartesian product of the reals with itself (up to R×R×R)', assessment: 'summative' },
              { id: 'mat.c02.t04', title: 'Relation (definition, pictorial diagrams, domain, co-domain, range)', assessment: 'summative' },
              { id: 'mat.c02.t05', title: 'Function as a special relation (pictorial representation, domain, co-domain, range)', assessment: 'summative' },
              { id: 'mat.c02.t06', title: 'Real-valued functions and their graphs: constant, identity, polynomial, rational, modulus, signum, exponential, logarithmic, greatest integer', assessment: 'summative' },
              { id: 'mat.c02.t07', title: 'Sum, difference, product and quotient of functions', assessment: 'summative' },
              { id: 'mat.c02.t08', title: 'Composition of functions', assessment: 'formative_only' },
            ],
          },
          {
            id: 'mat.c03',
            title: 'Trigonometric Functions',
            ncertNo: 3,
            topics: [
              { id: 'mat.c03.t01', title: 'Positive and negative angles', assessment: 'summative' },
              { id: 'mat.c03.t02', title: 'Radians and degrees and conversion', assessment: 'summative' },
              { id: 'mat.c03.t03', title: 'Trigonometric functions via the unit circle', assessment: 'summative' },
              { id: 'mat.c03.t04', title: 'Identity sin²x + cos²x = 1', assessment: 'summative' },
              { id: 'mat.c03.t05', title: 'Signs of trigonometric functions', assessment: 'summative' },
              { id: 'mat.c03.t06', title: 'Domain, range and graphs', assessment: 'summative' },
              { id: 'mat.c03.t07', title: 'sin(x±y) and cos(x±y) and simple applications', assessment: 'summative' },
              { id: 'mat.c03.t08', title: 'tan(x±y) and cot(x±y)', assessment: 'summative' },
              { id: 'mat.c03.t09', title: 'Sum-to-product and product identities (sin α ± sin β, cos α + cos β, cos α − cos β)', assessment: 'summative' },
              { id: 'mat.c03.t10', title: 'Identities for 2x and 3x (sin, cos, tan)', assessment: 'summative' },
              { id: 'mat.c03.t11', title: 'General solution of trigonometric equations of the type sin y = sin a, cos y = cos a, tan y = tan a', assessment: 'formative_only' },
            ],
          },
        ],
      },
      {
        id: 'mat.u02',
        title: 'Algebra',
        marks: 25,
        chapters: [
          {
            id: 'mat.cf01',
            title: 'Principle of Mathematical Induction',
            note: 'Removed from the rationalised NCERT book; CBSE lists it as formative only',
            topics: [
              { id: 'mat.cf01.t01', title: 'Process of proof by induction', assessment: 'formative_only' },
              { id: 'mat.cf01.t02', title: 'Natural numbers as the least inductive subset of the reals', assessment: 'formative_only' },
              { id: 'mat.cf01.t03', title: 'The principle and simple applications', assessment: 'formative_only' },
            ],
          },
          {
            id: 'mat.c04',
            title: 'Complex Numbers and Quadratic Equations',
            ncertNo: 4,
            topics: [
              { id: 'mat.c04.t01', title: 'Need for complex numbers (especially √−1)', assessment: 'summative' },
              { id: 'mat.c04.t02', title: 'Algebraic properties', assessment: 'summative' },
              { id: 'mat.c04.t03', title: 'Argand plane', assessment: 'summative' },
              { id: 'mat.c04.t04', title: 'Polar representation', assessment: 'formative_only' },
              { id: 'mat.c04.t05', title: 'Statement of the Fundamental Theorem of Algebra', assessment: 'formative_only' },
              { id: 'mat.c04.t06', title: 'Solving quadratics with real coefficients in the complex number system', assessment: 'formative_only' },
            ],
          },
          {
            id: 'mat.c05',
            title: 'Linear Inequalities',
            ncertNo: 5,
            topics: [
              { id: 'mat.c05.t01', title: 'Algebraic solutions of linear inequalities in one variable', assessment: 'summative' },
              { id: 'mat.c05.t02', title: 'Representation on the number line', assessment: 'summative' },
              { id: 'mat.c05.t03', title: 'Graphical solution of linear inequalities in two variables', assessment: 'formative_only' },
              { id: 'mat.c05.t04', title: 'Graphical solution of a system of such inequalities', assessment: 'formative_only' },
            ],
          },
          {
            id: 'mat.c06',
            title: 'Permutations and Combinations',
            ncertNo: 6,
            topics: [
              { id: 'mat.c06.t01', title: 'Fundamental principle of counting', assessment: 'summative' },
              { id: 'mat.c06.t02', title: 'Factorial n', assessment: 'summative' },
              { id: 'mat.c06.t03', title: 'Permutations and combinations', assessment: 'summative' },
              { id: 'mat.c06.t04', title: 'Derivation of formulae for nPr and nCr and their connections', assessment: 'summative' },
              { id: 'mat.c06.t05', title: 'Simple applications', assessment: 'summative' },
            ],
          },
          {
            id: 'mat.c07',
            title: 'Binomial Theorem',
            ncertNo: 7,
            topics: [
              { id: 'mat.c07.t01', title: 'Historical perspective', assessment: 'summative' },
              { id: 'mat.c07.t02', title: 'Statement and proof for positive integral indices', assessment: 'summative' },
              { id: 'mat.c07.t03', title: "Pascal's triangle", assessment: 'summative' },
              { id: 'mat.c07.t04', title: 'Simple applications', assessment: 'summative' },
              { id: 'mat.c07.t05', title: 'General term and middle term', assessment: 'formative_only' },
            ],
          },
          {
            id: 'mat.c08',
            title: 'Sequences and Series',
            ncertNo: 8,
            topics: [
              { id: 'mat.c08.t01', title: 'Sequence and series', assessment: 'summative' },
              { id: 'mat.c08.t02', title: 'Arithmetic mean (A.M.)', assessment: 'summative' },
              { id: 'mat.c08.t03', title: 'Geometric progression (G.P.), general term, sum of n terms, infinite G.P. and its sum', assessment: 'summative' },
              { id: 'mat.c08.t04', title: 'Geometric mean (G.M.)', assessment: 'summative' },
              { id: 'mat.c08.t05', title: 'Relation between A.M. and G.M.', assessment: 'summative' },
              { id: 'mat.c08.t06', title: 'Special sums Σk, Σk², Σk³', assessment: 'formative_only' },
            ],
          },
        ],
      },
      {
        id: 'mat.u03',
        title: 'Coordinate Geometry',
        marks: 12,
        chapters: [
          {
            id: 'mat.c09',
            title: 'Straight Lines',
            ncertNo: 9,
            topics: [
              { id: 'mat.c09.t01', title: 'Brief recall of 2-D geometry', assessment: 'summative' },
              { id: 'mat.c09.t02', title: 'Slope and angle between two lines', assessment: 'summative' },
              { id: 'mat.c09.t03', title: 'Forms of equation (parallel to axis, point-slope, slope-intercept, two-point, intercept)', assessment: 'summative' },
              { id: 'mat.c09.t04', title: 'Distance of a point from a line', assessment: 'summative' },
              { id: 'mat.c09.t05', title: 'Normal form', assessment: 'formative_only' },
              { id: 'mat.c09.t06', title: 'General equation of a line', assessment: 'formative_only' },
            ],
          },
          {
            id: 'mat.c10',
            title: 'Conic Sections',
            ncertNo: 10,
            topics: [
              { id: 'mat.c10.t01', title: 'Sections of a cone (circle, ellipse, parabola, hyperbola; a point, a straight line and a pair of intersecting lines as degenerate cases)', assessment: 'summative' },
              { id: 'mat.c10.t02', title: 'Standard equations and simple properties of parabola, ellipse and hyperbola', assessment: 'summative' },
              { id: 'mat.c10.t03', title: 'Standard equation of a circle', assessment: 'summative' },
            ],
          },
          {
            id: 'mat.c11',
            title: 'Introduction to Three Dimensional Geometry',
            ncertNo: 11,
            topics: [
              { id: 'mat.c11.t01', title: 'Coordinate axes and planes in three dimensions', assessment: 'summative' },
              { id: 'mat.c11.t02', title: 'Coordinates of a point', assessment: 'summative' },
              { id: 'mat.c11.t03', title: 'Distance between two points', assessment: 'summative' },
              { id: 'mat.c11.t04', title: 'Section formula', assessment: 'formative_only' },
            ],
          },
        ],
      },
      {
        id: 'mat.u04',
        title: 'Calculus',
        marks: 8,
        chapters: [
          {
            id: 'mat.c12',
            title: 'Limits and Derivatives',
            ncertNo: 12,
            topics: [
              { id: 'mat.c12.t01', title: 'Derivative as rate of change (distance function) and geometrically', assessment: 'summative' },
              { id: 'mat.c12.t02', title: 'Intuitive idea of limit', assessment: 'summative' },
              { id: 'mat.c12.t03', title: 'Limits of polynomial, rational, trigonometric, exponential and logarithmic functions', assessment: 'summative' },
              { id: 'mat.c12.t04', title: 'Definition of derivative and its relation to the slope of the tangent', assessment: 'summative' },
              { id: 'mat.c12.t05', title: 'Derivatives of sum, difference, product and quotient of polynomial and trigonometric functions', assessment: 'summative' },
              { id: 'mat.c12.t06', title: 'Derivatives of composite functions (chain rule)', assessment: 'formative_only' },
            ],
          },
        ],
      },
      {
        id: 'mat.u05',
        title: 'Statistics and Probability',
        marks: 12,
        chapters: [
          {
            id: 'mat.c13',
            title: 'Statistics',
            ncertNo: 13,
            topics: [
              { id: 'mat.c13.t01', title: 'Measures of dispersion: range, mean deviation, variance and standard deviation of ungrouped and grouped data', assessment: 'summative' },
            ],
          },
          {
            id: 'mat.c14',
            title: 'Probability',
            ncertNo: 14,
            topics: [
              { id: 'mat.c14.t01', title: 'Events and occurrence of events', assessment: 'summative' },
              { id: 'mat.c14.t02', title: '"not", "and", "or" events', assessment: 'summative' },
              { id: 'mat.c14.t03', title: 'Exhaustive events', assessment: 'summative' },
              { id: 'mat.c14.t04', title: 'Mutually exclusive events', assessment: 'summative' },
              { id: 'mat.c14.t05', title: 'Axiomatic (set-theoretic) probability and connections with earlier classes', assessment: 'summative' },
              { id: 'mat.c14.t06', title: 'Probability of an event, and of "not", "and", "or" events', assessment: 'summative' },
              { id: 'mat.c14.t07', title: 'Random experiments, outcomes, sample space (set representation)', assessment: 'formative_only' },
            ],
          },
        ],
      },
    ],
    practical: {
      items: [
        { id: 'mat.p01', title: 'Periodic tests (best 2 of 3)', assessment: 'summative' },
        { id: 'mat.p02', title: 'Mathematics activities (10 activities from the NCERT Lab Manual: record and activity work 5, year-end activity test 3, viva 2)', assessment: 'summative' },
      ],
      scheme: [
        { label: 'Periodic tests (best 2 of 3)', marks: 10 },
        { label: 'Mathematics activities', marks: 10 },
      ],
    },
    source: {
      label: 'CBSE curriculum 2026-27, as supplied by the learner',
      note: 'Your school may follow a different circular. Check with your teacher.',
    },
  },

  // -------------------------------------------------------------- Physics 042
  {
    id: 'physics',
    name: 'Physics',
    code: '042',
    catalogueName: 'Physics',
    theoryMarks: 70,
    units: [
      {
        id: 'phy.u01',
        title: 'Physical World and Measurement',
        marks: 23,
        marksGroup: 'Units I to III',
        periods: 8,
        chapters: [
          {
            id: 'phy.c01',
            title: 'Units and Measurements',
            ncertNo: 1,
            ncertPart: 1,
            topics: [
              { id: 'phy.c01.t01', title: 'Need for measurement', assessment: 'summative' },
              { id: 'phy.c01.t02', title: 'Units and systems of units', assessment: 'summative' },
              { id: 'phy.c01.t03', title: 'SI units', assessment: 'summative' },
              { id: 'phy.c01.t04', title: 'Fundamental and derived units', assessment: 'summative' },
              { id: 'phy.c01.t05', title: 'Significant figures', assessment: 'summative' },
              { id: 'phy.c01.t06', title: 'Determining the uncertainty in a result', assessment: 'summative' },
              { id: 'phy.c01.t07', title: 'Dimensions of physical quantities', assessment: 'summative' },
              { id: 'phy.c01.t08', title: 'Dimensional analysis and its applications', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'phy.u02',
        title: 'Kinematics',
        marks: null,
        marksGroup: 'Units I to III',
        periods: 24,
        chapters: [
          {
            id: 'phy.c02',
            title: 'Motion in a Straight Line',
            ncertNo: 2,
            ncertPart: 1,
            topics: [
              { id: 'phy.c02.t01', title: 'Frame of reference', assessment: 'summative' },
              { id: 'phy.c02.t02', title: 'Motion in a straight line', assessment: 'summative' },
              { id: 'phy.c02.t03', title: 'Elementary differentiation and integration for describing motion', assessment: 'summative' },
              { id: 'phy.c02.t04', title: 'Uniform and non-uniform motion', assessment: 'summative' },
              { id: 'phy.c02.t05', title: 'Average speed and average velocity', assessment: 'summative' },
              { id: 'phy.c02.t06', title: 'Instantaneous velocity', assessment: 'summative' },
              { id: 'phy.c02.t07', title: 'Uniformly accelerated motion', assessment: 'summative' },
              { id: 'phy.c02.t08', title: 'Velocity-time and position-time graphs', assessment: 'summative' },
              { id: 'phy.c02.t09', title: 'Relations for uniformly accelerated motion (graphical and calculus treatment)', assessment: 'summative' },
            ],
          },
          {
            id: 'phy.c03',
            title: 'Motion in a Plane',
            ncertNo: 3,
            ncertPart: 1,
            topics: [
              { id: 'phy.c03.t01', title: 'Scalar and vector quantities', assessment: 'summative' },
              { id: 'phy.c03.t02', title: 'Position and displacement vectors', assessment: 'summative' },
              { id: 'phy.c03.t03', title: 'Equality of vectors', assessment: 'summative' },
              { id: 'phy.c03.t04', title: 'Multiplication of a vector by a real number', assessment: 'summative' },
              { id: 'phy.c03.t05', title: 'Addition and subtraction of vectors', assessment: 'summative' },
              { id: 'phy.c03.t06', title: 'Unit vector', assessment: 'summative' },
              { id: 'phy.c03.t07', title: 'Resolution of a vector in a plane, rectangular components', assessment: 'summative' },
              { id: 'phy.c03.t08', title: 'Scalar and vector product of vectors', assessment: 'summative' },
              { id: 'phy.c03.t09', title: 'Motion in a plane with uniform velocity and uniform acceleration', assessment: 'summative' },
              { id: 'phy.c03.t10', title: 'Projectile motion', assessment: 'summative' },
              { id: 'phy.c03.t11', title: 'Uniform circular motion', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'phy.u03',
        title: 'Laws of Motion',
        marks: null,
        marksGroup: 'Units I to III',
        periods: 14,
        chapters: [
          {
            id: 'phy.c04',
            title: 'Laws of Motion',
            ncertNo: 4,
            ncertPart: 1,
            topics: [
              { id: 'phy.c04.t01', title: 'Intuitive concept of force', assessment: 'summative' },
              { id: 'phy.c04.t02', title: 'Inertia', assessment: 'summative' },
              { id: 'phy.c04.t03', title: "Newton's first law", assessment: 'summative' },
              { id: 'phy.c04.t04', title: "Momentum and Newton's second law", assessment: 'summative' },
              { id: 'phy.c04.t05', title: 'Impulse', assessment: 'summative' },
              { id: 'phy.c04.t06', title: "Newton's third law", assessment: 'summative' },
              { id: 'phy.c04.t07', title: 'Law of conservation of linear momentum and its applications', assessment: 'summative' },
              { id: 'phy.c04.t08', title: 'Equilibrium of concurrent forces', assessment: 'summative' },
              { id: 'phy.c04.t09', title: 'Static and kinetic friction, rolling friction, lubrication', assessment: 'summative' },
              { id: 'phy.c04.t10', title: 'Dynamics of uniform circular motion and centripetal force', assessment: 'summative' },
              { id: 'phy.c04.t11', title: 'Examples of circular motion (vehicle on a level circular road, vehicle on a banked road)', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'phy.u04',
        title: 'Work, Energy and Power',
        marks: 17,
        marksGroup: 'Units IV to VI',
        periods: 14,
        chapters: [
          {
            id: 'phy.c05',
            title: 'Work, Energy and Power',
            ncertNo: 5,
            ncertPart: 1,
            topics: [
              { id: 'phy.c05.t01', title: 'Work done by a constant force and by a variable force', assessment: 'summative' },
              { id: 'phy.c05.t02', title: 'Kinetic energy', assessment: 'summative' },
              { id: 'phy.c05.t03', title: 'Work-energy theorem', assessment: 'summative' },
              { id: 'phy.c05.t04', title: 'Power', assessment: 'summative' },
              { id: 'phy.c05.t05', title: 'Notion of potential energy', assessment: 'summative' },
              { id: 'phy.c05.t06', title: 'Potential energy of a spring', assessment: 'summative' },
              { id: 'phy.c05.t07', title: 'Conservative and non-conservative forces', assessment: 'summative' },
              { id: 'phy.c05.t08', title: 'Motion in a vertical circle', assessment: 'summative' },
              { id: 'phy.c05.t09', title: 'Elastic and inelastic collisions in one and two dimensions', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'phy.u05',
        title: 'Motion of System of Particles and Rigid Body',
        marks: null,
        marksGroup: 'Units IV to VI',
        periods: 18,
        chapters: [
          {
            id: 'phy.c06',
            title: 'System of Particles and Rotational Motion',
            ncertNo: 6,
            ncertPart: 1,
            topics: [
              { id: 'phy.c06.t01', title: 'Centre of mass of a two-particle system', assessment: 'summative' },
              { id: 'phy.c06.t02', title: 'Momentum conservation and centre-of-mass motion', assessment: 'summative' },
              { id: 'phy.c06.t03', title: 'Centre of mass of a rigid body and of a uniform rod', assessment: 'summative' },
              { id: 'phy.c06.t04', title: 'Moment of a force, torque', assessment: 'summative' },
              { id: 'phy.c06.t05', title: 'Angular momentum, law of conservation of angular momentum and its applications', assessment: 'summative' },
              { id: 'phy.c06.t06', title: 'Equilibrium of rigid bodies', assessment: 'summative' },
              { id: 'phy.c06.t07', title: 'Rigid-body rotation and equations of rotational motion', assessment: 'summative' },
              { id: 'phy.c06.t08', title: 'Comparison of linear and rotational motions', assessment: 'summative' },
              { id: 'phy.c06.t09', title: 'Moment of inertia and radius of gyration', assessment: 'summative' },
              { id: 'phy.c06.t10', title: 'Values of moments of inertia for simple geometrical objects (no derivation)', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'phy.u06',
        title: 'Gravitation',
        marks: null,
        marksGroup: 'Units IV to VI',
        periods: 12,
        chapters: [
          {
            id: 'phy.c07',
            title: 'Gravitation',
            ncertNo: 7,
            ncertPart: 1,
            topics: [
              { id: 'phy.c07.t01', title: "Kepler's laws of planetary motion", assessment: 'summative' },
              { id: 'phy.c07.t02', title: 'Universal law of gravitation', assessment: 'summative' },
              { id: 'phy.c07.t03', title: 'Acceleration due to gravity and its variation with altitude and depth', assessment: 'summative' },
              { id: 'phy.c07.t04', title: 'Gravitational potential energy and gravitational potential', assessment: 'summative' },
              { id: 'phy.c07.t05', title: 'Escape speed', assessment: 'summative' },
              { id: 'phy.c07.t06', title: 'Orbital velocity of a satellite', assessment: 'summative' },
              { id: 'phy.c07.t07', title: 'Energy of an orbiting satellite', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'phy.u07',
        title: 'Properties of Bulk Matter',
        marks: 20,
        marksGroup: 'Units VII to IX',
        periods: 24,
        chapters: [
          {
            id: 'phy.c08',
            title: 'Mechanical Properties of Solids',
            ncertNo: 8,
            ncertPart: 2,
            topics: [
              { id: 'phy.c08.t01', title: 'Elasticity', assessment: 'summative' },
              { id: 'phy.c08.t02', title: 'Stress-strain relationship', assessment: 'summative' },
              { id: 'phy.c08.t03', title: "Hooke's law", assessment: 'summative' },
              { id: 'phy.c08.t04', title: "Young's modulus", assessment: 'summative' },
              { id: 'phy.c08.t05', title: 'Bulk modulus', assessment: 'summative' },
              { id: 'phy.c08.t06', title: 'Shear modulus of rigidity (qualitative idea only)', assessment: 'summative' },
              { id: 'phy.c08.t07', title: "Poisson's ratio", assessment: 'summative' },
              { id: 'phy.c08.t08', title: 'Elastic energy', assessment: 'summative' },
              { id: 'phy.c08.t09', title: 'Applications of elastic behaviour of materials (qualitative idea only)', assessment: 'summative' },
            ],
          },
          {
            id: 'phy.c09',
            title: 'Mechanical Properties of Fluids',
            ncertNo: 9,
            ncertPart: 2,
            topics: [
              { id: 'phy.c09.t01', title: 'Pressure due to a fluid column', assessment: 'summative' },
              { id: 'phy.c09.t02', title: "Pascal's law and its applications (hydraulic lift and brakes)", assessment: 'summative' },
              { id: 'phy.c09.t03', title: 'Effect of gravity on fluid pressure', assessment: 'summative' },
              { id: 'phy.c09.t04', title: 'Viscosity', assessment: 'summative' },
              { id: 'phy.c09.t05', title: "Stokes' law", assessment: 'summative' },
              { id: 'phy.c09.t06', title: 'Terminal velocity', assessment: 'summative' },
              { id: 'phy.c09.t07', title: 'Streamline and turbulent flow', assessment: 'summative' },
              { id: 'phy.c09.t08', title: 'Critical velocity', assessment: 'summative' },
              { id: 'phy.c09.t09', title: "Bernoulli's theorem and simple applications (Torricelli's law, dynamic lift)", assessment: 'summative' },
              { id: 'phy.c09.t10', title: 'Surface energy and surface tension', assessment: 'summative' },
              { id: 'phy.c09.t11', title: 'Angle of contact', assessment: 'summative' },
              { id: 'phy.c09.t12', title: 'Excess pressure across a curved surface', assessment: 'summative' },
              { id: 'phy.c09.t13', title: 'Applications of surface tension to drops, bubbles and capillary rise', assessment: 'summative' },
            ],
          },
          {
            id: 'phy.c10',
            title: 'Thermal Properties of Matter',
            ncertNo: 10,
            ncertPart: 2,
            topics: [
              { id: 'phy.c10.t01', title: 'Heat and temperature', assessment: 'summative' },
              { id: 'phy.c10.t02', title: 'Thermal expansion of solids, liquids and gases', assessment: 'summative' },
              { id: 'phy.c10.t03', title: 'Anomalous expansion of water', assessment: 'summative' },
              { id: 'phy.c10.t04', title: 'Specific heat capacity (Cp, Cv)', assessment: 'summative' },
              { id: 'phy.c10.t05', title: 'Calorimetry', assessment: 'summative' },
              { id: 'phy.c10.t06', title: 'Change of state', assessment: 'summative' },
              { id: 'phy.c10.t07', title: 'Latent heat capacity', assessment: 'summative' },
              { id: 'phy.c10.t08', title: 'Heat transfer (conduction, convection, radiation)', assessment: 'summative' },
              { id: 'phy.c10.t09', title: 'Thermal conductivity', assessment: 'summative' },
              { id: 'phy.c10.t10', title: "Qualitative ideas of blackbody radiation, Wien's displacement law, Stefan's law", assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'phy.u08',
        title: 'Thermodynamics',
        marks: null,
        marksGroup: 'Units VII to IX',
        periods: 12,
        chapters: [
          {
            id: 'phy.c11',
            title: 'Thermodynamics',
            ncertNo: 11,
            ncertPart: 2,
            topics: [
              { id: 'phy.c11.t01', title: 'Thermal equilibrium and definition of temperature', assessment: 'summative' },
              { id: 'phy.c11.t02', title: 'Zeroth law', assessment: 'summative' },
              { id: 'phy.c11.t03', title: 'Heat, work and internal energy', assessment: 'summative' },
              { id: 'phy.c11.t04', title: 'First law', assessment: 'summative' },
              { id: 'phy.c11.t05', title: 'Second law', assessment: 'summative' },
              { id: 'phy.c11.t06', title: 'Thermodynamic state variables and equation of state', assessment: 'summative' },
              { id: 'phy.c11.t07', title: 'Change of condition of a gaseous state', assessment: 'summative' },
              { id: 'phy.c11.t08', title: 'Isothermal, adiabatic, reversible, irreversible and cyclic processes', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'phy.u09',
        title: 'Behaviour of Perfect Gases and Kinetic Theory of Gases',
        marks: null,
        marksGroup: 'Units VII to IX',
        periods: 8,
        chapters: [
          {
            id: 'phy.c12',
            title: 'Kinetic Theory',
            ncertNo: 12,
            ncertPart: 2,
            topics: [
              { id: 'phy.c12.t01', title: 'Equation of state of a perfect gas', assessment: 'summative' },
              { id: 'phy.c12.t02', title: 'Work done in compressing a gas', assessment: 'summative' },
              { id: 'phy.c12.t03', title: 'Kinetic theory of gases (assumptions, concept of pressure)', assessment: 'summative' },
              { id: 'phy.c12.t04', title: 'Kinetic interpretation of temperature', assessment: 'summative' },
              { id: 'phy.c12.t05', title: 'Rms speed of gas molecules', assessment: 'summative' },
              { id: 'phy.c12.t06', title: 'Degrees of freedom', assessment: 'summative' },
              { id: 'phy.c12.t07', title: 'Law of equipartition of energy (statement only) and application to specific heat capacities of gases', assessment: 'summative' },
              { id: 'phy.c12.t08', title: 'Concept of mean free path', assessment: 'summative' },
              { id: 'phy.c12.t09', title: "Avogadro's number", assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'phy.u10',
        title: 'Oscillations and Waves',
        marks: 10,
        periods: 26,
        chapters: [
          {
            id: 'phy.c13',
            title: 'Oscillations',
            ncertNo: 13,
            ncertPart: 2,
            topics: [
              { id: 'phy.c13.t01', title: 'Periodic motion (time period, frequency, displacement as a function of time)', assessment: 'summative' },
              { id: 'phy.c13.t02', title: 'Periodic functions', assessment: 'summative' },
              { id: 'phy.c13.t03', title: 'Simple harmonic motion (SHM) and its equations', assessment: 'summative' },
              { id: 'phy.c13.t04', title: 'Uniform circular motion and SHM', assessment: 'summative' },
              { id: 'phy.c13.t05', title: 'Phase', assessment: 'summative' },
              { id: 'phy.c13.t06', title: 'Oscillations of a loaded spring (restoring force, force constant)', assessment: 'summative' },
              { id: 'phy.c13.t07', title: 'Energy in SHM (kinetic and potential)', assessment: 'summative' },
              { id: 'phy.c13.t08', title: 'Simple pendulum and derivation of its time period', assessment: 'summative' },
            ],
          },
          {
            id: 'phy.c14',
            title: 'Waves',
            ncertNo: 14,
            ncertPart: 2,
            topics: [
              { id: 'phy.c14.t01', title: 'Wave motion', assessment: 'summative' },
              { id: 'phy.c14.t02', title: 'Transverse and longitudinal waves', assessment: 'summative' },
              { id: 'phy.c14.t03', title: 'Speed of a travelling wave', assessment: 'summative' },
              { id: 'phy.c14.t04', title: 'Displacement relation for a progressive wave', assessment: 'summative' },
              { id: 'phy.c14.t05', title: 'Principle of superposition', assessment: 'summative' },
              { id: 'phy.c14.t06', title: 'Reflection of waves', assessment: 'summative' },
              { id: 'phy.c14.t07', title: 'Standing waves in strings and organ pipes', assessment: 'summative' },
              { id: 'phy.c14.t08', title: 'Fundamental mode and harmonics', assessment: 'summative' },
              { id: 'phy.c14.t09', title: 'Beats', assessment: 'summative' },
            ],
          },
        ],
      },
    ],
    practicalNote:
      'Practical list not added yet — it was not captured from the supplied book. Check your school\'s practical handbook.',
    source: {
      label: 'CBSE curriculum 2026-27 via Delhi Directorate of Education support material 2026-27',
      note: "Read from a scanned book — verify against your school's copy. Your school may follow a different circular. Check with your teacher.",
    },
  },

  // ------------------------------------------------------------ Chemistry 043
  {
    id: 'chemistry',
    name: 'Chemistry',
    code: '043',
    catalogueName: 'Chemistry',
    theoryMarks: 70,
    units: [
      {
        id: 'che.u01',
        title: 'Some Basic Concepts of Chemistry',
        marks: 7,
        chapters: [
          {
            id: 'che.c01',
            title: 'Some Basic Concepts of Chemistry',
            ncertNo: 1,
            ncertPart: 1,
            topics: [
              { id: 'che.c01.t01', title: 'Importance of chemistry', assessment: 'summative' },
              { id: 'che.c01.t02', title: 'Nature of matter', assessment: 'summative' },
              { id: 'che.c01.t03', title: 'Properties of matter and their measurement', assessment: 'summative' },
              { id: 'che.c01.t04', title: 'Uncertainty in measurement', assessment: 'summative' },
              { id: 'che.c01.t05', title: 'Laws of chemical combination', assessment: 'summative' },
              { id: 'che.c01.t06', title: "Dalton's atomic theory", assessment: 'summative' },
              { id: 'che.c01.t07', title: 'Atomic and molecular masses', assessment: 'summative' },
              { id: 'che.c01.t08', title: 'Mole concept and molar masses', assessment: 'summative' },
              { id: 'che.c01.t09', title: 'Percentage composition', assessment: 'summative' },
              { id: 'che.c01.t10', title: 'Stoichiometry and stoichiometric calculations', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'che.u02',
        title: 'Structure of Atom',
        marks: 9,
        chapters: [
          {
            id: 'che.c02',
            title: 'Structure of Atom',
            ncertNo: 2,
            ncertPart: 1,
            topics: [
              { id: 'che.c02.t01', title: 'Discovery of sub-atomic particles', assessment: 'summative' },
              { id: 'che.c02.t02', title: 'Atomic models', assessment: 'summative' },
              { id: 'che.c02.t03', title: "Developments leading to Bohr's model", assessment: 'summative' },
              { id: 'che.c02.t04', title: "Bohr's model for the hydrogen atom", assessment: 'summative' },
              { id: 'che.c02.t05', title: 'Towards the quantum mechanical model', assessment: 'summative' },
              { id: 'che.c02.t06', title: 'Quantum mechanical model of the atom', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'che.u03',
        title: 'Classification of Elements and Periodicity in Properties',
        marks: 6,
        chapters: [
          {
            id: 'che.c03',
            title: 'Classification of Elements and Periodicity in Properties',
            ncertNo: 3,
            ncertPart: 1,
            topics: [
              { id: 'che.c03.t01', title: 'Why we need to classify elements', assessment: 'summative' },
              { id: 'che.c03.t02', title: 'Genesis of periodic classification', assessment: 'summative' },
              { id: 'che.c03.t03', title: 'Modern periodic law and the present form of the periodic table', assessment: 'summative' },
              { id: 'che.c03.t04', title: 'Nomenclature of elements with atomic number > 100', assessment: 'summative' },
              { id: 'che.c03.t05', title: 'Electronic configuration and the periodic table', assessment: 'summative' },
              { id: 'che.c03.t06', title: 'Electronic configuration and types of elements (s-, p-, d-, f-blocks)', assessment: 'summative' },
              { id: 'che.c03.t07', title: 'Periodic trends in properties of elements', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'che.u04',
        title: 'Chemical Bonding and Molecular Structure',
        marks: 7,
        chapters: [
          {
            id: 'che.c04',
            title: 'Chemical Bonding and Molecular Structure',
            ncertNo: 4,
            ncertPart: 1,
            topics: [
              { id: 'che.c04.t01', title: 'Kossel-Lewis approach', assessment: 'summative' },
              { id: 'che.c04.t02', title: 'Ionic or electrovalent bond', assessment: 'summative' },
              { id: 'che.c04.t03', title: 'Bond parameters', assessment: 'summative' },
              { id: 'che.c04.t04', title: 'VSEPR theory', assessment: 'summative' },
              { id: 'che.c04.t05', title: 'Valence bond theory', assessment: 'summative' },
              { id: 'che.c04.t06', title: 'Hybridisation', assessment: 'summative' },
              { id: 'che.c04.t07', title: 'Molecular orbital theory', assessment: 'summative' },
              { id: 'che.c04.t08', title: 'Bonding in some homonuclear diatomic molecules', assessment: 'summative' },
              { id: 'che.c04.t09', title: 'Hydrogen bonding', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'che.u05',
        title: 'Chemical Thermodynamics',
        marks: 9,
        chapters: [
          {
            id: 'che.c05',
            title: 'Chemical Thermodynamics',
            ncertNo: 5,
            ncertPart: 1,
            topics: [
              { id: 'che.c05.t01', title: 'Thermodynamic terms', assessment: 'summative' },
              { id: 'che.c05.t02', title: 'Applications', assessment: 'summative' },
              { id: 'che.c05.t03', title: 'Measurement of ΔU and ΔH (calorimetry)', assessment: 'summative' },
              { id: 'che.c05.t04', title: 'Enthalpy change and ΔH of a reaction (reaction enthalpy)', assessment: 'summative' },
              { id: 'che.c05.t05', title: 'Enthalpies for different types of reactions', assessment: 'summative' },
              { id: 'che.c05.t06', title: 'Spontaneity', assessment: 'summative' },
              { id: 'che.c05.t07', title: 'Gibbs energy change and equilibrium', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'che.u06',
        title: 'Equilibrium',
        marks: 7,
        chapters: [
          {
            id: 'che.c06',
            title: 'Equilibrium',
            ncertNo: 6,
            ncertPart: 1,
            topics: [
              { id: 'che.c06.t01', title: 'Equilibrium in physical processes', assessment: 'summative' },
              { id: 'che.c06.t02', title: 'Equilibrium in chemical processes (dynamic equilibrium)', assessment: 'summative' },
              { id: 'che.c06.t03', title: 'Law of chemical equilibrium and equilibrium constant', assessment: 'summative' },
              { id: 'che.c06.t04', title: 'Homogeneous equilibria', assessment: 'summative' },
              { id: 'che.c06.t05', title: 'Heterogeneous equilibria', assessment: 'summative' },
              { id: 'che.c06.t06', title: 'Applications of equilibrium constants', assessment: 'summative' },
              { id: 'che.c06.t07', title: 'Relationship between K, reaction quotient Q and Gibbs energy', assessment: 'summative' },
              { id: 'che.c06.t08', title: 'Factors affecting equilibria', assessment: 'summative' },
              { id: 'che.c06.t09', title: 'Ionic equilibrium in solution', assessment: 'summative' },
              { id: 'che.c06.t10', title: 'Acids, bases and salts', assessment: 'summative' },
              { id: 'che.c06.t11', title: 'Ionisation of acids and bases', assessment: 'summative' },
              { id: 'che.c06.t12', title: 'Buffer solutions', assessment: 'summative' },
              { id: 'che.c06.t13', title: 'Solubility equilibria of sparingly soluble salts', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'che.u07',
        title: 'Redox Reactions',
        marks: 4,
        chapters: [
          {
            id: 'che.c07',
            title: 'Redox Reactions',
            ncertNo: 7,
            ncertPart: 2,
            topics: [
              { id: 'che.c07.t01', title: 'Classical idea of redox reactions (oxidation and reduction)', assessment: 'summative' },
              { id: 'che.c07.t02', title: 'Redox reactions in terms of electron transfer', assessment: 'summative' },
              { id: 'che.c07.t03', title: 'Oxidation number', assessment: 'summative' },
              { id: 'che.c07.t04', title: 'Redox reactions and electrode processes', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'che.u08',
        title: 'Organic Chemistry: Some Basic Principles and Techniques',
        marks: 11,
        chapters: [
          {
            id: 'che.c08',
            title: 'Organic Chemistry: Some Basic Principles and Techniques',
            ncertNo: 8,
            ncertPart: 2,
            topics: [
              { id: 'che.c08.t01', title: 'General introduction', assessment: 'summative' },
              { id: 'che.c08.t02', title: 'Tetravalence of carbon and shapes of organic compounds', assessment: 'summative' },
              { id: 'che.c08.t03', title: 'Structural representations', assessment: 'summative' },
              { id: 'che.c08.t04', title: 'Classification', assessment: 'summative' },
              { id: 'che.c08.t05', title: 'Nomenclature', assessment: 'summative' },
              { id: 'che.c08.t06', title: 'Isomerism', assessment: 'summative' },
              { id: 'che.c08.t07', title: 'Fundamental concepts in organic reaction mechanism', assessment: 'summative' },
              { id: 'che.c08.t08', title: 'Methods of purification', assessment: 'summative' },
              { id: 'che.c08.t09', title: 'Qualitative analysis', assessment: 'summative' },
              { id: 'che.c08.t10', title: 'Quantitative analysis', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'che.u09',
        title: 'Hydrocarbons',
        marks: 10,
        chapters: [
          {
            id: 'che.c09',
            title: 'Hydrocarbons',
            ncertNo: 9,
            ncertPart: 2,
            topics: [
              { id: 'che.c09.t01', title: 'Classification', assessment: 'summative' },
              { id: 'che.c09.t02', title: 'Alkanes', assessment: 'summative' },
              { id: 'che.c09.t03', title: 'Alkenes', assessment: 'summative' },
              { id: 'che.c09.t04', title: 'Alkynes', assessment: 'summative' },
              { id: 'che.c09.t05', title: 'Aromatic hydrocarbons', assessment: 'summative' },
              { id: 'che.c09.t06', title: 'Carcinogenicity and toxicity', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'che.uf',
        title: 'Formative only (CBSE-only, removed from the rationalised NCERT book)',
        marks: null,
        chapters: [
          {
            id: 'che.cf01',
            title: 's and p Block Elements',
            note: 'Removed from the rationalised NCERT book; CBSE lists it as formative only',
            topics: [
              { id: 'che.cf01.t01', title: 'Electronic configuration', assessment: 'formative_only' },
              { id: 'che.cf01.t02', title: 'Atomic and ionic radii', assessment: 'formative_only' },
              { id: 'che.cf01.t03', title: 'Ionisation enthalpy', assessment: 'formative_only' },
              { id: 'che.cf01.t04', title: 'Hydration enthalpy', assessment: 'formative_only' },
              { id: 'che.cf01.t05', title: 'General trends in physical and chemical properties across periods and down groups of s and p block elements', assessment: 'formative_only' },
              { id: 'che.cf01.t06', title: 'Unique behaviour of the first element in each group', assessment: 'formative_only' },
            ],
          },
          {
            id: 'che.cf02',
            title: 'The Gaseous State',
            note: 'Removed from the rationalised NCERT book; CBSE lists it as formative only',
            topics: [
              { id: 'che.cf02.t01', title: 'Qualitative treatment of gas laws', assessment: 'formative_only' },
              { id: 'che.cf02.t02', title: 'Ideal gas equation and deviations from it', assessment: 'formative_only' },
            ],
          },
        ],
      },
    ],
    practical: {
      items: [
        { id: 'che.p01', title: 'Basic laboratory techniques (cutting glass tube and glass rod, bending a glass tube, drawing out a glass jet, boring a cork)', assessment: 'summative' },
        { id: 'che.p02', title: 'Characterisation and purification (melting point of an organic compound, boiling point of an organic compound, crystallisation of an impure sample — alum, copper sulphate or benzoic acid)', assessment: 'summative' },
        { id: 'che.p03', title: 'Experiments based on pH (pH of fruit juices and known solutions; comparing pH of strong and weak acids of the same concentration; pH change in titration of a strong base using universal indicator; pH change by common ion in weak acids and weak bases)', assessment: 'summative' },
        { id: 'che.p04', title: 'Chemical equilibrium (any one): shift in equilibrium between ferric and thiocyanate ions, or between [Co(H2O)6]2+ and chloride ions', assessment: 'summative' },
        { id: 'che.p05', title: 'Quantitative estimation (using a mechanical or electronic balance; standard oxalic acid solution; strength of NaOH by titration; standard sodium carbonate solution; strength of HCl by titration)', assessment: 'summative' },
        { id: 'che.p06', title: 'Qualitative analysis (one anion and one cation in a given salt, insoluble salts excluded; detection of nitrogen, sulphur and chlorine in organic compounds)', assessment: 'summative' },
        { id: 'che.p07', title: 'Project work (a scientific investigation of about 10 periods, with teacher approval)', assessment: 'summative' },
      ],
      scheme: [
        { label: 'Volumetric analysis', marks: 8 },
        { label: 'Salt analysis', marks: 8 },
        { label: 'Content-based experiment', marks: 6 },
        { label: 'Project work', marks: 4 },
        { label: 'Class record and viva', marks: 4 },
      ],
    },
    source: {
      label: 'CBSE curriculum 2026-27, as supplied by the learner',
      note: 'Your school may follow a different circular. Check with your teacher.',
    },
  },

  // ---------------------------------------------------- Computer Science 083
  {
    id: 'cs',
    name: 'Computer Science',
    code: '083',
    catalogueName: 'Computer Science',
    theoryMarks: 70,
    units: [
      {
        id: 'cs.u01',
        title: 'Computer Systems and Organisation',
        marks: 10,
        chapters: [
          {
            id: 'cs.c01',
            title: 'Computer System',
            ncertNo: 1,
            topics: [
              { id: 'cs.c01.t01', title: 'Basic computer organisation (computer system, hardware, software, input and output devices, CPU, memory: primary, cache, secondary; units of memory: bit, byte, KB, MB, GB, TB, PB)', assessment: 'summative' },
              { id: 'cs.c01.t02', title: 'Types of software (system software: operating systems, system utilities, device drivers; programming tools and language translators: assembler, compiler, interpreter; application software)', assessment: 'summative' },
              { id: 'cs.c01.t03', title: 'Operating system (functions of the OS, OS user interface)', assessment: 'summative' },
              { id: 'cs.c01.t04', title: "Boolean logic (NOT, AND, OR, NAND, NOR, XOR, truth tables, De Morgan's laws, logic circuits)", assessment: 'summative' },
            ],
          },
          {
            id: 'cs.c02',
            title: 'Encoding Schemes and Number System',
            ncertNo: 2,
            topics: [
              { id: 'cs.c02.t01', title: 'Number systems (binary, octal, decimal, hexadecimal) and conversion between them', assessment: 'summative' },
              { id: 'cs.c02.t02', title: 'Encoding schemes (ASCII, ISCII, Unicode: UTF-8, UTF-32)', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'cs.u02',
        title: 'Computational Thinking and Programming - I',
        marks: 45,
        chapters: [
          {
            id: 'cs.c04',
            title: 'Introduction to Problem Solving',
            ncertNo: 4,
            topics: [
              { id: 'cs.c04.t01', title: 'Steps for problem solving (analysing the problem, developing an algorithm, coding, testing and debugging)', assessment: 'summative' },
              { id: 'cs.c04.t02', title: 'Representation of algorithms using flowchart and pseudocode', assessment: 'summative' },
              { id: 'cs.c04.t03', title: 'Decomposition', assessment: 'summative' },
            ],
          },
          {
            id: 'cs.c05',
            title: 'Getting Started with Python',
            ncertNo: 5,
            topics: [
              { id: 'cs.c05.t01', title: 'Introduction and features of Python', assessment: 'summative' },
              { id: 'cs.c05.t02', title: '"hello world"', assessment: 'summative' },
              { id: 'cs.c05.t03', title: 'Interactive and script modes', assessment: 'summative' },
              { id: 'cs.c05.t04', title: 'Python character set', assessment: 'summative' },
              { id: 'cs.c05.t05', title: 'Tokens (keyword, identifier, literal, operator, punctuator)', assessment: 'summative' },
              { id: 'cs.c05.t06', title: 'Variables', assessment: 'summative' },
              { id: 'cs.c05.t07', title: 'l-value and r-value', assessment: 'summative' },
              { id: 'cs.c05.t08', title: 'Comments', assessment: 'summative' },
              { id: 'cs.c05.t09', title: 'Data types (number: integer, float, complex; boolean; sequence: string, list, tuple; None; mapping: dictionary; mutable and immutable types)', assessment: 'summative' },
              { id: 'cs.c05.t10', title: 'Operators (arithmetic, relational, logical, assignment, augmented assignment, identity: is, is not; membership: in, not in)', assessment: 'summative' },
              { id: 'cs.c05.t11', title: 'Expressions, statements, precedence of operators, evaluation of an expression', assessment: 'summative' },
              { id: 'cs.c05.t12', title: 'Type conversion (explicit and implicit)', assessment: 'summative' },
              { id: 'cs.c05.t13', title: 'Console input and output', assessment: 'summative' },
              { id: 'cs.c05.t14', title: 'Errors (syntax, logical, run-time)', assessment: 'summative' },
            ],
          },
          {
            id: 'cs.c06',
            title: 'Flow of Control',
            ncertNo: 6,
            topics: [
              { id: 'cs.c06.t01', title: 'Introduction', assessment: 'summative' },
              { id: 'cs.c06.t02', title: 'Use of indentation', assessment: 'summative' },
              { id: 'cs.c06.t03', title: 'Sequential, conditional and iterative flow', assessment: 'summative' },
              { id: 'cs.c06.t04', title: 'Conditional statements (if, if-else, if-elif-else; flowcharts; simple programs: absolute value, sort three numbers, divisibility)', assessment: 'summative' },
              { id: 'cs.c06.t05', title: 'Iterative statements (for, range(), while; flowcharts; break and continue; nested loops; programs: patterns, summation of series, factorial)', assessment: 'summative' },
            ],
          },
          {
            id: 'cs.c07',
            title: 'Functions',
            ncertNo: 7,
            note: 'The supplied Class 11 syllabus lists only the module topics from this chapter; user-defined functions appear in the Class 12 syllabus.',
            topics: [
              { id: 'cs.c07.t01', title: 'Python modules: `import <module>` and `from` forms', assessment: 'summative' },
              { id: 'cs.c07.t02', title: '`math` (pi, e, sqrt, ceil, floor, pow, fabs, sin, cos, tan)', assessment: 'summative' },
              { id: 'cs.c07.t03', title: '`random` (random, randint, randrange)', assessment: 'summative' },
              { id: 'cs.c07.t04', title: '`statistics` (mean, median, mode)', assessment: 'summative' },
            ],
          },
          {
            id: 'cs.c08',
            title: 'Strings',
            ncertNo: 8,
            topics: [
              { id: 'cs.c08.t01', title: 'Introduction', assessment: 'summative' },
              { id: 'cs.c08.t02', title: 'String operations (concatenation, repetition, membership, slicing)', assessment: 'summative' },
              { id: 'cs.c08.t03', title: 'Traversing a string with loops', assessment: 'summative' },
              { id: 'cs.c08.t04', title: 'Built-in functions and methods (len, capitalize, title, lower, upper, count, find, index, endswith, startswith, isalnum, isalpha, isdigit, islower, isupper, isspace, lstrip, rstrip, strip, replace, join, partition, split)', assessment: 'summative' },
            ],
          },
          {
            id: 'cs.c09',
            title: 'Lists',
            ncertNo: 9,
            topics: [
              { id: 'cs.c09.t01', title: 'Introduction', assessment: 'summative' },
              { id: 'cs.c09.t02', title: 'Indexing', assessment: 'summative' },
              { id: 'cs.c09.t03', title: 'List operations (concatenation, repetition, membership, slicing)', assessment: 'summative' },
              { id: 'cs.c09.t04', title: 'Traversal', assessment: 'summative' },
              { id: 'cs.c09.t05', title: 'Built-ins (len, list, append, extend, insert, count, index, remove, pop, reverse, sort, sorted, min, max, sum)', assessment: 'summative' },
              { id: 'cs.c09.t06', title: 'Nested lists', assessment: 'summative' },
              { id: 'cs.c09.t07', title: 'Programs (maximum, minimum, mean, linear search, frequency count)', assessment: 'summative' },
            ],
          },
          {
            id: 'cs.c10',
            title: 'Tuples and Dictionaries',
            ncertNo: 10,
            topics: [
              { id: 'cs.c10.t01', title: 'Tuples (introduction, indexing, concatenation, repetition, membership, slicing; built-ins len, tuple, count, index, sorted, min, max, sum; tuple assignment; nested tuples; programs: minimum, maximum, mean, linear search, frequency)', assessment: 'summative' },
              { id: 'cs.c10.t02', title: 'Dictionaries (introduction; accessing items by key; mutability: adding and modifying; traversal; built-ins len, dict, keys, values, items, get, update, del, clear, fromkeys, copy, pop, popitem, setdefault, max, min, sorted; programs: character count with a dictionary, employee-salary dictionary)', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'cs.u03',
        title: 'Society, Law and Ethics',
        marks: 15,
        chapters: [
          {
            id: 'cs.c11',
            title: 'Societal Impact',
            ncertNo: 11,
            topics: [
              { id: 'cs.c11.t01', title: 'Digital footprints', assessment: 'summative' },
              { id: 'cs.c11.t02', title: 'Digital society and netizen (net etiquette, communication etiquette, social media etiquette)', assessment: 'summative' },
              { id: 'cs.c11.t03', title: 'Data protection (intellectual property rights: copyright, patent, trademark; violation of IPR: plagiarism, copyright infringement, trademark infringement; open-source software and licensing: Creative Commons, GPL, Apache)', assessment: 'summative' },
              { id: 'cs.c11.t04', title: 'Cyber crime (definition, hacking, eavesdropping, phishing and fraud emails, ransomware, cyber trolls, cyber bullying)', assessment: 'summative' },
              { id: 'cs.c11.t05', title: 'Cyber safety (safe browsing, identity protection, confidentiality)', assessment: 'summative' },
              { id: 'cs.c11.t06', title: 'Malware (viruses, trojans, adware)', assessment: 'summative' },
              { id: 'cs.c11.t07', title: 'e-Waste management', assessment: 'summative' },
              { id: 'cs.c11.t08', title: 'Information Technology Act (IT Act)', assessment: 'summative' },
              { id: 'cs.c11.t09', title: 'Technology and society (gender and disability issues while teaching and using computers)', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'cs.u09',
        title: 'NCERT chapters not in the syllabus list',
        marks: null,
        chapters: [
          {
            id: 'cs.c03',
            title: 'Emerging Trends',
            ncertNo: 3,
            note: 'In the NCERT book, but not in the supplied CBSE syllabus list. Ask your teacher.',
            topics: [
              { id: 'cs.c03.t01', title: 'Emerging Trends', assessment: 'not_in_syllabus_doc' },
            ],
          },
        ],
      },
    ],
    practical: {
      items: [
        { id: 'cs.p01', title: 'Welcome message (input name and display a welcome message)', assessment: 'summative' },
        { id: 'cs.p02', title: 'Larger/smaller of two numbers', assessment: 'summative' },
        { id: 'cs.p03', title: 'Largest/smallest of three numbers', assessment: 'summative' },
        { id: 'cs.p04', title: 'The three star/number/letter patterns using nested loops', assessment: 'summative' },
        { id: 'cs.p05', title: 'Series sums (four series)', assessment: 'summative' },
        { id: 'cs.p06', title: 'Perfect number, Armstrong number and palindrome checks', assessment: 'summative' },
        { id: 'cs.p07', title: 'Prime or composite check', assessment: 'summative' },
        { id: 'cs.p08', title: 'Fibonacci terms', assessment: 'summative' },
        { id: 'cs.p09', title: 'GCD and LCM of two numbers', assessment: 'summative' },
        { id: 'cs.p10', title: 'Counting vowels, consonants, uppercase and lowercase letters in a string', assessment: 'summative' },
        { id: 'cs.p11', title: 'String palindrome and case conversion', assessment: 'summative' },
        { id: 'cs.p12', title: 'Largest/smallest in a list or tuple', assessment: 'summative' },
        { id: 'cs.p13', title: 'Swapping elements at even and odd positions in a list', assessment: 'summative' },
        { id: 'cs.p14', title: 'Searching an element in a list or tuple', assessment: 'summative' },
        { id: 'cs.p15', title: 'Dictionary of roll number, name and marks, and listing students above 75', assessment: 'summative' },
        { id: 'cs.p16', title: 'Class project', assessment: 'summative' },
      ],
      scheme: [
        { label: 'Lab test', marks: 12 },
        { label: 'Report file and viva', marks: 10 },
        { label: 'Project', marks: 8 },
      ],
    },
    source: {
      label: 'CBSE curriculum 2026-27, as supplied by the learner',
      note: 'Your school may follow a different circular. Check with your teacher.',
    },
  },

  // ------------------------------------------- Artificial Intelligence (843)
  {
    id: 'ai',
    name: 'Artificial Intelligence',
    code: '843',
    catalogueName: 'Artificial Intelligence',
    theoryMarks: 50,
    units: [
      {
        id: 'ai.u01',
        title: 'Part A: Employability Skills',
        marks: 10,
        chapters: [
          {
            id: 'ai.c01',
            title: 'Communication Skills III',
            note: 'Tracked at unit level — the supplied document lists only unit names; detailed topics are on the CBSE website.',
            topics: [
              { id: 'ai.c01.t01', title: 'Communication Skills III', assessment: 'summative' },
            ],
          },
          {
            id: 'ai.c02',
            title: 'Self-Management Skills III',
            note: 'Tracked at unit level — the supplied document lists only unit names; detailed topics are on the CBSE website.',
            topics: [
              { id: 'ai.c02.t01', title: 'Self-Management Skills III', assessment: 'summative' },
            ],
          },
          {
            id: 'ai.c03',
            title: 'ICT Skills III',
            note: 'Tracked at unit level — the supplied document lists only unit names; detailed topics are on the CBSE website.',
            topics: [
              { id: 'ai.c03.t01', title: 'ICT Skills III', assessment: 'summative' },
            ],
          },
          {
            id: 'ai.c04',
            title: 'Entrepreneurial Skills III',
            note: 'Tracked at unit level — the supplied document lists only unit names; detailed topics are on the CBSE website.',
            topics: [
              { id: 'ai.c04.t01', title: 'Entrepreneurial Skills III', assessment: 'summative' },
            ],
          },
          {
            id: 'ai.c05',
            title: 'Green Skills III',
            note: 'Tracked at unit level — the supplied document lists only unit names; detailed topics are on the CBSE website.',
            topics: [
              { id: 'ai.c05.t01', title: 'Green Skills III', assessment: 'summative' },
            ],
          },
        ],
      },
      {
        id: 'ai.u02',
        title: 'Part B: Subject-specific Skills',
        marks: 40,
        chapters: [
          {
            id: 'ai.c06',
            title: 'Introduction: Artificial Intelligence for Everyone',
            periods: 14,
            topics: [
              { id: 'ai.c06.t01', title: 'What is AI', assessment: 'summative' },
              { id: 'ai.c06.t02', title: 'Evolution of AI', assessment: 'summative' },
              { id: 'ai.c06.t03', title: 'Types of AI', assessment: 'summative' },
              { id: 'ai.c06.t04', title: 'Domains of AI', assessment: 'summative' },
              { id: 'ai.c06.t05', title: 'AI terminologies', assessment: 'summative' },
              { id: 'ai.c06.t06', title: 'Benefits and limitations of AI', assessment: 'summative' },
            ],
          },
          {
            id: 'ai.c07',
            title: 'Unlocking your Future in AI',
            topics: [
              { id: 'ai.c07.t01', title: 'The global demand', assessment: 'summative' },
              { id: 'ai.c07.t02', title: 'Common job roles in AI', assessment: 'summative' },
              { id: 'ai.c07.t03', title: 'Essential skills and tools for prospective AI careers', assessment: 'summative' },
              { id: 'ai.c07.t04', title: 'Opportunities in AI across industries', assessment: 'summative' },
            ],
          },
          {
            id: 'ai.c08',
            title: 'Python Programming',
            topics: [
              { id: 'ai.c08.t01', title: 'Level 1: basics, character sets, tokens, modes, operators, data types, control statements', assessment: 'summative' },
              { id: 'ai.c08.t02', title: 'Level 2: CSV files, libraries NumPy, Pandas, Scikit-learn', assessment: 'summative' },
            ],
          },
          {
            id: 'ai.c09',
            title: 'Introduction to Capstone Project',
            topics: [
              { id: 'ai.c09.t01', title: 'Design thinking', assessment: 'summative' },
              { id: 'ai.c09.t02', title: 'Empathy map', assessment: 'summative' },
              { id: 'ai.c09.t03', title: 'Sustainable Development Goals', assessment: 'summative' },
              { id: 'ai.c09.t04', title: 'Capstone project', assessment: 'summative' },
            ],
          },
          {
            id: 'ai.c10',
            title: 'Data Literacy: Data Collection to Data Analysis',
            topics: [
              { id: 'ai.c10.t01', title: 'What is data literacy', assessment: 'summative' },
              { id: 'ai.c10.t02', title: 'Data collection', assessment: 'summative' },
              { id: 'ai.c10.t03', title: 'Exploring data', assessment: 'summative' },
              { id: 'ai.c10.t04', title: 'Statistical analysis of data', assessment: 'summative' },
              { id: 'ai.c10.t05', title: 'Representation of data, Python programs for statistical analysis and visualisation', assessment: 'summative' },
              { id: 'ai.c10.t06', title: 'Introduction to matrices', assessment: 'summative' },
              { id: 'ai.c10.t07', title: 'Data pre-processing', assessment: 'summative' },
              { id: 'ai.c10.t08', title: 'Data in modelling and evaluation', assessment: 'summative' },
            ],
          },
          {
            id: 'ai.c11',
            title: 'Machine Learning Algorithms',
            topics: [
              { id: 'ai.c11.t01', title: 'Machine learning in a nutshell', assessment: 'summative' },
              { id: 'ai.c11.t02', title: 'Types of machine learning', assessment: 'summative' },
              { id: 'ai.c11.t03', title: 'Supervised learning', assessment: 'summative' },
              { id: 'ai.c11.t04', title: 'Correlation, regression, finding the line, linear regression algorithm', assessment: 'summative' },
              { id: 'ai.c11.t05', title: 'Classification (how it works, types, k-Nearest Neighbour)', assessment: 'summative' },
              { id: 'ai.c11.t06', title: 'Unsupervised learning', assessment: 'summative' },
              { id: 'ai.c11.t07', title: 'Clustering (how it works, types, k-means)', assessment: 'summative' },
              { id: 'ai.c11.t08', title: 'Linear regression, k-NN and k-means in Python', assessment: 'summative', advanced: true },
            ],
          },
          {
            id: 'ai.c12',
            title: 'Leveraging Linguistics and Computer Science',
            topics: [
              { id: 'ai.c12.t01', title: 'Understanding human language complexity', assessment: 'summative' },
              { id: 'ai.c12.t02', title: 'Introduction to NLP (emotion detection and sentiment analysis, classification problems, chatbot)', assessment: 'summative' },
              { id: 'ai.c12.t03', title: 'Phases of NLP', assessment: 'summative' },
              { id: 'ai.c12.t04', title: 'Applications of NLP', assessment: 'summative' },
              { id: 'ai.c12.t05', title: 'POS tags program', assessment: 'summative', advanced: true },
              { id: 'ai.c12.t06', title: 'Rule-based chatbot in Python', assessment: 'summative', advanced: true },
            ],
          },
          {
            id: 'ai.c13',
            title: 'AI Ethics and Values',
            topics: [
              { id: 'ai.c13.t01', title: 'Ethics in AI', assessment: 'summative' },
              { id: 'ai.c13.t02', title: 'The five pillars of AI ethics', assessment: 'summative' },
              { id: 'ai.c13.t03', title: 'Bias, bias awareness, sources of bias', assessment: 'summative' },
              { id: 'ai.c13.t04', title: 'Mitigating bias in AI systems', assessment: 'summative' },
              { id: 'ai.c13.t05', title: 'Developing AI policies', assessment: 'summative' },
              { id: 'ai.c13.t06', title: 'Moral Machine game', assessment: 'summative' },
              { id: 'ai.c13.t07', title: 'Survival of the Best Fit game', assessment: 'summative' },
            ],
          },
        ],
      },
    ],
    practical: {
      items: [
        { id: 'ai.p01', title: 'IBM SkillsBuild or other industry certification', assessment: 'summative' },
        { id: 'ai.p02', title: 'Capstone project (prepare, form a team, define the problem aligned to an SDG, understand users, brainstorm, design, identify and collect data, build prototype, test, reflect as a team, reflect individually, video pitch)', assessment: 'summative' },
        { id: 'ai.p03', title: 'Bootcamp, internship or start-up participation', assessment: 'summative' },
        { id: 'ai.p04', title: 'Practical file (must include one certification, at least one activity from each unit, and one participation certificate)', assessment: 'summative' },
        { id: 'ai.p05', title: 'Lab test or written exam', assessment: 'summative' },
        { id: 'ai.p06', title: 'Viva voce', assessment: 'summative' },
      ],
      scheme: [
        { label: 'Industry certification', marks: 5 },
        { label: 'Capstone project', marks: 12 },
        { label: 'Bootcamp, internship or start-up participation', marks: 7 },
        { label: 'Practical file', marks: 10 },
        { label: 'Lab test or written exam', marks: 10 },
        { label: 'Viva voce', marks: 6 },
      ],
    },
    source: {
      label: 'CBSE curriculum 2026-27, as supplied by the learner',
      note: 'Your school may follow a different circular. Check with your teacher.',
    },
  },
];

/** CBSE Class 11 (2026-27) — the five subjects the learner supplied.
 *  Chapter order everywhere is the NCERT order (Appendix A.0) and defines
 *  "next in order" for the planner. Data-only module: no I/O, DOM or clock. */
export const CLASS11_SUBJECTS: readonly SyllabusSubject[] = CLASS11_DATA;
