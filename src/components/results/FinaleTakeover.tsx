'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

// One-time full-screen splash when the tournament finishes. Deep-links into
// each of the three finale experiences. Remembered per device so it auto-opens
// just once; bump VERSION to show it again.
const VERSION = '2026-finale-v2';
const KEY = 'wc26_finale_seen';

export default function FinaleTakeover({ poolCount = 1 }: { poolCount?: number }) {
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

  // Someone in several pools has not told us which recap they mean, so every
  // button goes to the chooser rather than guessing one.
  const choose = poolCount > 1;

  if (!open) return null;

  // The night wash comes from the themed palette, so the splash follows the
  // app's theme instead of forcing a dark surface under light text.
  return (
    <div
      className="finale-stage z-[300] flex flex-col items-center justify-center gap-4 px-8 text-center"
      style={{ background: 'var(--f-bg-night)' }}
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] flex h-9 w-9 items-center justify-center rounded-full f-fill-2 text-foreground active:scale-90"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="anim-trophy text-7xl">🏆</div>
      <p className="finale-kicker text-gold">Full time</p>
      <h1 className="finale-hero metal-gold" style={{ fontSize: 'clamp(2.6rem, 13vw, 4.6rem)' }}>
        It is over
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-muted">
        Every match has been played. Your Recap, the pool Recap, the podium and the people&apos;s
        awards are all waiting.
      </p>

      <div className="mt-3 w-full max-w-xs space-y-2">
        <Link
          href={choose ? '/results' : '/results/recap'}
          onClick={close}
          className="block w-full rounded-2xl bg-accent py-3 text-sm font-bold text-[var(--accent-ink)] shadow-lg shadow-accent/20 active:scale-95"
        >
          Watch your Recap
        </Link>
        <Link
          href={choose ? '/results' : '/results/podium'}
          onClick={close}
          className="block w-full rounded-2xl border border-gold/40 bg-gold/[0.1] py-3 text-sm font-bold text-gold active:scale-95"
        >
          See the podium
        </Link>
        <Link
          href="/results"
          onClick={close}
          className="block w-full rounded-2xl border f-line f-track py-3 text-sm font-bold text-foreground active:scale-95"
        >
          Everything else
        </Link>
      </div>

      <button type="button" onClick={close} className="mt-1 text-xs font-semibold text-muted-2">
        Maybe later
      </button>
    </div>
  );
}
