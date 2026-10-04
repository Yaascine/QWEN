/** Seeded PRNG (mulberry32) + maze/terrain generators that emit cell events. */
import type { Pos } from '../types';

export type CellOp =
  | { kind: 'wall'; pos: Pos; on: boolean }
  | { kind: 'weight'; pos: Pos; weight: number };

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1e9);
}

export function seedLabel(seed: number): string {
  return `PATHLAB-${seed}`;
}

const ORTHO: [number, number][] = [[-1, 0], [0, 1], [1, 0], [0, -1]];

/** Random scattered walls with given density. */
export function randomWalls(rows: number, cols: number, density: number, rng: () => number, blocked: Set<number>): CellOp[] {
  const ops: CellOp[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (blocked.has(idx)) continue;
      if (rng() < density) ops.push({ kind: 'wall', pos: { row: r, col: c }, on: true });
    }
  }
  return ops;
}

/** Recursive division — thin walls with gaps, produces long straight corridors. */
export function recursiveDivision(rows: number, cols: number, rng: () => number, depth = 9): CellOp[] {
  const ops: CellOp[] = [];
  const occupied = (r: number, c: number) => ops.some((o) => o.kind === 'wall' && o.pos.row === r && o.pos.col === c);

  function divide(r0: number, r1: number, c0: number, c1: number, d: number) {
    if (d <= 0 || r1 - r0 < 3 || c1 - c0 < 3) return;
    const horizontal = r1 - r0 > c1 - c0 ? true : c1 - c0 > r1 - r0 ? false : rng() < 0.5;
    if (horizontal) {
      const candidates: number[] = [];
      for (let r = r0 + 1; r < r1; r += 2) candidates.push(r);
      if (!candidates.length) return;
      const wr = candidates[Math.floor(rng() * candidates.length)];
      const gapC = c0 + 2 * Math.floor(rng() * Math.max(1, Math.floor((c1 - c0) / 2)));
      for (let c = c0; c <= c1; c++) {
        if (c === gapC) continue;
        if (!occupied(wr, c)) ops.push({ kind: 'wall', pos: { row: wr, col: c }, on: true });
      }
      divide(r0, wr - 1, c0, c1, d - 1);
      divide(wr + 1, r1, c0, c1, d - 1);
    } else {
      const candidates: number[] = [];
      for (let c = c0 + 1; c < c1; c += 2) candidates.push(c);
      if (!candidates.length) return;
      const wc = candidates[Math.floor(rng() * candidates.length)];
      const gapR = r0 + 2 * Math.floor(rng() * Math.max(1, Math.floor((r1 - r0) / 2)));
      for (let r = r0; r <= r1; r++) {
        if (r === gapR) continue;
        if (!occupied(r, wc)) ops.push({ kind: 'wall', pos: { row: r, col: wc }, on: true });
      }
      divide(r0, r1, c0, wc - 1, d - 1);
      divide(r0, r1, wc + 1, c1, d - 1);
    }
  }

  divide(0, rows - 1, 0, cols - 1, depth);
  return ops;
}

/** Randomized DFS maze on odd-cell lattice (thin perfect maze). */
export function dfsMaze(rows: number, cols: number, rng: () => number): CellOp[] {
  const R = rows % 2 === 0 ? rows - 1 : rows;
  const C = cols % 2 === 0 ? cols - 1 : cols;
  const visited = new Uint8Array(R * C);
  const wallAt = (r: number, c: number) => r >= 0 && r < R && c >= 0 && c < C && r % 2 === 0 && c % 2 === 0;
  const ops: CellOp[] = [];
  // Start with everything a wall, then carve passages.
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (visited[r * C + c]) continue;
    if (r % 2 === 1 && c % 2 === 1) continue; // keep cells open later
    ops.push({ kind: 'wall', pos: { row: r, col: c }, on: true });
  }
  const clear = (r: number, c: number) => {
    const i = r * C + c;
    const k = ops.findIndex((o) => o.kind === 'wall' && o.pos.row === r && o.pos.col === c);
    if (k !== -1) ops.splice(k, 1);
    void i;
  };

  const stack: [number, number][] = [[1, 1]];
  visited[1 * C + 1] = 1;
  clear(1, 1);
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const dirs = [...ORTHO].sort(() => rng() - 0.5);
    let moved = false;
    for (const [dr, dc] of dirs) {
      const nr = r + dr * 2, nc = c + dc * 2;
      if (nr > 0 && nr < R - 0 && nc > 0 && nc < C - 0 && !visited[nr * C + nc] && (nr < R && nc < C)) {
        visited[nr * C + nc] = 1;
        clear(r + dr, c + dc);
        clear(nr, nc);
        stack.push([nr, nc]);
        moved = true;
        break;
      }
    }
    if (!moved) stack.pop();
  }
  void wallAt;
  return ops;
}

