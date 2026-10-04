import type { AlgorithmId, AlgorithmStats, HeuristicId, Pos, SearchEvent } from '../types';
import { GridModel } from '../algorithms/grid';
import { bfs } from '../algorithms/bfs';
import { dfs } from '../algorithms/dfs';
import { dijkstra } from '../algorithms/dijkstra';
import { astar } from '../algorithms/astar';
import { gbfs } from '../algorithms/gbfs';

export interface EngineConfig {
  algorithm: AlgorithmId;
  diagonal: boolean;
  cornerCutting: boolean;
  heuristic: HeuristicId;
}

/**
 * SearchEngine materializes the full event stream for a run.
 * The algorithms themselves are generators; pre-collecting events enables
 * pause / resume / step / scrub without the UI touching algorithm internals.
 */
export function collectEvents(grid: GridModel, cfg: EngineConfig): SearchEvent[] {
  const runCfg = { diagonal: cfg.diagonal, cornerCutting: cfg.cornerCutting };
  let gen: Generator<SearchEvent>;
  switch (cfg.algorithm) {
    case 'bfs': gen = bfs(grid, runCfg); break;
    case 'dfs': gen = dfs(grid, runCfg); break;
    case 'dijkstra': gen = dijkstra(grid, runCfg); break;
    case 'astar': gen = astar(grid, runCfg, cfg.heuristic); break;
    case 'gbfs': gen = gbfs(grid, runCfg, cfg.heuristic); break;
  }
  const events: SearchEvent[] = [];
  for (const ev of gen) {
    events.push(ev);
    if (events.length > 250_000) break; // hard safety cap on pathological boards
  }
  return events;
}

/* ------------------------------------------------------------------ */
/* Replay — deterministic visualization state from an event prefix     */
/* ------------------------------------------------------------------ */

export interface ReplayState {
  visited: Set<number>;
  frontier: Set<number>;
  current: number | null;
  pathSoFar: number[];
  parent: Map<number, number>;
  g: Map<number, number>;
  h: Map<number, number>;
  f: Map<number, number>;
  depth: Map<number, number>;
  visitedOrder: number;
  discoveredCount: number;
  /** Per-node discovery & visit sequence numbers (index by cell idx). */
  discoveredSeq: Map<number, number>;
  visitedSeq: Map<number, number>;
  /** Accumulated path cost of the reconstructed path so far. */
  pathCostSoFar: number;
  runTimeMs: number;
  /** Wall-clock ms captured when TARGET_FOUND fires (set by store). */
  foundAtMs: number | null;
  /** Event index at which TARGET_FOUND fired (set by store) — deterministic search-time marker. */
  foundAtEvent: number | null;
  /** Monotonic event counter used as a fallback "search time" measure. */
  eventsApplied: number;
  maxDepth: number;
  targetFound: boolean;
  noPath: boolean;
  lastFrontierList: Pos[];
  lastFrontierPriorities: number[];
  frontierComplete: boolean;
  maxFrontier: number;
  currentDepth: number;
  evaluating: number | null;
  lastEventIndex: number;
  lastMessage: string;
  pseudocodeLine: number | null;
}

export function makeReplayState(): ReplayState {
  return {
    visited: new Set(),
    frontier: new Set(),
    current: null,
    pathSoFar: [],
    parent: new Map(),
    g: new Map(),
    h: new Map(),
    f: new Map(),
    depth: new Map(),
    visitedOrder: 0,
    discoveredCount: 0,
    discoveredSeq: new Map(),
    visitedSeq: new Map(),
    pathCostSoFar: 0,
    runTimeMs: 0,
    foundAtMs: null,
    foundAtEvent: null,
    eventsApplied: 0,
    maxDepth: 0,
    targetFound: false,
    noPath: false,
    lastFrontierList: [],
    lastFrontierPriorities: [],
    frontierComplete: true,
    maxFrontier: 0,
    currentDepth: 0,
    evaluating: null,
    lastEventIndex: -1,
    lastMessage: '',
    pseudocodeLine: null,
  };
}

