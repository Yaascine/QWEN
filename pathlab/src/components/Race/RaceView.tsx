import { useEffect, useMemo, useRef, useState } from 'react';
import type { AlgorithmId } from '../../types';
import { ALGORITHMS, ALGORITHM_ORDER } from '../../algorithms/metadata';
import { replayTo, simulate, type EngineConfig } from '../../simulation/SearchEngine';
import { useAppState } from '../../simulation/store';
import GridCanvas, { type CanvasState } from '../Grid/GridCanvas';

interface RunData {
  id: AlgorithmId;
  events: ReturnType<typeof simulate>['events'];
  stats: ReturnType<typeof simulate>['stats'];
}

const RACE_SPEED = 420; // synchronized steps per second

/**
 * Race mode: countdown, then replay several algorithms simultaneously on
 * identical map clones. Finishing first is presented as an observation about
 * this specific map — never as a universal ranking.
 */
export default function RaceView() {
  const s = useAppState();
  const [selected, setSelected] = useState<AlgorithmId[]>(['bfs', 'dijkstra', 'astar', 'gbfs']);
  const [runs, setRuns] = useState<RunData[] | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  const maxLen = runs ? Math.max(1, ...runs.map((r) => r.events.length)) : 0;

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => {
    setRuns(null);
    setCursor(-1);
  }, [s.boardVersion]);

  const startRace = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const cfg: EngineConfig = {
      algorithm: 'bfs',
      diagonal: s.settings.diagonal,
      cornerCutting: s.settings.cornerCutting,
      heuristic: s.settings.heuristic,
    };
    const out: RunData[] = selected.map((id) => ({
      id,
      ...simulate(s.grid.clone(), { ...cfg, algorithm: id }),
    }));
    setRuns(out);
    setCursor(-1);
    setCountdown(3);
    timers.current.push(
      window.setTimeout(() => setCountdown(2), 700),
      window.setTimeout(() => setCountdown(1), 1400),
      window.setTimeout(() => {
        setCountdown(0); // "SEARCH"
        timers.current.push(window.setTimeout(() => setCountdown(null), 500));
        let last = performance.now();
        let acc = 0;
        const len = Math.max(1, ...out.map((r) => r.events.length));
        const tick = (now: number) => {
          const dt = now - last;
          last = now;
          acc += (dt / 1000) * RACE_SPEED;
          const batch = Math.floor(acc);
          if (batch > 0) {
            acc -= batch;
            setCursor((c) => Math.min(c + batch, len - 1));
          }
          if (performance.now() - startT < 60_000 && document.visibilityState === 'visible') {
            rafId = requestAnimationFrame(tick);
          }
        };
        let rafId = 0;
        const startT = performance.now();
        rafId = requestAnimationFrame(tick);
        timers.current.push(window.setTimeout(() => cancelAnimationFrame(rafId), 60_000));
      }, 2100),
    );
  };

  const toggle = (id: AlgorithmId) => {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 5 ? [...cur, id] : cur,
    );
    setRuns(null);
  };

  return (
    <div className="absolute inset-0 p-3 flex flex-col gap-2 min-h-0">
      <div className="panel px-3 py-2 flex flex-wrap items-center gap-2 shrink-0">
        <span className="section-title mr-1">Entrants</span>
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
        <button className="btn btn-primary !py-1 px-3 text-xs ml-2" onClick={startRace} disabled={selected.length < 2 || countdown !== null}>
          🏁 Start Race
        </button>
        {runs && <span className="mono text-[10px] text2 ml-auto">{Math.max(0, cursor + 1)} / {maxLen} ops</span>}
      </div>

      {countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <span className="font-bold count-pop" style={{ fontSize: 'clamp(64px,14vw,160px)', color: 'var(--accent)', textShadow: '0 0 40px var(--accent-dim)' }}>
            {countdown}
          </span>
        </div>
      )}
      {countdown === 0 && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <span className="font-bold count-pop tracking-widest" style={{ fontSize: 'clamp(32px,8vw,90px)', color: 'var(--accent)' }}>
            SEARCH
          </span>
        </div>
      )}

      {!runs && (
        <div className="flex-1 flex items-center justify-center text-sm text2">
          Pick your entrants and press <b className="text0 mx-1">Start Race</b>. All algorithms search identical copies of the current Lab map at the same replay speed.
        </div>
      )}

      {runs && (
        <div className="flex-1 min-h-0 grid gap-2 auto-rows-fr" style={{ gridTemplateColumns: `repeat(${Math.min(runs.length, 2)}, minmax(0,1fr))` }}>
          {runs.map((r) => (
            <RacePane key={r.id} run={r} cursor={cursor} cols={s.grid.cols} settings={s.settings} />
          ))}
        </div>
      )}

      {runs && (
        <p className="text-[10px] text2 shrink-0">
          The first runner to reach TARGET isn’t “the best algorithm” — check each pane’s visited count and final path cost.
          A fast finisher may have produced a longer or more expensive route on this particular map.
        </p>
      )}
    </div>
  );
}

function RacePane({
  run,
  cursor,
  cols,
  settings,
}: {
  run: RunData;
  cursor: number;
  cols: number;
  settings: ReturnType<typeof useAppState>['settings'];
}) {
  const upto = Math.min(cursor, run.events.length - 1);
  const state = useMemo<CanvasState>(() => {
    const st = replayTo(run.events, cols, upto);
    return { visited: st.visited, frontier: st.frontier, current: st.current, pathSoFar: st.pathSoFar, parent: st.parent, g: st.g, h: st.h, f: st.f };
  }, [run, cols, upto]);

  const foundAt = useMemo(() => {
    const i = run.events.findIndex((e) => e.type === 'TARGET_FOUND');
    return i;
  }, [run]);
  const finished = foundAt >= 0 ? upto >= foundAt : upto >= run.events.length - 1;
  const noPath = foundAt === -1 && upto >= run.events.length - 1;
  const progress = ((upto + 1) / run.events.length) * 100;
  const meta = ALGORITHMS[run.id];

  return (
    <div className="panel flex flex-col min-h-0 overflow-hidden">
      <div className="px-2 py-1 flex items-center gap-2 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <span className="text-[11px] font-bold text0">{meta.short}</span>
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(148,163,184,0.12)' }} role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label={`${meta.name} progress`}>
          <div className="h-full rounded-full transition-none" style={{ width: `${progress}%`, background: finished ? 'var(--start)' : 'var(--accent)' }} />
        </div>
        <span className="mono text-[9px] w-24 text-right shrink-0" style={{ color: finished ? 'var(--start)' : 'var(--text-2)' }}>
          {finished && !noPath ? `✓ ${run.stats.visitedCount} visited` : noPath ? '✕ no path' : `${Math.round(progress)}%`}
        </span>
      </div>
      <div className="flex-1 min-h-0 relative">
        <GridCanvas grid={useGrid()} state={state} settings={settings} algorithm={run.id} reducedMotion interactive={false} />
      </div>
    </div>
  );
}

function useGrid() {
  const s = useAppState();
  return s.grid;
}
