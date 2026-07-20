'use client';

import { useEffect, useRef, useState } from 'react';
import type { JourneyPoint } from '@/lib/wrapped';
import { ordinal } from './kit';

// The rank journey: an inverted line chart (rank 1 sits at the top) drawn on
// mount with a dash-offset reveal, with the peak and the low point called out.
// Ranks are integers over a small field, so the chart is drawn in a fixed
// viewBox and scaled by CSS rather than measured at runtime.
export default function RankLine({
  journey,
  fieldSize,
  peak,
  trough,
}: {
  journey: JourneyPoint[];
  fieldSize: number;
  peak: JourneyPoint | null;
  trough: JourneyPoint | null;
}) {
  const W = 320;
  const H = 190;
  const padX = 22;
  const padY = 26;
  const pathRef = useRef<SVGPathElement>(null);
  const [len, setLen] = useState(0);

  useEffect(() => {
    if (pathRef.current) setLen(pathRef.current.getTotalLength());
  }, [journey]);

  if (journey.length < 2) return null;

  const maxRank = Math.max(fieldSize, ...journey.map((j) => j.rank));
  const x = (i: number) => padX + (i * (W - padX * 2)) / (journey.length - 1);
  // Rank 1 at the top, worst rank at the bottom.
  const y = (rank: number) =>
    maxRank <= 1 ? H / 2 : padY + ((rank - 1) * (H - padY * 2)) / (maxRank - 1);

  const points = journey.map((j, i) => ({ x: x(i), y: y(j.rank), j }));
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${d} L${points[points.length - 1].x.toFixed(1)},${H - padY / 2} L${points[0].x.toFixed(1)},${H - padY / 2} Z`;

  const peakIdx = peak ? journey.findIndex((j) => j.label === peak.label && j.rank === peak.rank) : -1;
  const troughIdx = trough ? journey.findIndex((j) => j.label === trough.label && j.rank === trough.rank) : -1;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Your rank over the tournament">
        <defs>
          <linearGradient id="rank-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Faint gridlines at first and last place. */}
        <line x1={padX} y1={y(1)} x2={W - padX} y2={y(1)} stroke="rgba(255,255,255,0.12)" strokeDasharray="3 5" />
        <line
          x1={padX}
          y1={y(maxRank)}
          x2={W - padX}
          y2={y(maxRank)}
          stroke="rgba(255,255,255,0.07)"
          strokeDasharray="3 5"
        />

        <path d={area} fill="url(#rank-fill)" opacity={len ? 1 : 0} style={{ transition: 'opacity 600ms 900ms' }} />
        <path
          ref={pathRef}
          d={d}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={len || undefined}
          strokeDashoffset={len || undefined}
          style={
            len
              ? { animation: 'rank-draw 1500ms cubic-bezier(0.4,0,0.2,1) 250ms forwards' }
              : undefined
          }
        />

        {points.map((p, i) => (
          <circle
            key={p.j.label}
            cx={p.x}
            cy={p.y}
            r={i === peakIdx || i === troughIdx ? 5 : 3.2}
            fill={i === peakIdx ? 'var(--gold)' : i === troughIdx ? 'var(--live)' : '#0a1220'}
            stroke={i === peakIdx ? 'var(--gold)' : i === troughIdx ? 'var(--live)' : 'var(--accent)'}
            strokeWidth="2"
            opacity={len ? 1 : 0}
            style={{ transition: `opacity 300ms ${700 + i * 90}ms` }}
          />
        ))}

        {points.map((p) => (
          <text
            key={`l-${p.j.label}`}
            x={p.x}
            y={H - 5}
            textAnchor="middle"
            fontSize="9"
            fill="rgba(255,255,255,0.4)"
            fontWeight="700"
          >
            {p.j.short}
          </text>
        ))}
      </svg>

      <style>{`@keyframes rank-draw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          svg path { animation: none !important; stroke-dashoffset: 0 !important; }
        }`}</style>

      <div className="mt-2 flex justify-center gap-4 text-[0.65rem] font-bold uppercase tracking-wider">
        {peak ? <span className="text-gold">Peak: {ordinal(peak.rank)}</span> : null}
        {trough && trough.rank !== peak?.rank ? (
          <span className="text-live">Low: {ordinal(trough.rank)}</span>
        ) : null}
      </div>
    </div>
  );
}
