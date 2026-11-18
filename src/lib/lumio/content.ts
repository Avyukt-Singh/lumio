// Lumio content: verbatim port of the prototype's Lumio-written sample material.
// PROVENANCE: every chapter, question, glossary entry and exercise below was written by the
// Lumio project (human-authored sample material, 2024-2025). It is NOT official curriculum,
// NOT a textbook and contains no previous-year questions. reviewStatus: "peer_reviewed"
// (prototype-shipped), source: "original".
// Ported verbatim from lumio-project-final.zip (lumio.html, script constants BANDS/EXS/CAPS/
// WDS/GLO/CAT/CBSE11P/COMP) by tools/gen-content (chunk 1, 2025).

export type Band = 'young' | 'middle' | 'sec' | 'senior' | 'dropper' | 'above';
export type LearnerCat = 'school' | 'dropper' | 'above';

export interface Question {
  text: string;
  options: string[];
  /** index into options */
  answer: number;
  explanation: string;
}

export interface Chapter {
  title: string;
  subject: string;
  summary: string;
  questions: Question[];
}

export interface BandDef {
  name: string;
  nav: string[];
  tools: string[];
  subjects: string[];
  dailyGoal: number;
  chapters: Chapter[];
}

export const BOARDS = ["CBSE","ICSE / CISCE","UP Board","Other State Board","NIOS","Other / International"] as const;
export const EXAMS = ["JEE Main","JEE Advanced","NEET","CUET","Other"] as const;
export const SUBJECT_CATALOGUE = ["English","Hindi","Sanskrit","Mathematics","Applied Mathematics","Science","Physics","Chemistry","Biology","Social Science","History","Geography","Political Science","Economics","Sociology","Accountancy","Business Studies","Entrepreneurship","Computer Science","Informatics Practices","Information Technology","Artificial Intelligence","Psychology","Legal Studies","Physical Education","Home Science","Fine Arts","Music","Dance","Engineering Graphics","Data Science","Financial Markets","Web Applications","Marketing"];
export const STATE_CAPITALS: Array<[string, string]> = [["Uttar Pradesh","Lucknow"],["Maharashtra","Mumbai"],["Tamil Nadu","Chennai"],["Karnataka","Bengaluru"],["Rajasthan","Jaipur"],["West Bengal","Kolkata"],["Gujarat","Gandhinagar"],["Kerala","Thiruvananthapuram"],["Bihar","Patna"],["Odisha","Bhubaneswar"]];
export const SPELL_WORDS: Array<[string, string, string[]]> = [["🐶","dog",["dig","dug"]],["🐱","cat",["cut","cot"]],["🌞","sun",["sin","son"]],["🐟","fish",["dish","fist"]],["🚌","bus",["bun","bud"]],["🌳","tree",["three","free"]]];
export const GLOSSARY: Array<[string, string]> = [["Numerator","The top number of a fraction: how many parts you have."],["Denominator","The bottom number of a fraction: how many equal parts make the whole."],["Force","A push or a pull that can change motion."],["Friction","A force that opposes relative motion between surfaces."],["Acceleration","The rate of change of velocity."],["Kinetic energy","Energy of motion, ½mv²."],["Torque","The turning effect of a force, τ = Iα for rotation."],["Photosynthesis","How plants make glucose from CO₂, water and light."],["Discriminant","D = b² − 4ac; it tells the type of roots of a quadratic."],["Ohm’s law","V = IR: voltage equals current times resistance."],["Conservation of mass","Atoms are rearranged in a reaction, never created or destroyed."],["Mole","6.022×10²³ particles of a substance."],["Variable","A name that stores a value in a program."],["Loop","A structure that repeats steps."],["Milestone","A small, testable goal inside a bigger project."],["Overfitting","A model that memorises training data and fails on new data."],["Compound interest","Interest earned on the principal and on earlier interest."],["Allele","One version of a gene; dominant (A) or recessive (a)."]];
export const COMPTopics: Array<[string, string, { t: string; o: string[]; a: number; e: string }]> = [["Coding basics","A variable stores a value, and a program runs its steps in order.",{"t":"A variable is used to…","o":["Store a value","Draw a picture","Switch off the PC"],"a":0,"e":"Variables give names to stored values."}],["AI basics","A model learns patterns from training data, then is tested on new data.",{"t":"Why test on new data?","o":["To check it generalises","To make it bigger","To delete data"],"a":0,"e":"Good results on unseen data show real learning."}],["Financial literacy","Compound interest earns interest on the interest already added.",{"t":"Interest on interest is","o":["Simple interest","Compound interest","A tax"],"a":1,"e":"That is how savings grow faster over time."}],["Entrepreneurship","Start with a real customer problem, then design the product.",{"t":"What comes first?","o":["A customer problem","A logo","A loan"],"a":0,"e":"Products solve problems."}],["Communication","Make one main point, then support it with evidence.",{"t":"A clear talk has…","o":["One main point","Ten unrelated points","No structure"],"a":0,"e":"Focus helps listeners remember."}],["Spanish basics","“Hola” means hello and “gracias” means thank you.",{"t":"“Gracias” means","o":["Goodbye","Thank you","Please"],"a":1,"e":"Gracias = thanks."}]];
export const CBSE11_PHYSICS_OUTLINE: Array<[string, string[]]> = [["Part I",["Units and Measurements","Motion in a Straight Line","Motion in a Plane","Laws of Motion","Work, Energy and Power","System of Particles and Rotational Motion","Gravitation"]],["Part II",["Mechanical Properties of Solids","Mechanical Properties of Fluids","Thermal Properties of Matter","Thermodynamics","Kinetic Theory","Oscillations","Waves"]]];

