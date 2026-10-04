import { useEffect, useState } from 'react';
import Header from './components/Header';
import LeftPanel from './components/Controls/LeftPanel';
import RightPanel from './components/InfoPanel/RightPanel';
import BoardArea from './components/Grid/BoardArea';
import GraphBoard from './components/Graph/GraphBoard';
import CompareView from './components/Compare/CompareView';
import RaceView from './components/Race/RaceView';
import Toast from './components/Toast';
import HelpModal from './components/Modals/HelpModal';
import AboutModal from './components/Modals/AboutModal';
import ExportModal from './components/Modals/ExportModal';
import { useAppState } from './simulation/store';
import { useAnimationDriver } from './hooks/useAnimationDriver';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export type View = 'lab' | 'compare' | 'race' | 'graph';

export default function App() {
  const state = useAppState();
  const [view, setView] = useState<View>(() => (localStorage.getItem('pathlab-view') as View) || 'lab');
  const [modal, setModal] = useState<'help' | 'about' | 'export' | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useAnimationDriver();
  useKeyboardShortcuts(view === 'lab');

  useEffect(() => {
    localStorage.setItem('pathlab-view', view);
  }, [view]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  return (
    <div className="h-full flex flex-col lab-bg" style={{ background: 'var(--bg-0)' }}>
      <Header view={view} onViewChange={setView} onOpenModal={setModal} />
      <div className="flex-1 min-h-0 relative">
        {view === 'lab' && (
          <>
            <LeftPanel />
            <main className="absolute inset-y-0 left-[280px] right-[320px] flex flex-col px-3 py-3 max-lg:left-0 max-lg:right-0">
              <BoardArea reducedMotion={reducedMotion} />
            </main>
            <RightPanel />
          </>
        )}
        {view === 'compare' && <CompareView reducedMotion={reducedMotion} />}
        {view === 'race' && <RaceView />}
        {view === 'graph' && <GraphBoard />}
      </div>
      <Toast />
      {modal === 'help' && <HelpModal onClose={() => setModal(null)} />}
      {modal === 'about' && <AboutModal onClose={() => setModal(null)} />}
      {modal === 'export' && <ExportModal onClose={() => setModal(null)} />}
      {/* keep board mounted for graph-mode shared grid? no — separate mode by design */}
      <span className="hidden">{state.mode}</span>
    </div>
  );
}
