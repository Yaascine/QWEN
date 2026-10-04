import type { Cell, HeuristicId, Pos, Settings } from '../types';

/** Flat board model: typed arrays indexed by row * cols + col. */
export class GridModel {
  readonly rows: number;
  readonly cols: number;
  /** 0 = walkable, 1 = wall, 2 = weighted terrain */
  readonly kind: Uint8Array;
  readonly weight: Float64Array;
  start: Pos;
  target: Pos;

  constructor(rows: number, cols: number, start: Pos, target: Pos) {
    this.rows = rows;
    this.cols = cols;
    this.kind = new Uint8Array(rows * cols);
    this.weight = new Float64Array(rows * cols).fill(1);
    this.start = { ...start };
    this.target = { ...target };
  }

  idx(p: Pos): number {
    return p.row * this.cols + p.col;
  }

  at(idx: number): Pos {
    return { row: Math.floor(idx / this.cols), col: idx % this.cols };
  }

  inBounds(p: Pos): boolean {
    return p.row >= 0 && p.row < this.rows && p.col >= 0 && p.col < this.cols;
  }

  isWall(idx: number): boolean {
    return this.kind[idx] === 1;
  }

  isWalkable(idx: number): boolean {
    return this.kind[idx] !== 1;
  }

  costOf(idx: number): number {
    return this.kind[idx] === 2 ? this.weight[idx] : 1;
  }

  cellInfo(idx: number): Cell {
    const p = this.at(idx);
    return {
      row: p.row,
      col: p.col,
      type: this.kind[idx] === 1 ? 'wall' : this.kind[idx] === 2 ? 'weight' : 'normal',
      weight: this.costOf(idx),
    };
  }

  clone(): GridModel {
    const g = new GridModel(this.rows, this.cols, this.start, this.target);
    g.kind.set(this.kind);
    g.weight.set(this.weight);
    return g;
  }

  setWall(idx: number): void {
    if (idx === this.idx(this.start) || idx === this.idx(this.target)) return;
    this.kind[idx] = 1;
    this.weight[idx] = 1;
  }

  setWeight(idx: number, w: number): void {
    if (idx === this.idx(this.start) || idx === this.idx(this.target)) return;
    this.kind[idx] = 2;
    this.weight[idx] = w;
  }

  clearCell(idx: number): void {
    if (idx === this.idx(this.start) || idx === this.idx(this.target)) return;
    this.kind[idx] = 0;
    this.weight[idx] = 1;
  }

  isStart(idx: number): boolean {
    return idx === this.idx(this.start);
  }

  isTarget(idx: number): boolean {
    return idx === this.idx(this.target);
  }
}

/* ------------------------------------------------------------------ */
/* Neighbors                                                           */
/* ------------------------------------------------------------------ */

const ORTHO: [number, number][] = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const DIAG: [number, number][] = [[-1, 1], [1, 1], [1, -1], [-1, -1]];

export const SQRT2 = Math.SQRT2;

/**
 * Walkable neighbor indices of `idx`. Diagonal moves are only allowed when
 * both orthogonal neighbors adjacent to the corner are open (no corner
 * cutting) unless settings.cornerCutting is true.
 */
export function neighborsOf(grid: GridModel, idx: number, settings: Pick<Settings, 'diagonal' | 'cornerCutting'>): number[] {
  const { row, col } = grid.at(idx);
  const out: number[] = [];
  const open = (r: number, c: number): boolean =>
    r >= 0 && r < grid.rows && c >= 0 && c < grid.cols && !grid.isWall(r * grid.cols + c);

  for (const [dr, dc] of ORTHO) {
    const r = row + dr, c = col + dc;
    if (open(r, c)) out.push(r * grid.cols + c);
  }
  if (settings.diagonal) {
    for (const [dr, dc] of DIAG) {
      const r = row + dr, c = col + dc;
      if (!open(r, c)) continue;
      if (!settings.cornerCutting && !(open(row + dr, col) && open(row, col + dc))) continue;
      out.push(r * grid.cols + c);
    }
  }
  return out;
}

/** Edge traversal cost from `fromIdx` into `toIdx` honoring terrain and diagonals. */
export function edgeCost(grid: GridModel, fromIdx: number, toIdx: number, diagonalMove: boolean): number {
  const a = grid.at(fromIdx);
  const b = grid.at(toIdx);
  const diag = a.row !== b.row && a.col !== b.col;
  const base = grid.costOf(toIdx);
  if (diag && diagonalMove) return base * SQRT2;
  return base;
}

/* ------------------------------------------------------------------ */
/* Heuristics                                                          */
/* ------------------------------------------------------------------ */

export type HeuristicFn = (a: Pos, b: Pos) => number;

/**
 * Note: admissibility depends on the movement model and terrain. Manhattan is
 * admissible for 4-direction unit-cost grids; with diagonals (√2 steps) it can
 * overestimate, and any weighted terrain can break admissibility of all three —
 * PathLab surfaces this honestly in the UI rather than silently "fixing" it.
 */
export function makeHeuristic(id: HeuristicId): HeuristicFn {
  switch (id) {
    case 'manhattan':
      return (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
    case 'euclidean':
      return (a, b) => Math.hypot(a.row - b.row, a.col - b.col);
    case 'chebyshev':
      return (a, b) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
  }
}

export const HEURISTIC_FORMULAS: Record<HeuristicId, string> = {
  manhattan: 'h(n) = |x₁−x₂| + |y₁−y₂|',
  euclidean: 'h(n) = √((x₁−x₂)² + (y₁−y₂)²)',
  chebyshev: 'h(n) = max(|x₁−x₂|, |y₁−y₂|)',
};

export function encodePos(p: Pos): string {
  return `${p.row},${p.col}`;
}
