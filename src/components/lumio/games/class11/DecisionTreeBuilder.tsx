'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Flag, GitBranch, ListTree, RotateCcw, Wand2 } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Decision Tree Builder (Class 11 AI): the classic play-outside weather
 * dataset, manual top-down tree building with Gini impurity bars before and
 * after every candidate split, a greedy auto-built tree for comparison, and
 * a training-accuracy win check. Everything is deterministic (no PRNG needed
 * — the dataset is a fixed table), so the numbers never shuffle.
 */

type FeatureKey = 'Weather' | 'Temperature' | 'Humidity' | 'Wind';
type PlayLabel = 'Yes' | 'No';

interface Row {
  f: Record<FeatureKey, string>;
  play: PlayLabel;
}

const FEATURES: { key: FeatureKey; values: string[] }[] = [
  { key: 'Weather', values: ['Sunny', 'Overcast', 'Rain'] },
  { key: 'Temperature', values: ['Hot', 'Mild', 'Cool'] },
  { key: 'Humidity', values: ['High', 'Normal'] },
  { key: 'Wind', values: ['Weak', 'Strong'] },
];

const FEATURE_KEYS = FEATURES.map((f) => f.key);

// Classic 14-row play-outside dataset (fixed table, stable forever).
const RAW: Array<[string, string, string, string, PlayLabel]> = [
  ['Sunny', 'Hot', 'High', 'Weak', 'No'],
  ['Sunny', 'Hot', 'High', 'Strong', 'No'],
  ['Overcast', 'Hot', 'High', 'Weak', 'Yes'],
  ['Rain', 'Mild', 'High', 'Weak', 'Yes'],
  ['Rain', 'Cool', 'Normal', 'Weak', 'Yes'],
  ['Rain', 'Cool', 'Normal', 'Strong', 'No'],
  ['Overcast', 'Cool', 'Normal', 'Strong', 'Yes'],
  ['Sunny', 'Mild', 'High', 'Weak', 'No'],
  ['Sunny', 'Cool', 'Normal', 'Weak', 'Yes'],
  ['Rain', 'Mild', 'Normal', 'Weak', 'Yes'],
  ['Sunny', 'Mild', 'Normal', 'Strong', 'Yes'],
  ['Overcast', 'Mild', 'High', 'Strong', 'Yes'],
  ['Overcast', 'Hot', 'Normal', 'Weak', 'Yes'],
  ['Rain', 'Mild', 'High', 'Strong', 'No'],
];

const DATASET: Row[] = RAW.map(([w, t, h, wd, play]) => ({
  f: { Weather: w, Temperature: t, Humidity: h, Wind: wd },
  play,
}));

function gini(rows: Row[]): number {
  if (rows.length === 0) return 0;
  const yes = rows.filter((r) => r.play === 'Yes').length;
  const p = yes / rows.length;
  const q = 1 - p;
  return 1 - p * p - q * q;
}

function splitBy(rows: Row[], feature: FeatureKey): { value: string; rows: Row[] }[] {
  const out: { value: string; rows: Row[] }[] = [];
  for (const v of FEATURES.find((f) => f.key === feature)?.values ?? []) {
    const part = rows.filter((r) => r.f[feature] === v);
    if (part.length > 0) out.push({ value: v, rows: part });
  }
  return out;
}

function weightedGini(rows: Row[], feature: FeatureKey): number {
  const parts = splitBy(rows, feature);
  let total = 0;
  for (const p of parts) total += (p.rows.length / rows.length) * gini(p.rows);
  return total;
}

function majority(rows: Row[]): { label: PlayLabel; yes: number; no: number; tie: boolean } {
  const yes = rows.filter((r) => r.play === 'Yes').length;
  const no = rows.length - yes;
  // Honest tie-break: equal counts go to Yes and are flagged on the leaf.
  const tie = yes === no;
  return { label: tie ? 'Yes' : yes > no ? 'Yes' : 'No', yes, no, tie };
}

interface TNode {
  id: string;
  rows: Row[];
  depth: number;
  used: FeatureKey[];
  feature: FeatureKey | null;
  branchValue: string;
  children: TNode[] | null;
  accepted: boolean;
  label: PlayLabel | null;
  tie: boolean;
}

function leafNode(id: string, rows: Row[], depth: number, used: FeatureKey[], branchValue: string): TNode {
  return { id, rows, depth, used, feature: null, branchValue, children: null, accepted: false, label: null, tie: false };
}

