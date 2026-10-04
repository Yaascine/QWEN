/**
 * PathLab algorithm correctness suite.
 * Verifies BFS, DFS, Dijkstra, A-star, GBFS, PriorityQueue, replay and path reconstruction.
 */
import { describe, it, expect } from 'vitest';
import type { AlgorithmId, HeuristicId, Pos, SearchEvent } from '../types';
import { GridModel, makeHeuristic, edgeCost, neighborsOf } from '../algorithms/grid';
import { bfs } from '../algorithms/bfs';
import { dfs } from '../algorithms/dfs';
import { dijkstra } from '../algorithms/dijkstra';
import { astar } from '../algorithms/astar';
import { gbfs } from '../algorithms/gbfs';
import { PriorityQueue } from '../dataStructures/PriorityQueue';
import { collectEvents, simulate, replayTo, makeReplayState, applyEvent } from '../simulation/SearchEngine';

const RUN_CFG = { diagonal: false, cornerCutting: false };

function runGen(gen: Generator<SearchEvent>): SearchEvent[] {
  const out: SearchEvent[] = [];
  for (const ev of gen) out.push(ev);
  return out;
}

function makeGrid(rows: number, cols: number, start: Pos, target: Pos): GridModel {
  return new GridModel(rows, cols, start, target);
}

/** Apply a maze generator's CellOp list to a grid. */
function applyOps(g: GridModel, ops: Array<{ kind: string; pos: Pos; on?: boolean; weight?: number }>) {
  for (const op of ops) {
    const idx = g.idx(op.pos);
    if (op.kind === 'wall') {
      if (op.on !== false) g.setWall(idx);
      else g.clearCell(idx);
    } else if (op.kind === 'weight') {
      g.setWeight(idx, op.weight ?? 2);
    }
  }
}

/** Extract final path + stats from an event stream. */
function extract(events: SearchEvent[]) {
  const finished = events.find((e) => e.type === 'FINISHED' || e.type === 'NO_PATH');
  const found = !!events.find((e) => e.type === 'TARGET_FOUND');
  let path = events.filter((e) => e.type === 'PATH_NODE').map((e) => e.node!);
  // Normalize to start-first order if the stream emitted the parent chain backwards.
  const s = events.find((e) => e.type === 'INIT')?.node;
  if (s && path.length >= 2 && (path[0].row !== s.row || path[0].col !== s.col)) {
    path = [...path].reverse();
  }
  return { found, path, finished, visitedCount: events.filter((e) => e.type === 'VISIT').length };
}

/** Verify a path is contiguous & walkable on the grid. */
function assertValidPath(grid: GridModel, path: Pos[], diagonal = false) {
  expect(path.length).toBeGreaterThan(0);
  for (let i = 0; i < path.length; i++) {
    expect(grid.isWalkable(grid.idx(path[i]))).toBe(true);
    if (i > 0) {
      const dr = Math.abs(path[i].row - path[i - 1].row);
      const dc = Math.abs(path[i].col - path[i - 1].col);
      expect(dr <= 1 && dc <= 1 && dr + dc > 0).toBe(true);
      if (!diagonal) expect(dr + dc).toBe(1);
    }
  }
}

function pathWeightCost(grid: GridModel, path: Pos[]): number {
  let c = 0;
  for (let i = 1; i < path.length; i++) c += grid.costOf(grid.idx(path[i]));
  return c;
}

