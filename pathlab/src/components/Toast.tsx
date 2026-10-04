import { useAppState } from '../simulation/store';

/** Transient status toast (bottom-center). Non-blocking, screen-reader friendly. */
export default function Toast() {
  const s = useAppState();
  if (!s.toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 panel px-4 py-2 fade-up text-xs flex items-center gap-2 shadow-lg"
    >
      <span aria-hidden style={{ color: 'var(--accent)' }}>◈</span>
      <span className="text0">{s.toast}</span>
    </div>
  );
}
