'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

// One-time full-screen splash when the tournament finishes. Deep-links into the
// Results page. Remembered per device so it auto-opens just once.
const VERSION = '2026-finale-v1';
const KEY = 'wc26_finale_seen';

export default function FinaleTakeover() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(KEY);
    } catch {
      // storage unavailable; skip auto-open
    }
    if (seen !== VERSION) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(KEY, VERSION);
    } catch {
      // ignore
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-5 px-8 text-center"
      style={{
        background: 'radial-gradient(120% 90% at 50% 0%, #10233f 0%, #060a13 60%)',
      }}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-edge bg-white/[0.04] text-muted active:scale-90"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="text-7xl">🏆</div>
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.4em] text-gold">Full time</p>
      <h1 className="shine font-display text-5xl leading-none">The World Cup is over</h1>
      <p className="max-w-xs text-sm leading-relaxed text-muted">
        The whistle has blown on the whole thing. The podium, the awards and your tournament recap are
        ready.
      </p>

      <Link
        href="/results"
        onClick={close}
        className="mt-2 min-h-12 w-full max-w-xs rounded-2xl bg-accent text-base font-bold leading-[3rem] text-[var(--accent-ink)] shadow-lg shadow-accent/20 active:scale-95"
      >
        See the podium
      </Link>
      <button type="button" onClick={close} className="text-xs font-semibold text-muted-2">
        Maybe later
      </button>
    </div>
  );
}