/* ------------------------------------------------------------------ */
describe('PriorityQueue (binary min-heap)', () => {
  it('dequeues in priority order', () => {
    const pq = new PriorityQueue<number>((a, b) => a < b);
    [5, 1, 9, 3, 7, 2].forEach((v) => pq.enqueue(v, v));
    const out: number[] = [];
    while (!pq.isEmpty()) out.push(pq.dequeue()!.value);
    expect(out).toEqual([1, 2, 3, 5, 7, 9]);
  });

  it('reports size/peek correctly', () => {
    const pq = new PriorityQueue<number>((a, b) => a < b);
    expect(pq.isEmpty()).toBe(true);
    pq.enqueue(42, 4);
    expect(pq.size).toBe(1);
    expect(pq.peek()?.priority).toBe(4);
    expect(pq.peek()?.value).toBe(42);
    pq.enqueue(7, 1);
    expect(pq.peek()?.priority).toBe(1);
  });

  it('snapshot returns ascending priorities up to limit', () => {
    const pq = new PriorityQueue<number>((a, b) => a < b);
    [9, 3, 7, 1, 5].forEach((v) => pq.enqueue(v, v));
    expect(pq.snapshot(3).map((i) => i.priority)).toEqual([1, 3, 5]);
  });

  it('randomized stress vs sorted reference', () => {
    const vals: number[] = [];
    for (let i = 0; i < 500; i++) vals.push(Math.floor(Math.random() * 10000));
    const pq = new PriorityQueue<number>((a, b) => a < b);
    vals.forEach((v) => pq.enqueue(v, v));
    const out: number[] = [];
    while (!pq.isEmpty()) out.push(pq.dequeue()!.value);
    expect(out).toEqual([...vals].sort((a, b) => a - b));
  });
});

