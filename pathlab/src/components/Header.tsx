import { useEffect, useState } from 'react';
import type { View } from '../App';
import { ALGORITHMS } from '../algorithms/metadata';
import { actions, store, useAppState } from '../simulation/store';

interface Props {
  view: View;
  onViewChange: (v: View) => void;
  onOpenModal: (m: 'help' | 'about' | 'export') => void;
}

const VIEWS: { id: View; label: string }[] = [
  { id: 'lab', label: 'Lab' },
  { id: 'compare', label: 'Compare' },
  { id: 'race', label: 'Race' },
  { id: 'graph', label: 'Graph' },
];

export default function Header({ view, onViewChange, onOpenModal }: Props) {
  const s = useAppState();
  const meta = ALGORITHMS[s.algorithm];
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('pathlab-theme') as 'light') || 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('pathlab-theme', theme);
  }, [theme]);

  const statusLabel: Record<string, string> = {
    idle: 'Idle',
    running: 'Searching…',
    paused: 'Paused',
    found: 'Path found',
    nopath: 'No path exists',
    finished: 'Done',
  };

  return (
    <header className="glass border-b flex items-center gap-4 px-4 h-14 shrink-0 z-20" style={{ borderColor: 'var(--border)' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 min-w-[180px]">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
          <rect x="1" y="1" width="24" height="24" rx="6" stroke="var(--accent)" strokeWidth="1.5" />
          <circle cx="7" cy="19" r="2.2" fill="var(--start)" />
          <circle cx="19" cy="7" r="2.2" fill="var(--target)" />
          <path d="M8.5 17.5 L13 13 L17.5 8.5" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2.5 2.5" />
        </svg>
        <div className="leading-tight">
          <div className="font-bold tracking-tight text-[15px]" style={{ color: 'var(--text-0)' }}>
            Path<span style={{ color: 'var(--accent)' }}>Lab</span>
          </div>
          <div className="text-[10px] mono" style={{ color: 'var(--text-2)' }}>search algorithm lab</div>
        </div>
      </div>

      {/* Center: mode + algorithm info */}
      <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
        <nav className="flex rounded-lg p-0.5 gap-0.5 border" style={{ borderColor: 'var(--border)', background: 'rgba(2,6,23,0.4)' }} aria-label="Views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${view === v.id ? 'btn-active' : ''}`}
              style={view !== v.id ? { color: 'var(--text-1)' } : undefined}
              aria-pressed={view === v.id}
            >
              {v.label}
            </button>
          ))}
        </nav>
        {view === 'lab' && (
          <div className="hidden md:flex items-center gap-2 min-w-0">
            <span className="chip" style={{ color: `var(--accent)` }}>{meta.short}</span>
            <span className="text-xs truncate" style={{ color: 'var(--text-1)' }}>{meta.name}</span>
            <span
              className="chip"
              style={{
                color: s.status === 'found' ? 'var(--start)' : s.status === 'nopath' ? 'var(--danger)' : s.status === 'running' ? 'var(--accent)' : 'var(--text-2)',
              }}
            >
              ● {statusLabel[s.status] ?? s.status}
            </span>
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <button className="btn !px-2.5 !py-1.5" title="Toggle theme" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
        <button className="btn !px-2.5 !py-1.5" title="Export / import board JSON" aria-label="Export board" onClick={() => onOpenModal('export')}>⇄</button>
        <button className="btn !px-2.5 !py-1.5" title="About search algorithms" aria-label="About" onClick={() => onOpenModal('about')}>ℹ</button>
        <button className="btn !px-2.5 !py-1.5" title="Help & shortcuts" aria-label="Help" onClick={() => onOpenModal('help')}>?</button>
        <button
          className="btn btn-danger !px-2.5 !py-1.5"
          title="Reset search (R)"
          aria-label="Reset search"
          onClick={() => store.clearSearch()}
        >
          ↺
        </button>
      </div>
    </header>
  );
}

// re-export for convenience in modals that trigger actions
export { actions };
