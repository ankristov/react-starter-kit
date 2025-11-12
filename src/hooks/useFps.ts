import { useEffect, useRef, useState } from 'react';

export function useFps(sampleWindowMs: number = 1000): number {
  const [fps, setFps] = useState(0);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const windowStartRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = performance.now();
      frameCountRef.current += 1;

      // If window elapsed, compute FPS and reset
      if (now - windowStartRef.current >= sampleWindowMs) {
        const seconds = (now - windowStartRef.current) / 1000;
        const currentFps = frameCountRef.current / seconds;
        setFps(Math.round(currentFps));
        frameCountRef.current = 0;
        windowStartRef.current = now;
      }

      lastTimeRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [sampleWindowMs]);

  return fps;
}

