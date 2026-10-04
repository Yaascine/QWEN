/** Educational board presets — each highlights a specific search behavior. */
import { GridModel } from '../algorithms/grid';

export interface Preset {
  id: string;
  name: string;
  explain: string;
  build: (rows: number, cols: number) => GridModel;
}

function base(rows: number, cols: number): GridModel {
  return new GridModel(rows, cols, { row: Math.floor(rows / 2), col: 2 }, { row: Math.floor(rows / 2), col: cols - 3 });
}

export const PRESETS: Preset[] = [
  {
    id: 'open-field',
    name: 'Open Field',
    explain: 'Clean arena — watch BFS waves vs A* directness.',
    build: (r, c) => base(r, c),
  },
  {
    id: 'narrow-corridor',
    name: 'Narrow Corridor',
    explain: 'One snaking passage — every algorithm must follow the same route.',
    build: (rows: number, cols: number): GridModel => {
      const g = base(rows, cols);
      for (let i = 0; i < rows * cols; i++) if (!g.isStart(i) && !g.isTarget(i)) g.setWall(i);
      // carve a snake
      const mid = Math.floor(rows / 2);
      let r = mid;
      for (let c = 1; c < cols - 1; c += 4) {
        const down = (c / 4) % 2 === 0;
        const r1 = down ? rows - 2 : 1;
        const step = down ? 1 : -1;
        for (let rr = r; rr !== r1 + step; rr += step) g.clearCell(rr * cols + c);
        for (let cc = c; cc <= Math.min(c + 4, cols - 2); cc++) g.clearCell(r1 * cols + cc);
        r = r1;
      }
      g.clearCell(g.idx(g.start));
      g.clearCell(g.idx(g.target));
      return g;
    },
  },
  {
    id: 'weighted-shortcut',
    name: 'Weighted Shortcut',
    explain: 'Direct route crosses expensive mud (×10). The long way is cheaper — BFS/A*-edge-count disagrees with Dijkstra cost.',
    build: (rows: number, cols: number): GridModel => {
      const g = base(rows, cols);
      const mid = Math.floor(rows / 2);
      // mud band straight ahead
      for (let r = mid - 5; r <= mid + 5; r++) {
        for (let c = Math.floor(cols * 0.4); c <= Math.floor(cols * 0.6); c++) g.setWeight(r * cols + c, 10);
      }
      // cheap wide detour above
      for (let c = 2; c < cols - 3; c++) {
        for (let r = 1; r <= 3; r++) g.clearCell(r * cols + c);
      }
      return g;
    },
  },
  {
    id: 'heuristic-trap',
    name: 'Heuristic Trap',
    explain: 'A deceptive pocket pulls greedy search toward it — GBFS dives in, A* evaluates before committing.',
    build: (rows: number, cols: number): GridModel => {
      const g = base(rows, cols);
      const mid = Math.floor(rows / 2);
      const cx = Math.floor(cols * 0.5);
      // U-shaped wall pocket opening toward target side
      for (let r = mid - 6; r <= mid + 6; r++) {
        if (r >= mid - 1 && r <= mid + 1) continue;
        g.setWall(r * cols + (cx - 4));
      }
      for (let c = cx - 4; c <= cx + 4; c++) g.setWall((mid - 6) * cols + c);
      for (let c = cx - 4; c <= cx + 4; c++) g.setWall((mid + 6) * cols + c);
      g.setWall(mid * cols + (cx + 4));
      // dense block inside pocket to force dead-end exploration
      for (let r = mid - 4; r <= mid + 4; r++) {
        for (let c = cx - 2; c <= cx; c++) if ((r + c) % 3 !== 0) g.setWall(r * cols + c);
      }
      return g;
    },
  },
  {
    id: 'large-maze',
    name: 'Large Maze',
    explain: 'Dense perfect maze — compare how many nodes each algorithm needs.',
    build: (rows: number, cols: number): GridModel => {
      const g = base(rows, cols);
      // deterministic pattern maze (no rng so preset is reproducible)
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          if ((r % 4 === 0 && c % 2 === 0) || (c % 6 === 0 && r % 2 === 0)) g.setWall(r * cols + c);
        }
      }
      // guarantee start/target open and lanes clear
      for (let c = 0; c < 6; c++) g.clearCell(g.start.row * cols + c);
      for (let c = cols - 6; c < cols; c++) g.clearCell(g.target.row * cols + c);
      return g;
    },
  },
  {
    id: 'dfs-deadend',
    name: 'DFS Dead End',
    explain: 'Tempting first branch is a dead end — DFS explores it fully before backtracking.',
    build: (rows: number, cols: number): GridModel => {
      const g = base(rows, cols);
      const mid = Math.floor(rows / 2);
      const bx = Math.floor(cols * 0.25);
      // vertical wall right of start with one gap at top
      for (let r = 0; r < rows - 1; r++) {
        if (r === 2) continue;
        g.setWall(r * cols + bx);
      }
      // dead-end alcove behind the gap
      for (let c = bx + 1; c < bx + 8 && c < cols - 2; c++) {
        g.setWall(0 * cols + c);
        g.setWall(6 * cols + c);
      }
      // main path along the bottom
      for (let c = bx + 1; c < cols - 2; c++) g.clearCell((rows - 3) * cols + c);
      void mid;
      return g;
    },
  },
  {
    id: 'bfs-wave',
    name: 'BFS Wave',
    explain: 'Sparse obstacles — BFS shows its clean concentric wavefront.',
    build: (rows: number, cols: number): GridModel => {
      const g = base(rows, cols);
      const mid = Math.floor(rows / 2);
      for (let k = 0; k < 30; k++) {
        const r = (k * 7 + 3) % (rows - 2) + 1;
        const c = (k * 13 + 5) % (cols - 2) + 1;
        g.setWall(r * cols + c);
      }
      void mid;
      return g;
    },
  },
  {
    id: 'dijkstra-terrain',
    name: 'Dijkstra Terrain',
    explain: 'Three terrain bands (forest ×2, sand ×5, water ×10) — watch the wavefront slow in costly ground.',
    build: (rows: number, cols: number): GridModel => {
      const g = base(rows, cols);
      const third = Math.floor(cols / 3);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (c > third && c <= third * 2) g.setWeight(r * cols + c, 2);
          else if (c > third * 2) g.setWeight(r * cols + c, r % 3 === 0 ? 10 : 5);
        }
      }
      g.clearCell(g.idx(g.target));
      return g;
    },
  },
  {
    id: 'astar-demo',
    name: 'A* Demonstration',
    explain: 'Classic demo map: A* threads between walls while Dijkstra floods both sides.',
    build: (rows: number, cols: number): GridModel => {
      const g = base(rows, cols);
      const mid = Math.floor(rows / 2);
      for (let r = mid - 8; r <= mid + 2; r++) if (r >= 0 && r < rows) g.setWall(r * cols + Math.floor(cols * 0.3));
      for (let r = mid - 2; r <= mid + 8; r++) if (r >= 0 && r < rows) g.setWall(r * cols + Math.floor(cols * 0.55));
      for (let r = mid - 6; r <= mid + 6; r++) if (r >= 0 && r < rows) g.setWall(r * cols + Math.floor(cols * 0.78));
      return g;
    },
  },
];
