/** Color + shape legend — never relies on color alone. */
const ITEMS: { label: string; swatch: JSX.Element }[] = [
  {
    label: 'Start',
    swatch: <span className="lg-box" style={{ background: '#22c55e' }} aria-hidden>S</span>,
  },
  {
    label: 'Target',
    swatch: <span className="lg-box" style={{ background: '#f43f5e' }} aria-hidden>T</span>,
  },
  {
    label: 'Wall',
    swatch: (
      <span className="lg-box" style={{ background: '#334155' }} aria-hidden>
        <span className="lg-dash" />
      </span>
    ),
  },
  {
    label: 'Forest ×2',
    swatch: <span className="lg-box lg-hatch" style={{ background: '#14532d' }} aria-hidden />,
  },
  {
    label: 'Sand ×5',
    swatch: <span className="lg-box" style={{ background: '#7c5a1e' }} aria-hidden>⋮</span>,
  },
  {
    label: 'Water ×10',
    swatch: <span className="lg-box" style={{ background: '#1e3a5f' }} aria-hidden>≈</span>,
  },
  {
    label: 'Frontier',
    swatch: <span className="lg-ring" aria-hidden />,
  },
  {
    label: 'Current',
    swatch: <span className="lg-current" aria-hidden />,
  },
  {
    label: 'Visited',
    swatch: <span className="lg-box" style={{ background: 'rgba(56,189,248,0.3)', border: '1px solid rgba(56,189,248,0.5)' }} aria-hidden />,
  },
  {
    label: 'Path',
    swatch: <span className="lg-path" aria-hidden />,
  },
];

export default function Legend() {
  return (
    <div className="panel px-3 py-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text1 shrink-0" aria-label="Legend">
      {ITEMS.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.swatch}
          {it.label}
        </span>
      ))}
    </div>
  );
}
