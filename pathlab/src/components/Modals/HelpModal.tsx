import Modal from './Modal';

const KEYS: { keys: string; what: string }[] = [
  { keys: 'Space', what: 'Run / Pause the current search' },
  { keys: '→', what: 'Next step (manual execution)' },
  { keys: '←', what: 'Previous step (timeline replay)' },
  { keys: 'R', what: 'Reset / clear search — keeps your map' },
  { keys: 'C', what: 'Clear board — removes walls, weights & visualization' },
  { keys: 'W', what: 'Wall tool' },
  { keys: 'E', what: 'Eraser tool' },
  { keys: 'S', what: 'Start-node tool' },
  { keys: 'T', what: 'Target-node tool' },
  { keys: 'P', what: 'Pointer / inspect tool' },
  { keys: 'G', what: 'Terrain (weight) tool' },
  { keys: '1 – 5', what: 'Select BFS / DFS / Dijkstra / A* / GBFS' },
];

export default function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="PathLab — Help & Shortcuts" onClose={onClose}>
      <div className="space-y-4 text1">
        <section>
          <h3 className="section-title mb-1">Getting started</h3>
          <ol className="list-decimal ml-4 space-y-1">
            <li><b className="text0">Drag S / T</b> (or use the Start/Target tools) to place your nodes.</li>
            <li><b className="text0">Draw walls</b> by clicking and dragging with the Wall tool. The Terrain tool paints weighted cells (forest ×2, sand ×5, water ×10).</li>
            <li>Pick an algorithm on the left, then press <b className="text0" style={{ color: 'var(--accent)' }}>Run</b>. Watch the frontier pulse, the current node glow, and the final path animate.</li>
            <li>Use <b className="text0">Step ▶ / ◀</b> or the timeline to move through the search one operation at a time — the right panel explains every step.</li>
            <li><b className="text0">Clear Search</b> (R) removes only the visualization; <b className="text0">Clear Board</b> (C) also removes your map.</li>
          </ol>
        </section>
        <section>
          <h3 className="section-title mb-1">Views</h3>
          <p>
            <b className="text0">Lab</b> is the main visualizer. <b className="text0">Compare</b> runs up to 5 algorithms on identical copies of the same map side-by-side.
            <b className="text0"> Race</b> replays them simultaneously with progress bars. <b className="text0">Graph</b> switches to an editable node-and-edge graph for abstract pathfinding.
          </p>
        </section>
        <section>
          <h3 className="section-title mb-2">Keyboard shortcuts</h3>
          <table className="w-full text-xs">
            <tbody>
              {KEYS.map((k) => (
                <tr key={k.keys} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-1 pr-3 w-24">
                    <kbd className="chip mono">{k.keys}</kbd>
                  </td>
                  <td className="py-1 text1">{k.what}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text2 mt-2">Shortcuts are ignored while typing in input fields.</p>
        </section>
      </div>
    </Modal>
  );
}
