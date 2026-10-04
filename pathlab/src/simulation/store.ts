import { useSyncExternalStore } from 'react';
import type { AlgorithmId, HeuristicId, Pos, SearchEvent, SearchStatus, Settings, Tool } from '../types';
import { GridModel } from '../algorithms/grid';
import { applyEvent, collectEvents, makeReplayState, replayTo, type ReplayState } from './SearchEngine';
import { exportBoard, importBoard, applyImported } from '../utils/persistence';

export const DEFAULT_ROWS = 24;
export const DEFAULT_COLS = 48;

/** Build the default demo board: start left, target right, obstacles between. */
export function defaultGrid(rows = DEFAULT_ROWS, cols = DEFAULT_COLS): GridModel {
  const g = new GridModel(rows, cols, { row: Math.floor(rows / 2), col: 3 }, { row: Math.floor(rows / 2), col: cols - 4 });
  const midR = Math.floor(rows / 2);
  // Two vertical barriers with offset gaps.
  for (let r = 0; r < rows; r++) {
    if (r < midR - 5 || r > midR + 6) g.setWall(r * cols + Math.floor(cols * 0.35));
    if (r > midR - 6 || r < midR - 99) { /* noop */ }
  }
  for (let r = 1; r < rows - 1; r++) {
    if (r > midR - 4) g.setWall(r * cols + Math.floor(cols * 0.65));
  }
  // Weighted terrain patches near the second barrier.
  for (let r = midR - 3; r <= midR + 3; r++) {
    for (let c = Math.floor(cols * 0.65) + 2; c <= Math.floor(cols * 0.65) + 5; c++) {
      g.setWeight(r * cols + c, r <= midR ? 5 : 2);
    }
  }
  return g;
}

export interface AppState {
  grid: GridModel;
  algorithm: AlgorithmId;
  status: SearchStatus;
  tool: Tool;
  editMode: 'draw' | 'erase';
  weightValue: number;
  speed: number; // steps per second; Infinity = instant
  settings: Settings;
  events: SearchEvent[];
  cursor: number; // last applied event index (-1 = none)
  totalSteps: number; // events.length when a search is loaded (0 otherwise)
  replay: ReplayState;
  runStartMs: number | null;
  elapsedMs: number;
  seed: number | null;
  inspectorIdx: number | null;
  boardVersion: number; // bump to force canvas redraw of static layer
  searchVersion: number; // bump on replay change
  toast: string | null;
  mode: 'grid' | 'graph';
}

const savedSettings = (() => {
  try {
    const raw = localStorage.getItem('pathlab-settings');
    return raw ? (JSON.parse(raw) as Partial<AppState>) : {};
  } catch {
    return {};
  }
})();

const initialState: AppState = {
  grid: defaultGrid(),
  algorithm: (savedSettings.algorithm as AlgorithmId) ?? 'astar',
  status: 'idle',
  tool: 'wall',
  editMode: 'draw',
  weightValue: 2,
  speed: savedSettings.speed ?? 120,
  settings: {
    diagonal: false,
    cornerCutting: false,
    heuristic: 'manhattan',
    showGrid: true,
    showDirections: false,
    showValues: false,
    showCoords: false,
    animatePath: true,
    liveMode: false,
    ...(savedSettings.settings as Partial<Settings> | undefined),
  },
  events: [],
  cursor: -1,
  totalSteps: 0,
  replay: makeReplayState(),
  runStartMs: null,
  elapsedMs: 0,
  seed: null,
  inspectorIdx: null,
  boardVersion: 0,
  searchVersion: 0,
  toast: null,
  mode: 'grid',
};

type Listener = () => void;

