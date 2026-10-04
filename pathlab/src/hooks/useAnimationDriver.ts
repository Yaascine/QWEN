import { useEffect, useRef } from 'react';
import { store } from '../simulation/store';

/**
 * Drives event playback with requestAnimationFrame. Speed is read live from
 * the store each frame so slider changes take effect immediately; pause is
 * honored within one frame. Instant speed flushes all remaining events.
 */
export function useAnimationDriver(): void {
  const raf = useRef<number>(0);
  const acc = useRef(0);
  const last = useRef(0);

  useEffect(() => {
    const tick = (now: number) => {
      raf.current = requestAnimationFrame(tick);
      const s = store.state;
      if (s.status !== 'running') {
        last.current = now;
        return;
      }
      const dt = Math.min(100, now - (last.current || now));
      last.current = now;

      if (!Number.isFinite(s.speed)) {
        // Instant: jump to final event.
        store.goTo(s.events.length - 1);
        return;
      }
      acc.current += (dt / 1000) * s.speed;
      const batch = Math.floor(acc.current);
      if (batch > 0) {
        acc.current -= batch;
        const target = Math.min(s.cursor + batch, s.events.length - 1);
        if (target > s.cursor) store.advance(target);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);
}
