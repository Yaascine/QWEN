import { useRef, useState } from 'react';
import type { Pos } from '../../types';
import { GridModel } from '../../algorithms/grid';
import { store } from '../../simulation/store';
import {
  dfsMaze,
  mulberry32,
  obstacleCourse,
  primMaze,
  randomSeed,
  randomTerrain,
  randomWalls,
  recursiveDivision,
  seedLabel,
  type CellOp,
} from '../../maze/generators';
import { PRESETS } from '../../presets/presets';

type GenKind = 'random-walls' | 'recursive-division' | 'dfs-maze' | 'prim-maze' | 'terrain' | 'obstacle' | 'clear';

const GENERATORS: { id: GenKind; label: string }[] = [
  { id: 'random-walls', label: 'Random Walls' },
  { id: 'recursive-division', label: 'Recursive Division' },
  { id: 'dfs-maze', label: "Randomized DFS Maze" },
  { id: 'prim-maze', label: "Prim's Maze" },
  { id: 'terrain', label: 'Weighted Terrain' },
  { id: 'obstacle', label: 'Obstacle Course' },
  { id: 'clear', label: 'Clear Grid' },
];

export default function MazeMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(false);

  const runGenerator = (kind: GenKind) => {
    if (busy) return;
    setBusy(true);
    cancelRef.current = false;
    store.clearSearch();
    const g = store.state.grid;
    const seed = randomSeed();
    const rng = mulberry32(seed);
    const blocked = new Set<number>([g.idx(g.start), g.idx(g.target)]);

    let ops: CellOp[] = [];
    switch (kind) {
      case 'random-walls': ops = randomWalls(g.rows, g.cols, 0.28, rng, blocked); break;
      case 'recursive-division': ops = recursiveDivision(g.rows, g.cols, rng); break;
      case 'dfs-maze': ops = dfsMaze(g.rows, g.cols, rng); break;
      case 'prim-maze': ops = primMaze(g.rows, g.cols, rng); break;
      case 'terrain': ops = randomTerrain(g.rows, g.cols, 0.5, rng, blocked); break;
      case 'obstacle': ops = obstacleCourse(g.rows, g.cols, rng); break;
      case 'clear': ops = []; break;
    }

    // Clear existing walls/weights first (except start/target).
    for (let i = 0; i < g.rows * g.cols; i++) {
      if (!blocked.has(i)) g.clearCell(i);
    }

    applyAnimated(g, ops, () => {
      ensureReachable(g);
      store.set({ seed });
      store.showToast(`${labelFor(kind)} generated · Seed ${seedLabel(seed)}`);
      setBusy(false);
    }, cancelRef);
  };

  const runPreset = (id: string) => {
    if (busy) return;
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setBusy(true);
    cancelRef.current = false;
    store.clearSearch();
    const { rows, cols } = store.state.grid;
    const g = preset.build(rows, cols);
    store.setGrid(g);
    store.showToast(`Preset loaded: ${preset.name} — ${preset.explain}`);
    setBusy(false);
  };

  return (
    <section className="panel p-3 flex flex-col gap-2">
      <button className="flex items-center justify-between w-full" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="section-title">Maze & Presets</span>
        <span className="text2 text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="fade-up flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-1">
            {GENERATORS.map((gen) => (
              <button key={gen.id} className="btn !py-1 text-[11px] justify-start" onClick={() => runGenerator(gen.id)} disabled={busy}>
                {gen.label}
              </button>
            ))}
          </div>
          <div className="section-title mt-1">Educational presets</div>
          <div className="grid grid-cols-1 gap-1">
            {PRESETS.map((p) => (
              <button key={p.id} className="btn !py-1 text-[11px] justify-start" title={p.explain} onClick={() => runPreset(p.id)} disabled={busy}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function labelFor(kind: GenKind): string {
  return GENERATORS.find((x) => x.id === kind)?.label ?? 'Board';
}

/** Apply cell ops progressively via rAF so generation animates on the canvas. */
function applyAnimated(g: GridModel, ops: CellOp[], done: () => void, cancel: { current: boolean }): void {
  const perFrame = Math.max(40, Math.floor(ops.length / 90));
  let i = 0;
  const step = () => {
    if (cancel.current) { done(); return; }
    const end = Math.min(i + perFrame, ops.length);
    for (; i < end; i++) {
      const op = ops[i];
      const idx = g.idx(op.pos);
      if (g.isStart(idx) || g.isTarget(idx)) continue;
      if (op.kind === 'wall') g.setWall(idx);
      else g.setWeight(idx, op.weight);
    }
    store.set({ boardVersion: store.state.boardVersion + 1 });
    if (i < ops.length) requestAnimationFrame(step);
    else done();
  };
  requestAnimationFrame(step);
}

/** If the generator sealed off the target, carve a straight escape lane. */
function ensureReachable(g: GridModel): void {
  if (reachable(g, g.start, g.target)) return;
  // Carve an L-shaped corridor from start toward target row/col.
  const { start, target } = g;
  const cMin = Math.min(start.col, target.col);
  const cMax = Math.max(start.col, target.col);
  for (let c = cMin; c <= cMax; c++) g.clearCell(start.row * g.cols + c);
  const rMin = Math.min(start.row, target.row);
  const rMax = Math.max(start.row, target.row);
  for (let r = rMin; r <= rMax; r++) g.clearCell(r * g.cols + target.col);
  store.set({ boardVersion: store.state.boardVersion + 1 });
}

function reachable(g: GridModel, from: Pos, to: Pos): boolean {
  const seen = new Uint8Array(g.rows * g.cols);
  const stack = [g.idx(from)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === g.idx(to)) return true;
    const r = Math.floor(cur / g.cols), c = cur % g.cols;
    const push = (nr: number, nc: number) => {
      if (nr < 0 || nc < 0 || nr >= g.rows || nc >= g.cols) return;
      const ni = nr * g.cols + nc;
      if (!seen[ni] && g.isWalkable(ni)) { seen[ni] = 1; stack.push(ni); }
    };
    push(r - 1, c); push(r + 1, c); push(r, c - 1); push(r, c + 1);
  }
  return false;
}
