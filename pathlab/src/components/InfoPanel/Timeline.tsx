import { actions, store, useAppState } from '../../simulation/store';

/** Scrubbable timeline over the current run's event stream. */
export default function Timeline() {
  const s = useAppState();
  if (s.events.length === 0) return null;

  const total = s.events.length;
  const pct = ((s.cursor + 1) / total) * 100;
  const lastEv = s.events[Math.max(0, Math.min(s.cursor, total - 1))];

  return (
    <div className="panel px-3 py-2 flex items-center gap-3 shrink-0" aria-label="Timeline">
      <button className="btn !px-2 !py-0.5 text-xs" onClick={() => store.goTo(-1)} title="Jump to start" disabled={s.cursor < 0}>⏮</button>
      <button className="btn !px-2 !py-0.5 text-xs" onClick={() => store.stepBackward()} disabled={s.cursor < 0} title="Previous step (←)">◀</button>
      <div className="flex-1 relative h-6 flex items-center">
        <input
          type="range"
          min={-1}
          max={total - 1}
          step={1}
          value={s.cursor}
          onChange={(e) => {
            if (s.status === 'running') store.pause();
            store.goTo(Number(e.target.value));
          }}
          style={{ ['--fill' as never]: `${Math.max(0, pct)}%` }}
          className="w-full"
          aria-label="Timeline scrubber"
        />
      </div>
      <button className="btn !px-2 !py-0.5 text-xs" onClick={() => store.stepForward()} disabled={s.cursor >= total - 1} title="Next step (→)">▶</button>
      <button className="btn !px-2 !py-0.5 text-xs" onClick={() => store.goTo(total - 1)} disabled={s.cursor >= total - 1} title="Jump to end">⏭</button>
      <span className="mono text-[10px] text2 w-24 text-right shrink-0">
        Step {Math.max(0, s.cursor + 1)} / {total}
      </span>
      <span className="hidden xl:inline mono text-[10px] truncate max-w-[380px] text1" title={lastEv?.message}>
        {lastEv?.message ?? ''}
      </span>
      <button className="btn !px-2 !py-0.5 text-[10px] shrink-0" onClick={() => actions.setInspector(null)} title="Clear selection">✕</button>
    </div>
  );
}