export const CODING_EXERCISES: Array<{
  id: string; title: string; starter: string; tests: Array<[unknown[], unknown]>; lang?: string;
}> = [{"id":"is_even","title":"Even or odd","starter":"def is_even(n):\n    # return True if n is even\n    pass","tests":[[[4],true],[[7],false],[[0],true]],"lang":"py"},{"id":"sum_list","title":"Sum a list","starter":"def sum_list(nums):\n    # return the sum of the numbers\n    pass","tests":[[[[1,2,3]],6],[[[]],0]],"lang":"py"},{"id":"reverse_text","title":"Reverse text","starter":"def reverse_text(s):\n    # return s reversed\n    pass","tests":[[["abc"],"cba"],[[""],""]],"lang":"py"},{"id":"count_vowels","title":"Count vowels","starter":"def count_vowels(text):\n    # count a, e, i, o, u (any case)\n    pass","tests":[[["Lumio"],3],[["rhythm"],0],[["AEIOU"],5]],"lang":"py"},{"id":"factorial","title":"Factorial","starter":"def factorial(n):\n    # return n! (0! is 1)\n    pass","tests":[[[0],1],[[5],120],[[3],6]],"lang":"py"},{"id":"average","title":"Debug: average","starter":"def average(nums):\n    # BUG: this should return the average of the numbers\n    total = 0\n    for i in range(len(nums) + 1):\n        total += nums[i]\n    return total / len(nums)","tests":[[[[2,4,6]],4],[[[10]],10]],"lang":"py"},{"id":"max_of","title":"Debug: largest number","starter":"def max_of(nums):\n    # BUG: fails for some lists\n    best = 0\n    for x in nums:\n        if x > best:\n            best = x\n    return best","tests":[[[[3,9,2]],9],[[[-5,-2,-9]],-2]],"lang":"py"},{"id":"total_even","title":"Debug: sum of evens","starter":"def total_even(nums):\n    # BUG: should add only the even numbers\n    total = 0\n    for n in nums:\n        total += n\n    return total","tests":[[[[1,2,3,4]],6],[[[7]],0],[[[]],0]],"lang":"py"}];

