'use client';

import { useEffect, useRef } from 'react';

// Lightweight canvas confetti, no dependencies. Fires a ~4.5s burst when
// `fire` flips true. Respects prefers-reduced-motion (renders nothing then).
export default function Confetti({ fire }: { fire: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();

    const colors = ['#fbbf24', '#ef4444', '#10b981', '#3b82f6', '#e879f9', '#fde047'];
    const parts = Array.from({ length: 170 }, () => ({
      x: Math.random() * canvas.width,
      y: -Math.random() * canvas.height * 0.5,
      r: (5 + Math.random() * 6) * dpr,
      c: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 2.4 * dpr,
      vy: (2 + Math.random() * 3.2) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.24,
    }));

    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03 * dpr;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
        ctx.restore();
      }
      if (t - start < 4500) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [fire]);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[60]" aria-hidden />;
}
