import { useMemo } from 'react';
import { actions, useAppState } from '../../simulation/store';
import { HEURISTIC_FORMULAS } from '../../algorithms/grid';

const fmt = (v: number | undefined): string =>
  v === undefined ? '—' : Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '∞';

/** Floating inspector for the currently selected cell. */
export default function NodeInspector() {
  const s = useAppState();
  const idx = s.inspectorIdx;

  const info = useMemo(() => {
    if (idx === null) return null;
    const g = s.grid;
    const p = g.at(idx);
    const st = s.replay;
    const parent = st.parent.get(idx);
    const state =
      st.pathSoFar.includes(idx) ? 'PATH' :
      st.visited.has(idx) ? 'CLOSED' :
      st.frontier.has(idx) ? 'OPEN' :
      'UNEXPLORED';
    return {
      pos: p,
      kind: g.kind[idx],
      cost: g.costOf(idx),
      state,
      parent: parent !== undefined ? g.at(parent) : null,
      gv: st.g.get(idx),
      hv: st.h.get(idx),
      fv: st.f.get(idx),
      dOrder: st.discoveredSeq.get(idx),
      vOrder: st.visitedSeq.get(idx),
      isStart: g.isStart(idx),
      isTarget: g.isTarget(idx),
    };
  }, [idx, s.grid, s.replay, s.searchVersion]);

  if (idx === null || !info) return null;

  const showH = s.algorithm === 'astar' || s.algorithm === 'gbfs';

  return (
    <div
      className="absolute bottom-3 right-3 w-60 panel p-3 fade-up z-10 text-xs"
      role="dialog"
      aria-label={`Node inspector (${info.pos.row},${info.pos.col})`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="mono font-bold text0">NODE ({info.pos.row},{info.pos.col})</span>
        <button className="btn !px-1.5 !py-0 text-[10px]" onClick={() => actions.setInspector(null)} aria-label="Close inspector">✕</button>
      </div>
      <table className="w-full mono text-[11px] leading-5">
        <tbody>
          <Row k="State" v={info.state} />
          <Row k="Terrain" v={info.kind === 1 ? 'wall' : info.kind === 2 ? `weight ×${fmt(info.cost)}` : 'normal'} />
          <Row k="Move cost" v={fmt(info.cost)} />
          <Row k="Role" v={info.isStart ? 'START' : info.isTarget ? 'TARGET' : '—'} />
          <Row k="Parent" v={info.parent ? `(${info.parent.row},${info.parent.col})` : '—'} />
          {(s.algorithm === 'astar' || s.algorithm === 'dijkstra') && <Row k="g(n)" v={fmt(info.gv)} />}
          {showH && <Row k="h(n)" v={fmt(info.hv)} />}
          {s.algorithm === 'astar' && <Row k="f(n)" v={fmt(info.fv)} />}
          <Row k="Discovered #" v={info.dOrder !== undefined ? `#${info.dOrder}` : '—'} />
          <Row k="Visited #" v={info.vOrder !== undefined ? `#${info.vOrder}` : '—'} />
        </tbody>
      </table>
      {s.algorithm === 'astar' && (
        <p className="mt-2 text-[9px] text2">{HEURISTIC_FORMULAS[s.settings.heuristic]}</p>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td className="text2 pr-2 align-top">{k}</td>
      <td className="text0 text-right">{v}</td>
    </tr>
  );
}