export const BANDS: Record<Band, BandDef> = {
  young: {
    name: "Nursery – Class 5",
    nav: ["home","study","games","ach"],
    tools: ["Short 2-minute activities","Picture-led lessons","Read-aloud instructions (planned)"],
    subjects: ["English","Maths","EVS","Hindi"],
    dailyGoal: 1,
    chapters: [
  {
    "title": "Counting to 20",
    "subject": "Maths",
    "summary": "Count objects one by one. Each new number is one more than the last.",
    "questions": [
      {
        "text": "What comes after 9?",
        "options": [
          "8",
          "10",
          "11"
        ],
        "answer": 1,
        "explanation": "10 is one more than 9."
      },
      {
        "text": "3 apples + 2 apples = ?",
        "options": [
          "4",
          "5",
          "6"
        ],
        "answer": 1,
        "explanation": "3 + 2 = 5."
      }
    ]
  },
  {
    "title": "Shapes around us",
    "subject": "Maths",
    "summary": "A circle is round, a square has 4 equal sides, a triangle has 3 sides.",
    "questions": [
      {
        "text": "How many sides does a triangle have?",
        "options": [
          "2",
          "3",
          "4"
        ],
        "answer": 1,
        "explanation": "Tri means three."
      },
      {
        "text": "Which shape has 4 equal sides?",
        "options": [
          "Circle",
          "Square",
          "Triangle"
        ],
        "answer": 1,
        "explanation": "A square has 4 equal sides."
      }
    ]
  },
  {
    "title": "What plants need",
    "subject": "EVS",
    "summary": "Plants need sunlight, water and air to grow. Roots take in water.",
    "questions": [
      {
        "text": "What do plants need to grow?",
        "options": [
          "Sunlight and water",
          "Only toys",
          "Only sand"
        ],
        "answer": 0,
        "explanation": "Plants make food using light and water."
      },
      {
        "text": "Which part takes in water?",
        "options": [
          "Root",
          "Flower",
          "Leaf"
        ],
        "answer": 0,
        "explanation": "Roots absorb water from soil."
      }
    ]
  }
],
  },
  middle: {
    name: "Classes 6 – 8",
    nav: ["home","study","games","progress","ach","board"],
    tools: ["Guided learning paths","Games and the Pendulum Lab","Virtual lab experiments"],
    subjects: ["Maths","Science","English","Social Science"],
    dailyGoal: 2,
    chapters: [
  {
    "title": "Fractions",
    "subject": "Maths",
    "summary": "A fraction shows parts of a whole: numerator over denominator.",
    "questions": [
      {
        "text": "1/2 + 1/2 = ?",
        "options": [
          "1/4",
          "1",
          "2"
        ],
        "answer": 1,
        "explanation": "Two halves make one whole."
      },
      {
        "text": "Which is larger?",
        "options": [
          "3/4",
          "1/4",
          "Equal"
        ],
        "answer": 0,
        "explanation": "3 parts out of 4 is more than 1 part."
      }
    ]
  },
  {
    "title": "Force and motion",
    "subject": "Science",
    "summary": "A force is a push or a pull. It can change an object's speed or direction.",
    "questions": [
      {
        "text": "A force can change an object's…",
        "options": [
          "Colour",
          "Motion",
          "Name"
        ],
        "answer": 1,
        "explanation": "Forces change motion."
      },
      {
        "text": "Friction…",
        "options": [
          "Helps motion along",
          "Opposes motion",
          "Is upward only"
        ],
        "answer": 1,
        "explanation": "Friction opposes relative motion."
      }
    ]
  },
  {
    "title": "Photosynthesis",
    "subject": "Science",
    "summary": "Plants make glucose from carbon dioxide and water using light.",
    "questions": [
      {
        "text": "Gas absorbed in photosynthesis",
        "options": [
          "Oxygen",
          "Carbon dioxide",
          "Nitrogen"
        ],
        "answer": 1,
        "explanation": "CO₂ is the raw material."
      },
      {
        "text": "Main site",
        "options": [
          "Root",
          "Leaf",
          "Bark"
        ],
        "answer": 1,
        "explanation": "Leaves hold chloroplasts."
      }
    ]
  }
],
  },
  sec: {
    name: "Classes 9 – 10",
    nav: ["home","study","games","progress","ach","board"],
    tools: ["Subject mastery tracking","Revision sessions and mock tests","Projectile and chemistry simulations"],
    subjects: ["Mathematics","Science","English","Social Science"],
    dailyGoal: 2,
    chapters: [
  {
    "title": "Quadratic equations",
    "subject": "Mathematics",
    "summary": "ax\u00b2+bx+c=0 has roots x=(−b±√D)/2a where D=b\u00b2−4ac. D decides the root type.",
    "questions": [
      {
        "text": "If D < 0 the roots are",
        "options": [
          "Real and equal",
          "Real and distinct",
          "Not real"
        ],
        "answer": 2,
        "explanation": "Negative D gives no real roots."
      },
      {
        "text": "Roots of x\u00b2−5x+6=0",
        "options": [
          "2 and 3",
          "1 and 6",
          "−2 and −3"
        ],
        "answer": 0,
        "explanation": "(x−2)(x−3)=0."
      }
    ]
  },
  {
    "title": "Chemical reactions",
    "subject": "Science",
    "summary": "Balanced equations keep the number of each atom the same: mass is conserved.",
    "questions": [
      {
        "text": "Balancing follows the law of",
        "options": [
          "Conservation of mass",
          "Gravitation",
          "Reflection"
        ],
        "answer": 0,
        "explanation": "Atoms are not created or destroyed."
      },
      {
        "text": "Rusting is a",
        "options": [
          "Physical change",
          "Chemical change",
          "Nuclear change"
        ],
        "answer": 1,
        "explanation": "Iron forms a new substance."
      }
    ]
  },
  {
    "title": "Electricity",
    "subject": "Science",
    "summary": "Ohm's law: V = IR. Series circuits share current; parallel ones share voltage.",
    "questions": [
      {
        "text": "SI unit of resistance",
        "options": [
          "Ohm",
          "Volt",
          "Ampere"
        ],
        "answer": 0,
        "explanation": "Named after Georg Ohm."
      },
      {
        "text": "V = 12 V, R = 4 Ω. I = ?",
        "options": [
          "3 A",
          "48 A",
          "0.3 A"
        ],
        "answer": 0,
        "explanation": "I = V/R = 3 A."
      }
    ]
  }
],
  },
  senior: {
    name: "Classes 11 – 12",
    nav: ["home","study","games","progress","ach","board"],
    tools: ["Coding, AI and web labs","Spaceship and projectile simulations","Competitive-exam tools (planned)"],
    subjects: ["Physics","Chemistry","Mathematics","Computer Science"],
    dailyGoal: 2,
    chapters: [
  {
    "title": "Kinematics",
    "subject": "Physics",
    "summary": "For constant acceleration: v=u+at, s=ut+\u00bdat\u00b2, v\u00b2=u\u00b2+2as.",
    "questions": [
      {
        "text": "u=0, a=2 m/s\u00b2, t=3 s. v = ?",
        "options": [
          "3 m/s",
          "6 m/s",
          "9 m/s"
        ],
        "answer": 1,
        "explanation": "v = 0 + 2×3 = 6."
      },
      {
        "text": "Area under a v\u2013t graph gives",
        "options": [
          "Acceleration",
          "Displacement",
          "Force"
        ],
        "answer": 1,
        "explanation": "∫v dt is displacement."
      }
    ]
  },
  {
    "title": "Newton's laws",
    "subject": "Physics",
    "summary": "F = ma. Action\u2013reaction pairs act on different bodies.",
    "questions": [
      {
        "text": "5 kg, net force 20 N. a = ?",
        "options": [
          "4 m/s\u00b2",
          "100 m/s\u00b2",
          "0.25 m/s\u00b2"
        ],
        "answer": 0,
        "explanation": "a = F/m."
      },
      {
        "text": "Action and reaction act on",
        "options": [
          "The same body",
          "Different bodies",
          "Neither"
        ],
        "answer": 1,
        "explanation": "So they never cancel each other."
      }
    ]
  },
  {
    "title": "Work and energy",
    "subject": "Physics",
    "summary": "W = Fd cosθ, KE = \u00bdmv\u00b2. Net work equals the change in KE.",
    "questions": [
      {
        "text": "KE of 2 kg at 3 m/s",
        "options": [
          "9 J",
          "6 J",
          "18 J"
        ],
        "answer": 0,
        "explanation": "\u00bd×2×9 = 9 J."
      },
      {
        "text": "Work by a force ⟂ displacement",
        "options": [
          "Maximum",
          "Zero",
          "Negative"
        ],
        "answer": 1,
        "explanation": "cos 90° = 0."
      }
    ]
  },
  {
    "title": "Units and measurements",
    "subject": "Physics (Lumio-written practice, not official)",
    "summary": "A physical quantity is something we can measure, and a measurement is a number together with a unit. The SI system has seven base quantities: length (metre), mass (kilogram), time (second), electric current (ampere), temperature (kelvin), amount of substance (mole) and luminous intensity (candela). Every other unit is derived from these, so force is kg m s⁻\u00b2 (the newton). The dimensions of a quantity show how it depends on the base quantities, for example work and energy have dimensions [M L\u00b2 T⁻\u00b2]. A dimensional check can show that an equation is wrong, but it cannot prove an equation is right, because pure numbers and constants like \u00bd have no dimensions. Only quantities with the same dimensions can be added or subtracted. Significant figures show how precise a measurement is: non-zero digits always count, zeros between digits count, leading zeros do not, and trailing zeros after a decimal point do. Percentage error is (absolute error ÷ measured value) × 100. A common mistake is to treat dimensional agreement as proof that a formula is correct.",
    "questions": [
      {
        "text": "Base-unit form of the newton (SI unit of force)",
        "options": [
          "kg m s⁻\u00b2",
          "kg m\u00b2 s⁻\u00b2",
          "kg m s⁻¹"
        ],
        "answer": 0,
        "explanation": "F = ma, so the unit is kg × m/s\u00b2."
      },
      {
        "text": "Dimensions of work and energy",
        "options": [
          "[M L T⁻\u00b2]",
          "[M L\u00b2 T⁻\u00b2]",
          "[M L\u00b2 T⁻¹]"
        ],
        "answer": 1,
        "explanation": "Work = force × distance = [M L T⁻\u00b2] × [L]."
      },
      {
        "text": "Significant figures in 0.00450",
        "options": [
          "2",
          "3",
          "5"
        ],
        "answer": 1,
        "explanation": "Leading zeros do not count. The 4, 5 and the trailing 0 after the decimal point do."
      },
      {
        "text": "Which quantity has the same dimensions as work?",
        "options": [
          "Torque",
          "Power",
          "Momentum"
        ],
        "answer": 0,
        "explanation": "Torque = force × distance, so it is [M L\u00b2 T⁻\u00b2]. Power is that divided by time."
      },
      {
        "text": "L = 12.0 cm with an absolute error of 0.1 cm. Percentage error ≈",
        "options": [
          "0.83%",
          "1.2%",
          "0.1%"
        ],
        "answer": 0,
        "explanation": "0.1 ÷ 12.0 × 100 ≈ 0.83%."
      },
      {
        "text": "A dimensional check on a formula can show it is…",
        "options": [
          "Definitely correct",
          "Possibly correct but not proven",
          "Always wrong"
        ],
        "answer": 1,
        "explanation": "It only tests dimensions. Numerical factors and missing terms go unnoticed."
      }
    ]
  },
  {
    "title": "Motion in a straight line",
    "subject": "Physics (Lumio-written practice, not official)",
    "summary": "Distance is the total path length and is never negative, while displacement is the change in position and can be positive, negative or zero. Average velocity is displacement divided by time, and average speed is distance divided by time. Acceleration is the rate of change of velocity. For constant acceleration along a straight line: v = u + at, s = ut + \u00bdat\u00b2 and v\u00b2 = u\u00b2 + 2as, where u is the initial velocity, v the final velocity and s the displacement. The slope of a position\u2013time graph gives velocity, the slope of a velocity\u2013time graph gives acceleration, and the area under a velocity\u2013time graph gives displacement. A body dropped near the Earth's surface falls with acceleration g, about 9.8 m/s\u00b2 downward, if air resistance is ignored. A common mistake is to use the constant-acceleration equations when the acceleration is changing, or to forget the sign of a quantity when it points in the negative direction.",
    "questions": [
      {
        "text": "A body moves 5 m forward then 2 m back along a line. Displacement and distance are",
        "options": [
          "3 m and 7 m",
          "7 m and 3 m",
          "3 m and 3 m"
        ],
        "answer": 0,
        "explanation": "Displacement = 5 − 2 = 3 m. Distance = 5 + 2 = 7 m."
      },
      {
        "text": "u = 10 m/s, a = −2 m/s\u00b2, t = 3 s. v = ?",
        "options": [
          "16 m/s",
          "4 m/s",
          "−4 m/s"
        ],
        "answer": 1,
        "explanation": "v = 10 + (−2)(3) = 4 m/s."
      },
      {
        "text": "u = 0, a = 4 m/s\u00b2, t = 3 s. s = ?",
        "options": [
          "12 m",
          "18 m",
          "36 m"
        ],
        "answer": 1,
        "explanation": "s = \u00bd × 4 × 3\u00b2 = 18 m."
      },
      {
        "text": "u = 0 and v = 20 m/s over s = 50 m. a = ?",
        "options": [
          "4 m/s\u00b2",
          "8 m/s\u00b2",
          "0.25 m/s\u00b2"
        ],
        "answer": 0,
        "explanation": "a = v\u00b2 ÷ 2s = 400 ÷ 100 = 4 m/s\u00b2."
      },
      {
        "text": "The slope of a position\u2013time graph gives",
        "options": [
          "Acceleration",
          "Velocity",
          "Displacement"
        ],
        "answer": 1,
        "explanation": "Slope = change in position ÷ change in time = velocity."
      },
      {
        "text": "Dropped from rest (take g = 10 m/s\u00b2, no air resistance). Speed after 3 s = ?",
        "options": [
          "30 m/s",
          "15 m/s",
          "90 m/s"
        ],
        "answer": 0,
        "explanation": "v = gt = 10 × 3 = 30 m/s."
      }
    ]
  },
  {
    "title": "Gravitation",
    "subject": "Physics (Lumio-written practice, not official)",
    "summary": "Newton's law of gravitation says every two masses attract each other with a force F = Gm₁m₂/r\u00b2, where r is the distance between their centres and G is the gravitational constant. The force is always attractive and falls with the square of the distance. Near a planet of mass M and radius R, the acceleration due to gravity is g = GM/R\u00b2. Gravitational potential energy is U = −GMm/r, which is negative and tends to zero at infinite distance. Escape speed from the surface is √(2GM/R), which is √2 times the orbital speed just above the surface. Kepler's third law states that the square of a planet's orbital period is proportional to the cube of the semi-major axis of its orbit. Astronauts in orbit feel weightless because they and the spacecraft are both in free fall, not because gravity has vanished. A common mistake is to measure r from the surface instead of from the centre of the planet.",
    "questions": [
      {
        "text": "If the distance between two masses doubles, the gravitational force becomes",
        "options": [
          "Half",
          "One quarter",
          "Double"
        ],
        "answer": 1,
        "explanation": "F ∝ 1/r\u00b2, so doubling r divides F by 4."
      },
      {
        "text": "A planet has the same mass as Earth but twice the radius. Its surface g is",
        "options": [
          "g/2",
          "g/4",
          "2g"
        ],
        "answer": 1,
        "explanation": "g = GM/R\u00b2, so doubling R divides g by 4."
      },
      {
        "text": "Escape speed compared with orbital speed just above the surface",
        "options": [
          "√2 times larger",
          "Twice as large",
          "Equal"
        ],
        "answer": 0,
        "explanation": "v_escape = √2 × v_orbit."
      },
      {
        "text": "An orbit's radius becomes 4 times larger. The period becomes",
        "options": [
          "4 times",
          "8 times",
          "16 times"
        ],
        "answer": 1,
        "explanation": "T\u00b2 ∝ r³, so T ∝ r^(3/2) = 4^(3/2) = 8."
      },
      {
        "text": "Astronauts in orbit feel weightless because",
        "options": [
          "Gravity is zero there",
          "They and the spacecraft are in free fall",
          "They are outside Earth's gravitational field"
        ],
        "answer": 1,
        "explanation": "Gravity at that height is still strong, about 90% of its surface value for a low orbit."
      },
      {
        "text": "As r → ∞ the gravitational potential energy U = −GMm/r tends to",
        "options": [
          "0",
          "−∞",
          "+∞"
        ],
        "answer": 0,
        "explanation": "The magnitude GMm/r shrinks towards zero."
      }
    ]
  },
  {
    "title": "Oscillations",
    "subject": "Physics (Lumio-written practice, not official)",
    "summary": "An oscillation repeats its motion about a mean position. In simple harmonic motion (SHM) the restoring force is proportional to the displacement and points towards the mean position, so x = A cos(ωt + φ), where A is the amplitude and ω = 2π/T is the angular frequency. The speed is greatest at the mean position, where it equals Aω, and zero at the extremes. The acceleration is greatest at the extremes, where it equals Aω\u00b2, and zero at the mean position. A mass m on a spring of constant k has T = 2π√(m/k). A simple pendulum of length L swinging through small angles has T = 2π√(L/g), which does not depend on the mass. The total energy of SHM is \u00bdkA\u00b2 and stays constant while it swaps between kinetic and potential energy. A common mistake is to say the speed is greatest at the extremes: it is zero there.",
    "questions": [
      {
        "text": "A 1 kg mass on a spring with k = 100 N/m. Its time period is about",
        "options": [
          "0.63 s",
          "6.3 s",
          "0.1 s"
        ],
        "answer": 0,
        "explanation": "T = 2π√(m/k) = 2π√(1/100) = 2π × 0.1 ≈ 0.63 s."
      },
      {
        "text": "The length of a simple pendulum is made four times longer. Its time period becomes",
        "options": [
          "Half",
          "Double",
          "Four times"
        ],
        "answer": 1,
        "explanation": "T is proportional to √L, and √4 = 2."
      },
      {
        "text": "In SHM the magnitude of the acceleration is greatest at",
        "options": [
          "The mean position",
          "The extreme positions",
          "Halfway between them"
        ],
        "answer": 1,
        "explanation": "a = −ω\u00b2x, so it is largest where the displacement is largest."
      },
      {
        "text": "A = 0.05 m and ω = 10 rad/s. The maximum speed is",
        "options": [
          "0.5 m/s",
          "5 m/s",
          "0.005 m/s"
        ],
        "answer": 0,
        "explanation": "v max = Aω = 0.05 × 10 = 0.5 m/s."
      }
    ]
  },
  {
    "title": "Thermal properties of matter",
    "subject": "Physics (Lumio-written practice, not official)",
    "summary": "Temperature tells how hot something is, while heat is energy that flows because of a temperature difference. A change of 1 °C equals a change of 1 K. The heat needed to change the temperature of a mass m is Q = mcΔT, where c is the specific heat capacity. Water has a high specific heat capacity, about 4200 J/(kg·K), which is why it heats and cools slowly. During a change of state, such as melting or boiling, the temperature stays constant and the heat supplied (latent heat, Q = mL) changes how the particles are arranged instead. Heat travels by conduction in solids, by convection in fluids and by radiation through empty space. A rod of length L heated by ΔT expands by ΔL = αLΔT, where α is the coefficient of linear expansion. A common mistake is to confuse heat with temperature: a large cup of warm water holds more heat than a spark that is much hotter.",
    "questions": [
      {
        "text": "How much heat raises 2 kg of water by 10 °C? (c = 4200 J/(kg·K))",
        "options": [
          "84 000 J",
          "8400 J",
          "840 000 J"
        ],
        "answer": 0,
        "explanation": "Q = mcΔT = 2 × 4200 × 10 = 84 000 J."
      },
      {
        "text": "A temperature rise of 20 °C is the same as a rise of",
        "options": [
          "20 K",
          "293 K",
          "253 K"
        ],
        "answer": 0,
        "explanation": "The size of one degree is the same on both scales, so the change is 20 K."
      },
      {
        "text": "While ice melts at 0 °C, the heat supplied goes into",
        "options": [
          "Raising the temperature",
          "Changing the state (latent heat)",
          "Nothing at all"
        ],
        "answer": 1,
        "explanation": "The temperature stays constant during a change of state."
      },
      {
        "text": "A 2 m rod has α = 1.2 × 10⁻⁵ per K and is heated by 50 K. Its length increases by",
        "options": [
          "1.2 mm",
          "12 mm",
          "0.12 mm"
        ],
        "answer": 0,
        "explanation": "ΔL = αLΔT = 1.2 × 10⁻⁵ × 2 × 50 = 1.2 × 10⁻³ m = 1.2 mm."
      }
    ]
  },
  {
    "title": "Python: functions and loops",
    "subject": "Computer Science / Python (Lumio-written practice, not official)",
    "summary": "A function is a named block of code that you define with the keyword def and call by name. It can take parameters and send a value back with return, so def double(x): return x * 2 gives double(4) equal to 8. A for loop repeats code for each item in a sequence, and range(n) produces the numbers 0 up to n − 1. A while loop repeats as long as its condition stays true, so it needs something inside that eventually makes the condition false. The operator // gives the whole-number part of a division and % gives the remainder, so 10 // 3 is 3 and 10 % 3 is 1. The built-in len() returns how many items a string or list holds. Indentation is part of Python's syntax and shows which lines belong inside a function or loop. A common mistake is forgetting that range stops before its end value, or printing a value inside a function when the task asks you to return it. Practise these ideas in Practice & Games, then Coding Lab.",
    "questions": [
      {
        "text": "range(4) produces",
        "options": [
          "1, 2, 3, 4",
          "0, 1, 2, 3",
          "0, 1, 2, 3, 4"
        ],
        "answer": 1,
        "explanation": "range starts at 0 and stops before 4."
      },
      {
        "text": "def f(x): return x * 2. What is f(3) + f(1)?",
        "options": [
          "8",
          "7",
          "62"
        ],
        "answer": 0,
        "explanation": "f(3) = 6 and f(1) = 2, so the sum is 8."
      },
      {
        "text": "len(\"Lumio\") returns",
        "options": [
          "4",
          "5",
          "6"
        ],
        "answer": 1,
        "explanation": "The string has five characters."
      },
      {
        "text": "print(10 // 3) shows",
        "options": [
          "3",
          "3.33",
          "4"
        ],
        "answer": 0,
        "explanation": "// is floor division, so the result is the whole-number part."
      },
      {
        "text": "10 % 3 equals",
        "options": [
          "3",
          "1",
          "0"
        ],
        "answer": 1,
        "explanation": "10 = 3 × 3 + 1, so the remainder is 1."
      },
      {
        "text": "Which keyword starts a function definition?",
        "options": [
          "func",
          "def",
          "function"
        ],
        "answer": 1,
        "explanation": "Python uses def."
      }
    ]
  }
],
  },
  dropper: {
    name: "Dropper / exam repeater",
    nav: ["home","study","games","progress","ach","board"],
    tools: ["Exam countdown and weak-topic focus","Mock tests with review of missed questions","Revision sessions"],
    subjects: ["Physics","Chemistry","Mathematics","Biology"],
    dailyGoal: 3,
    chapters: [
  {
    "title": "Rotational motion",
    "subject": "Physics",
    "summary": "τ = Iα and L = Iω. L is conserved when net torque is zero.",
    "questions": [
      {
        "text": "L is conserved when net ___ is zero",
        "options": [
          "Force",
          "Torque",
          "Energy"
        ],
        "answer": 1,
        "explanation": "Net external torque."
      },
      {
        "text": "I=2, α=3. τ = ?",
        "options": [
          "6",
          "5",
          "1.5"
        ],
        "answer": 0,
        "explanation": "τ = Iα."
      }
    ]
  },
  {
    "title": "Mole concept",
    "subject": "Chemistry",
    "summary": "n = mass / molar mass. One mole has 6.022×10\u00b2³ particles.",
    "questions": [
      {
        "text": "Moles in 36 g of water (M=18)",
        "options": [
          "1",
          "2",
          "0.5"
        ],
        "answer": 1,
        "explanation": "36/18 = 2."
      },
      {
        "text": "Avogadro's number",
        "options": [
          "6.022×10\u00b2³",
          "6.022×10³\u00b2",
          "3×10⁸"
        ],
        "answer": 0,
        "explanation": "Particles per mole."
      }
    ]
  },
  {
    "title": "Mock-test review",
    "subject": "Strategy",
    "summary": "Sort errors into concept, calculation and careless. Fix concept gaps first.",
    "questions": [
      {
        "text": "Which error needs concept revision first?",
        "options": [
          "A sign slip",
          "Not knowing the formula",
          "Misreading a unit"
        ],
        "answer": 1,
        "explanation": "A knowledge gap repeats."
      },
      {
        "text": "Best use of a mock test",
        "options": [
          "Only note the score",
          "Analyse each wrong answer",
          "Retake at once"
        ],
        "answer": 1,
        "explanation": "Errors are the data."
      }
    ]
  }
],
  },
  above: {
    name: "Above Class 12",
    nav: ["home","study","games","progress","ach","board"],
    tools: ["Professional learning paths","Coding, AI and web labs","Custom goals (planned)"],
    subjects: ["Python","Data","Web","Career skills"],
    dailyGoal: 2,
    chapters: [
  {
    "title": "Python variables",
    "subject": "Python",
    "summary": "A variable names a value: x = 5. Common types: int, float, str.",
    "questions": [
      {
        "text": "Type of 3.5",
        "options": [
          "int",
          "float",
          "str"
        ],
        "answer": 1,
        "explanation": "Decimals are floats."
      },
      {
        "text": "x=2; x=x+3. x = ?",
        "options": [
          "2",
          "5",
          "23"
        ],
        "answer": 1,
        "explanation": "x becomes 5."
      }
    ]
  },
  {
    "title": "Loops",
    "subject": "Python",
    "summary": "for i in range(n) repeats n times, starting from 0.",
    "questions": [
      {
        "text": "range(3) yields",
        "options": [
          "1,2,3",
          "0,1,2",
          "0,1,2,3"
        ],
        "answer": 1,
        "explanation": "Starts at 0, stops before 3."
      },
      {
        "text": "Repeats while a condition is true",
        "options": [
          "while",
          "if",
          "def"
        ],
        "answer": 0,
        "explanation": "while loops test each time."
      }
    ]
  },
  {
    "title": "Project planning",
    "subject": "Career skills",
    "summary": "Break a project into small milestones, each with a testable outcome.",
    "questions": [
      {
        "text": "Good first step",
        "options": [
          "Write all the code",
          "Define a small testable milestone",
          "Skip testing"
        ],
        "answer": 1,
        "explanation": "Small, testable steps."
      },
      {
        "text": "A milestone should be",
        "options": [
          "Vague",
          "Testable",
          "Huge"
        ],
        "answer": 1,
        "explanation": "So you know when it is done."
      }
    ]
  }
],
  },
};