export function applyEvent(state: ReplayState, cols: number, ev: SearchEvent): void {
  const idxOf = (p?: Pos) => (p ? p.row * cols + p.col : undefined);
  switch (ev.type) {
    case 'INIT': {
      const i = idxOf(ev.node)!;
      state.frontier.add(i);
      state.discoveredCount++;
      state.discoveredSeq.set(i, 1);
      break;
    }
    case 'SET_CURRENT': {
      const i = idxOf(ev.node)!;
      state.frontier.delete(i);
      state.current = i;
      break;
    }
    case 'DISCOVER':
    case 'ADD_TO_FRONTIER': {
      const i = idxOf(ev.node)!;
      if (!state.visited.has(i) && !state.frontier.has(i) && !state.discoveredSeq.has(i)) {
        state.discoveredCount++;
        state.discoveredSeq.set(i, state.discoveredCount);
      }
      state.frontier.add(i);
      if (ev.parent) state.parent.set(i, idxOf(ev.parent)!);
      break;
    }
    case 'REMOVE_FROM_FRONTIER': {
      const i = idxOf(ev.node)!;
      state.frontier.delete(i);
      break;
    }
    case 'VISIT': {
      const i = idxOf(ev.node)!;
      state.frontier.delete(i);
      if (!state.visited.has(i)) {
        state.visited.add(i);
        state.visitedOrder++;
        state.visitedSeq.set(i, state.visitedOrder);
      }
      state.current = i;
      break;
    }
    case 'UPDATE_COST': {
      const i = idxOf(ev.node)!;
      state.frontier.add(i);
      if (ev.parent !== undefined) state.parent.set(i, idxOf(ev.parent)!);
      break;
    }
    case 'SET_PARENT': {
      const i = idxOf(ev.node)!;
      if (ev.parent) state.parent.set(i, idxOf(ev.parent)!);
      break;
    }
    case 'BACKTRACK': {
      const i = idxOf(ev.node)!;
      state.frontier.delete(i);
      break;
    }
    case 'EVALUATE': {
      const i = idxOf(ev.node)!;
      state.evaluating = i;
      break;
    }
    case 'SKIP': {
      state.evaluating = null;
      break;
    }
    case 'TARGET_FOUND': {
      const i = idxOf(ev.node)!;
      state.frontier.delete(i);
      if (!state.visited.has(i)) {
        state.visited.add(i);
        state.visitedOrder++;
        state.visitedSeq.set(i, state.visitedOrder);
      }
      // Deterministic "search time": the event index at which the target was
      // discovered (excludes path reconstruction).
      if (state.foundAtEvent === null) state.foundAtEvent = state.lastEventIndex + 1;
      // Path reconstruction begins at TARGET — seed pathSoFar so PATH_NODE
      // events replay in start→target order.
      state.pathSoFar = [i];
      state.current = i;
      state.targetFound = true;
      break;
    }
    case 'PATH_NODE': {
      const i = idxOf(ev.node)!;
      if (state.pathSoFar.length === 0) state.pathSoFar.push(i);
      else state.pathSoFar.push(i);
      const gEnd = state.g.get(i);
      if (gEnd !== undefined && Number.isFinite(gEnd)) state.pathCostSoFar = gEnd;
      break;
    }
    case 'FINISHED': {
      state.current = null;
      state.evaluating = null;
      // Keep any frontier entries that remain for honest final stats, but
      // drop them from the live view only when a path was found.
      if (state.targetFound) {
        state.frontier.clear();
        state.lastFrontierList = [];
        state.lastFrontierPriorities = [];
      }
      break;
    }
    case 'NO_PATH': {
      state.noPath = true;
      state.current = null;
      state.evaluating = null;
      state.frontier.clear();
      state.lastFrontierList = [];
      state.lastFrontierPriorities = [];
      break;
    }
  }

  // Record scores for the inspector regardless of event type.
  if (ev.node) {
    const i = idxOf(ev.node)!;
    if (ev.g !== undefined) state.g.set(i, ev.g);
    if (ev.h !== undefined) state.h.set(i, ev.h);
    if (ev.f !== undefined) state.f.set(i, ev.f);
    if (ev.depth !== undefined) state.depth.set(i, ev.depth);
  }
  if (ev.type === 'VISIT' || ev.type === 'SET_CURRENT') state.evaluating = null;
  if (ev.depth !== undefined) {
    state.currentDepth = ev.depth;
    if (ev.depth > state.maxDepth) state.maxDepth = ev.depth;
  }
  if (ev.frontier) {
    state.lastFrontierList = ev.frontier;
    state.lastFrontierPriorities = ev.frontierPriorities ?? [];
    state.frontierComplete = ev.frontierComplete ?? false;
    state.frontier.clear();
    for (const p of ev.frontier) state.frontier.add(p.row * cols + p.col);
    const sizeGuess = ev.frontierComplete ? ev.frontier.length : Math.max(ev.frontier.length, state.frontier.size);
    if (sizeGuess > state.maxFrontier) state.maxFrontier = sizeGuess;
  } else if (state.frontier.size > state.maxFrontier) {
    state.maxFrontier = state.frontier.size;
  }
  if (ev.message) state.lastMessage = ev.message;
  state.pseudocodeLine = ev.line ?? state.pseudocodeLine;
  state.lastEventIndex++;
}

/** Fast-forward replay to `upTo` (inclusive). Used when scrubbing backwards. */
export function replayTo(events: SearchEvent[], cols: number, upTo: number): ReplayState {
  const st = makeReplayState();
  const limit = Math.min(upTo, events.length - 1);
  for (let i = 0; i <= limit; i++) applyEvent(st, cols, events[i]);
  return st;
}

/**
 * Run an algorithm headless and summarize the result — used by Compare and
 * Race views without touching the interactive store.
 */
export function simulate(grid: GridModel, cfg: EngineConfig): { events: SearchEvent[]; stats: AlgorithmStats } {
  const t0 = performance.now();
  const events = collectEvents(grid, cfg);
  const computeMs = performance.now() - t0;
  const st = replayTo(events, grid.cols, events.length - 1);
  // Path cost: prefer the settled g of the target (weighted-correct), else sum edges.
  let pathCostVal = 0;
  if (st.pathSoFar.length > 1) {
    const endIdx = st.pathSoFar[st.pathSoFar.length - 1];
    const gEnd = st.g.get(endIdx);
    if (gEnd !== undefined && Number.isFinite(gEnd)) {
      pathCostVal = gEnd;
    } else {
      for (let i = 1; i < st.pathSoFar.length; i++) pathCostVal += grid.costOf(st.pathSoFar[i]);
    }
  }
  const foundIdx = events.findIndex((e) => e.type === 'TARGET_FOUND');
  const searchFrac = foundIdx >= 0 ? (foundIdx + 1) / Math.max(1, events.length) : 1;
  return {
    events,
    stats: {
      visitedCount: st.visited.size,
      discoveredCount: st.discoveredCount,
      maxFrontier: st.maxFrontier,
      pathLength: st.pathSoFar.length,
      pathCost: Math.round(pathCostVal * 1000) / 1000,
      runtimeMs: Math.round(computeMs * searchFrac * 1000) / 1000,
      operations: events.length,
      maxDepth: st.maxDepth,
      found: st.targetFound,
    },
  };
}