/** Prim's randomized maze. */
export function primMaze(rows: number, cols: number, rng: () => number): CellOp[] {
  const R = rows % 2 === 0 ? rows - 1 : rows;
  const C = cols % 2 === 0 ? cols - 1 : cols;
  const inMaze = new Uint8Array(R * C);
  const ops: CellOp[] = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    ops.push({ kind: 'wall', pos: { row: r, col: c }, on: true });
  }
  const removeWall = (r: number, c: number) => {
    const k = ops.findIndex((o) => o.kind === 'wall' && o.pos.row === r && o.pos.col === c);
    if (k !== -1) ops.splice(k, 1);
  };

  const startR = 1, startC = 1;
  inMaze[startR * C + startC] = 1;
  removeWall(startR, startC);
  const frontier: [number, number, number, number][] = [];
  const addWalls = (r: number, c: number) => {
    for (const [dr, dc] of ORTHO) {
      const nr = r + dr, nc = c + dc;
      if (nr > 0 && nr < R - 1 && nc > 0 && nc < C - 1 && !inMaze[nr * C + nc]) {
        frontier.push([nr, nc, r, c]);
      }
    }
  };
  addWalls(startR, startC);
  while (frontier.length) {
    const ki = Math.floor(rng() * frontier.length);
    const [wr, wc, fr, fc] = frontier.splice(ki, 1)[0];
    if (inMaze[wr * C + wc]) continue;
    inMaze[wr * C + wc] = 1;
    removeWall(wr, wc);
    removeWall((wr + fr) >> 1, (wc + fc) >> 1);
    addWalls(wr, wc);
  }
  return ops;
}

/** Weighted terrain blobs (forest/sand/water). */
export function randomTerrain(rows: number, cols: number, amount: number, rng: () => number, blocked: Set<number>): CellOp[] {
  const weights = [2, 5, 10];
  const ops: CellOp[] = [];
  const blobCount = Math.max(2, Math.floor(amount * 12));
  for (let b = 0; b < blobCount; b++) {
    const w = weights[Math.floor(rng() * weights.length)];
    let r = Math.floor(rng() * rows);
    let c = Math.floor(rng() * cols);
    const size = 6 + Math.floor(rng() * 22);
    for (let i = 0; i < size; i++) {
      const idx = r * cols + c;
      if (!blocked.has(idx)) ops.push({ kind: 'weight', pos: { row: r, col: c }, weight: w });
      const [dr, dc] = ORTHO[Math.floor(rng() * 4)];
      r = Math.min(rows - 1, Math.max(0, r + dr));
      c = Math.min(cols - 1, Math.max(0, c + dc));
    }
  }
  return ops;
}

/** Simple obstacle course: staggered barrier slabs with alternating gaps. */
export function obstacleCourse(rows: number, cols: number, rng: () => number): CellOp[] {
  const ops: CellOp[] = [];
  for (let c = Math.floor(cols / 6); c < cols - 2; c += Math.floor(cols / 6)) {
    const gapStart = Math.floor(rng() * (rows - 8));
    for (let r = 1; r < rows - 1; r++) {
      if (r >= gapStart && r < gapStart + 6) continue;
      ops.push({ kind: 'wall', pos: { row: r, col: c }, on: true });
    }
  }
  return ops;
}