/** Achievement catalogue (ported from prototype ACH; unlock rules are re-implemented in domain.ts). */
export const ACHIEVEMENTS: Array<{ id: string; description: string; target: number }> = [
  {
    "id": "Quest finisher",
    "description": "Claim any quest",
    "target": 1
  },
  {
    "id": "Weekly champion",
    "description": "Claim a weekly quest",
    "target": 1
  },
  {
    "id": "Monthly master",
    "description": "Claim a monthly quest",
    "target": 1
  },
  {
    "id": "Quest hunter",
    "description": "Claim 10 quests",
    "target": 10
  },
  {
    "id": "Focus starter",
    "description": "Complete one focus block",
    "target": 1
  },
  {
    "id": "Steady focus",
    "description": "Complete 10 focus blocks",
    "target": 10
  },
  {
    "id": "First lesson",
    "description": "Complete any chapter quiz",
    "target": 1
  },
  {
    "id": "First mastery",
    "description": "Score full marks on a chapter",
    "target": 1
  },
  {
    "id": "3-day streak",
    "description": "Learn on 3 days in a row",
    "target": 3
  },
  {
    "id": "7-day streak",
    "description": "Learn on 7 days in a row",
    "target": 7
  },
  {
    "id": "14-day streak",
    "description": "Learn on 14 days in a row",
    "target": 14
  },
  {
    "id": "30-day streak",
    "description": "Learn on 30 days in a row",
    "target": 30
  },
  {
    "id": "60-day streak",
    "description": "Learn on 60 days in a row",
    "target": 60
  },
  {
    "id": "100-day streak",
    "description": "Learn on 100 days in a row",
    "target": 100
  },
  {
    "id": "Path complete",
    "description": "Complete all chapters on your sample path",
    "target": 3
  },
  {
    "id": "Legend",
    "description": "Win a legendary challenge",
    "target": 1
  },
  {
    "id": "Flashcard habit",
    "description": "Review flashcards on a day",
    "target": 1
  },
  {
    "id": "Revision starter",
    "description": "Finish a revision session",
    "target": 1
  },
  {
    "id": "Mock tester",
    "description": "Complete a mock test",
    "target": 1
  },
  {
    "id": "Fix the gaps",
    "description": "Clear a chapter flagged in a mock",
    "target": 1
  },
  {
    "id": "Any-light learner",
    "description": "Finish quizzes in all 3 themes",
    "target": 3
  }
];

/** Official board links: validated by hand against the prototype's shipped list. Link-out only. */
export const OFFICIAL_LINKS = [
  { label: 'CBSE Academic', url: 'https://cbseacademic.nic.in/', note: 'Official CBSE curriculum and academic resources.' },
  { label: 'CISCE Publications', url: 'https://cisce.org/publications.aspx', note: 'Official ICSE / ISC publications list.' },
  { label: 'UPMSP (UP Board)', url: 'https://upmsp.edu.in/', note: 'Official Uttar Pradesh Madhyamik Shiksha Parishad site.' },
  { label: 'NIOS', url: 'https://www.nios.ac.in/', note: 'Official National Institute of Open Schooling site.' },
] as const;
