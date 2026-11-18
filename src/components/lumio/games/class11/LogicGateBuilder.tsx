'use client';

import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { CircuitBoard, Trash2, Eraser, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';
import { GameShell, type GameProps } from '../GameShell';
import { PredictFirst, ChapterRef, LabReport } from './shared';
import { cn } from '@/lib/utils';

/**
 * Logic Gate Builder: drag-and-drop SVG canvas. Click a source node (input
 * toggle output or a gate output), then click a gate input or the lamp to wire
 * a bezier wire; click a wire to delete it. The network is re-evaluated on
 * every change and a live truth table is shown beside the canvas.
 */

type GateKind = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR';
type ToggleId = 'A' | 'B' | 'C';

interface Gate {
  id: number;
  kind: GateKind;
  slot: number;
  x: number;
  y: number;
}

type NodeRef = { kind: 'toggle'; id: ToggleId } | { kind: 'gate'; gate: number };
type WireDst = { gate: number; input: 0 | 1 } | { lamp: true };

interface Wire {
  id: number;
  src: NodeRef;
  dst: WireDst;
}

const KIND_META: Record<GateKind, { inputs: 1 | 2; outDx: number }> = {
  AND: { inputs: 2, outDx: 58 },
  OR: { inputs: 2, outDx: 58 },
  XOR: { inputs: 2, outDx: 58 },
  NAND: { inputs: 2, outDx: 68 },
  NOR: { inputs: 2, outDx: 68 },
  NOT: { inputs: 1, outDx: 56 },
};

const PALETTE: GateKind[] = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'];
const MAX_GATES = 8;
const TOGGLES: ToggleId[] = ['A', 'B', 'C'];
const TOGGLE_Y: Record<ToggleId, number> = { A: 40, B: 130, C: 220 };
const LAMP_POS = { x: 596, y: 186 };

function slotPos(slot: number): { x: number; y: number } {
  return { x: 130 + (slot % 4) * 130, y: 70 + Math.floor(slot / 4) * 160 };
}

function gateInputPos(g: Gate, input: 0 | 1): { x: number; y: number } {
  if (KIND_META[g.kind].inputs === 1) return { x: g.x + 10, y: g.y + 22 };
  return { x: g.x + 10, y: g.y + (input === 0 ? 12 : 32) };
}

function nodePos(ref: NodeRef, gates: Gate[]): { x: number; y: number } {
  if (ref.kind === 'toggle') return { x: 58, y: TOGGLE_Y[ref.id] + 17 };
  const g = gates.find((gg) => gg.id === ref.gate);
  if (!g) return { x: 0, y: 0 };
  return { x: g.x + KIND_META[g.kind].outDx, y: g.y + 22 };
}

/* ---------------- evaluation ---------------- */

function evalNetwork(
  gates: Gate[],
  wires: Wire[],
  toggleVals: Record<ToggleId, boolean>
): { gateVals: Record<number, boolean>; lamp: boolean | null; cycle: boolean } {
  // incoming wire per destination
  const inWire = new Map<string, Wire>();
  let lampWire: Wire | null = null;
  for (const w of wires) {
    if ('lamp' in w.dst) {
      lampWire = w;
    } else {
      inWire.set(`${w.dst.gate}:${w.dst.input}`, w);
    }
  }

  // Kahn topological sort over gate->gate edges
  const inDeg = new Map<number, number>();
  const adj = new Map<number, number[]>();
  for (const g of gates) {
    inDeg.set(g.id, 0);
    adj.set(g.id, []);
  }
  for (const w of wires) {
    if ('lamp' in w.dst) continue;
    if (w.src.kind === 'gate' && inDeg.has(w.dst.gate) && inDeg.has(w.src.gate)) {
      inDeg.set(w.dst.gate, (inDeg.get(w.dst.gate) ?? 0) + 1);
      adj.get(w.src.gate)?.push(w.dst.gate);
    }
  }
  const queue = gates.filter((g) => (inDeg.get(g.id) ?? 0) === 0).map((g) => g.id);
  const order: number[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as number;
    order.push(id);
    for (const nxt of adj.get(id) ?? []) {
      const d = (inDeg.get(nxt) ?? 0) - 1;
      inDeg.set(nxt, d);
      if (d === 0) queue.push(nxt);
    }
  }
  const cycle = order.length < gates.length;

  const gateVals: Record<number, boolean> = {};
  for (const id of order) {
    const g = gates.find((gg) => gg.id === id);
    if (!g) continue;
    const inputs: boolean[] = [];
    for (let k = 0; k < KIND_META[g.kind].inputs; k++) {
      const w = inWire.get(`${id}:${k}`);
      if (!w) inputs.push(false);
      else if (w.src.kind === 'toggle') inputs.push(toggleVals[w.src.id]);
      else inputs.push(gateVals[w.src.gate] ?? false);
    }
    let out: boolean;
    switch (g.kind) {
      case 'AND': out = inputs[0] && inputs[1]; break;
      case 'OR': out = inputs[0] || inputs[1]; break;
      case 'NOT': out = !inputs[0]; break;
      case 'NAND': out = !(inputs[0] && inputs[1]); break;
      case 'NOR': out = !(inputs[0] || inputs[1]); break;
      case 'XOR': out = inputs[0] !== inputs[1]; break;
    }
    gateVals[id] = out;
  }

  let lamp: boolean | null = null;
  if (lampWire) {
    if (lampWire.src.kind === 'toggle') lamp = toggleVals[lampWire.src.id];
    else lamp = gateVals[lampWire.src.gate] ?? false;
  }
  return { gateVals, lamp, cycle };
}

/** Toggles reachable from the lamp source (what the truth table varies). */
function usedToggles(lampWire: Wire | null, wires: Wire[]): ToggleId[] {
  if (!lampWire) return [];
  const seenGates = new Set<number>();
  const used = new Set<ToggleId>();
  const walk = (ref: NodeRef) => {
    if (ref.kind === 'toggle') {
      used.add(ref.id);
      return;
    }
    if (seenGates.has(ref.gate)) return;
    seenGates.add(ref.gate);
    for (const w of wires) {
      if (!('lamp' in w.dst) && w.dst.gate === ref.gate) walk(w.src);
    }
  };
  walk(lampWire.src);
  return TOGGLES.filter((t) => used.has(t));
}

/* ---------------- challenges ---------------- */

interface ChallengeDef {
  id: number;
  expr: string;
  fn: (a: boolean, b: boolean, c: boolean) => boolean;
  needsC: boolean;
}

const CHALLENGES: ChallengeDef[] = [
  { id: 1, expr: 'A AND (NOT B)', fn: (a, b) => a && !b, needsC: false },
  { id: 2, expr: '(A OR B) AND NOT (A AND B)', fn: (a, b) => (a || b) && !(a && b), needsC: false },
  { id: 3, expr: 'NOT (A OR B) OR C', fn: (a, b, c) => (!a && !b) || c, needsC: true },
];

const DE_MORGAN_HINT =
  'De Morgan hint: NOT (A OR B) = (NOT A) AND (NOT B), and NOT (A AND B) = (NOT A) OR (NOT B). Challenge 1 is just A AND (NOT B) — two gates. Challenge 2 can be one XOR gate. Challenge 3 needs NOT (A OR B) feeding an OR with C.';

interface ChallengeState {
  done: boolean;
  tries: number;
  hint: boolean;
}

/* ---------------- gate shapes ---------------- */

function GateShape({ kind }: { kind: GateKind }) {
  switch (kind) {
    case 'AND':
      return (
        <g>
          <path d="M10,0 L34,0 A22,22 0 0 1 34,44 L10,44 Z" className="fill-primary/10 stroke-foreground" strokeWidth="2" />
          <text x="22" y="27" textAnchor="middle" fontSize="10" className="fill-foreground font-semibold">AND</text>
        </g>
      );
    case 'NAND':
      return (
        <g>
          <path d="M10,0 L34,0 A22,22 0 0 1 34,44 L10,44 Z" className="fill-primary/10 stroke-foreground" strokeWidth="2" />
          <circle cx="62" cy="22" r="4" className="fill-card stroke-foreground" strokeWidth="2" />
          <text x="22" y="27" textAnchor="middle" fontSize="10" className="fill-foreground font-semibold">NAND</text>
        </g>
      );
    case 'OR':
      return (
        <g>
          <path d="M10,0 Q30,-4 56,22 Q30,48 10,44 Q22,22 10,0 Z" className="fill-primary/10 stroke-foreground" strokeWidth="2" />
          <text x="26" y="27" textAnchor="middle" fontSize="10" className="fill-foreground font-semibold">OR</text>
        </g>
      );
    case 'NOR':
      return (
        <g>
          <path d="M10,0 Q30,-4 56,22 Q30,48 10,44 Q22,22 10,0 Z" className="fill-primary/10 stroke-foreground" strokeWidth="2" />
          <circle cx="62" cy="22" r="4" className="fill-card stroke-foreground" strokeWidth="2" />
          <text x="26" y="27" textAnchor="middle" fontSize="10" className="fill-foreground font-semibold">NOR</text>
        </g>
      );
    case 'XOR':
      return (
        <g>
          <path d="M10,0 Q30,-4 56,22 Q30,48 10,44 Q22,22 10,0 Z" className="fill-primary/10 stroke-foreground" strokeWidth="2" />
          <path d="M2,0 Q12,22 2,44" className="fill-none stroke-foreground" strokeWidth="2" />
          <text x="26" y="27" textAnchor="middle" fontSize="10" className="fill-foreground font-semibold">XOR</text>
        </g>
      );
    case 'NOT':
      return (
        <g>
          <path d="M10,4 L44,22 L10,40 Z" className="fill-primary/10 stroke-foreground" strokeWidth="2" />
          <circle cx="50" cy="22" r="4" className="fill-card stroke-foreground" strokeWidth="2" />
          <text x="20" y="27" textAnchor="middle" fontSize="10" className="fill-foreground font-semibold">NOT</text>
        </g>
      );
  }
}

/* ---------------- component ---------------- */

export function LogicGateBuilderLab(props: GameProps) {
  const [gates, setGates] = useState<Gate[]>([]);
  const [wires, setWires] = useState<Wire[]>([]);
  const [toggleVals, setToggleVals] = useState<Record<ToggleId, boolean>>({ A: false, B: false, C: false });
  const [pending, setPending] = useState<NodeRef | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [chState, setChState] = useState<Record<number, ChallengeState>>({
    1: { done: false, tries: 0, hint: false },
    2: { done: false, tries: 0, hint: false },
    3: { done: false, tries: 0, hint: false },
  });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const nextGateId = useRef(1);
  const nextWireId = useRef(1);
  const dragRef = useRef<{ id: number; dx: number; dy: number; moved: boolean } | null>(null);

  /* --- derived (above any effect; there are no effects here) --- */
  const lampWire = useMemo(() => wires.find((w) => 'lamp' in w.dst) ?? null, [wires]);
  const net = useMemo(() => evalNetwork(gates, wires, toggleVals), [gates, wires, toggleVals]);
  const used = useMemo(() => usedToggles(lampWire, wires), [lampWire, wires]);
  const anyUnconnected = useMemo(() => {
    for (const g of gates) {
      for (let k = 0; k < KIND_META[g.kind].inputs; k++) {
        const w = wires.find((ww) => !('lamp' in ww.dst) && ww.dst.gate === g.id && ww.dst.input === k);
        if (!w) return true;
      }
    }
    return false;
  }, [gates, wires]);

  interface TableRow {
    bits: boolean[];
    out: boolean;
  }
  const tableRows: TableRow[] = useMemo(() => {
    if (!lampWire || used.length === 0) return [];
    const rows: TableRow[] = [];
    const n = used.length;
    for (let i = 0; i < 1 << n; i++) {
      const vals: Record<ToggleId, boolean> = { A: false, B: false, C: false };
      const bits: boolean[] = [];
      for (let j = 0; j < n; j++) {
        const on = ((i >> (n - 1 - j)) & 1) === 1;
        vals[used[j]] = on;
        bits.push(on);
      }
      rows.push({ bits, out: evalNetwork(gates, wires, vals).lamp === true });
    }
    return rows;
  }, [lampWire, used, gates, wires]);

  function svgPoint(e: RPointerEvent<SVGElement>): { x: number; y: number } {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scale = 660 / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale };
  }

  /* --- palette / gates --- */
  function addGate(kind: GateKind) {
    if (gates.length >= MAX_GATES) {
      setMsg('The canvas is full — 8 gates maximum. Delete a gate first.');
      return;
    }
    const taken = new Set(gates.map((g) => g.slot));
    let slot = 0;
    while (taken.has(slot)) slot++;
    const p = slotPos(slot);
    setGates((gs) => [...gs, { id: nextGateId.current++, kind, slot, x: p.x, y: p.y }]);
    setMsg(`Added a ${kind} gate. Drag it to move; click its output node, then a target input, to wire it.`);
  }

  function deleteSelected() {
    if (selected === null) {
      setMsg('Click a gate first to select it, then delete it.');
      return;
    }
    const id = selected;
    setGates((gs) => gs.filter((g) => g.id !== id));
    setWires((ws) =>
      ws.filter((w) => {
        if (w.src.kind === 'gate' && w.src.gate === id) return false;
        return 'lamp' in w.dst ? true : w.dst.gate !== id;
      })
    );
    setSelected(null);
    setMsg('Gate deleted along with its wires.');
  }

  function clearAll() {
    setGates([]);
    setWires([]);
    setPending(null);
    setSelected(null);
    setMsg('Canvas cleared.');
  }

  /* --- wiring --- */
  function sameRef(a: NodeRef, b: NodeRef): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === 'toggle' && b.kind === 'toggle') return a.id === b.id;
    if (a.kind === 'gate' && b.kind === 'gate') return a.gate === b.gate;
    return false;
  }

  function clickSource(ref: NodeRef) {
    if (pending && sameRef(pending, ref)) {
      setPending(null);
      setMsg('Wiring cancelled.');
      return;
    }
    setPending(ref);
    setMsg('Source selected — now click a gate input or the lamp to complete the wire.');
  }

  function clickTarget(dst: WireDst) {
    if (!pending) {
      setMsg('Click a source node first (a toggle output or a gate output), then the target.');
      return;
    }
    if (pending.kind === 'gate' && !('lamp' in dst) && dst.gate === pending.gate) {
      setMsg('A gate cannot feed itself.');
      return;
    }
    setWires((ws) => {
      // Replace any existing wire into the same destination (lamp or gate input).
      const filtered = ws.filter((w) => {
        if ('lamp' in dst) return !('lamp' in w.dst);
        if ('lamp' in w.dst) return true;
        return !(dst.gate === w.dst.gate && dst.input === w.dst.input);
      });
      return [...filtered, { id: nextWireId.current++, src: pending, dst }];
    });
    setPending(null);
    setMsg('Wire added. Click any wire to delete it.');
  }

  /* --- drag --- */
  function gatePointerDown(e: RPointerEvent<SVGGElement>, g: Gate) {
    e.stopPropagation();
    setSelected(g.id);
    const p = svgPoint(e);
    dragRef.current = { id: g.id, dx: p.x - g.x, dy: p.y - g.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function gatePointerMove(e: RPointerEvent<SVGGElement>) {
    const d = dragRef.current;
    if (!d) return;
    const p = svgPoint(e);
    const nx = Math.max(0, Math.min(570, p.x - d.dx));
    const ny = Math.max(0, Math.min(350, p.y - d.dy));
    d.moved = true;
    setGates((gs) => gs.map((g) => (g.id === d.id ? { ...g, x: nx, y: ny } : g)));
  }

  function gatePointerUp(e: RPointerEvent<SVGGElement>) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  /* --- challenges --- */
  function checkChallenge(id: number) {
    if (!lampWire) {
      setMsg('Wire an output to the lamp first, then check the challenge.');
      return;
    }
    if (used.length === 0) {
      setMsg('The circuit does not use any input toggles yet.');
      return;
    }
    const def = CHALLENGES.find((c) => c.id === id);
    if (!def) return;
    if (def.needsC && !used.includes('C')) {
      setMsg('Challenge 3 uses a third input — wire the C toggle into your circuit.');
      return;
    }
    let allMatch = true;
    for (const row of tableRows) {
      const vals: Record<ToggleId, boolean> = { A: false, B: false, C: false };
      used.forEach((t, j) => {
        vals[t] = row.bits[j];
      });
      const got = evalNetwork(gates, wires, vals).lamp === true;
      const want = def.fn(vals.A, vals.B, vals.C);
      if (got !== want) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) {
      const next = { ...chState, [id]: { ...chState[id], done: true, hint: false } };
      setChState(next);
      setMsg(`Challenge ${id} matches — the truth tables agree.`);
      if (CHALLENGES.every((c) => next[c.id].done)) props.onWin();
    } else {
      setChState((cs) => ({ ...cs, [id]: { ...cs[id], tries: cs[id].tries + 1, hint: true } }));
      setMsg(`Challenge ${id}: the truth tables disagree. Compare row by row.`);
    }
  }

  /* --- wire geometry --- */
  function wirePath(w: Wire): string {
    const s = nodePos(w.src, gates);
    const t = (() => {
      const dst = w.dst;
      if ('lamp' in dst) return { x: LAMP_POS.x, y: LAMP_POS.y };
      const g = gates.find((gg) => gg.id === dst.gate);
      return g ? gateInputPos(g, dst.input) : { x: 0, y: 0 };
    })();
    return `M ${s.x},${s.y} C ${s.x + 40},${s.y} ${t.x - 40},${t.y} ${t.x},${t.y}`;
  }

  const allDone = CHALLENGES.every((c) => chState[c.id].done);

  return (
    <GameShell
      title="Logic Gate Builder"
      blurb="Place gates, wire them with bezier curves, flip the input toggles and watch the lamp. Build the three target circuits to win."
      modelNote="Circuits with unconnected gate inputs evaluate those inputs as 0 (false); in real hardware such pins would float, so treat the value as a lab simplification. The simulator refuses feedback loops by reporting a cycle instead of oscillating."
      xp={25}
      won={props.won}
      onBack={props.onBack}
    >
      <ChapterRef
        subject="Computer Science"
        chapter="Boolean logic (Class 11 CS / Applied Maths)"
        topic="Gates, truth tables, De Morgan"
      />

      <div className="mt-4">
        <PredictFirst
          key="lg-predict"
          prompt="which single gate behaves exactly like NOT (A OR B)?"
          options={[
            { label: 'NOR', correct: true },
            { label: 'NAND' },
            { label: 'XOR' },
          ]}
          explain="NOT (A OR B) is the definition of NOR — De Morgan turns it into (NOT A) AND (NOT B), which is the same 1000 truth table column."
          className="max-w-2xl"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* left: palette + canvas */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background/50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <CircuitBoard className="size-4" aria-hidden="true" /> Palette
            </span>
            {PALETTE.map((k) => (
              <button
                key={k}
                onClick={() => addGate(k)}
                className="press inline-flex min-h-[44px] items-center rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
                aria-label={`Add a ${k} gate`}
              >
                {k}
              </button>
            ))}
            <button
              onClick={deleteSelected}
              className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
            >
              <Trash2 className="size-4" aria-hidden="true" /> Delete selected
            </button>
            <button
              onClick={clearAll}
              className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
            >
              <Eraser className="size-4" aria-hidden="true" /> Clear
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">{gates.length}/{MAX_GATES} gates</span>
          </div>

          <svg
            ref={svgRef}
            viewBox="0 0 660 400"
            className="w-full rounded-xl border border-border bg-card"
            role="img"
            aria-label="Logic circuit canvas with input toggles A, B and C, up to eight gates, and an output lamp"
          >
            {/* toggles */}
            {TOGGLES.map((t) => {
              const y = TOGGLE_Y[t];
              const on = toggleVals[t];
              const isPending = pending?.kind === 'toggle' && pending.id === t;
              return (
                <g key={t}>
                  <g
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setToggleVals((tv) => ({ ...tv, [t]: !tv[t] }));
                    }}
                    className="cursor-pointer"
                  >
                    <rect x="10" y={y} width="36" height="34" rx="8" className={cn(on ? 'fill-emerald-500' : 'fill-muted', 'stroke-foreground')} strokeWidth="1.5" />
                    <text x="28" y={y + 21} textAnchor="middle" fontSize="13" className="fill-foreground font-bold">{t}</text>
                  </g>
                  <circle
                    cx="58"
                    cy={y + 17}
                    r="7"
                    className={cn(isPending ? 'fill-amber-400 stroke-foreground' : 'fill-card stroke-foreground', 'cursor-pointer')}
                    strokeWidth="2"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      clickSource({ kind: 'toggle', id: t });
                    }}
                  />
                  <text x="70" y={y + 21} fontSize="11" className="fill-muted-foreground">{on ? '1' : '0'}</text>
                </g>
              );
            })}

            {/* wires */}
            {wires.map((w) => (
              <g key={w.id}>
                <path d={wirePath(w)} className="fill-none stroke-primary" strokeWidth="2.5" />
                <path
                  d={wirePath(w)}
                  className="fill-none stroke-transparent cursor-pointer"
                  strokeWidth="14"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setWires((ws) => ws.filter((x) => x.id !== w.id));
                    setMsg('Wire deleted.');
                  }}
                />
              </g>
            ))}

            {/* gates */}
            {gates.map((g) => {
              const meta = KIND_META[g.kind];
              const isSel = selected === g.id;
              return (
                <g key={g.id} transform={`translate(${g.x},${g.y})`}>
                  <rect x="-8" y="-8" width={meta.outDx + 22} height="60" rx="10" className={cn(isSel ? 'fill-primary/15 stroke-primary' : 'fill-transparent stroke-transparent')} strokeWidth="1.5" />
                  <g
                    onPointerDown={(e) => gatePointerDown(e, g)}
                    onPointerMove={gatePointerMove}
                    onPointerUp={gatePointerUp}
                    className="cursor-move"
                  >
                    <GateShape kind={g.kind} />
                  </g>
                  {Array.from({ length: meta.inputs }, (_, k) => k as 0 | 1).map((k) => (
                    <circle
                      key={k}
                      cx={gateInputPos(g, k).x - g.x}
                      cy={gateInputPos(g, k).y - g.y}
                      r="6"
                      className="fill-card stroke-foreground cursor-pointer"
                      strokeWidth="2"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        clickTarget({ gate: g.id, input: k });
                      }}
                    />
                  ))}
                  <circle
                    cx={meta.outDx}
                    cy="22"
                    r="6"
                    className={cn(
                      'cursor-pointer',
                      pending?.kind === 'gate' && pending.gate === g.id ? 'fill-amber-400 stroke-foreground' : 'fill-primary stroke-foreground'
                    )}
                    strokeWidth="2"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      clickSource({ kind: 'gate', gate: g.id });
                    }}
                  />
                  <text x={meta.outDx / 2} y="56" textAnchor="middle" fontSize="10" className="fill-muted-foreground tabular-nums">
                    {net.gateVals[g.id] ? '1' : '0'}
                  </text>
                </g>
              );
            })}

            {/* lamp */}
            <circle
              cx={LAMP_POS.x}
              cy={LAMP_POS.y}
              r="10"
              className="fill-card stroke-foreground cursor-pointer"
              strokeWidth="2"
              onPointerDown={(e) => {
                e.stopPropagation();
                clickTarget({ lamp: true });
              }}
            />
            <circle
              cx={LAMP_POS.x + 22}
              cy={LAMP_POS.y}
              r="14"
              className={cn(net.lamp ? 'fill-amber-300 stroke-amber-500' : 'fill-muted stroke-foreground')}
              strokeWidth="2"
            />
            <text x={LAMP_POS.x + 22} y={LAMP_POS.y + 4} textAnchor="middle" fontSize="11" className="fill-foreground font-bold">
              {net.lamp === null ? '?' : net.lamp ? '1' : '0'}
            </text>
            <text x={LAMP_POS.x + 8} y={LAMP_POS.y + 36} textAnchor="middle" fontSize="10" className="fill-muted-foreground">
              output lamp
            </text>
          </svg>

          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {msg || 'Click a palette button to add a gate, drag gates to move them, click a source node then a target input to wire.'}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {net.cycle && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 font-semibold text-amber-600">
                <AlertTriangle className="size-3.5" aria-hidden="true" /> Feedback loop detected — cycle
              </span>
            )}
            {anyUnconnected && !net.cycle && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 font-semibold text-amber-600">
                <AlertTriangle className="size-3.5" aria-hidden="true" /> Unconnected gate inputs evaluate as 0
              </span>
            )}
            {!lampWire && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 font-semibold text-amber-600">
                <AlertTriangle className="size-3.5" aria-hidden="true" /> Lamp not wired
              </span>
            )}
          </div>
        </div>

        {/* right: truth table + challenges */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Lightbulb className="size-4" aria-hidden="true" /> Live truth table
            </h3>
            {tableRows.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Wire the lamp to a circuit that uses at least one toggle and the table appears here.
              </p>
            ) : (
              <table className="mt-2 w-full text-sm tabular-nums">
                <caption className="sr-only">Truth table generated from the circuit</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    {used.map((t) => (
                      <th key={t} scope="col" className="px-2 py-1.5 font-semibold">{t}</th>
                    ))}
                    <th scope="col" className="px-2 py-1.5 font-semibold">Out</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      {r.bits.map((b, j) => (
                        <td key={j} className="px-2 py-1.5">{b ? '1' : '0'}</td>
                      ))}
                      <td className={cn('px-2 py-1.5 font-bold', r.out ? 'text-emerald-600' : 'text-muted-foreground')}>
                        {r.out ? '1' : '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {used.length === 3 && <p className="mt-1 text-xs text-muted-foreground">C uses a third input, so the table has 8 rows.</p>}
          </div>

          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <h3 className="text-sm font-bold">Challenges</h3>
            <div className="mt-2 flex flex-col gap-2">
              {CHALLENGES.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'rounded-xl border p-3 text-sm',
                    chState[c.id].done ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-card'
                  )}
                >
                  <p className="font-semibold">
                    {c.id}. Build: {c.expr}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => checkChallenge(c.id)}
                      disabled={chState[c.id].done}
                      className="press inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-accent/10"
                    >
                      <CheckCircle2 className="size-4" aria-hidden="true" /> Check
                    </button>
                    {chState[c.id].done && <span className="font-semibold text-emerald-600">Truth tables match — done</span>}
                    {!chState[c.id].done && chState[c.id].tries > 0 && (
                      <span className="text-xs text-muted-foreground tabular-nums">attempts: {chState[c.id].tries}</span>
                    )}
                  </div>
                  {!chState[c.id].done && chState[c.id].hint && (
                    <p className="mt-2 text-xs text-amber-600">{DE_MORGAN_HINT}</p>
                  )}
                </div>
              ))}
            </div>
            {allDone && (
              <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600" role="status">
                All three challenges built — you are reading and writing truth tables like a logician.
              </p>
            )}
          </div>

          <LabReport
            title="Challenge report"
            columns={['Challenge', 'Target expression', 'Attempts', 'Result']}
            rows={CHALLENGES.map((c) => [c.id, c.expr, chState[c.id].tries, chState[c.id].done ? 'Matched' : 'Pending'])}
            note="Equivalence is checked honestly: your circuit and the target expression must agree on every input combination."
          />
        </div>
      </div>
    </GameShell>
  );
}