function mapNode(n: TNode, id: string, fn: (n: TNode) => TNode): TNode {
  if (n.id === id) return fn(n);
  if (!n.children) return n;
  return { ...n, children: n.children.map((c) => mapNode(c, id, fn)) };
}

function collectLeaves(n: TNode): TNode[] {
  if (!n.children) return [n];
  return n.children.flatMap((c) => collectLeaves(c));
}

function findNode(n: TNode, id: string, path = 'Root'): { node: TNode; path: string } | null {
  if (n.id === id) return { node: n, path };
  if (!n.children) return null;
  for (const c of n.children) {
    const step = n.feature ? `${n.feature}=${c.branchValue}` : c.branchValue;
    const nextPath = path === 'Root' ? `Root → ${step}` : `${path} → ${step}`;
    const found = findNode(c, id, nextPath);
    if (found) return found;
  }
  return null;
}

function classify(row: Row, root: TNode): PlayLabel {
  let cur = root;
  while (cur.children && cur.feature) {
    const next = cur.children.find((c) => c.branchValue === row.f[cur.feature as FeatureKey]);
    if (!next) break;
    cur = next;
  }
  if (cur.label) return cur.label;
  return majority(cur.rows).label;
}

function treeAccuracy(rows: Row[], root: TNode): number {
  let correct = 0;
  for (const r of rows) if (classify(r, root) === r.play) correct += 1;
  return correct / rows.length;
}

function autoBuild(rows: Row[], depth: number, used: FeatureKey[], id: string, branchValue: string): TNode {
  const g = gini(rows);
  const maj = majority(rows);
  if (depth >= 3 || used.length >= FEATURE_KEYS.length || g <= 1e-9) {
    return { ...leafNode(id, rows, depth, used, branchValue), accepted: true, label: maj.label, tie: maj.tie };
  }
  let best: { f: FeatureKey; wg: number } | null = null;
  for (const f of FEATURE_KEYS) {
    if (used.includes(f)) continue;
    const wg = weightedGini(rows, f);
    if (!best || wg < best.wg) best = { f, wg };
  }
  if (!best || best.wg >= g - 1e-9) {
    return { ...leafNode(id, rows, depth, used, branchValue), accepted: true, label: maj.label, tie: maj.tie };
  }
  const bestFeature: FeatureKey = best.f;
  const parts = splitBy(rows, bestFeature);
  return {
    id,
    rows,
    depth,
    used,
    feature: bestFeature,
    branchValue,
    accepted: false,
    label: null,
    tie: false,
    children: parts.map((p) => autoBuild(p.rows, depth + 1, [...used, bestFeature], `${id}|${p.value}`, p.value)),
  };
}

// ---- SVG layout -------------------------------------------------------------

interface LaidNode {
  node: TNode;
  x: number;
  y: number;
}
interface LaidEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}

function layoutTree(root: TNode): { nodes: LaidNode[]; edges: LaidEdge[]; width: number; height: number } {
  const leafCount = Math.max(1, collectLeaves(root).length);
  const slotW = Math.max(76, 760 / leafCount);
  const nodes: LaidNode[] = [];
  const edges: LaidEdge[] = [];
  let slot = 0;
  const place = (n: TNode): number => {
    const y = 26 + n.depth * 96;
    if (!n.children || n.children.length === 0) {
      const x = (slot++ + 0.5) * slotW;
      nodes.push({ node: n, x, y });
      return x;
    }
    const kids = n.children.map((c) => ({ cx: place(c), cy: 26 + c.depth * 96 - 21, label: c.branchValue }));
    const x = (Math.min(...kids.map((k) => k.cx)) + Math.max(...kids.map((k) => k.cx))) / 2;
    for (const k of kids) edges.push({ x1: x, y1: y + 23, x2: k.cx, y2: k.cy, label: k.label });
    nodes.push({ node: n, x, y });
    return x;
  };
  place(root);
  const maxDepth = nodes.reduce((m, nd) => Math.max(m, nd.node.depth), 0);
  return { nodes, edges, width: slotW * leafCount, height: 26 + maxDepth * 96 + 48 };
}

