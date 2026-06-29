'use client';

import { useEffect, useState } from 'react';
import { X, Trophy } from 'lucide-react';

// One-time explainer for the new knockout penalty-shootout prediction, shown
// the next time someone opens the Predict page. Tracked in localStorage so it
// only auto-opens once.
const VERSION = '2026-06-29-pens';
const KEY = 'wc26_predict_pens_seen';

export default function PredictPensIntro() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(KEY);
    } catch {
      // storage unavailable; skip auto-open
    }
    if (seen !== VERSION) {
      const t = setTimeout(() => setOpen(true), 500);
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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="relative w-full max-w-[20rem] rounded-2xl border border-edge-strong bg-surface-raised p-5 text-center shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-edge bg-surface text-muted active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/10 ring-1 ring-gold/30">
          <Trophy className="h-7 w-7 text-gold" strokeWidth={2} />
        </div>

        <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-muted-2">New</p>
        <h2 className="mt-1 font-display text-2xl leading-tight text-foreground">Penalty predictions</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Knockout games can end in a shootout. When you set a{' '}
          <span className="text-foreground">level score</span> on a knockout match, you now also pick{' '}
          <span className="text-foreground">who wins on penalties</span>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          If the tie really goes to penalties and you called the right team, that is a{' '}
          <span className="font-bold text-gold">bonus point</span> on top of your exact-score point.
        </p>

        <button
          type="button"
          onClick={close}
          className="mt-4 min-h-11 w-full rounded-xl bg-accent text-sm font-bold text-[var(--accent-ink)] active:scale-95"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