class Store {
  state: AppState = initialState;
  private listeners = new Set<Listener>();

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): AppState => this.state;

  set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /* ---------------- selection helpers ---------------- */

  selectedAlgorithm(): AlgorithmId {
    return this.state.algorithm;
  }

  persistPrefs(): void {
    const { algorithm, speed, settings } = this.state;
    try {
      localStorage.setItem('pathlab-settings', JSON.stringify({ algorithm, speed, settings }));
    } catch {
      /* ignore quota errors */
    }
  }

  /* ---------------- search lifecycle ---------------- */

  runSearch(): void {
    const s = this.state;
    const grid = s.grid;
    const t0 = performance.now();
    const events = collectEvents(grid, {
      algorithm: s.algorithm,
      diagonal: s.settings.diagonal,
      cornerCutting: s.settings.cornerCutting,
      heuristic: s.settings.heuristic,
    });
    // Search "compute time": wall-clock ms to materialize the full event stream.
    const computeMs = Math.max(0.1, performance.now() - t0);
    const foundIdx = events.findIndex((e) => e.type === 'TARGET_FOUND');
    const total = events.length;
    // Proportion of the search that happens before the target is discovered
    // (path reconstruction is the tail). Falls back to the whole run.
    const searchFrac = foundIdx >= 0 ? (foundIdx + 1) / total : 1;
    this.set({
      events,
      totalSteps: total,
      cursor: -1,
      replay: makeReplayState(),
      status: 'running',
      runStartMs: computeMs * searchFrac,
      elapsedMs: 0,
      searchVersion: s.searchVersion + 1,
    });
  }

  /** Apply events [from+1 .. to] incrementally (forward only). */
  advance(to: number): void {
    const s = this.state;
    if (to <= s.cursor) return;
    const st = s.replay;
    for (let i = s.cursor + 1; i <= to && i < s.events.length; i++) {
      applyEvent(st, s.grid.cols, s.events[i]);
    }
    const done = to >= s.events.length - 1;
    const found = st.targetFound;
    const status: SearchStatus = done ? (found ? 'found' : 'nopath') : s.status;
    // runStartMs already holds compute time scaled to the pre-TARGET_FOUND
    // fraction of events, so completion simply reports it.
    const elapsed = done ? Math.max(0, s.runStartMs ?? 0) : s.elapsedMs;
    this.set({
      cursor: Math.min(to, s.events.length - 1),
      replay: st,
      status,
      elapsedMs: elapsed,
      searchVersion: s.searchVersion + 1,
    });
  }

  goTo(to: number): void {
    const s = this.state;
    const clamped = Math.max(-1, Math.min(to, s.events.length - 1));
    if (clamped === s.cursor) return;
    if (clamped > s.cursor) {
      this.advance(clamped);
      return;
    }
    const st = replayTo(s.events, s.grid.cols, clamped);
    const done = clamped >= s.events.length - 1;
    this.set({
      cursor: clamped,
      replay: st,
      status: done ? (st.targetFound ? 'found' : 'nopath') : 'paused',
      elapsedMs: done ? Math.max(0, s.runStartMs ?? 0) : 0,
      searchVersion: s.searchVersion + 1,
    });
  }

  stepForward(): void {
    const s = this.state;
    if (s.cursor >= s.events.length - 1) return;
    this.set({ status: s.status === 'running' ? 'running' : 'paused' });
    this.advance(s.cursor + 1);
  }

  stepBackward(): void {
    this.goTo(this.state.cursor - 1);
  }

  pause(): void {
    if (this.state.status === 'running') this.set({ status: 'paused' });
  }

  resume(): void {
    if (this.state.status === 'paused' && this.state.cursor < this.state.events.length - 1) {
      this.set({ status: 'running' });
    }
  }

  stop(): void {
    this.clearSearch();
  }

  clearSearch(): void {
    this.set({
      events: [],
      totalSteps: 0,
      cursor: -1,
      replay: makeReplayState(),
      status: 'idle',
      elapsedMs: 0,
      searchVersion: this.state.searchVersion + 1,
    });
  }

  clearBoard(): void {
    this.set({
      grid: defaultGrid(this.state.grid.rows, this.state.grid.cols),
      seed: null,
      boardVersion: this.state.boardVersion + 1,
    });
    this.clearSearch();
  }

  emptyBoard(): void {
    const { rows, cols } = this.state.grid;
    const g = new GridModel(rows, cols, { row: Math.floor(rows / 2), col: 3 }, { row: Math.floor(rows / 2), col: cols - 4 });
    this.set({ grid: g, boardVersion: this.state.boardVersion + 1, seed: null });
    this.clearSearch();
  }

  setGrid(g: GridModel): void {
    this.set({ grid: g, boardVersion: this.state.boardVersion + 1 });
    this.clearSearch();
  }

  /** Environment mutation while searching → restart deterministically (live mode). */
  afterBoardEdit(): void {
    const s = this.state;
    this.set({ boardVersion: s.boardVersion + 1 });
    if (s.settings.liveMode && (s.status === 'running' || s.status === 'paused')) {
      this.showToast('Environment changed — recalculating path…');
      this.runSearch();
    } else if (s.events.length > 0 && s.status !== 'idle') {
      // Stale visualization vs. new map: clear it so colors can't mislead.
      this.clearSearch();
    }
  }

  showToast(msg: string): void {
    this.set({ toast: msg });
    window.setTimeout(() => {
      if (this.state.toast === msg) this.set({ toast: null });
    }, 2600);
  }
}

