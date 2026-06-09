'use client';

import { useEffect, useState } from 'react';

// Ticks down to kickoff. Server passes the moment as an epoch ms so the
// client and server agree regardless of timezone.
function parts(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    mins: Math.floor((s % 3600) / 60),
    secs: s % 60,
  };
}

export default function Countdown({ kickoffMs }: { kickoffMs: number }) {
  // Start at "now = just before kickoff" so the server render is deterministic
  // (all zeros) and hydration matches; the real clock takes over on mount.
  const [now, setNow] = useState(() => kickoffMs - 1);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const { days, hours, mins, secs } = parts(kickoffMs - now);
  const cells = [
    { v: days, l: 'days' },
    { v: hours, l: 'hrs' },
    { v: mins, l: 'min' },
    { v: secs, l: 'sec' },
  ];

  return (
    <div className="flex justify-center gap-2">
      {cells.map((c) => (
        <div
          key={c.l}
          className="flex min-w-15 flex-col items-center rounded-xl border border-edge bg-white/[0.03] px-3 py-2"
        >
          <span className="font-display text-3xl leading-none tabular-nums text-foreground">
            {String(c.v).padStart(2, '0')}
          </span>
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted">
            {c.l}
          </span>
        </div>
      ))}
    </div>
  );
}
