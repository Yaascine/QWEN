/** Shared runtime state + event helpers for grid search algorithms. */
import type { Pos } from '../types';
import { GridModel, neighborsOf, edgeCost } from './grid';

export interface RunConfig {
  diagonal: boolean;
  cornerCutting: boolean;
}

export const frontierLimit = 12;

export function makeState(grid: GridModel) {
  const n = grid.rows * grid.cols;
  return {
    parent: new Int32Array(n).fill(-1),
    visited: new Uint8Array(n),
    inFrontier: new Uint8Array(n),
    g: new Float64Array(n).fill(Infinity),
    order: 0,
    discoveredOrder: new Int32Array(n).fill(-1),
    visitedOrder: new Int32Array(n).fill(-1),
  };
}

export type SearchState = ReturnType<typeof makeState>;

export function posStr(p: Pos): string {
  return `(${p.row},${p.col})`;
}

export interface FrontierSnap {
  nodes: Pos[];
  priorities: number[];
}

/** Ordered snapshot of a queue/stack (positions only, index order preserved). */
export function frontierSnapshot(list: Iterable<number>, cols: number, limit = frontierLimit): Pos[] {
  const out: Pos[] = [];
  for (const idx of list) {
    out.push({ row: Math.floor(idx / cols), col: idx % cols });
    if (out.length >= limit) break;
  }
  return out;
}

/** Ordered snapshot with parallel priority values (for the PQ viewer). */
export function frontierSnapWithPriorities(entries: Iterable<[number, number]>, cols: number, limit = frontierLimit): FrontierSnap {
  const nodes: Pos[] = [];
  const priorities: number[] = [];
  for (const [idx, pr] of entries) {
    nodes.push({ row: Math.floor(idx / cols), col: idx % cols });
    priorities.push(pr);
    if (nodes.length >= limit) break;
  }
  return { nodes, priorities };
}

/** Reconstruct path by following parent pointers target → start. */
export function reconstructPath(state: SearchState, grid: GridModel, targetIdx: number): Pos[] {
  const path: Pos[] = [];
  let cur = targetIdx;
  while (cur !== -1) {
    path.push(grid.at(cur));
    cur = state.parent[cur];
  }
  path.reverse();
  return path;
}

export function pathCost(grid: GridModel, path: Pos[], cfg: RunConfig): number {
  let cost = 0;
  for (let i = 1; i < path.length; i++) {
    cost += edgeCost(grid, grid.idx(path[i - 1]), grid.idx(path[i]), cfg.diagonal);
  }
  return Math.round(cost * 1000) / 1000;
}

export interface NeighborInfo {
  idx: number;
  pos: Pos;
  cost: number;
}

export function walkableNeighbors(grid: GridModel, idx: number, cfg: RunConfig): NeighborInfo[] {
  return neighborsOf(grid, idx, cfg).map((n) => ({
    idx: n,
    pos: grid.at(n),
    cost: edgeCost(grid, idx, n, cfg.diagonal),
  }));
}