function TreeDiagram({
  root,
  selectedId,
  onSelect,
  caption,
}: {
  root: TNode;
  selectedId: string;
  onSelect: (id: string) => void;
  caption: string;
}) {
  const { nodes, edges, width, height } = useMemo(() => layoutTree(root), [root]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={caption}>
      {edges.map((e, i) => (
        <g key={i}>
          <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className="stroke-border" strokeWidth="2" />
          <text x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 4} textAnchor="middle" fontSize="10" className="fill-muted-foreground">
            {e.label}
          </text>
        </g>
      ))}
      {nodes.map(({ node, x, y }) => {
        const isLeaf = !node.children;
        const selected = node.id === selectedId;
        const rect = isLeaf ? { w: 64, h: 40 } : { w: 116, h: 46 };
        const fill = !isLeaf
          ? 'fill-primary/10 stroke-primary'
          : node.accepted && node.label === 'Yes'
            ? 'fill-emerald-500/15 stroke-emerald-500'
            : node.accepted && node.label === 'No'
              ? 'fill-rose-500/10 stroke-rose-400'
              : 'fill-muted stroke-border';
        return (
          <g key={node.id} onClick={() => onSelect(node.id)} className="cursor-pointer">
            <rect
              x={x - rect.w / 2}
              y={y - rect.h / 2}
              width={rect.w}
              height={rect.h}
              rx="10"
              className={fill}
              strokeWidth={selected ? 3.5 : 2}
              strokeDasharray={!node.accepted && isLeaf ? '4 3' : undefined}
            />
            {isLeaf ? (
              <>
                <text x={x} y={y - 2} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-foreground">
                  {node.accepted ? (node.label === 'Yes' ? 'Play' : 'Rest') : '?'}
                </text>
                <text x={x} y={y + 13} textAnchor="middle" fontSize="10" className="fill-muted-foreground">
                  {node.rows.length} rows{node.tie ? ' · tie' : ''}
                </text>
              </>
            ) : (
              <>
                <text x={x} y={y - 2} textAnchor="middle" fontSize="12" fontWeight="700" className="fill-foreground">
                  {node.feature}
                </text>
                <text x={x} y={y + 13} textAnchor="middle" fontSize="10" className="fill-muted-foreground">
                  gini {gini(node.rows).toFixed(2)} · {node.rows.length} rows
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---- Lab --------------------------------------------------------------------

type Tone = 'ok' | 'warn' | 'info';

export function DecisionTreeBuilderLab(props: GameProps) {
  const [tree, setTree] = useState<TNode>(() => leafNode('r', DATASET, 0, [], 'Root'));
  const [selectedId, setSelectedId] = useState('r');
  const [autoTree, setAutoTree] = useState<TNode | null>(null);
  const [report, setReport] = useState<(string | number)[][]>([]);
  const [msg, setMsg] = useState('Click the root leaf, then pick a feature to split on.');
  const [tone, setTone] = useState<Tone>('info');

  const auto = useMemo(() => autoBuild(DATASET, 0, [], 'auto-root', 'Root'), []);
  const autoAcc = useMemo(() => treeAccuracy(DATASET, auto), [auto]);

  const leaves = useMemo(() => collectLeaves(tree), [tree]);
  const complete = leaves.every((l) => l.accepted);
  const myAcc = complete ? treeAccuracy(DATASET, tree) : null;
  const selected = useMemo(() => findNode(tree, selectedId), [tree, selectedId]);
  const sel = selected?.node ?? null;
  const isLeaf = sel !== null && !sel.children;
  const selGini = sel ? gini(sel.rows) : 0;
  const canSplit =
    isLeaf && sel !== null && !sel.accepted && sel.depth < 3 && selGini > 1e-9 && sel.used.length < FEATURE_KEYS.length;
  const candidates = canSplit && sel ? FEATURES.filter((f) => !sel.used.includes(f.key)) : [];

  function say(text: string, t: Tone) {
    setMsg(text);
    setTone(t);
  }

  function splitLeaf(feature: FeatureKey) {
    if (!sel) return;
    const gBefore = gini(sel.rows);
    const wg = weightedGini(sel.rows, feature);
    const pathLabel = selected?.path ?? 'Root';
    setTree((t) =>
      mapNode(t, sel.id, (n) => {
        const parts = splitBy(n.rows, feature);
        return {
          ...n,
          feature,
          used: [...n.used, feature],
          children: parts.map((p) =>
            leafNode(`${n.id}|${p.value}`, p.rows, n.depth + 1, [...n.used, feature], p.value)
          ),
        };
      })
    );
    setReport((r) => [...r, [pathLabel, gBefore.toFixed(3), wg.toFixed(3), sel.rows.length]]);
    say(
      `Split on ${feature}: Gini ${gBefore.toFixed(3)} → ${wg.toFixed(3)} weighted. Click a new leaf to keep going.`,
      'ok'
    );
  }

  function acceptLeaf() {
    if (!sel) return;
    const maj = majority(sel.rows);
    setTree((t) => mapNode(t, sel.id, (n) => ({ ...n, accepted: true, label: maj.label, tie: maj.tie })));
    say(
      maj.tie
        ? `Tie at this leaf (${maj.yes} Yes / ${maj.no} No) — honestly broken to Play and flagged on the tree.`
        : `Leaf accepted: majority label ${maj.label === 'Yes' ? 'Play' : 'Rest'} (${maj.yes} Yes / ${maj.no} No).`,
      'ok'
    );
  }

  function resetTree() {
    setTree(leafNode('r', DATASET, 0, [], 'Root'));
    setSelectedId('r');
    setReport([]);
    setAutoTree(null);
    say('Tree cleared. Start again from the root.', 'info');
  }

  function submitTree() {
    if (!complete) {
      say('Accept every leaf first — an unfinished leaf has no majority label to score.', 'warn');
      return;
    }
    const acc = myAcc ?? 0;
    if (acc >= autoAcc || acc >= 0.93) {
      props.onWin();
      say(
        `Submitted: your tree scores ${(acc * 100).toFixed(0)}% on the 14 training rows (auto tree: ${(autoAcc * 100).toFixed(0)}%). Greedy Gini won this round!`,
        'ok'
      );
    } else {
      say(
        `Submitted: ${(acc * 100).toFixed(0)}% — below the ${(autoAcc * 100).toFixed(0)}% auto tree and the 93% bar. Try splitting where Gini drops the most.`,
        'warn'
      );
    }
  }

  return (
    <GameShell
      title="Decision Tree Builder"
      blurb="Build a decision tree by hand on the classic play-outside weather dataset. Pick splits, watch Gini impurity fall, and race the greedy auto-built tree."
      modelNote="Toy CART-style Gini splits, max depth 3, no pruning or cost-complexity tuning. Ties at a leaf are honestly broken to Yes and flagged."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <div className="flex flex-col gap-4">
        <ChapterRef subject="Artificial Intelligence" chapter="Class 11 AI curriculum" topic="Decision trees, Gini impurity" />
        <PredictFirst
          prompt="Which single feature splits this data best? Commit before you look at the impurity bars."
          options={[
            { label: 'Weather', correct: true },
            { label: 'Temperature' },
            { label: 'Humidity' },
            { label: 'Wind' },
          ]}
          explain="Weather wins: its weighted Gini is about 0.343 because every Overcast day is a play day, so one branch is already pure. That is why the root split is Weather."
        />

        <div className="rounded-2xl border border-border bg-background/50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <ListTree className="size-4" aria-hidden="true" /> Training data (14 days)
          </h3>
          <div className="mt-3 max-h-56 overflow-y-auto">
            <table className="w-full text-sm tabular-nums">
              <caption className="sr-only">Play-outside weather dataset</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  {['Weather', 'Temperature', 'Humidity', 'Wind', 'Plays outside'].map((c) => (
                    <th key={c} scope="col" className="whitespace-nowrap px-2 py-1.5 font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DATASET.map((r, i) => (
                  <tr key={i} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-1.5">{r.f.Weather}</td>
                    <td className="px-2 py-1.5">{r.f.Temperature}</td>
                    <td className="px-2 py-1.5">{r.f.Humidity}</td>
                    <td className="px-2 py-1.5">{r.f.Wind}</td>
                    <td className={cn('px-2 py-1.5 font-semibold', r.play === 'Yes' ? 'text-emerald-600' : 'text-rose-500')}>
                      {r.play}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <GitBranch className="size-4" aria-hidden="true" /> Selected node
            </h3>
            <p className="text-sm text-muted-foreground">
              {sel ? (selected?.path ?? 'Root') : 'Nothing selected'} — {sel ? `${sel.rows.length} rows` : ''}{' '}
              {sel ? `· Gini ${selGini.toFixed(3)}` : ''}
            </p>
            {sel && !isLeaf && (
              <p className="text-sm text-muted-foreground">Already split — click one of its leaf branches below to continue.</p>
            )}
            {isLeaf && sel && sel.accepted && (
              <p className="text-sm text-muted-foreground">
                Accepted leaf: {sel.label === 'Yes' ? 'Play' : 'Rest'}
                {sel.tie ? ' (tie broken to Play)' : ''}. Select another leaf to keep building.
              </p>
            )}
            {isLeaf && sel && !sel.accepted && sel.depth >= 3 && (
              <p className="text-sm text-amber-600">Max depth 3 reached — accept this leaf as-is.</p>
            )}
            {isLeaf && sel && !sel.accepted && sel.depth < 3 && selGini <= 1e-9 && (
              <p className="text-sm text-emerald-600">This leaf is pure (Gini 0) — accept it.</p>
            )}

            {canSplit && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold">Pick a feature to split on (impurity bars):</p>
                {candidates.map((f) => {
                  const wg = weightedGini(sel.rows, f.key);
                  const beforePct = Math.min(100, (selGini / 0.5) * 100);
                  const afterPct = Math.min(100, (wg / 0.5) * 100);
                  return (
                    <button
                      key={f.key}
                      onClick={() => splitLeaf(f.key)}
                      className="press w-full rounded-xl border border-border bg-card p-2 text-left hover:bg-accent/10"
                      aria-label={`Split on ${f.key}: Gini before ${selGini.toFixed(3)}, weighted after ${wg.toFixed(3)}`}
                    >
                      <span className="text-sm font-semibold">{f.key}</span>
                      <span className="mt-1 flex items-center gap-2 text-xs tabular-nums">
                        <span className="w-12 text-muted-foreground">before</span>
                        <span className="h-2.5 flex-1 rounded bg-amber-500/30">
                          <span className="block h-full rounded bg-amber-500" style={{ width: `${beforePct}%` }} />
                        </span>
                        <span className="w-10">{selGini.toFixed(3)}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-xs tabular-nums">
                        <span className="w-12 text-muted-foreground">after</span>
                        <span className="h-2.5 flex-1 rounded bg-emerald-500/25">
                          <span className="block h-full rounded bg-emerald-500" style={{ width: `${afterPct}%` }} />
                        </span>
                        <span className="w-10">{wg.toFixed(3)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {isLeaf && sel && !sel.accepted && (
              <Button className="press min-h-[44px] w-full" onClick={acceptLeaf}>
                <CheckCircle2 className="size-4" aria-hidden="true" /> Accept leaf (majority label)
              </Button>
            )}

            <Button variant="outline" className="press min-h-[44px] w-full" onClick={() => setAutoTree(auto)}>
              <Wand2 className="size-4" aria-hidden="true" /> Auto-build greedy tree
            </Button>
            <Button variant="outline" className="press min-h-[44px] w-full" onClick={resetTree}>
              <RotateCcw className="size-4" aria-hidden="true" /> Reset my tree
            </Button>
            <Button className="press min-h-[44px] w-full" onClick={submitTree} disabled={!complete}>
              <Flag className="size-4" aria-hidden="true" /> Submit my tree
            </Button>
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

          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/50 p-4">
            <div>
              <h3 className="text-sm font-bold">My tree (click leaves to work on them)</h3>
              <TreeDiagram root={tree} selectedId={selectedId} onSelect={setSelectedId} caption="My decision tree diagram" />
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-sm">
              <p className="font-semibold">Metrics (training accuracy on the same 14 rows)</p>
              <p className="mt-1 tabular-nums">
                My tree: <b>{myAcc === null ? 'not finished' : `${(myAcc * 100).toFixed(0)}%`}</b> · Auto tree:{' '}
                <b>{autoTree ? `${(treeAccuracy(DATASET, autoTree) * 100).toFixed(0)}%` : 'not built yet'}</b>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Win: match or beat the auto tree, or score at least 93% absolute. The greedy tree usually reaches 100% here.
              </p>
            </div>
            {autoTree && (
              <div>
                <h3 className="text-sm font-bold">Auto-built tree (greedy lowest weighted Gini, for comparison)</h3>
                <TreeDiagram
                  root={autoTree}
                  selectedId=""
                  onSelect={() => undefined}
                  caption="Auto-built greedy decision tree diagram"
                />
              </div>
            )}
          </div>
        </div>

        <LabReport
          title="Split log"
          columns={['Split chosen', 'Gini before', 'Gini after', 'Rows left']}
          rows={report}
          note="Appended every time you split a node. Rows left counts the rows at the node being split; each branch takes its share."
        />
      </div>
    </GameShell>
  );
}
