import { useEffect, useRef } from 'react';
import { actions, store } from '../simulation/store';

/** Global keyboard shortcuts. Ignores typing in inputs/textareas. */
export function useKeyboardShortcuts(enabled: boolean): void {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!enabledRef.current) return;
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
      if (e.metaKey || e.ctrlKey) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          toggleRun();
          break;
        case 'ArrowRight':
          e.preventDefault();
          store.stepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          store.stepBackward();
          break;
        case 'r': case 'R':
          store.clearSearch();
          break;
        case 'c': case 'C':
          store.clearBoard();
          break;
        case 'w': case 'W':
          actions.setTool('wall');
          break;
        case 'e': case 'E':
          actions.setTool('eraser');
          break;
        case 's': case 'S':
          actions.setTool('start');
          break;
        case 't': case 'T':
          actions.setTool('target');
          break;
        case 'p': case 'P':
          actions.setTool('pointer');
          break;
        case '1': actions.setAlgorithm('bfs'); break;
        case '2': actions.setAlgorithm('dfs'); break;
        case '3': actions.setAlgorithm('dijkstra'); break;
        case '4': actions.setAlgorithm('astar'); break;
        case '5': actions.setAlgorithm('gbfs'); break;
        case 'Escape':
          store.set({ inspectorIdx: null });
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function toggleRun(): void {
  const s = store.state;
  if (s.status === 'running') store.pause();
  else if (s.status === 'paused') store.resume();
  else store.runSearch();
}