/* ------------------------------------------------------------------ */
describe('Heuristics', () => {
  const a: Pos = { row: 2, col: 3 }, b: Pos = { row: 6, col: 9 };
  it('manhattan / euclidean / chebyshev formulas', () => {
    expect(makeHeuristic('manhattan')(a, b)).toBe(10);
    expect(makeHeuristic('euclidean')(a, b)).toBeCloseTo(Math.hypot(4, 6));
    expect(makeHeuristic('chebyshev')(a, b)).toBe(6);
  });

  it('manhattan is admissible for 4-dir unit-cost movement', () => {
    for (let t = 0; t < 20; t++) {
      const g = makeGrid(8, 8, { row: 0, col: 0 }, { row: 7, col: 7 });
      for (let i = 0; i < 10; i++) {
        const idx = Math.floor(Math.random() * 64);
        const p = g.at(idx);
        if ((p.row !== 0 || p.col !== 0) && (p.row !== 7 || p.col !== 7)) g.setWall(idx);
      }
      const res = extract(runGen(dijkstra(g, RUN_CFG)));
      if (res.found) {
        const trueCost = res.path.length - 1;
        expect(makeHeuristic('manhattan')(g.start, g.target)).toBeLessThanOrEqual(trueCost);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
describe('BFS', () => {
  it('finds shortest edge-count path on open grid', () => {
    const g = makeGrid(10, 10, { row: 0, col: 0 }, { row: 9, col: 9 });
    const res = extract(runGen(bfs(g, RUN_CFG)));
    expect(res.found).toBe(true);
    assertValidPath(g, res.path);
    expect(res.path.length).toBe(19); // 9+9 steps + start
    expect(res.path[0]).toEqual(g.start);
    expect(res.path[res.path.length - 1]).toEqual(g.target);
  });

  it('navigates around obstacles with correct length', () => {
    const g = makeGrid(5, 5, { row: 2, col: 0 }, { row: 2, col: 4 });
    for (let r = 1; r < 5; r++) g.setWall(g.idx({ row: r, col: 2 })); // gap at (0,2)
    const res = extract(runGen(bfs(g, RUN_CFG)));
    expect(res.found).toBe(true);
    assertValidPath(g, res.path);
    expect(bruteBfs(g).dist).toBe(8);
    expect(res.path.length - 1).toBe(bruteBfs(g).dist);
  });

  it('reports no path when target enclosed', () => {
    const g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 2, col: 2 });
    [[1, 2], [3, 2], [2, 1], [2, 3]].forEach(([r, c]) => g.setWall(g.idx({ row: r, col: c })));
    const res = extract(runGen(bfs(g, RUN_CFG)));
    expect(res.found).toBe(false);
    expect(res.path.length).toBe(0);
    expect(res.finished).toBeDefined();
  });

  it('handles start == target', () => {
    const p = { row: 3, col: 3 };
    const g = makeGrid(5, 5, p, p);
    const res = extract(runGen(bfs(g, RUN_CFG)));
    expect(res.found).toBe(true);
    expect(res.path.length).toBe(1);
  });

  it('matches brute-force shortest distance on random maps', () => {
    for (let t = 0; t < 10; t++) {
      const g = makeGrid(7, 7, { row: 0, col: 0 }, { row: 6, col: 6 });
      for (let i = 0; i < 15; i++) {
        const idx = Math.floor(Math.random() * 49);
        const p = g.at(idx);
        if (!(p.row === 0 && p.col === 0) && !(p.row === 6 && p.col === 6)) g.setWall(idx);
      }
      const res = extract(runGen(bfs(g, RUN_CFG)));
      const ref = bruteBfs(g);
      expect(res.found).toBe(ref.dist !== -1);
      if (ref.dist !== -1) expect(res.path.length - 1).toBe(ref.dist);
    }
  });
});

function bruteBfs(g: GridModel): { dist: number } {
  const n = g.rows * g.cols;
  const d = new Int32Array(n).fill(-1);
  const s = g.idx(g.start), t = g.idx(g.target);
  d[s] = 0;
  const q = [s];
  for (let h = 0; h < q.length; h++) {
    const cur = q[h];
    if (cur === t) break;
    for (const nb of neighborsOf(g, cur, { diagonal: false, cornerCutting: false })) {
      if (d[nb] === -1) { d[nb] = d[cur] + 1; q.push(nb); }
    }
  }
  return { dist: d[t] };
}

/* ------------------------------------------------------------------ */
describe('DFS', () => {
  it('finds a valid (not necessarily shortest) path', () => {
    const g = makeGrid(10, 10, { row: 0, col: 0 }, { row: 9, col: 9 });
    const res = extract(runGen(dfs(g, RUN_CFG)));
    expect(res.found).toBe(true);
    assertValidPath(g, res.path);
    expect(res.path.length).toBeGreaterThanOrEqual(19);
  });

  it('backtracks around dead ends', () => {
    // Layout (5x5), start (0,0), target (4,4). A wall column at c=2 with a
    // single gap at r=3 forces DFS to explore the left half first; leftover
    // stack duplicates of already-visited cells are popped as the search
    // unwinds through the gap toward the target → explicit BACKTRACK events.
    const g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 4, col: 4 });
    for (let r = 0; r < 5; r++) if (r !== 3) g.setWall(g.idx({ row: r, col: 2 }));
    const events = runGen(dfs(g, RUN_CFG));
    const res = extract(events);
    expect(res.found).toBe(true);
    assertValidPath(g, res.path);
    expect(events.some((e) => e.type === 'BACKTRACK')).toBe(true);
  });

  it('terminates on unreachable target', () => {
    const g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 4, col: 4 });
    for (let r = 0; r < 5; r++) g.setWall(g.idx({ row: r, col: 2 }));
    const res = extract(runGen(dfs(g, RUN_CFG)));
    expect(res.found).toBe(false);
    expect(res.finished).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
describe('Dijkstra', () => {
  it('prefers cheap long route over expensive short route', () => {
    const g = makeGrid(3, 7, { row: 1, col: 0 }, { row: 1, col: 6 });
    for (let c = 1; c < 6; c++) g.setWeight(g.idx({ row: 1, col: c }), 10);
    const res = extract(runGen(dijkstra(g, RUN_CFG)));
    expect(res.found).toBe(true);
    assertValidPath(g, res.path);
    const cost = pathWeightCost(g, res.path);
    expect(cost).toBe(bruteMinCost(g));
    expect(cost).toBeLessThan(50); // through-the-mud would be 50
    expect(res.path.some((p) => p.row === 1 && p.col >= 1 && p.col <= 5)).toBe(false);
  });

  it('equals BFS result on unweighted grids', () => {
    const g = makeGrid(8, 8, { row: 0, col: 0 }, { row: 7, col: 7 });
    for (let i = 0; i < 12; i++) {
      const idx = Math.floor(Math.random() * 64);
      const p = g.at(idx);
      if (!((p.row === 0 && p.col === 0) || (p.row === 7 && p.col === 7))) g.setWall(idx);
    }
    const rb = extract(runGen(bfs(g, RUN_CFG)));
    const rd = extract(runGen(dijkstra(g, RUN_CFG)));
    expect(rb.found).toBe(rd.found);
    if (rb.found) expect(rd.path.length).toBe(rb.path.length);
  });

  it('matches brute-force minimum cost on weighted random maps', () => {
    for (let t = 0; t < 8; t++) {
      const g = makeGrid(6, 6, { row: 0, col: 0 }, { row: 5, col: 5 });
      for (let i = 0; i < 8; i++) {
        const idx = Math.floor(Math.random() * 36);
        const p = g.at(idx);
        if (!((p.row === 0 && p.col === 0) || (p.row === 5 && p.col === 5))) {
          if (Math.random() < 0.5) g.setWall(idx);
          else g.setWeight(idx, [2, 5, 10][Math.floor(Math.random() * 3)]);
        }
      }
      const res = extract(runGen(dijkstra(g, RUN_CFG)));
      const best = bruteMinCost(g);
      if (best === Infinity) expect(res.found).toBe(false);
      else {
        expect(res.found).toBe(true);
        expect(pathWeightCost(g, res.path)).toBe(best);
      }
    }
  });

  it('emits SKIP when a known route is already cheaper (relaxation check)', () => {
    // Layout (4x6): start (1,0), target (1,5). Heavy cell X=(1,2) (cost 10).
    // X is first discovered from (1,1) with tentative dist 1 + 10 = 11. When
    // the cheap top-row chain later settles (0,2) at d = 3, relaxing its edge
    // into the still-open X yields alt = 3 + 10 = 13 ≥ 11 → the engine emits a
    // SKIP event ("keeps its better known distance"). This proves Dijkstra
    // evaluates every incoming edge and only adopts strictly cheaper routes.
    const g = makeGrid(4, 6, { row: 1, col: 0 }, { row: 1, col: 5 });
    g.setWeight(g.idx({ row: 1, col: 2 }), 10);
    const events = runGen(dijkstra(g, RUN_CFG));
    expect(events.some((e) => e.type === 'EVALUATE')).toBe(true);
    expect(events.some((e) => e.type === 'SKIP')).toBe(true);
  });

  it('relaxes distances correctly on weighted abstract graphs', async () => {
    // Graph-mode Dijkstra uses per-edge weights: A→F(10) is discovered first;
    // when C settles at 3, F improves to 7 → genuine decrease-key relaxation.
    const { runGraphSearch } = await import('../components/Graph/GraphBoard');
    const gm = {
      nodes: [
        { id: 0, x: 0, y: 0, label: 'A' }, { id: 1, x: 1, y: 0, label: 'B' },
        { id: 2, x: 0, y: 1, label: 'C' }, { id: 3, x: 1, y: 1, label: 'D' },
        { id: 4, x: 2, y: 0.5, label: 'E' }, { id: 5, x: 2, y: 1.5, label: 'F' },
        { id: 6, x: 3, y: 1, label: 'G' },
      ],
      edges: [
        { a: 0, b: 1, weight: 1 }, { a: 0, b: 2, weight: 3 },
        { a: 1, b: 5, weight: 10 }, { a: 2, b: 5, weight: 4 },
        { a: 1, b: 3, weight: 1 }, { a: 3, b: 6, weight: 8 },
        { a: 5, b: 6, weight: 1 }, { a: 4, b: 6, weight: 1 },
      ],
      start: 0, target: 6,
    };
    const res = runGraphSearch(gm);
    if (typeof res === 'string') throw new Error(res);
    expect(res.path).not.toBeNull();
    // Optimal: A→B→C? no—A-B(1)… best A→B(1)→? B-F 10 ⇒ 11; A→C(3)→F(4)=7 → G(1)=8.
    expect(res.dist.get(5)).toBe(7); // relaxed from 11 (via B) down to 7 (via C)
    expect(res.dist.get(6)).toBe(8);
    expect(res.path).toEqual([0, 2, 5, 6]);
  });
});

/** Brute-force Dijkstra reference over the same movement model. */
function bruteMinCost(g: GridModel): number {
  const n = g.rows * g.cols;
  const dist = new Float64Array(n).fill(Infinity);
  const s = g.idx(g.start), t = g.idx(g.target);
  dist[s] = 0;
  const pq = new PriorityQueue<number>((a, b) => a < b);
  pq.enqueue(s, 0);
  while (!pq.isEmpty()) {
    const { value: cur, priority: d } = pq.dequeue()!;
    if (d > dist[cur]) continue; // stale entry
    if (cur === t) return dist[t];
    for (const nb of neighborsOf(g, cur, { diagonal: false, cornerCutting: false })) {
      const nd = d + edgeCost(g, cur, nb, false);
      if (nd < dist[nb]) { dist[nb] = nd; pq.enqueue(nb, nd); }
    }
  }
  return dist[t];
}

/* ------------------------------------------------------------------ */
describe('A*', () => {
  it('returns optimal cost equal to brute force under Manhattan heuristic', () => {
    for (let t = 0; t < 10; t++) {
      const g = makeGrid(7, 7, { row: 0, col: 0 }, { row: 6, col: 6 });
      for (let i = 0; i < 10; i++) {
        const idx = Math.floor(Math.random() * 49);
        const p = g.at(idx);
        if (!((p.row === 0 && p.col === 0) || (p.row === 6 && p.col === 6))) {
          if (Math.random() < 0.6) g.setWall(idx);
          else g.setWeight(idx, [2, 5, 10][Math.floor(Math.random() * 3)]);
        }
      }
      const ra = extract(runGen(astar(g, RUN_CFG, 'manhattan')));
      const best = bruteMinCost(g);
      if (best === Infinity) expect(ra.found).toBe(false);
      else {
        expect(ra.found).toBe(true);
        expect(pathWeightCost(g, ra.path)).toBe(best);
      }
    }
  });

  it('explores no more nodes than Dijkstra on open grids', () => {
    const g = makeGrid(15, 15, { row: 0, col: 0 }, { row: 14, col: 14 });
    const vd = extract(runGen(dijkstra(g, RUN_CFG))).visitedCount;
    const va = extract(runGen(astar(g, RUN_CFG, 'manhattan'))).visitedCount;
    expect(va).toBeLessThanOrEqual(vd);
  });

  it('emits consistent g/h/f values in events', () => {
    const g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 4, col: 4 });
    const events = runGen(astar(g, RUN_CFG, 'manhattan'));
    const discover = events.find((e) => (e.type === 'DISCOVER' || e.type === 'ADD_TO_FRONTIER') && e.g !== undefined);
    expect(discover).toBeDefined();
    const visit = events.find((e) => e.type === 'VISIT' && e.f !== undefined);
    expect(visit).toBeDefined();
    expect(visit!.f).toBeCloseTo((visit!.g ?? 0) + (visit!.h ?? 0), 5);
  });

  it('supports all three heuristics and stays optimal', () => {
    for (const hId of ['manhattan', 'euclidean', 'chebyshev'] as HeuristicId[]) {
      const g = makeGrid(6, 6, { row: 0, col: 0 }, { row: 5, col: 5 });
      g.setWall(g.idx({ row: 2, col: 2 }));
      g.setWeight(g.idx({ row: 1, col: 1 }), 10);
      const res = extract(runGen(astar(g, RUN_CFG, hId)));
      expect(res.found).toBe(true);
      expect(pathWeightCost(g, res.path)).toBe(bruteMinCost(g));
    }
  });

  it('handles start == target', () => {
    const p = { row: 2, col: 2 };
    const g = makeGrid(5, 5, p, p);
    const res = extract(runGen(astar(g, RUN_CFG, 'manhattan')));
    expect(res.found).toBe(true);
    expect(res.path.length).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
describe('Greedy Best-First', () => {
  it('finds a valid path on open grids', () => {
    const g = makeGrid(10, 10, { row: 0, col: 0 }, { row: 9, col: 9 });
    const rg = extract(runGen(gbfs(g, RUN_CFG, 'manhattan')));
    expect(rg.found).toBe(true);
    assertValidPath(g, rg.path);
  });

  it('may produce suboptimal paths (greedy is not optimal)', () => {
    // Trap layout: greedy dives toward the goal line into a cul-de-sac corridor.
    const g = makeGrid(5, 9, { row: 4, col: 0 }, { row: 0, col: 8 });
    for (let c = 1; c < 8; c++) g.setWall(g.idx({ row: 2, col: c }));
    g.setWall(g.idx({ row: 3, col: 2 }));
    g.setWall(g.idx({ row: 1, col: 5 }));
    const rg = extract(runGen(gbfs(g, RUN_CFG, 'manhattan')));
    const rb = extract(runGen(bfs(g, RUN_CFG)));
    expect(rg.found).toBe(true);
    expect(rb.found).toBe(true);
    assertValidPath(g, rg.path);
    // documented behavior: greedy path length >= optimal edge count
    expect(rg.path.length).toBeGreaterThanOrEqual(rb.path.length);
  });

  it('terminates when no path exists', () => {
    const g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 4, col: 4 });
    for (let r = 0; r < 5; r++) g.setWall(g.idx({ row: r, col: 2 }));
    const res = extract(runGen(gbfs(g, RUN_CFG, 'manhattan')));
    expect(res.found).toBe(false);
    expect(res.finished).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
describe('Diagonal movement consistency', () => {
  it('A* with diagonals finds a valid diagonal path', () => {
    const cfg = { diagonal: true, cornerCutting: true };
    const g = makeGrid(6, 6, { row: 0, col: 0 }, { row: 5, col: 5 });
    g.setWeight(g.idx({ row: 2, col: 2 }), 10);
    const res = extract(runGen(astar(g, cfg, 'chebyshev')));
    expect(res.found).toBe(true);
    assertValidPath(g, res.path, true);
    expect(Math.abs(res.path[0].row - res.path[res.path.length - 1].row)).toBe(5);
  });

  it('corner cutting blocked prevents diagonal slips past walls', () => {
    const cfg = { diagonal: true, cornerCutting: false };
    const g = makeGrid(3, 3, { row: 0, col: 0 }, { row: 2, col: 2 });
    g.setWall(g.idx({ row: 0, col: 1 }));
    g.setWall(g.idx({ row: 1, col: 0 }));
    const nb = neighborsOf(g, g.idx({ row: 0, col: 0 }), cfg);
    expect(nb).not.toContain(g.idx({ row: 1, col: 1 })); // blocked by adjacent walls
  });
});

/* ------------------------------------------------------------------ */
describe('Simulation / Replay engine', () => {
  it('collectEvents produces terminated streams with FINISHED or NO_PATH last', () => {
    const g = makeGrid(8, 8, { row: 0, col: 0 }, { row: 7, col: 7 });
    for (const id of ['bfs', 'dfs', 'dijkstra', 'astar', 'gbfs'] as AlgorithmId[]) {
      const events = collectEvents(g, { algorithm: id, diagonal: false, cornerCutting: false, heuristic: 'manhattan' });
      expect(events.length).toBeGreaterThan(3);
      const last = events[events.length - 1].type;
      expect(last === 'FINISHED' || last === 'NO_PATH').toBe(true);
    }
  });

  it('replayTo(step) equals incremental application (deterministic)', () => {
    const g = makeGrid(6, 6, { row: 0, col: 0 }, { row: 5, col: 5 });
    g.setWall(g.idx({ row: 2, col: 2 }));
    const { events } = simulate(g, { algorithm: 'astar', diagonal: false, cornerCutting: false, heuristic: 'manhattan' });
    const half = Math.floor(events.length / 2);
    // replayTo is inclusive of index `upTo`, so apply events [0..half] manually.
    const mid = replayTo(events, g.cols, half);
    const manual = makeReplayState();
    for (let i = 0; i <= half; i++) applyEvent(manual, g.cols, events[i]);
    expect(mid.visited.size).toBe(manual.visited.size);
    expect(mid.frontier.size).toBe(manual.frontier.size);
    expect(mid.current).toBe(manual.current);
    expect([...mid.pathSoFar]).toEqual([...manual.pathSoFar]);
  });

  it('simulate returns stats consistent with the final replay state', () => {
    const g = makeGrid(10, 10, { row: 0, col: 0 }, { row: 9, col: 9 });
    const { events, stats } = simulate(g, { algorithm: 'bfs', diagonal: false, cornerCutting: false, heuristic: 'manhattan' });
    const final = replayTo(events, g.cols, events.length - 1);
    expect(stats.found).toBe(true);
    // VISIT events count may include the target itself; final replay set is authoritative.
    expect(stats.visitedCount).toBe(final.visited.size);
    // BFS emits VISIT for every settled node except the target, which is added
    // to the visited set by the TARGET_FOUND handler in the replay engine.
    expect(events.filter((e) => e.type === 'VISIT').length + 1).toBe(stats.visitedCount);
    expect(stats.pathLength).toBe(final.pathSoFar.length);
    expect(stats.maxFrontier).toBeGreaterThan(0);
    expect(stats.pathCost).toBeGreaterThan(0);
  });

  it('every event node is inside bounds', () => {
    const g = makeGrid(5, 5, { row: 0, col: 0 }, { row: 4, col: 4 });
    const events = collectEvents(g, { algorithm: 'dijkstra', diagonal: false, cornerCutting: false, heuristic: 'manhattan' });
    for (const e of events) {
      if (e.node) {
        expect(e.node.row).toBeGreaterThanOrEqual(0);
        expect(e.node.row).toBeLessThan(g.rows);
        expect(e.node.col).toBeGreaterThanOrEqual(0);
        expect(e.node.col).toBeLessThan(g.cols);
      }
    }
  });
});

/* ------------------------------------------------------------------ */
describe('Maze generators boundary conditions', () => {
  const rows = 21, cols = 31;
  const start: Pos = { row: 10, col: 1 }, target: Pos = { row: 10, col: 29 };

  function solvable(g: GridModel): boolean {
    return extract(runGen(bfs(g, RUN_CFG))).found;
  }

  it('randomWalls keeps endpoints walkable', async () => {
    const { randomWalls, mulberry32 } = await import('../maze/generators');
    const g = makeGrid(rows, cols, start, target);
    const rng = mulberry32(42);
    applyOps(g, randomWalls(rows, cols, 0.25, rng, new Set([g.idx(start), g.idx(target)]) as any));
    expect(g.isWalkable(g.idx(start))).toBe(true);
    expect(g.isWalkable(g.idx(target))).toBe(true);
  });

  it('recursiveDivision produces a solvable maze', async () => {
    const { recursiveDivision, mulberry32 } = await import('../maze/generators');
    const g = makeGrid(rows, cols, start, target);
    applyOps(g, recursiveDivision(rows, cols, mulberry32(7)));
    expect(g.isWalkable(g.idx(start))).toBe(true);
    expect(g.isWalkable(g.idx(target))).toBe(true);
    expect(solvable(g)).toBe(true);
    assertValidPath(g, extract(runGen(bfs(g, RUN_CFG))).path);
  });

  it('dfsMaze produces a solvable maze', async () => {
    const { dfsMaze, mulberry32 } = await import('../maze/generators');
    const g = makeGrid(rows, cols, start, target);
    applyOps(g, dfsMaze(rows, cols, mulberry32(123)));
    expect(g.isWalkable(g.idx(start))).toBe(true);
    expect(g.isWalkable(g.idx(target))).toBe(true);
    expect(solvable(g)).toBe(true);
  });

  it('primMaze produces a solvable maze', async () => {
    const { primMaze, mulberry32 } = await import('../maze/generators');
    const g = makeGrid(rows, cols, start, target);
    applyOps(g, primMaze(rows, cols, mulberry32(999)));
    expect(g.isWalkable(g.idx(start))).toBe(true);
    expect(g.isWalkable(g.idx(target))).toBe(true);
    expect(solvable(g)).toBe(true);
  });

  it('mulberry32 is deterministic for a seed', async () => {
    const { mulberry32 } = await import('../maze/generators');
    const a = mulberry32(48291), b = mulberry32(48291);
    for (let i = 0; i < 50; i++) expect(a()).toBe(b());
  });
});
