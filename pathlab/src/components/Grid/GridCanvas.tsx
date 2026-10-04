import { useEffect, useRef } from 'react';
import type { AlgorithmId, Pos, Settings } from '../../types';
import type { GridModel } from '../../algorithms/grid';
import { ALGORITHMS } from '../../algorithms/metadata';

export interface CanvasState {
  visited: Set<number>;
  frontier: Set<number>;
  current: number | null;
  /** Path nodes revealed so far (start → … → target order). */
  pathSoFar: number[];
  parent: Map<number, number>;
  g: Map<number, number>;
  h: Map<number, number>;
  f: Map<number, number>;
}

interface Props {
  grid: GridModel;
  state: CanvasState;
  settings: Settings;
  algorithm: AlgorithmId;
  reducedMotion?: boolean;
  interactive?: boolean;
  className?: string;
  onPaint?: (p: Pos) => void;
  onStartDrag?: (p: Pos) => void;
  onTargetDrag?: (p: Pos) => void;
  onClickCell?: (p: Pos) => void;
}

const COLORS = {
  bg: '#0b1220',
  cell: '#131c2e',
  cellAlt: '#16213a',
  border: 'rgba(148,163,184,0.10)',
  wall: '#334155',
  wallHatch: '#475569',
  forest: '#14532d',
  sand: '#7c5a1e',
  water: '#1e3a5f',
  start: '#22c55e',
  target: '#f43f5e',
};

const ACCENTS: Record<string, { frontier: string; visited: string; path: string; current: string }> = {
  sky: { frontier: '#38bdf8', visited: '#0ea5e9', path: '#bae6fd', current: '#f0f9ff' },
  violet: { frontier: '#a78bfa', visited: '#8b5cf6', path: '#ede9fe', current: '#faf5ff' },
  amber: { frontier: '#fbbf24', visited: '#f59e0b', path: '#fef3c7', current: '#fffbeb' },
  emerald: { frontier: '#34d399', visited: '#10b981', path: '#d1fae5', current: '#ecfdf5' },
  rose: { frontier: '#fb7185', visited: '#f43f5e', path: '#ffe4e6', current: '#fff1f2' },
};

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/**
 * Imperative canvas board renderer. React does not re-render per cell;
 * a single rAF loop reads the latest props and paints. Time-based effects
 * (pulse, glow, traveling spark) run inside draw() only.
 */
