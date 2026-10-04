/** Deterministic board snapshots for JSON export/import. */
import type { BoardExport, Pos } from '../types';
import { GridModel } from '../algorithms/grid';

export function exportBoard(grid: GridModel, seed?: number): BoardExport {
  const walls: Pos[] = [];
  const weights: { pos: Pos; weight: number }[] = [];
  for (let i = 0; i < grid.rows * grid.cols; i++) {
    if (grid.kind[i] === 1) walls.push(grid.at(i));
    else if (grid.kind[i] === 2) weights.push({ pos: grid.at(i), weight: grid.weight[i] });
  }
  return { version: 1, rows: grid.rows, cols: grid.cols, walls, weights, start: grid.start, target: grid.target, seed };
}

export function importBoard(json: unknown): BoardExport | string {
  if (typeof json !== 'object' || json === null) return 'Invalid JSON: not an object.';
  const b = json as Partial<BoardExport>;
  if (b.version !== 1) return 'Unsupported board format version.';
  if (!Number.isInteger(b.rows) || !Number.isInteger(b.cols)) return 'Missing rows/cols.';
  if (!Array.isArray(b.walls) || !Array.isArray(b.weights) || !b.start || !b.target) {
    return 'Missing walls/weights/start/target fields.';
  }
  return b as BoardExport;
}

export function applyImported(board: BoardExport): GridModel {
  const g = new GridModel(board.rows, board.cols, board.start, board.target);
  for (const w of board.walls) {
    const p = { row: w.row, col: w.col };
    if (g.inBounds(p)) g.setWall(g.idx(p));
  }
  for (const t of board.weights) {
    const p = { row: t.pos.row, col: t.pos.col };
    if (g.inBounds(p)) g.setWeight(g.idx(p), t.weight);
  }
  return g;
}
