import { useEffect, useMemo, useRef, useState } from 'react';
import type { AlgorithmId } from '../../types';
import { ALGORITHMS, ALGORITHM_ORDER } from '../../algorithms/metadata';
import { GridModel } from '../../algorithms/grid';
import { replayTo, simulate, type EngineConfig } from '../../simulation/SearchEngine';
import { useAppState } from '../../simulation/store';
import GridCanvas, { type CanvasState } from '../Grid/GridCanvas';

interface RunData {
  id: AlgorithmId;
  events: ReturnType<typeof simulate>['events'];
  stats: ReturnType<typeof simulate>['stats'];
}

/**
 * Compare mode: run up to 5 algorithms on identical clones of the current map,
 * replay them in sync, and show factual side-by-side statistics.
 */
export default function CompareView({ reducedMotion }: { reducedMotion: boolean }) {
  const s = useAppState();
  const [selected, setSelected] = useState<AlgorithmId[]>(['bfs', 'dijkstra', 'astar']);
  const [runs, setRuns] = useState<RunData[] | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  const maxLen = runs ? Math.max(1, ...runs.map((r) => r.events.length)) : 0;
  const speed = 240; // synchronized replay steps per second

  // Invalidate computed runs when the underlying board changes.
  useEffect(() => {
    setRuns(null);
    setCursor(-1);
    setPlaying(false);
  }, [s.boardVersion]);

  useEffect(() => {
    if (!playing || !runs) return;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      raf.current = requestAnimationFrame(tick);
      const dt = now - last;
      last = now;
      acc += (dt / 1000) * speed;
      const batch = Math.floor(acc);
      if (batch > 0) {
        acc -= batch;
        setCursor((c) => {
          const n = Math.min(c + batch, maxLen - 1);
          if (n >= maxLen - 1) setPlaying(false);
          return n;
        });
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, runs, maxLen]);

  const compute = () => {
    const cfg: EngineConfig = {
      algorithm: 'bfs',
      diagonal: s.settings.diagonal,
      cornerCutting: s.settings.cornerCutting,
      heuristic: s.settings.heuristic,
    };
    const out: RunData[] = selected.map((id) => {
      const clone: GridModel = s.grid.clone();
      const res = simulate(clone, { ...cfg, algorithm: id });
      return { id, events: res.events, stats: res.stats };
    });
    setRuns(out);
    setCursor(-1);
    setPlaying(!reducedMotion);
  };

  const toggle = (id: AlgorithmId) => {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 5 ? [...cur, id] : cur,
    );
    setRuns(null);
  };

  return (
    <div className="absolute inset-0 p-3 flex flex-col gap-2 min-h-0">
      {/* Toolbar */}
      <div className="panel px-3 py-2 flex flex-wrap items-center gap-2 shrink-0">
        <span className="section-title mr-1">Algorithms</span>
        {ALGORITHM_ORDER.map((id) => (
          <button
            key={id}
            onClick={() => toggle(id)}
            aria-pressed={selected.includes(id)}
            className={`chip transition-colors ${selected.includes(id) ? 'btn-active' : ''}`}
          >
            {ALGORITHMS[id].short}
          </button>
        ))}
        <button className="btn btn-primary !py-1 px-3 text-xs ml-2" onClick={compute} disabled={selected.length < 2}>
          ▶ Run Comparison
        </button>
        {runs && (
          <>
            <button className="btn !py-1 px-3 text-xs" onClick={() => setPlaying((p) => !p)}>
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <input
              type="range"
              min={-1}
              max={maxLen - 1}
              value={Math.min(cursor, maxLen - 1)}
              onChange={(e) => {
                setPlaying(false);
                setCursor(Number(e.target.value));
              }}
              className="flex-1 min-w-[140px]"
              style={{ ['--fill' as never]: `${((cursor + 1) / maxLen) * 100}%` }}
              aria-label="Synchronized timeline"
            />
            <span className="mono text-[10px] text2 w-28 text-right">
              {Math.max(0, cursor + 1)} / {maxLen} ops
            </span>
          </>
        )}
      </div>

      {!runs && (
        <div className="flex-1 flex items-center justify-center text-sm text2">
          Select at least two algorithms, then press <b className="text0 mx-1">Run Comparison</b>. Each algorithm searches an identical copy of your Lab map.
        </div>
      )}

      {runs && (
        <div
          className="flex-1 min-h-0 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.min(runs.length, 3)}, minmax(0,1fr))` }}
        >
          {runs.map((r) => (
            <ComparePane key={r.id} run={r} cursor={cursor} cols={s.grid.cols} settings={s.settings} reducedMotion={reducedMotion} />
          ))}
        </div>
      )}

      {runs && (
        <div className="panel p-2 shrink-0 overflow-x-auto scroll-thin">
          <table className="w-full mono text-[11px]">
            <thead>
              <tr className="text2 text-left border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="font-normal py-1 pr-3">Algorithm</th>
                <th className="font-normal pr-3">Status</th>
                <th className="font-normal pr-3">Visited</th>
                <th className="font-normal pr-3">Max frontier</th>
                <th className="font-normal pr-3">Path length</th>
                <th className="font-normal pr-3">Path cost</th>
                <th className="font-normal pr-3">Compute</th>
                <th className="font-normal">Optimality note</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-1 pr-3" style={{ color: `var(--accent)` }}>{ALGORITHMS[r.id].short}</td>
                  <td className="pr-3">{r.stats.found ? 'found' : 'no path'}</td>
                  <td className="pr-3">{r.stats.visitedCount}</td>
                  <td className="pr-3">{r.stats.maxFrontier}</td>
                  <td className="pr-3">{r.stats.pathLength || '—'}</td>
                  <td className="pr-3">{r.stats.found ? r.stats.pathCost.toFixed(1) : '—'}</td>
                  <td className="pr-3">{r.stats.runtimeMs.toFixed(2)} ms</td>
                  <td className="text2">{optimalityNote(r.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text2 mt-1">
            No single column declares a “winner”: fewer visited nodes ≠ cheaper path. Compare exploration effort against resulting path cost for your own map.
          </p>
        </div>
      )}
    </div>
  );
}

function optimalityNote(id: AlgorithmId): string {
  switch (id) {
    case 'bfs': return 'fewest edges (ignores weights)';
    case 'dfs': return 'any path — no guarantee';
    case 'dijkstra': return 'cheapest cost (non-neg. weights)';
    case 'astar': return 'cheapest if h admissible+consistent';
    case 'gbfs': return 'fast-directed — may be sub-optimal';
  }
}

/** One synchronized mini-board for a single algorithm run. */
function ComparePane({
  run,
  cursor,
  cols,
  settings,
  reducedMotion,
}: {
  run: RunData;
  cursor: number;
  cols: number;
  settings: ReturnType<typeof useAppState>['settings'];
  reducedMotion: boolean;
}) {
  const upto = Math.min(cursor, run.events.length - 1);
  const state = useMemo<CanvasState>(() => {
    const st = replayTo(run.events, cols, upto);
    return {
      visited: st.visited,
      frontier: st.frontier,
      current: st.current,
      pathSoFar: st.pathSoFar,
      parent: st.parent,
      g: st.g,
      h: st.h,
      f: st.f,
    };
  }, [run, cols, upto]);

  // The canvas needs a grid reference; all panes share the same static layout.
  const gridRef = useRef<GridModel | null>(null);
  if (!gridRef.current) gridRef.current = useAppStateGrid();

  const meta = ALGORITHMS[run.id];
  const done = upto >= run.events.length - 1;

  return (
    <div className="panel flex flex-col min-h-0 overflow-hidden">
      <div className="px-2 py-1 flex items-center justify-between border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <span className="text-[11px] font-bold" style={{ color: 'var(--text-0)' }}>{meta.name}</span>
        <span className="mono text-[9px] text2">
          {done ? (run.stats.found ? `visited ${run.stats.visitedCount} · cost ${run.stats.pathCost.toFixed(1)}` : 'no path') : `${upto + 1}/${run.events.length}`}
        </span>
      </div>
      <div className="flex-1 min-h-0 relative">
        {gridRef.current && (
          <GridCanvas grid={gridRef.current} state={state} settings={settings} algorithm={run.id} reducedMotion={reducedMotion} interactive={false} />
        )}
      </div>
    </div>
  );
}

/** Small helper hook to grab the current grid without prop-drilling. */
function useAppStateGrid(): GridModel {
  const s = useAppState();
  return s.grid;
}