export default function GridCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const dragRef = useRef<'start' | 'target' | 'paint' | null>(null);
  const hoverRef = useRef<Pos | null>(null);
  const downPosRef = useRef<Pos | null>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const p = propsRef.current;
      const canvas = canvasRef.current;
      const wrap = canvas?.parentElement;
      if (!canvas || !wrap) return;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 20 || h < 20) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderBoard(ctx, w, h, p.grid, p.state, p.settings, p.algorithm, p.reducedMotion ?? false, hoverRef.current);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cellFromEvent = (e: React.PointerEvent): Pos | null => {
    const canvas = canvasRef.current;
    const wrap = canvas?.parentElement;
    if (!canvas || !wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const { cell, ox, oy } = layout(rect.width, rect.height, propsRef.current.grid);
    const col = Math.floor((e.clientX - rect.left - ox) / cell);
    const row = Math.floor((e.clientY - rect.top - oy) / cell);
    const g = propsRef.current.grid;
    if (row < 0 || row >= g.rows || col < 0 || col >= g.cols) return null;
    return { row, col };
  };

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Pathfinding grid board"
      className={props.className ?? 'block w-full h-full touch-none select-none cursor-crosshair'}
      onPointerDown={(e) => {
        const p = propsRef.current;
        if (!p.interactive) return;
        const pos = cellFromEvent(e);
        if (!pos) return;
        e.preventDefault();
        downPosRef.current = pos;
        const idx = p.grid.idx(pos);
        if (p.grid.isStart(idx)) {
          dragRef.current = 'start';
        } else if (p.grid.isTarget(idx)) {
          dragRef.current = 'target';
        } else {
          dragRef.current = 'paint';
          p.onPaint?.(pos);
        }
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const p = propsRef.current;
        const pos = cellFromEvent(e);
        hoverRef.current = pos;
        if (!p.interactive || !pos || !dragRef.current) return;
        if (dragRef.current === 'start') p.onStartDrag?.(pos);
        else if (dragRef.current === 'target') p.onTargetDrag?.(pos);
        else p.onPaint?.(pos);
      }}
      onPointerUp={(e) => {
        const p = propsRef.current;
        const up = cellFromEvent(e);
        const down = downPosRef.current;
        const wasClick = up && down && up.row === down.row && up.col === down.col;
        if (dragRef.current === 'paint' && wasClick && up) p.onClickCell?.(up);
        dragRef.current = null;
        downPosRef.current = null;
      }}
      onPointerLeave={() => {
        hoverRef.current = null;
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Pure rendering                                                      */
/* ------------------------------------------------------------------ */

function layout(w: number, h: number, grid: GridModel) {
  const cell = Math.max(4, Math.floor(Math.min(w / grid.cols, h / grid.rows)));
  const ox = Math.floor((w - cell * grid.cols) / 2);
  const oy = Math.floor((h - cell * grid.rows) / 2);
  return { cell, ox, oy };
}

function renderBoard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  grid: GridModel,
  st: CanvasState,
  settings: Settings,
  algorithm: AlgorithmId,
  reduced: boolean,
  hover: Pos | null,
): void {
  const t = performance.now() / 1000;
  const accent = ACCENTS[ALGORITHMS[algorithm].accent];
  const { cell, ox, oy } = layout(w, h, grid);
  ctx.clearRect(0, 0, w, h);

  // board backdrop
  ctx.fillStyle = COLORS.bg;
  rr(ctx, ox - 6, oy - 6, cell * grid.cols + 12, cell * grid.rows + 12, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148,163,184,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  const showVals = settings.showValues && cell >= 18;
  const pathSet = new Set(st.pathSoFar);
  const pathIdx = new Map<number, number>();
  st.pathSoFar.forEach((v, i) => pathIdx.set(v, i));

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const idx = r * grid.cols + c;
      const x = ox + c * cell;
      const y = oy + r * cell;
      const inset = settings.showGrid ? 0.5 : 0;
      const s = cell - inset * 2;

      // --- walls -----------------------------------------------------
      if (grid.kind[idx] === 1) {
        ctx.fillStyle = COLORS.wall;
        rr(ctx, x + inset, y + inset, s, s, Math.min(3, cell * 0.16));
        ctx.fill();
        ctx.strokeStyle = COLORS.wallHatch;
        ctx.lineWidth = Math.max(1, cell * 0.07);
        ctx.beginPath();
        ctx.moveTo(x + s * 0.22, y + s * 0.5);
        ctx.lineTo(x + s * 0.78, y + s * 0.5);
        ctx.stroke();
        continue;
      }

      const isVisited = st.visited.has(idx);
      const isFrontier = st.frontier.has(idx);
      const isCurrent = st.current === idx;

      // --- base fill -------------------------------------------------
      let base = (r + c) % 2 === 0 ? COLORS.cell : COLORS.cellAlt;
      if (grid.kind[idx] === 2) {
        const wgt = grid.weight[idx];
        base = wgt <= 2 ? COLORS.forest : wgt <= 5 ? COLORS.sand : COLORS.water;
      }
      ctx.fillStyle = base;
      rr(ctx, x + inset, y + inset, s, s, 2);
      ctx.fill();

      // --- search overlays -------------------------------------------
      if (isVisited) {
        ctx.fillStyle = alpha(accent.visited, 0.3);
        rr(ctx, x + inset, y + inset, s, s, 2);
        ctx.fill();
      } else if (isFrontier) {
        const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(t * 4.5 + (r * 0.7 + c * 0.5));
        ctx.fillStyle = alpha(accent.frontier, 0.1 + 0.1 * pulse);
        rr(ctx, x + inset, y + inset, s, s, 2);
        ctx.fill();
        ctx.strokeStyle = alpha(accent.frontier, 0.45 + 0.35 * pulse);
        ctx.lineWidth = Math.max(1, cell * 0.07);
        rr(ctx, x + 1.5, y + 1.5, cell - 3, cell - 3, 2.5);
        ctx.stroke();
      }

      // --- terrain texture & label (shape redundancy for a11y) -------
      if (grid.kind[idx] === 2 && cell >= 9) {
        const wgt = grid.weight[idx];
        ctx.save();
        rr(ctx, x + inset, y + inset, s, s, 2);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (wgt <= 2) {
          for (let i = -s; i < s * 1.5; i += 5) { ctx.moveTo(x + i, y + s); ctx.lineTo(x + i + s, y); }
        } else if (wgt <= 5) {
          for (let i = 0; i < 4; i++) {
            const dx = x + 2 + (i * s) / 4;
            ctx.moveTo(dx, y + s * 0.72); ctx.lineTo(dx, y + s * 0.9);
          }
        } else {
          for (let i = 0; i < 3; i++) {
            const wy = y + s * (0.28 + i * 0.24);
            ctx.moveTo(x + 2, wy);
            ctx.quadraticCurveTo(x + s / 2, wy + s * 0.14, x + s - 2, wy);
          }
        }
        ctx.stroke();
        ctx.restore();
        if (cell >= 18) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.font = `600 ${Math.max(8, cell * 0.28)}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`${wgt}`, x + 2, y + 1);
        }
      }

      // --- grid lines -------------------------------------------------
      if (settings.showGrid) {
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + inset + 0.5, y + inset + 0.5, s - 1, s - 1);
      }

      // --- final path -------------------------------------------------
      const pi = pathIdx.get(idx);
      if (pi !== undefined && pi > 0) {
        const prev = st.pathSoFar[pi - 1];
        const pr = Math.floor(prev / grid.cols), pc = prev % grid.cols;
        ctx.strokeStyle = accent.path;
        ctx.lineWidth = Math.max(2, cell * 0.24);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ox + pc * cell + cell / 2, oy + pr * cell + cell / 2);
        ctx.lineTo(x + cell / 2, y + cell / 2);
        ctx.stroke();
      } else if (pi === 0) {
        ctx.fillStyle = accent.path;
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, Math.max(2, cell * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }

      // traveling spark at the head of the reconstructed path
      if (!reduced && st.pathSoFar.length > 1 && pi === st.pathSoFar.length - 1) {
        const k = (t * 1.6) % 1;
        ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(k * Math.PI)})`;
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, Math.max(1.5, cell * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }

      // --- parent direction arrows ------------------------------------
      if (settings.showDirections && cell >= 12) {
        const par = st.parent.get(idx);
        if (par !== undefined && !pathSet.has(idx)) {
          const fr = Math.floor(par / grid.cols), fc = par % grid.cols;
          arrow(ctx, ox + fc * cell + cell / 2, oy + fr * cell + cell / 2, x + cell / 2, y + cell / 2, alpha(accent.visited, 0.55), cell);
        }
      }

      // --- current node ring ------------------------------------------
      if (isCurrent) {
        const g = reduced ? 1 : 0.7 + 0.3 * Math.sin(t * 9);
        ctx.strokeStyle = accent.current;
        ctx.lineWidth = Math.max(2, cell * 0.13);
        ctx.shadowColor = accent.frontier;
        ctx.shadowBlur = reduced ? 0 : 10 * g;
        rr(ctx, x + 1.5, y + 1.5, cell - 3, cell - 3, 3);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // --- values / visit order ---------------------------------------
      if (showVals) {
        const gv = st.g.get(idx);
        const hv = st.h.get(idx);
        const fv = st.f.get(idx);
        ctx.font = `500 ${Math.max(7, cell * 0.19)}px "JetBrains Mono", monospace`;
        ctx.textBaseline = 'top';
        if (hv !== undefined) { ctx.fillStyle = '#f0abfc'; ctx.textAlign = 'right'; ctx.fillText(`h ${fmtShort(hv)}`, x + cell - 2, y + 1); }
        if (gv !== undefined) { ctx.fillStyle = '#7dd3fc'; ctx.textAlign = 'left'; ctx.fillText(`g ${fmtShort(gv)}`, x + 2, y + 1); }
        if (fv !== undefined) { ctx.fillStyle = '#86efac'; ctx.textAlign = 'center'; ctx.fillText(`f ${fmtShort(fv)}`, x + cell / 2, y + cell - Math.max(8, cell * 0.24)); }
      }
    }
  }

  // --- start / target badges (icon + letter, not color-only) ---------
  badge(ctx, ox + grid.start.col * cell, oy + grid.start.row * cell, cell, COLORS.start, 'S');
  badge(ctx, ox + grid.target.col * cell, oy + grid.target.row * cell, cell, COLORS.target, 'T');

  // --- hover outline ---------------------------------------------------
  if (hover) {
    ctx.strokeStyle = 'rgba(226,232,240,0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox + hover.col * cell + 1, oy + hover.row * cell + 1, cell - 2, cell - 2);
  }
}

function badge(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, color: string, letter: string): void {
  const pad = cell * 0.1;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  rr(ctx, x + pad, y + pad, cell - pad * 2, cell - pad * 2, cell * 0.24);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0b1220';
  ctx.font = `700 ${Math.max(8, cell * 0.44)}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, x + cell / 2, y + cell / 2 + cell * 0.02);
}

function arrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, cell: number): void {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const tipX = x2 - ux * cell * 0.2, tipY = y2 - uy * cell * 0.2;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, cell * 0.05);
  ctx.beginPath();
  ctx.moveTo(x1 + ux * cell * 0.25, y1 + uy * cell * 0.25);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  const ah = cell * 0.18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - ux * ah - uy * ah * 0.5, tipY - uy * ah + ux * ah * 0.5);
  ctx.lineTo(tipX - ux * ah + uy * ah * 0.5, tipY - uy * ah - ux * ah * 0.5);
  ctx.closePath();
  ctx.fill();
}

function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function fmtShort(v: number): string {
  if (!Number.isFinite(v)) return '∞';
  if (v >= 100) return String(Math.round(v));
  if (v >= 10) return v.toFixed(0);
  return Math.abs(v % 1) > 0.04 ? v.toFixed(1) : v.toFixed(0);
}
