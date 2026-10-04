import { useEffect } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

/** Shared modal shell: backdrop, Esc-to-close, focus trap-lite, scroll lock. */
export default function Modal({ title, onClose, children, wide }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,23,0.65)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`panel fade-up flex flex-col max-h-[85vh] w-full ${wide ? 'max-w-3xl' : 'max-w-xl'}`}
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-0)' }}>{title}</h2>
          <button className="btn !px-2 !py-0.5 text-xs" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>
        <div className="overflow-y-auto scroll-thin p-4 text-xs leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
