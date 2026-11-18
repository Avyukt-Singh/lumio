'use client';

import { useState } from 'react';
import { CheckCircle2, FlaskConical, ListOrdered, Play, RotateCcw, XCircle } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Train Classifier (Class 11 AI): an editable bag-of-words multinomial naive
 * Bayes text classifier with Laplace smoothing, a held-out test set, a live
 * playground with class-probability bars, and a data-skew bias demo.
 */

type ClassKey = 'exam' | 'chat';

const CLASS_LABEL: Record<ClassKey, string> = { exam: 'Exam / class note', chat: 'Casual chat' };

const SEED_EXAM: string[] = [
  'Maths test on Friday chapters 4 and 5 bring geometry box',
  'Physics assignment due tomorrow submit the lab report',
  'Revision class after school for the chemistry unit test',
  'Exam syllabus reduced study chapters 1 to 6 only',
  'Bring the practical file tomorrow it will be checked',
  'Unit test marks declared check the notice board',
];

const SEED_CHAT: string[] = [
  'Want to play football after school today',
  'Happy birthday have an awesome day party at my place',
  'Movie night this weekend bring snacks',
  'Loved your new profile picture',
  'Let us meet at the cafe after class for fun',
  'Cricket match in the evening come and cheer',
];

// Bias demo: casual-content examples mislabelled as exam notes. Appended at
// train time only when the skew toggle is on.
const SKEW_EXAM: string[] = [
  'Movie night at my place this weekend',
  'Party at the cafe after class',
  'Great game yesterday come and cheer',
  'Watch the match today for fun',
  'Photos from the birthday party',
  'Football after school today',
  'Movie and snacks this weekend',
  'Cafe fun with friends',
  'Birthday party planning now',
  'Play cricket in the evening',
  'New profile picture loved it',
  'Weekend fun plan come over',
];

const TEST_SET: { text: string; label: ClassKey }[] = [
  { text: 'Chemistry test postponed to next week', label: 'exam' },
  { text: 'Submit your maths homework before the deadline', label: 'exam' },
  { text: 'Biology practical exam on Monday bring lab coat', label: 'exam' },
  { text: 'Revision worksheet shared for the physics test', label: 'exam' },
  { text: 'Let us watch a movie this weekend', label: 'chat' },
  { text: 'Great game yesterday we should play again', label: 'chat' },
  { text: 'Sending you the party photos now', label: 'chat' },
  { text: 'Coffee at the cafe this evening', label: 'chat' },
];

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

interface NBModel {
  priorExam: number;
  prob: Record<string, [number, number]>; // [p(w | exam), p(w | chat)] smoothed
  counts: Record<string, [number, number]>; // raw counts per class
  vocabSize: number;
  totalExam: number;
  totalChat: number;
}

function trainModel(examDocs: string[], chatDocs: string[]): NBModel {
  const vocab = new Set<string>();
  const counts: Record<string, [number, number]> = {};
  let totalExam = 0;
  let totalChat = 0;
  for (const d of examDocs) {
    for (const w of tokenize(d)) {
      if (!counts[w]) counts[w] = [0, 0];
      counts[w][0] += 1;
      totalExam += 1;
      vocab.add(w);
    }
  }
  for (const d of chatDocs) {
    for (const w of tokenize(d)) {
      if (!counts[w]) counts[w] = [0, 0];
      counts[w][1] += 1;
      totalChat += 1;
      vocab.add(w);
    }
  }
  const prob: Record<string, [number, number]> = {};
  for (const w of vocab) {
    const [ce, cc] = counts[w];
    prob[w] = [(ce + 1) / (totalExam + vocab.size), (cc + 1) / (totalChat + vocab.size)];
  }
  return {
    priorExam: examDocs.length / (examDocs.length + chatDocs.length),
    prob,
    counts,
    vocabSize: vocab.size,
    totalExam,
    totalChat,
  };
}

function logScores(m: NBModel, tokens: string[]): [number, number] {
  let sx = Math.log(m.priorExam);
  let sc = Math.log(1 - m.priorExam);
  const unkE = 1 / (m.totalExam + m.vocabSize);
  const unkC = 1 / (m.totalChat + m.vocabSize);
  for (const w of tokens) {
    sx += Math.log(m.prob[w]?.[0] ?? unkE);
    sc += Math.log(m.prob[w]?.[1] ?? unkC);
  }
  return [sx, sc];
}

