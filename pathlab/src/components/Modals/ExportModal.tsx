import { useState } from 'react';
import Modal from './Modal';
import { actions, store } from '../../simulation/store';

/** Copy the current board as JSON or paste a board definition to load it. */
export default function ExportModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const json = actions.copyBoardJSON();

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      // Clipboard API unavailable (insecure context) — fall back to textarea selection.
      const ta = document.getElementById('board-json') as HTMLTextAreaElement | null;
      ta?.select();
      document.execCommand?.('copy');
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const doImport = () => {
    setError(null);
    try {
      const ok = actions.importBoardJSON(text);
      if (ok) onClose();
      else setError('See toast for details.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON.');
    }
  };

  return (
    <Modal title="Export / Import Board" onClose={onClose}>
      <div className="space-y-4">
        <section>
          <div className="flex items-center justify-between mb-1">
            <span className="section-title">Current board ({store.state.grid.rows}×{store.state.grid.cols})</span>
            <button className="btn btn-primary !py-0.5 !px-2 text-[10px]" onClick={doCopy} aria-label="Copy board JSON">
              {copied ? '✓ Copied' : 'Copy JSON'}
            </button>
          </div>
          <textarea
            id="board-json"
            readOnly
            value={json.length > 6000 ? json.slice(0, 6000) + '\n… truncated preview — use Copy JSON for the full payload' : json}
            className="input mono w-full h-32 text-[10px] resize-none"
            aria-label="Board JSON export preview"
          />
        </section>
        <section>
          <span className="section-title block mb-1">Paste a board definition</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{ "version": 1, "rows": 24, "cols": 48, "walls": [...], ... }'
            className="input mono w-full h-28 text-[10px] resize-none"
            aria-label="Board JSON import"
          />
          {error && <p className="text-[10px] mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="mt-2 flex justify-end">
            <button className="btn btn-primary !py-1 px-3 text-xs" onClick={doImport} disabled={!text.trim()}>
              Import Board
            </button>
          </div>
        </section>
        <p className="text-[10px] text2">
          Exports include walls, terrain weights, START/TARGET positions and the generator seed (if any), so a board can be reproduced exactly.
        </p>
      </div>
    </Modal>
  );
}
