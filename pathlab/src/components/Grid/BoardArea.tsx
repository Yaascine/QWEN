import { useMemo, useState } from 'react';
import type { Pos } from '../../types';
import { actions, store, useAppState } from '../../simulation/store';
import GridCanvas from './GridCanvas';
import Legend from './Legend';
import Timeline from '../InfoPanel/Timeline';
import NodeInspector from '../InfoPanel/NodeInspector';

export default function BoardArea({ reducedMotion }: { reducedMotion: boolean }) {
  const s = useAppState();
  const [hintOpen, setHintOpen] = useState(() => !localStorage.getItem('pathlab-hint-dismissed'));

  const canvasState = useMemo(
    () => ({
      visited: s.replay.visited,
      frontier: s.replay.frontier,
      current: s.replay.current,
      pathSoFar: s.replay.pathSoFar,
      parent: s.replay.parent,
      g: s.replay.g,
      h: s.replay.h,
      f: s.replay.f,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.searchVersion, s.boardVersion],
  );

  const onPaint = (p: Pos) => {
    if (s.tool === 'start') { actions.moveStart(p); return; }
    if (s.tool === 'target') { actions.moveTarget(p); return; }
    if (s.tool === 'pointer') { actions.setInspector(s.grid.idx(p)); return; }
    actions.paintCell(p);
  };

  const onClick = (p: Pos) => {
    // Click any cell with pointer tool → inspector.
    if (s.tool === 'pointer' || s.tool === 'eraser') return;
    actions.setInspector(s.grid.idx(p));
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {hintOpen && (
        <div className="fade-up panel px-3 py-2 flex items-center justify-between text-xs" role="status">
          <span className="text1">
            👋 Welcome to PathLab — <b className="text0">draw walls</b>, <b className="text0">drag S / T nodes</b>, add terrain, then press{' '}
            <b className="text0" style={{ color: 'var(--accent)' }}>Run</b>. Shortcuts: Space = run/pause, ←/→ = step, 1–5 = algorithms.
          </span>
          <button
            className="btn !py-0.5 !px-2 text-[10px] shrink-0 ml-3"
            onClick={() => { localStorage.setItem('pathlab-hint-dismissed', '1'); setHintOpen(false); }}
          >
            Dismiss ✕
          </button>
        </div>
      )}

      <div className="panel flex-1 min-h-0 relative overflow-hidden">
        <GridCanvas
          grid={s.grid}
          state={canvasState}
          settings={s.settings}
          algorithm={s.algorithm}
          reducedMotion={reducedMotion}
          interactive
          onPaint={onPaint}
          onStartDrag={(p) => actions.moveStart(p)}
          onTargetDrag={(p) => actions.moveTarget(p)}
          onClickCell={onClick}
        />
        {s.status === 'nopath' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 panel px-4 py-2 fade-up text-sm flex items-center gap-2" role="alert">
            <span aria-hidden>⛔</span>
            <span className="text0 font-medium">No path exists between START and TARGET.</span>
            <span className="text2 mono text-xs">Explored {s.replay.visited.size} nodes.</span>
          </div>
        )}
        {s.status === 'found' && s.cursor >= s.events.length - 1 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 panel px-4 py-2 fade-up text-sm flex items-center gap-3" role="status">
            <span style={{ color: 'var(--start)' }} aria-hidden>✓</span>
            <span className="text0 font-semibold">Path found!</span>
            <span className="mono text-xs text1">
              Length {s.replay.pathSoFar.length} · Visited {s.replay.visited.size} · Cost {finalCost()}
            </span>
          </div>
        )}
        <NodeInspector />
      </div>

      <Timeline />
      <Legend />
    </div>
  );
}

function finalCost(): string {
  const s = store.state;
  const p = s.replay.pathSoFar;
  if (p.length < 2) return '—';
  let cost = 0;
  for (let i = 1; i < p.length; i++) {
    const a = s.grid.at(p[i - 1]);
    const b = s.grid.at(p[i]);
    const diag = a.row !== b.row && a.col !== b.col;
    cost += s.grid.costOf(p[i]) * (diag && s.settings.diagonal ? Math.SQRT2 : 1);
  }
  return cost.toFixed(1);
}
