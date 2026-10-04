import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GraphEdge, GraphModel, GraphNode } from '../../types';
import { PriorityQueue } from '../../dataStructures/PriorityQueue';

/** Deterministic sample graph with non-negative edge weights. */
export function defaultGraph(): GraphModel {
  const nodes: GraphNode[] = [
    { id: 0, x: 0.10, y: 0.52, label: 'A' },
    { id: 1, x: 0.28, y: 0.20, label: 'B' },
    { id: 2, x: 0.30, y: 0.78, label: 'C' },
    { id: 3, x: 0.48, y: 0.46, label: 'D' },
    { id: 4, x: 0.66, y: 0.18, label: 'E' },
    { id: 5, x: 0.68, y: 0.72, label: 'F' },
    { id: 6, x: 0.86, y: 0.44, label: 'G' },
    { id: 7, x: 0.48, y: 0.90, label: 'H' },
  ];
  const edges: GraphEdge[] = [
    { a: 0, b: 1, weight: 4 },
    { a: 0, b: 2, weight: 2 },
    { a: 1, b: 2, weight: 1 },
    { a: 1, b: 3, weight: 5 },
    { a: 2, b: 3, weight: 8 },
    { a: 2, b: 7, weight: 3 },
    { a: 3, b: 4, weight: 2 },
    { a: 3, b: 5, weight: 6 },
    { a: 4, b: 5, weight: 3 },
    { a: 4, b: 6, weight: 5 },
    { a: 5, b: 6, weight: 2 },
    { a: 5, b: 7, weight: 4 },
    { a: 7, b: 5, weight: 7 },
  ];
  return { nodes, edges, start: 0, target: 6 };
}

/* ---------------- engine (pure) ---------------- */

interface StepResult {
  order: number[]; // settle order
  parent: Map<number, number>;
  dist: Map<number, number>;
  path: number[] | null;
  visitedCount: number;
}

/** Dijkstra on the abstract graph — same relaxation semantics as the grid version. */
export function runGraphSearch(g: GraphModel): StepResult | string {
  if (g.start === null || g.target === null) return 'Pick both a START and a TARGET node first.';
  const adj = new Map<number, { to: number; w: number }[]>();
  for (const n of g.nodes) adj.set(n.id, []);
  for (const e of g.edges) {
    if (e.weight < 0) return `Negative edge weight (${e.weight}) — Dijkstra requires non-negative costs.`;
    adj.get(e.a)?.push({ to: e.b, w: e.weight });
    adj.get(e.b)?.push({ to: e.a, w: e.weight });
  }
  const dist = new Map<number, number>();
  const parent = new Map<number, number>();
  const settled = new Set<number>();
  const pq = new PriorityQueue<number>((a, b) => a < b);
  dist.set(g.start, 0);
  pq.enqueue(g.start, 0);
  const order: number[] = [];
  while (!pq.isEmpty()) {
    const top = pq.dequeue()!;
    const cur = top.value;
    if (settled.has(cur)) continue;
    settled.add(cur);
    order.push(cur);
    if (cur === g.target) break;
    for (const { to, w } of adj.get(cur) ?? []) {
      if (settled.has(to)) continue;
      const alt = (dist.get(cur) ?? Infinity) + w;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        parent.set(to, cur);
        pq.enqueue(to, alt);
      }
    }
  }
  let path: number[] | null = null;
  if (settled.has(g.target)) {
    path = [];
    let c: number | undefined = g.target;
    while (c !== undefined) {
      path.unshift(c);
      c = parent.get(c);
      if (c === g.start) { path.unshift(g.start); break; }
    }
    if (path[0] !== g.start) path = null;
  }
  return { order, parent, dist, path, visitedCount: settled.size };
}

/* ---------------- component ---------------- */

type GStatus = 'idle' | 'running' | 'done';

interface Props {
  reducedMotion?: boolean;
}

