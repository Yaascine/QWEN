import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AlgorithmId } from '../../types';
import { ALGORITHMS } from '../../algorithms/metadata';
import { store, useAppState } from '../../simulation/store';

const fmt = (v: number | undefined): string =>
  v === undefined ? '—' : Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '∞';

type Tab = 'stats' | 'frontier' | 'pseudo' | 'log' | 'code';

/** Right-hand information column: live stats, structure viewer, pseudocode, event log, code. */
export default function RightPanel() {
  const s = useAppState();
  const [tab, setTab] = useState<Tab>('stats');
  const meta = ALGORITHMS[s.algorithm];
  const st = s.replay;

  const isWeightedBoard = useMemoHasWeights(s);

  return (
    <aside className="absolute inset-y-0 right-0 w-[320px] p-3 pl-0 flex flex-col gap-2 max-lg:hidden" aria-label="Algorithm information">
      <div className="panel flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b shrink-0" style={{ borderColor: 'var(--border)' }} role="tablist">
          {(['stats', 'frontier', 'pseudo', 'log', 'code'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${tab === t ? '' : 'text2 hover:text1'}`}
              style={tab === t ? { color: 'var(--accent)', boxShadow: 'inset 0 -2px 0 var(--accent)' } : undefined}
            >
              {t === 'pseudo' ? 'Pseudocode' : t}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scroll-thin p-3 text-xs">
          {tab === 'stats' && <StatsTab />}
          {tab === 'frontier' && <FrontierTab />}
          {tab === 'pseudo' && <PseudoTab algorithm={s.algorithm} line={st.pseudocodeLine} />}
          {tab === 'log' && <EventLog />}
          {tab === 'code' && <CodeTab algorithm={s.algorithm} />}
        </div>
      </div>

      {/* Educational warning strip for mismatched algorithm/board combos */}
      {(isWeightedBoard && (s.algorithm === 'bfs' || s.algorithm === 'dfs')) && (
        <div className="panel px-3 py-2 text-[10px] fade-up" style={{ borderColor: 'rgba(251,191,36,0.4)' }}>
          ⚠️ <b className="text0">{meta.short}</b> does not account for terrain weights — it treats all walkable cells uniformly. Try Dijkstra or A* for cost-aware routes.
        </div>
      )}
      {isWeightedBoard && s.algorithm === 'gbfs' && (
        <div className="panel px-3 py-2 text-[10px] fade-up" style={{ borderColor: 'rgba(251,191,36,0.4)' }}>
          ⚠️ GBFS ignores both weights and accumulated cost; on weighted maps its path is rarely optimal.
        </div>
      )}
      {s.settings.diagonal && s.algorithm === 'astar' && s.settings.heuristic === 'manhattan' && (
        <div className="panel px-3 py-2 text-[10px] fade-up" style={{ borderColor: 'rgba(251,191,36,0.4)' }}>
          ⚠️ Manhattan + diagonals (√2 steps) can overestimate → A* may return a sub-optimal path. Euclidean stays admissible.
        </div>
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */

function StatsTab() {
  const s = useAppState();
  const st = s.replay;
  const currentPos = st.current !== null ? s.grid.at(st.current) : null;
  const statusLabel: Record<string, string> = {
    idle: 'Idle — press Run', running: 'Searching…', paused: 'Paused',
    found: 'Path found', nopath: 'No path exists', finished: 'Done',
  };
  return (
    <div className="space-y-3">
      <table className="w-full mono text-[11px] leading-5">
        <tbody>
          <Row k="Algorithm" v={ALGORITHMS[s.algorithm].name} />
          <Row k="Status" v={statusLabel[s.status]} />
          <Row k="Current node" v={currentPos ? `(${currentPos.row},${currentPos.col})` : '—'} />
          <Row k="Visited" v={String(st.visited.size)} />
          <Row k="Discovered" v={String(st.discoveredCount)} />
          <Row k="Frontier size" v={String(st.frontier.size)} />
          <Row k="Path length" v={st.pathSoFar.length ? `${st.pathSoFar.length} nodes` : '—'} />
          <Row k="Path cost" v={st.pathCostSoFar ? fmt(st.pathCostSoFar) : '—'} />
          <Row k="Runtime" v={s.elapsedMs > 0 ? `${s.elapsedMs.toFixed(2)} ms` : s.events.length ? '…' : '—'} />
          <Row k="Max frontier" v={st.maxFrontier ? String(st.maxFrontier) : '—'} />
          <Row k="Max depth" v={st.maxDepth ? String(st.maxDepth) : '—'} />
          <Row k="Operations" v={String(Math.max(0, s.cursor + 1))} />
        </tbody>
      </table>
      <div className="section-title pt-1">Current node scores</div>
      <table className="w-full mono text-[11px] leading-5">
        <tbody>
          <TipRow tip="Actual path cost from START to this node." k="g(n)" v={fmt(currentPos ? st.g.get(st.current!) : undefined)} />
          <TipRow tip="Estimated remaining cost from this node to TARGET." k="h(n)" v={fmt(currentPos ? st.h.get(st.current!) : undefined)} />
          <TipRow tip="Estimated total path cost through this node: g(n) + h(n)." k="f(n)" v={fmt(currentPos ? st.f.get(st.current!) : undefined)} />
        </tbody>
      </table>
      <p className="text-[10px] text2 italic">
        {ALGORITHMS[s.algorithm].heuristicNote}. Heuristic: {s.settings.heuristic}
      </p>
    </div>
  );
}

function FrontierTab() {
  const s = useAppState();
  const st = s.replay;
  const kind =
    s.algorithm === 'bfs' ? 'QUEUE (FIFO)' :
    s.algorithm === 'dfs' ? 'STACK (LIFO)' : 'PRIORITY QUEUE (min-heap)';
  const list = st.lastFrontierList;
  const pris = st.lastFrontierPriorities;
  const header = s.algorithm === 'bfs' ? 'front → back' : s.algorithm === 'dfs' ? 'top → bottom' : 'lowest priority first';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="section-title">{kind}</span>
        <span className="chip">{st.frontier.size} nodes</span>
      </div>
      <p className="text-[10px] text2">{header}{st.frontierComplete ? '' : ' · showing up to 12 of the best entries'}</p>
      {list.length === 0 ? (
        <p className="text-[11px] text2 italic py-4 text-center">Run an algorithm to see its frontier.</p>
      ) : (
        <table className="w-full mono text-[11px]">
          <thead>
            <tr className="text2 text-left">
              <th className="font-normal pb-1">#</th>
              <th className="font-normal pb-1">Node</th>
              <th className="font-normal pb-1 text-right">{s.algorithm === 'astar' ? 'f' : s.algorithm === 'gbfs' ? 'h' : s.algorithm === 'dijkstra' ? 'dist' : 'order'}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p, i) => (
              <tr key={`${p.row}-${p.col}`} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="py-0.5 text2">{i + 1}</td>
                <td className="text0">({p.row},{p.col})</td>
                <td className="text-right text1">{pris[i] !== undefined ? fmt(pris[i]) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PseudoTab({ algorithm, line }: { algorithm: AlgorithmId; line: number | null }) {
  const meta = ALGORITHMS[algorithm];
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [line]);
  return (
    <div>
      <div className="section-title mb-2">{meta.name} — pseudocode</div>
      <pre className="mono text-[10.5px] leading-[1.7] whitespace-pre-wrap">
        {meta.pseudocode.map((ln, i) => (
          <div
            key={i}
            ref={i === line ? activeRef : undefined}
            className={`pseudo-line px-1.5 py-[1px] flex gap-2 ${i === line ? 'active' : ''}`}
          >
            <span className="text2 select-none w-5 text-right shrink-0">{i}</span>
            <span className={i === line ? 'text0' : 'text1'}>{ln}</span>
          </div>
        ))}
      </pre>
      <p className="text-[10px] text2 mt-2">The highlighted line tracks the visualization in real time.</p>
    </div>
  );
}

function EventLog() {
  const s = useAppState();
  const endRef = useRef<HTMLDivElement>(null);
  const upto = Math.max(0, s.cursor + 1);
  const events = s.events.slice(Math.max(0, upto - 80), upto);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [upto]);
  if (s.events.length === 0) {
    return <p className="text-[11px] text2 italic">Event log appears once you run a search. Each step gets a human-readable explanation.</p>;
  }
  return (
    <div className="mono text-[10px] leading-4 space-y-0.5">
      {events.map((e, i) => (
        <div key={Math.max(0, upto - 80) + i} className={`flex gap-1.5 ${i === events.length - 1 ? 'text0' : 'text1'}`}>
          <span className="text2 shrink-0">#{Math.max(0, upto - 80) + i + 1}</span>
          <span className="break-words">{e.message ?? e.type}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

function CodeTab({ algorithm }: { algorithm: AlgorithmId }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const loaders: Record<AlgorithmId, () => Promise<string>> = {
      bfs: () => import('../../algorithms/bfs?raw').then((m) => m.default),
      dfs: () => import('../../algorithms/dfs?raw').then((m) => m.default),
      dijkstra: () => import('../../algorithms/dijkstra?raw').then((m) => m.default),
      astar: () => import('../../algorithms/astar?raw').then((m) => m.default),
      gbfs: () => import('../../algorithms/gbfs?raw').then((m) => m.default),
    };
    loaders[algorithm]().then((src) => {
      if (!cancelled) setSource(src.replace(/\n{3,}/g, '\n\n'));
    });
    return () => { cancelled = true; };
  }, [algorithm]);
  return (
    <div>
      <div className="section-title mb-1">Implementation — src/algorithms/{algorithm}.ts</div>
      <p className="text-[10px] text2 mb-2">This is the exact generator that produced the animation you are watching.</p>
      {source === null ? (
        <p className="text-[11px] text2 italic">Loading source…</p>
      ) : (
        <HighlightTs code={source} />
      )}
    </div>
  );
}

/** Tiny dependency-free TS syntax highlighter (keywords / strings / comments / numbers). */
function HighlightTs({ code }: { code: string }) {
  const lines = code.split('\n');
  return (
    <pre className="mono text-[9.5px] leading-[1.55] overflow-x-auto scroll-thin">
      {lines.map((ln, i) => (
        <div key={i} className="flex">
          <span className="text2 select-none w-7 shrink-0 text-right pr-2 opacity-60">{i + 1}</span>
          <span>{tokenize(ln)}</span>
        </div>
      ))}
    </pre>
  );
}

const KEYWORDS = new Set(['import','from','export','const','let','var','function','return','if','else','for','while','of','in','new','type','interface','continue','break','yield','default','class','extends','private','readonly','as','void','switch','case','true','false','null','undefined','Infinity']);

function tokenize(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  // comment?
  const cIdx = line.indexOf('//');
  let body = line;
  let comment = '';
  if (cIdx !== -1 && !/['"`][^'"`]*\/\/[^'"`]*['"`]/.test(line)) {
    body = line.slice(0, cIdx);
    comment = line.slice(cIdx);
  }
  const re = /(\b[A-Za-z_$][\w$]*\b)|(\d+\.?\d*)|('[^']*'|"[^"]*"|`[^`]*`)|([^\s\w'"`]+)|(\s+)/g;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(body)) !== null) {
    const [, word, num, str, punct, ws] = m;
    if (ws) out.push(<span key={k++}>{ws}</span>);
    else if (str) out.push(<span key={k++} style={{ color: '#a5d6ff' }}>{str}</span>);
    else if (num) out.push(<span key={k++} style={{ color: '#f2cc60' }}>{num}</span>);
    else if (word && KEYWORDS.has(word)) out.push(<span key={k++} style={{ color: '#ff7b72' }}>{word}</span>);
    else if (word) out.push(<span key={k++} style={{ color: '#d2a8ff' }}>{word}</span>);
    else if (punct) out.push(<span key={k++} className="text1">{punct}</span>);
  }
  if (comment) out.push(<span key={k++} className="text2 italic">{comment}</span>);
  return out;
}

/** Cheap scan for any weighted cell (cached per board version). */
let weightsCache = { version: -1, has: false };
function useMemoHasWeights(s: ReturnType<typeof useAppState>): boolean {
  if (weightsCache.version !== s.boardVersion) {
    let has = false;
    const g = s.grid;
    for (let i = 0; i < g.kind.length; i++) {
      if (g.kind[i] === 2) { has = true; break; }
    }
    weightsCache = { version: s.boardVersion, has };
  }
  return weightsCache.has;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr>
      <td className="text2 pr-2">{k}</td>
      <td className="text0 text-right">{v}</td>
    </tr>
  );
}

function TipRow({ k, v, tip }: { k: string; v: string; tip: string }) {
  return (
    <tr title={tip}>
      <td className="text2 pr-2 cursor-help underline decoration-dotted">{k}</td>
      <td className="text0 text-right">{v}</td>
    </tr>
  );
}

// expose store for tab components that need imperative actions
void store;