function probExam(m: NBModel, tokens: string[]): number {
  const [sx, sc] = logScores(m, tokens);
  const mx = Math.max(sx, sc);
  const ex = Math.exp(sx - mx);
  const ec = Math.exp(sc - mx);
  return ex / (ex + ec);
}

function topWords(m: NBModel, cls: ClassKey, n: number): { word: string; weight: number }[] {
  const idx = cls === 'exam' ? 0 : 1;
  const other = cls === 'exam' ? 1 : 0;
  const out: { word: string; weight: number }[] = [];
  for (const [w, counts] of Object.entries(m.counts)) {
    if (counts[idx] === 0) continue;
    const pe = m.prob[w]?.[idx] ?? 1 / (m.totalExam + m.vocabSize);
    const po = m.prob[w]?.[other] ?? 1 / (m.totalChat + m.vocabSize);
    out.push({ word: w, weight: Math.log(pe) - Math.log(po) });
  }
  out.sort((a, b) => b.weight - a.weight);
  return out.slice(0, n);
}

type Tone = 'ok' | 'warn' | 'info';

interface TrainResult {
  acc: number;
  preds: { text: string; label: ClassKey; pred: ClassKey; correct: boolean }[];
}

export function TrainClassifierLab(props: GameProps) {
  const [examText, setExamText] = useState(() => SEED_EXAM.join('\n'));
  const [chatText, setChatText] = useState(() => SEED_CHAT.join('\n'));
  const [biasOn, setBiasOn] = useState(false);
  const [model, setModel] = useState<NBModel | null>(null);
  const [result, setResult] = useState<TrainResult | null>(null);
  const [topExam, setTopExam] = useState<{ word: string; weight: number }[]>([]);
  const [topChat, setTopChat] = useState<{ word: string; weight: number }[]>([]);
  const [playgroundInput, setPlaygroundInput] = useState('');
  const [playground, setPlayground] = useState<{ pExam: number; pred: ClassKey } | null>(null);
  const [report, setReport] = useState<(string | number)[][]>([]);
  const [msg, setMsg] = useState('Edit the examples if you like, then press Train.');
  const [tone, setTone] = useState<Tone>('info');

  const examLines = examText.split('\n').map((s) => s.trim()).filter(Boolean);
  const chatLines = chatText.split('\n').map((s) => s.trim()).filter(Boolean);
  const canTrain = examLines.length >= 3 && chatLines.length >= 3;

  function say(text: string, t: Tone) {
    setMsg(text);
    setTone(t);
  }

  function train() {
    if (!canTrain) {
      say(`Need at least 3 examples per class (currently ${examLines.length} exam / ${chatLines.length} chat).`, 'warn');
      return;
    }
    const effExam = biasOn ? [...examLines, ...SKEW_EXAM] : examLines;
    const m = trainModel(effExam, chatLines);
    const preds = TEST_SET.map((t) => {
      const pe = probExam(m, tokenize(t.text));
      const pred: ClassKey = pe >= 0.5 ? 'exam' : 'chat';
      return { text: t.text, label: t.label, pred, correct: pred === t.label };
    });
    const correct = preds.filter((p) => p.correct).length;
    const acc = correct / preds.length;
    const res: TrainResult = { acc, preds };
    setModel(m);
    setResult(res);
    setTopExam(topWords(m, 'exam', 10));
    setTopChat(topWords(m, 'chat', 10));
    setPlayground(null);
    setReport((r) => [
      ...r,
      [r.length + 1, effExam.length, chatLines.length, biasOn ? 'skewed' : 'balanced', `${(acc * 100).toFixed(0)}%`],
    ]);
    if (!biasOn && acc >= 0.75) {
      props.onWin();
      say(
        `Held-out accuracy ${(acc * 100).toFixed(0)}% (${correct}/${preds.length}) — the classifier generalises. Win!`,
        'ok'
      );
    } else if (biasOn) {
      say(
        `Bias demo: accuracy dropped to ${(acc * 100).toFixed(0)}% and the playground now leans exam note for almost anything. Bad data leads to bad predictions — turn the toggle off and retrain.`,
        'warn'
      );
    } else {
      say(
        `Held-out accuracy ${(acc * 100).toFixed(0)}% — below the 75% target. Add clearer, more distinctive examples and retrain.`,
        'warn'
      );
    }
  }

  function resetLab() {
    setExamText(SEED_EXAM.join('\n'));
    setChatText(SEED_CHAT.join('\n'));
    setBiasOn(false);
    setModel(null);
    setResult(null);
    setTopExam([]);
    setTopChat([]);
    setPlayground(null);
    setReport([]);
    say('Reset: seed examples restored and the skew is cleared.', 'info');
  }

  function runPlayground() {
    if (!model) {
      say('Train the model first, then try the playground.', 'warn');
      return;
    }
    const tokens = tokenize(playgroundInput);
    if (tokens.length === 0) {
      say('Type a sentence to classify.', 'warn');
      return;
    }
    const pe = probExam(model, tokens);
    setPlayground({ pExam: pe, pred: pe >= 0.5 ? 'exam' : 'chat' });
  }

  const maxWeight = Math.max(0.001, ...topExam.map((t) => t.weight), ...topChat.map((t) => t.weight));

  return (
    <GameShell
      title="Train a Text Classifier"
      blurb="Teach a naive Bayes bag-of-words model to tell exam notes from casual chats, check it on a held-out test set, then skew the training data and watch the bias spread."
      modelNote="Naive Bayes bag-of-words only: word order is ignored and images are not supported in this build — text examples only. Weights are Laplace-smoothed word counts, a toy of real text classifiers."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="flex flex-col gap-4">
        <ChapterRef
          subject="Artificial Intelligence"
          chapter="Class 11 AI curriculum"
          topic="Introduction to machine learning, text classification"
        />
        <PredictFirst
          prompt="Before training: which words do you think will tip the model toward exam note rather than casual chat?"
          options={[
            { label: 'Words like test, exam, submit, revision', correct: true },
            { label: 'Longer sentences always mean exam note' },
            { label: 'The model cannot learn word hints at all' },
          ]}
          explain="Naive Bayes scores each word per class. Content words that appear mostly in one class get large log-odds weights; words like the or and appear everywhere and barely matter."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <FlaskConical className="size-4" aria-hidden="true" /> Training data (one example per line)
            </h3>
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>
                Exam / class note examples: <b>{examLines.length}</b> (min 3)
              </span>
              <textarea
                className="min-h-[132px] w-full rounded-xl border border-border bg-card p-2 text-sm"
                value={examText}
                onChange={(e) => setExamText(e.target.value)}
                aria-label="Exam and class note training examples, one per line"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>
                Casual chat examples: <b>{chatLines.length}</b> (min 3)
              </span>
              <textarea
                className="min-h-[132px] w-full rounded-xl border border-border bg-card p-2 text-sm"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                aria-label="Casual chat training examples, one per line"
              />
            </label>
            <label className="flex min-h-[44px] items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={biasOn}
                onChange={(e) => setBiasOn(e.target.checked)}
                className="size-4 accent-amber-600"
                aria-label="Skew the training data with one-sided mislabelled examples"
              />
              Skew the training data (bias demo)
            </label>
            {biasOn && (
              <p className="text-xs text-amber-600">
                Skew active: 12 casual-content examples mislabelled as exam note get appended at train time. The class prior
                and word weights tip toward exam note, so the playground over-predicts it and held-out accuracy visibly
                drops. Bad data in, bad predictions out — resetting clears it.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button className="press min-h-[44px]" onClick={train} disabled={!canTrain}>
                <Play className="size-4" aria-hidden="true" /> Train
              </Button>
              <Button variant="outline" className="press min-h-[44px]" onClick={resetLab}>
                <RotateCcw className="size-4" aria-hidden="true" /> Reset
              </Button>
            </div>
            <p
              role="status"
              aria-live="polite"
              className={cn(
                'text-sm font-semibold',
                tone === 'ok' && 'text-emerald-600',
                tone === 'warn' && 'text-amber-600',
                tone === 'info' && 'text-muted-foreground'
              )}
            >
              {msg}
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <ListOrdered className="size-4" aria-hidden="true" /> Model + held-out test (8 labelled sentences)
            </h3>
            {model ? (
              <>
                <p className="text-sm tabular-nums text-muted-foreground">
                  Prior P(exam) = {model.priorExam.toFixed(2)} · vocabulary = {model.vocabSize} words
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ['Exam note indicators', topExam],
                      ['Casual chat indicators', topChat],
                    ] as const
                  ).map(([title, list]) => (
                    <div key={title} className="rounded-xl border border-border bg-card p-2">
                      <p className="text-xs font-semibold">{title}</p>
                      <div className="mt-1 max-h-44 overflow-y-auto">
                        {list.length === 0 && <p className="text-xs text-muted-foreground">No data.</p>}
                        {list.map((t) => (
                          <p key={t.word} className="flex items-center gap-2 text-xs tabular-nums">
                            <span className="w-16 shrink-0 truncate">{t.word}</span>
                            <span className="h-2 flex-1 rounded bg-primary/15">
                              <span
                                className="block h-full rounded bg-primary"
                                style={{ width: `${Math.max(6, (t.weight / maxWeight) * 100)}%` }}
                              />
                            </span>
                            <span className="w-10 text-right">{t.weight.toFixed(1)}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {result && (
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-sm font-semibold tabular-nums">
                      Held-out accuracy: {(result.acc * 100).toFixed(0)}% ({result.preds.filter((p) => p.correct).length}/{result.preds.length})
                    </p>
                    <div className="mt-2 max-h-56 overflow-y-auto">
                      {result.preds.map((p) => (
                        <p key={p.text} className="flex items-start gap-1.5 py-0.5 text-xs">
                          {p.correct ? (
                            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                          ) : (
                            <XCircle className="mt-0.5 size-3.5 shrink-0 text-rose-500" aria-hidden="true" />
                          )}
                          <span>
                            {p.text} — true: {CLASS_LABEL[p.label]}, predicted: {CLASS_LABEL[p.pred]}
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing trained yet — press Train to fit the model.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background/50 p-4">
          <h3 className="text-sm font-bold">Live playground</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={playgroundInput}
              onChange={(e) => setPlaygroundInput(e.target.value)}
              placeholder="Type any sentence..."
              className="min-h-[44px] min-w-[220px] flex-1 rounded-xl border border-border bg-card px-3 text-sm"
              aria-label="Sentence to classify in the live playground"
            />
            <Button className="press min-h-[44px]" onClick={runPlayground}>
              Classify
            </Button>
          </div>
          {playground && model && (
            <div className="mt-3">
              <p
                role="status"
                aria-live="polite"
                className={cn(
                  'text-sm font-semibold',
                  biasOn ? 'text-amber-600' : 'text-foreground'
                )}
              >
                Prediction: <b>{CLASS_LABEL[playground.pred]}</b> ({(Math.max(playground.pExam, 1 - playground.pExam) * 100).toFixed(0)}%
                confidence)
                {biasOn && ' — skewed by the biased training data, not by the words alone.'}
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                <p className="flex items-center gap-2 text-xs tabular-nums">
                  <span className="w-28 text-muted-foreground">Exam note</span>
                  <span className="h-3 flex-1 rounded bg-primary/15">
                    <span className="block h-full rounded bg-primary" style={{ width: `${playground.pExam * 100}%` }} />
                  </span>
                  <span className="w-12 text-right">{(playground.pExam * 100).toFixed(0)}%</span>
                </p>
                <p className="flex items-center gap-2 text-xs tabular-nums">
                  <span className="w-28 text-muted-foreground">Casual chat</span>
                  <span className="h-3 flex-1 rounded bg-emerald-500/15">
                    <span
                      className="block h-full rounded bg-emerald-500"
                      style={{ width: `${(1 - playground.pExam) * 100}%` }}
                    />
                  </span>
                  <span className="w-12 text-right">{((1 - playground.pExam) * 100).toFixed(0)}%</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <LabReport
          title="Training runs"
          columns={['Run', 'Exam docs', 'Chat docs', 'Data mix', 'Test accuracy']}
          rows={report}
          note="One row per Train press. The skewed runs show what one-sided mislabelled data does to held-out accuracy."
        />
      </div>
    </GameShell>
  );
}
