import { useState } from 'react';
import type { AlgorithmId, Tool } from '../../types';
import { ALGORITHMS, ALGORITHM_ORDER } from '../../algorithms/metadata';
import { actions, store, useAppState } from '../../simulation/store';
import MazeMenu from './MazeMenu';

const SPEEDS: { label: string; value: number }[] = [
  { label: '0.25x', value: 15 },
  { label: '0.5x', value: 40 },
  { label: '1x', value: 90 },
  { label: '2x', value: 180 },
  { label: '4x', value: 360 },
  { label: 'Instant', value: Infinity },
];

const TOOLS: { id: Tool; label: string; icon: string; key: string }[] = [
  { id: 'pointer', label: 'Pointer', icon: '↖', key: 'P' },
  { id: 'start', label: 'Start', icon: 'S', key: 'S' },
  { id: 'target', label: 'Target', icon: 'T', key: 'T' },
  { id: 'wall', label: 'Wall', icon: '▩', key: 'W' },
  { id: 'weight', label: 'Terrain', icon: '≋', key: 'G' },
  { id: 'eraser', label: 'Eraser', icon: '⌫', key: 'E' },
];

export default function LeftPanel() {
  const s = useAppState();
  const [openCard, setOpenCard] = useState<AlgorithmId | null>(null);
  const meta = ALGORITHMS[s.algorithm];

  const speedIdx = Math.max(0, SPEEDS.findIndex((x) => x.value === s.speed));

  return (
    <aside className="absolute inset-y-0 left-0 w-[280px] p-3 pr-0 flex flex-col gap-3 max-lg:hidden scroll-thin overflow-y-auto" aria-label="Controls">
      {/* Algorithm selector */}
      <section className="panel p-3 flex flex-col gap-2">
        <div className="section-title">Algorithm</div>
        <div className="grid grid-cols-5 gap-1">
          {ALGORITHM_ORDER.map((id, i) => (
            <button
              key={id}
              onClick={() => actions.setAlgorithm(id)}
              onDoubleClick={() => setOpenCard(openCard === id ? null : id)}
              title={`${ALGORITHMS[id].name} — press ${i + 1}`}
              aria-pressed={s.algorithm === id}
              className={`rounded-md py-1.5 text-[11px] font-bold mono transition-all border ${s.algorithm === id ? 'btn-active scale-[1.03]' : ''}`}
              style={s.algorithm !== id ? { borderColor: 'var(--border)', color: 'var(--text-1)' } : undefined}
            >
              {ALGORITHMS[id].short}
            </button>
          ))}
        </div>

        {/* Selected algorithm card */}
        <div className="rounded-lg p-2.5 text-xs leading-relaxed" style={{ background: 'rgba(2,6,23,0.45)', border: '1px solid var(--border)' }}>
          <div className="font-semibold text0 mb-1">{meta.name}</div>
          <p className="text1 mb-2">{meta.description}</p>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 mono text-[10px]">
            <span className="text2">Optimal:</span><span className="text0">{meta.guaranteesShortest.startsWith('Yes') ? '✓ ' : '✗ '}{meta.guaranteesShortest}</span>
            <span className="text2">Weights:</span><span className="text0">{meta.supportsWeights ? 'Yes (non-negative)' : 'No'}</span>
            <span className="text2">Heuristic:</span><span className="text0">{meta.heuristicNote.split(';')[0]}</span>
          </div>
          {(s.algorithm === 'astar' || s.algorithm === 'gbfs') && (
            <label className="flex items-center gap-2 mt-2 text-[11px] text1">
              Heuristic
              <select
                className="input !w-auto !py-0.5 !px-1.5 text-[11px]"
                value={s.settings.heuristic}
                onChange={(e) => actions.setSetting('heuristic', e.target.value as typeof s.settings.heuristic)}
                aria-label="Heuristic"
              >
                <option value="manhattan">Manhattan</option>
                <option value="euclidean">Euclidean</option>
                <option value="chebyshev">Chebyshev</option>
              </select>
            </label>
          )}
          <button className="text-[10px] underline mt-2 self-start text2 hover:text0" onClick={() => setOpenCard(openCard === s.algorithm ? null : s.algorithm)}>
            {openCard ? 'Hide details' : 'Full details'}
          </button>
          {openCard === s.algorithm && (
            <div className="fade-up mt-2 pt-2 border-t space-y-1 text-[10px]" style={{ borderColor: 'var(--border)' }}>
              <Row k="Strategy" v={meta.strategy} />
              <Row k="Data structure" v={meta.structure} />
              <Row k="Time" v={meta.timeComplexity} />
              <Row k="Space" v={meta.spaceComplexity} />
              <Row k="Complete" v={meta.complete} />
            </div>
          )}
        </div>
        <p className="text-[10px] italic" style={{ color: 'var(--accent)' }}>{meta.hint}</p>
      </section>

      {/* Playback */}
      <section className="panel p-3 flex flex-col gap-2">
        <div className="section-title">Playback</div>
        <div className="grid grid-cols-3 gap-1.5">
          <button className="btn btn-primary" disabled={s.status === 'running'} onClick={() => (s.status === 'paused' ? store.resume() : store.runSearch())}>
            ▶ {s.status === 'paused' ? 'Resume' : 'Run'}
          </button>
          <button className="btn" disabled={s.status !== 'running'} onClick={() => store.pause()}>❚❚ Pause</button>
          <button className="btn" disabled={s.events.length === 0} onClick={() => store.stop()}>■ Stop</button>
          <button className="btn" disabled={s.cursor >= s.events.length - 1} onClick={() => store.stepBackward()} title="Previous step (←)">◀ Step</button>
          <button className="btn" disabled={s.cursor >= s.events.length - 1} onClick={() => store.stepForward()} title="Next step (→)">Step ▶</button>
          <button className="btn" disabled={s.events.length === 0} onClick={() => { store.clearSearch(); store.runSearch(); }} title="Restart with current map">↻ Restart</button>
        </div>

        <label className="text-[11px] text1 flex flex-col gap-1">
          Speed
          <input
            type="range"
            min={0}
            max={SPEEDS.length - 1}
            step={1}
            value={speedIdx}
            onChange={(e) => actions.setSpeed(SPEEDS[Number(e.target.value)].value)}
            style={{ ['--fill' as never]: `${(speedIdx / (SPEEDS.length - 1)) * 100}%` }}
            aria-label="Animation speed"
          />
          <div className="flex justify-between mono text-[9px] text2">
            {SPEEDS.map((sp, i) => (
              <button key={sp.label} className={i === speedIdx ? 'text0 font-bold' : ''} onClick={() => actions.setSpeed(sp.value)}>{sp.label}</button>
            ))}
          </div>
        </label>
      </section>

      {/* Editing tools */}
      <section className="panel p-3 flex flex-col gap-2">
        <div className="section-title">Editing tools</div>
        <div className="grid grid-cols-3 gap-1.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`btn !px-1 !py-1.5 text-[11px] ${s.tool === t.id ? 'btn-active' : ''}`}
              onClick={() => actions.setTool(t.id)}
              title={`${t.label} (${t.key})`}
              aria-pressed={s.tool === t.id}
            >
              <span className="mono">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button className={`btn flex-1 !py-1 text-[11px] ${s.editMode === 'draw' ? 'btn-active' : ''}`} onClick={() => actions.setEditMode('draw')}>Draw</button>
          <button className={`btn flex-1 !py-1 text-[11px] ${s.editMode === 'erase' ? 'btn-active' : ''}`} onClick={() => actions.setEditMode('erase')}>Erase</button>
        </div>
        {s.tool === 'weight' && (
          <div className="flex gap-1.5 fade-up">
            {[1, 2, 5, 10].map((w) => (
              <button key={w} className={`btn flex-1 !py-1 text-[11px] mono ${s.weightValue === w ? 'btn-active' : ''}`} onClick={() => actions.setWeight(w)} title={terrainName(w)}>
                ×{w}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <button className="btn flex-1 !py-1 text-[11px] btn-danger" onClick={() => store.clearSearch()} title="Remove visualization only — keeps walls & nodes">Clear Search</button>
          <button className="btn flex-1 !py-1 text-[11px]" onClick={() => store.clearBoard()} title="Remove everything and restore default board">Clear Board</button>
        </div>
      </section>

      <MazeMenu />

      {/* Settings */}
      <section className="panel p-3 flex flex-col gap-1.5">
        <div className="section-title">Settings</div>
        <Toggle label="Diagonal movement (8-dir)" checked={s.settings.diagonal} onChange={(v) => actions.setSetting('diagonal', v)} />
        <Toggle label="Prevent corner cutting" checked={s.settings.cornerCutting === false && s.settings.diagonal} disabled={!s.settings.diagonal} onChange={(v) => actions.setSetting('cornerCutting', !v)} />
        <Toggle label="Show grid lines" checked={s.settings.showGrid} onChange={(v) => actions.setSetting('showGrid', v)} />
        <Toggle label="Show parent arrows" checked={s.settings.showDirections} onChange={(v) => actions.setSetting('showDirections', v)} />
        <Toggle label="Show node values (g/h/f)" checked={s.settings.showValues} onChange={(v) => actions.setSetting('showValues', v)} />
        <Toggle label="Animate final path" checked={s.settings.animatePath} onChange={(v) => actions.setSetting('animatePath', v)} />
        <Toggle label="Live mode (re-run on edits)" checked={s.settings.liveMode} onChange={(v) => actions.setSetting('liveMode', v)} />
      </section>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="text2 shrink-0">{k}:</span>
      <span className="text0">{v}</span>
    </div>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between text-[11px] ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
      <span className="text1">{label}</span>
      <input type="checkbox" className="accent-[var(--accent)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function terrainName(w: number): string {
  if (w <= 1) return 'Normal (cost 1)';
  if (w <= 2) return 'Forest (cost 2)';
  if (w <= 5) return 'Sand (cost 5)';
  return 'Water / mud (cost 10)';
}