export default function GraphBoard({ reducedMotion }: Props) {
  const [g, setG] = useState<GraphModel>(defaultGraph);
  const [status, setStatus] = useState<GStatus>('idle');
  const [cursor, setCursor] = useState(-1);
  const [result, setResult] = useState<StepResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(6);
  const [linking, setLinking] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const raf = useRef(0);
  const acc = useRef(0);
  const last = useRef(0);

  // playback driver
  useEffect(() => {
    if (status !== 'running' || !result) return;
    const tick = (now: number) => {
      raf.current = requestAnimationFrame(tick);
      const dt = Math.min(100, now - (last.current || now));
      last.current = now;
      acc.current += (dt / 1000) * speed;
      const batch = Math.floor(acc.current);
      if (batch > 0) {
        acc.current -= batch;
        setCursor((c) => {
          const next = Math.min(c + batch, result.order.length - 1);
          if (next >= result.order.length - 1) setStatus('done');
          return next;
        });
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [status, result, speed]);

  const run = (): void => {
    const r = runGraphSearch(g);
    if (typeof r === 'string') {
      setError(r);
      setResult(null);
      setStatus('idle');
      setCursor(-1);
      return;
    }
    setError(null);
    setResult(r);
    setCursor(-1);
    setStatus('running');
  };

  const reset = (): void => {
    setStatus('idle');
    setResult(null);
    setCursor(-1);
    setError(null);
  };

  const relabel = (n: GraphNode): string => {
    if (g.start === n.id) return 'S';
    if (g.target === n.id) return 'T';
    return n.label;
  };

  const nodeState = (id: number): 'start' | 'target' | 'settled' | 'frontier' | 'path' | 'none' => {
    if (!result) return id === g.start ? 'start' : id === g.target ? 'target' : 'none';
    const settledSet = result.order.slice(0, cursor + 1);
    if (result.path && settledSet.length === result.order.length && result.path.includes(id)) return 'path';
    if (id === g.start) return 'start';
    if (id === g.target) return 'target';
    if (settledSet.includes(id)) return 'settled';
    // frontier = discovered via a settled node's edges but not settled
    const hasSettledNeighbor = g.edges.some(
      (e) => (e.a === id && settledSet.includes(e.b)) || (e.b === id && settledSet.includes(e.a)),
    );
    return hasSettledNeighbor ? 'frontier' : 'none';
  };

  const colors: Record<string, string> = {
    start: '#22c55e',
    target: '#f43f5e',
    settled: '#10b981',
    frontier: '#34d399',
    path: '#bae6fd',
    none: '#334155',
  };

  const posOf = (id: number): GraphNode => g.nodes.find((n) => n.id === id)!;
  const W = 800, H = 480;

  const toXY = (e: ReactPointerEvent): { x: number; y: number } => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.max(0.04, Math.min(0.96, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0.06, Math.min(0.94, (e.clientY - rect.top) / rect.height)),
    };
  };

  return (
    <div className="absolute inset-0 flex gap-3 p-3">
      {/* Controls */}
      <aside className="panel w-64 shrink-0 p-3 flex flex-col gap-2 overflow-y-auto scroll-thin" aria-label="Graph controls">
        <div className="section-title">Abstract graph mode</div>
        <p className="text-[10px] text1 leading-relaxed">
          The same Dijkstra relaxation you watched on the grid, now on an explicit weighted graph.
          Edges are undirected with non-negative costs.
        </p>
        <div className="flex gap-1.5">
          <button className="btn btn-primary flex-1" onClick={run}>▶ Visualize</button>
          <button className="btn" onClick={reset} disabled={status === 'idle'}>Reset</button>
        </div>
        <label className="text-[11px] text1 flex flex-col gap-1">
          Speed: {speed}/s
          <input type="range" min={1} max={20} value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
            style={{ ['--fill' as never]: `${((speed - 1) / 19) * 100}%` }} aria-label="Playback speed" />
        </label>

        <div className="section-title mt-2">Nodes</div>
        <div className="flex gap-1.5">
          <button className={`btn flex-1 !py-1 text-[11px] ${linking === null ? '' : ''}`} onClick={() => { setLinking(null); }}>Select</button>
          <button className={`btn flex-1 !py-1 text-[11px] ${linking !== null ? 'btn-active' : ''}`} onClick={() => setLinking(g.nodes[0].id)} title="Click two connected nodes to change their cost">Edit edge</button>
        </div>
        <p className="text-[10px] text2">
          Click a node once to make it START, twice for TARGET. Drag nodes to rearrange. In “Edit edge”, click an endpoint pair then use ±.
        </p>

        {linking !== null && (
          <EdgeEditor g={g} setG={setG} from={linking} done={() => setLinking(null)} />
        )}

        {error && <div className="text-[11px]" style={{ color: 'var(--danger)' }}>{error}</div>}

        {result && (
          <div className="mt-2 space-y-1 mono text-[10px]">
            <div className="section-title">Results</div>
            <div className="text1">Settled: {Math.min(cursor + 1, result.order.length)} / {result.order.length}</div>
            {result.path ? (
              <>
                <div className="text1">Path: {result.path.map((id) => relabel(posOf(id))).join(' → ')}</div>
                <div className="text1">Cost: {result.dist.get(g.target!) ?? '—'}</div>
              </>
            ) : (
              <div style={{ color: 'var(--danger)' }}>No path exists.</div>
            )}
          </div>
        )}
      </aside>

      {/* SVG stage */}
      <main className="panel flex-1 min-w-0 relative overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full select-none touch-none"
          role="img"
          aria-label="Weighted graph visualization"
          onPointerMove={(e) => {
            if (dragging === null) return;
            const { x, y } = toXY(e);
            setG((prev) => ({ ...prev, nodes: prev.nodes.map((n) => (n.id === dragging ? { ...n, x, y } : n)) }));
          }}
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => setDragging(null)}
        >
          {/* edges */}
          {g.edges.map((e, i) => {
            const a = posOf(e.a), b = posOf(e.b);
            const inPath = !!result?.path && (() => {
              const p = result.path!;
              for (let k = 1; k < p.length; k++) {
                if ((p[k - 1] === e.a && p[k] === e.b) || (p[k - 1] === e.b && p[k] === e.a)) return true;
              }
              return false;
            })();
            const mx = ((a.x + b.x) / 2) * W;
            const my = ((a.y + b.y) / 2) * H;
            return (
              <g key={i}>
                <line
                  x1={a.x * W} y1={a.y * H} x2={b.x * W} y2={b.y * H}
                  stroke={inPath ? '#bae6fd' : 'rgba(148,163,184,0.35)'}
                  strokeWidth={inPath ? 4 : 2}
                  strokeDasharray={inPath ? undefined : undefined}
                />
                <rect x={mx - 12} y={my - 9} width={24} height={18} rx={5} fill="#0b1220" stroke="rgba(148,163,184,0.3)" />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize={11} className="mono" fill="#94a3b8">{e.weight}</text>
              </g>
            );
          })}
          {/* nodes */}
          {g.nodes.map((n) => {
            const stt = nodeState(n.id);
            const dist = result?.dist.get(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x * W},${n.y * H})`}
                className="cursor-pointer"
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (linking !== null) { setLinking(n.id); return; }
                  setDragging(n.id);
                }}
                onClick={() => {
                  if (dragging !== null || linking !== null) return;
                  setG((prev) => {
                    if (prev.start === n.id && prev.target !== n.id) return { ...prev, start: null };
                    if (prev.target === n.id) return { ...prev, target: null };
                    if (prev.start === null) return { ...prev, start: n.id };
                    if (prev.target === null) return { ...prev, target: n.id };
                    return { ...prev, start: n.id };
                  });
                  reset();
                }}
              >
                <circle
                  r={22}
                  fill={colors[stt]}
                  opacity={stt === 'none' ? 0.85 : 1}
                  stroke={stt === 'frontier' && !reducedMotion ? '#f0f9ff' : 'rgba(2,6,23,0.6)'}
                  strokeWidth={stt === 'frontier' ? 3 : 1.5}
                  className={stt === 'frontier' && !reducedMotion ? 'graph-pulse' : undefined}
                />
                <text textAnchor="middle" dy={5} fontSize={15} fontWeight={700} fill="#0b1220">{relabel(n)}</text>
                {dist !== undefined && (
                  <text textAnchor="middle" dy={-30} fontSize={11} className="mono" fill="#7dd3fc">d={dist}</text>
                )}
              </g>
            );
          })}
        </svg>
      </main>
    </div>
  );
}

function EdgeEditor({ g, setG, from, done }: {
  g: GraphModel;
  setG: (fn: (prev: GraphModel) => GraphModel) => void;
  from: number;

  done: () => void;
}) {
  const [to, setTo] = useState<number | null>(null);
  const edge = to === null ? undefined : g.edges.find((e) => (e.a === from && e.b === to) || (e.a === to && e.b === from));
  const rel = (id: number) => g.nodes.find((n) => n.id === id)!.label;
  return (
    <div className="fade-up border rounded-lg p-2 text-[11px] space-y-1.5" style={{ borderColor: 'var(--border)' }}>
      <div className="text1">From: <b className="text0">{rel(from)}</b></div>
      <select className="input !py-1 text-[11px]" value={to ?? ''} onChange={(e) => setTo(Number(e.target.value))} aria-label="Edge end node">
        <option value="">Choose end…</option>
        {g.nodes.filter((n) => n.id !== from).map((n) => (
          <option key={n.id} value={n.id}>{rel(n.id)}</option>
        ))}
      </select>
      {edge && (
        <div className="flex items-center gap-2">
          <span className="mono text0">cost {edge.weight}</span>
          <button className="btn !px-2 !py-0" onClick={() => setG((prev) => ({ ...prev, edges: prev.edges.map((e) => e === edge ? { ...e, weight: Math.max(1, e.weight - 1) } : e) }))}>−</button>
          <button className="btn !px-2 !py-0" onClick={() => setG((prev) => ({ ...prev, edges: prev.edges.map((e) => e === edge ? { ...e, weight: e.weight + 1 } : e) }))}>+</button>
        </div>
      )}
      {edge === undefined && to !== null && (
        <button className="btn btn-primary w-full !py-1 text-[11px]" onClick={() => setG((prev) => ({ ...prev, edges: [...prev.edges, { a: from, b: to, weight: 3 }] }))}>
          Create edge {rel(from)}–{rel(to)}
        </button>
      )}
      <button className="btn w-full !py-1 text-[11px]" onClick={done}>Done</button>
    </div>
  );
}
