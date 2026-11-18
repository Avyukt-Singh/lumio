// Syllabus dataset audit (chunk 6 — prompt section 2 evidence, like contrast-audit.mjs).
// Usage: bun scripts/syllabus-audit.mjs   (bun transpiles the TS data module)
// Checks: unique stable ids, titles present, unit marks sum to the CBSE
// theory totals in Appendix A, chapter counts per subject match the appendix,
// and every catalogueName exists in SUBJECT_CATALOGUE.
import { CLASS11_SUBJECTS } from '../src/lib/lumio/syllabus/class11.ts';
import { SUBJECT_CATALOGUE } from '../src/lib/lumio/content.ts';

const EXPECTED = {
  maths: { theoryMarks: 80, ncertChapters: 14, formativeChapters: 1 },
  physics: { theoryMarks: 70, ncertChapters: 14, formativeChapters: 0 },
  chemistry: { theoryMarks: 70, ncertChapters: 9, formativeChapters: 2 },
  cs: { theoryMarks: 70, ncertChapters: 11, formativeChapters: 0 },
  ai: { theoryMarks: 50, ncertChapters: 13, formativeChapters: 0 },
};

let fails = 0;
const fail = (msg) => { fails++; console.log(`FAIL ${msg}`); };
const pass = (msg) => console.log(`PASS ${msg}`);

const idRe = /^(mat|phy|che|cs|ai)\.(c\d{2}|cf\d{2})$/; // chapter
const unitRe = /^(mat|phy|che|cs|ai)\.(u\d{2}|uf|ua|ub)$/; // unit
const topicRe = /^(mat|phy|che|cs|ai)\.[a-z]+\d{2}\.t\d{2}$/; // topic id
const practicalRe = /^(mat|phy|che|cs|ai)\.p\d{2}$/; // practical item id
const seenIds = new Set();

for (const s of CLASS11_SUBJECTS) {
  const exp = EXPECTED[s.id];
  if (!exp) { fail(`subject ${s.id} has no expectation`); continue; }

  // marks
  const sum = s.units.reduce((a, u) => a + (u.marks ?? 0), 0);
  if (sum === exp.theoryMarks) pass(`${s.id}: unit marks sum ${sum} = theory ${exp.theoryMarks}`);
  else fail(`${s.id}: unit marks sum ${sum} != theory ${exp.theoryMarks}`);

  // chapter counts — AI has no NCERT textbook (CBSE handbooks instead), so its
  // 13 units are all counted as "chapters" without a NCERT number.
  const chapters = s.units.flatMap((u) => u.chapters);
  const ncert = s.id === 'ai' ? chapters.length : chapters.filter((c) => c.ncertNo != null).length;
  const cbseOnly = s.id === 'ai' ? 0 : chapters.filter((c) => c.ncertNo == null).length;
  if (ncert === exp.ncertChapters) pass(`${s.id}: ${ncert} NCERT chapters`);
  else fail(`${s.id}: ${ncert} NCERT chapters != ${exp.ncertChapters}`);
  if (cbseOnly === exp.formativeChapters) pass(`${s.id}: ${cbseOnly} CBSE-only (formative) chapters`);
  else fail(`${s.id}: ${cbseOnly} CBSE-only chapters != ${exp.formativeChapters}`);

  // catalogue name (planner pairing depends on it)
  if (SUBJECT_CATALOGUE.includes(s.catalogueName)) pass(`${s.id}: catalogueName "${s.catalogueName}" in SUBJECT_CATALOGUE`);
  else fail(`${s.id}: catalogueName "${s.catalogueName}" NOT in SUBJECT_CATALOGUE`);

  // ids + titles
  for (const u of s.units) {
    if (!unitRe.test(u.id)) fail(`unit id "${u.id}" not stable format`);
    if (seenIds.has(u.id)) fail(`duplicate unit id ${u.id}`);
    seenIds.add(u.id);
    for (const c of u.chapters) {
      if (!idRe.test(c.id)) fail(`chapter id "${c.id}" not stable format`);
      if (!c.title || c.title.length < 2) fail(`chapter ${c.id} missing title`);
      if (seenIds.has(c.id)) fail(`duplicate chapter id ${c.id}`);
      seenIds.add(c.id);
      if (c.topics.length === 0 && !c.note) fail(`chapter ${c.id} has no topics and no honest note`);
      for (const t of c.topics) {
        if (!topicRe.test(t.id)) fail(`topic id "${t.id}" not stable format`);
        if (!t.title || t.title.length < 2) fail(`topic ${t.id} missing title`);
        if (seenIds.has(t.id)) fail(`duplicate topic id ${t.id}`);
        seenIds.add(t.id);
      }
    }
  }
  for (const p of s.practical?.items ?? []) {
    if (!practicalRe.test(p.id)) fail(`practical id "${p.id}" not stable format`);
    if (!p.title || p.title.length < 2) fail(`practical ${p.id} missing title`);
    if (seenIds.has(p.id)) fail(`duplicate practical id ${p.id}`);
    seenIds.add(p.id);
  }

  // topic totals (informational, for the report)
  const topics = s.units.reduce((a, u) => a + u.chapters.reduce((b, c) => b + c.topics.length, 0), 0);
  const practical = s.practical?.items.length ?? 0;
  console.log(`INFO ${s.id} (${s.code}): ${s.units.length} units, ${chapters.length} chapters, ${topics} topics, ${practical} practical items, source "${s.source.label}"`);
}

// marks scheme sanity where a practical exists
for (const s of CLASS11_SUBJECTS) {
  if (s.practical) {
    const sum = s.practical.scheme.reduce((a, x) => a + x.marks, 0);
    const theory = s.id === 'maths' ? 20 : 30; // maths IA 20, others practical 30 (ai practical = 50)
    const expectedPractical = s.id === 'ai' ? 50 : s.id === 'maths' ? 20 : 30;
    void theory;
    if (sum === expectedPractical) pass(`${s.id}: practical scheme sums ${sum}`);
    else fail(`${s.id}: practical scheme sums ${sum} != ${expectedPractical}`);
  }
}

console.log('');
console.log(fails === 0 ? `syllabus-audit: ALL PASS (${seenIds.size} ids checked)` : `syllabus-audit: ${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