export const store = new Store();

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/* ------------------------------------------------------------------ */
/* Actions (plain functions — keep components dumb)                    */
/* ------------------------------------------------------------------ */

export const actions = {
  setAlgorithm(id: AlgorithmId) {
    store.set({ algorithm: id });
    store.clearSearch();
    store.persistPrefs();
  },
  setTool(t: Tool) {
    store.set({ tool: t, editMode: 'draw' });
  },
  setEditMode(m: 'draw' | 'erase') {
    store.set({ editMode: m });
  },
  setWeight(w: number) {
    store.set({ weightValue: w });
  },
  setSpeed(v: number) {
    store.set({ speed: v });
    store.persistPrefs();
  },
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    store.set({ settings: { ...store.state.settings, [key]: value } });
    store.persistPrefs();
    // Movement/heuristic changes invalidate an existing search result.
    if (key === 'diagonal' || key === 'cornerCutting' || key === 'heuristic') {
      if (store.state.events.length) store.clearSearch();
    }
  },
  moveStart(p: Pos) {
    const g = store.state.grid;
    if (!g.inBounds(p) || g.isWall(g.idx(p)) || g.isTarget(g.idx(p))) return false;
    g.start = p;
    store.afterBoardEdit();
    return true;
  },
  moveTarget(p: Pos) {
    const g = store.state.grid;
    if (!g.inBounds(p) || g.isWall(g.idx(p)) || g.isStart(g.idx(p))) return false;
    g.target = p;
    store.afterBoardEdit();
    return true;
  },
  paintCell(p: Pos) {
    const s = store.state;
    const g = s.grid;
    if (!g.inBounds(p)) return;
    const idx = g.idx(p);
    if (g.isStart(idx) || g.isTarget(idx)) return; // never overwrite nodes
    let changed = false;
    if (s.tool === 'wall') {
      if (s.editMode === 'draw' && g.kind[idx] !== 1) { g.setWall(idx); changed = true; }
      if (s.editMode === 'erase' && g.kind[idx] !== 0) { g.clearCell(idx); changed = true; }
    } else if (s.tool === 'weight') {
      if (s.editMode === 'draw' && (g.kind[idx] !== 2 || g.weight[idx] !== s.weightValue)) {
        g.setWeight(idx, s.weightValue);
        changed = true;
      }
      if (s.editMode === 'erase' && g.kind[idx] === 2) { g.clearCell(idx); changed = true; }
    } else if (s.tool === 'eraser') {
      if (g.kind[idx] !== 0) { g.clearCell(idx); changed = true; }
    }
    if (changed) store.afterBoardEdit();
  },
  setInspector(idx: number | null) {
    store.set({ inspectorIdx: idx });
  },
  setMode(m: 'grid' | 'graph') {
    store.set({ mode: m });
    store.clearSearch();
  },
  copyBoardJSON(): string {
    const b = exportBoard(store.state.grid, store.state.seed ?? undefined);
    return JSON.stringify(b);
  },
  importBoardJSON(text: string): boolean {
    const parsed = importBoard(JSON.parse(text));
    if (typeof parsed === 'string') {
      store.showToast(`Import failed: ${parsed}`);
      return false;
    }
    store.setGrid(applyImported(parsed));
    store.showToast('Board imported.');
    return true;
  },
};

export type { HeuristicId };
