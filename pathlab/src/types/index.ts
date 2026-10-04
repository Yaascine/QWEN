/** Core domain types shared by algorithms, simulation and UI. */

export type AlgorithmId = 'bfs' | 'dfs' | 'dijkstra' | 'astar' | 'gbfs';

export type HeuristicId = 'manhattan' | 'euclidean' | 'chebyshev';

export type CellType = 'normal' | 'wall' | 'weight';

/** Static board model — mutated only through BoardStore actions. */
export interface Cell {
  row: number;
  col: number;
  type: CellType;
  /** Movement cost to ENTER this cell (1 for normal/walkable default). */
  weight: number;
}

export interface Pos {
  row: number;
  col: number;
}

export type SearchStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'found'
  | 'nopath'
  | 'finished';

export type Tool = 'pointer' | 'start' | 'target' | 'wall' | 'weight' | 'eraser';

export type EditMode = 'draw' | 'erase';

export interface Settings {
  diagonal: boolean;
  cornerCutting: boolean;
  heuristic: HeuristicId;
  showGrid: boolean;
  showDirections: boolean; // parent arrows
  showValues: boolean; // g/h/f text in cells
  showCoords: boolean;
  animatePath: boolean;
  liveMode: boolean; // re-run search when environment changes mid-search
}

/* ------------------------------------------------------------------ */
/* Search events                                                       */
/* ------------------------------------------------------------------ */

export type SearchEventType =
  | 'INIT'
  | 'SET_CURRENT'
  | 'DISCOVER'
  | 'ADD_TO_FRONTIER'
  | 'REMOVE_FROM_FRONTIER'
  | 'VISIT'
  | 'SET_PARENT'
  | 'UPDATE_COST'
  | 'BACKTRACK'
  | 'EVALUATE'
  | 'SKIP'
  | 'TARGET_FOUND'
  | 'PATH_NODE'
  | 'FINISHED'
  | 'NO_PATH';

export interface SearchEvent {
  type: SearchEventType;
  /** Node the event refers to (may be null for global events). */
  node?: Pos;
  /** Parent involved (for SET_PARENT / DISCOVER). */
  parent?: Pos;
  /** Cost fields when relevant. */
  g?: number;
  h?: number;
  f?: number;
  oldCost?: number;
  newCost?: number;
  depth?: number;
  /** Snapshot of frontier contents after the event (bounded, ordered). */
  frontier?: Pos[];
  /** Priority value matching each frontier snapshot entry (queue/heap order). */
  frontierPriorities?: number[];
  /** Whether `frontier` is a complete picture of the structure (queue/stack) or a partial heap sample. */
  frontierComplete?: boolean;
  /** Human-readable educational explanation for the event log. */
  message?: string;
  /** Pseudocode line index to highlight while this event plays. */
  line?: number;
}

export interface AlgorithmStats {
  visitedCount: number;
  discoveredCount: number;
  maxFrontier: number;
  pathLength: number;
  pathCost: number;
  runtimeMs: number;
  operations: number;
  maxDepth: number;
  found: boolean;
}

export interface AlgorithmResult {
  found: boolean;
  /** Path from start to target as a flat [row, col] list, empty if none. */
  path: Pos[];
  stats: AlgorithmStats;
}

/* ------------------------------------------------------------------ */
/* Algorithm metadata                                                  */
/* ------------------------------------------------------------------ */

export interface AlgorithmMeta {
  id: AlgorithmId;
  name: string;
  short: string;
  description: string;
  strategy: string;
  structure: string;
  supportsWeights: boolean;
  guaranteesShortest: string;
  complete: string;
  timeComplexity: string;
  spaceComplexity: string;
  heuristicNote: string;
  hint: string;
  pseudocode: string[];
  accent: string; // css color token name suffix
}

/* ------------------------------------------------------------------ */
/* Graph mode                                                          */
/* ------------------------------------------------------------------ */

export interface GraphNode {
  id: number;
  x: number;
  y: number;
  label: string;
}

export interface GraphEdge {
  a: number;
  b: number;
  weight: number;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  start: number | null;
  target: number | null;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

export interface BoardExport {
  version: 1;
  rows: number;
  cols: number;
  walls: Pos[];
  weights: { pos: Pos; weight: number }[];
  start: Pos;
  target: Pos;
  seed?: number;
  settings?: Partial<Settings>;
}
