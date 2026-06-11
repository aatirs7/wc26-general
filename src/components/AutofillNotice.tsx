'use client';

import { useEffect, useState } from 'react';

// One-time popup for players whose bracket was randomly auto-filled at lock
// because they never finished it. Dismissed for good via localStorage.
const ACK_KEY = 'wc26_autofill_ack_v1';

export default function AutofillNotice({ pools }: { pools: string[] }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (pools.length > 0 && localStorage.getItem(ACK_KEY) !== '1') setShow(true);
  }, [pools.length]);

  if (!show) return null;

  function dismiss() {
    localStorage.setItem(ACK_KEY, '1');
    setShow(false);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-5" onClick={dismiss}>
      <div
        className="glass w-full max-w-sm rounded-2xl border border-gold/40 p-5 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-2xl ring-1 ring-gold/40">
          🎲
        </div>
        <h2 className="font-display text-2xl text-gold">Your bracket was auto-filled</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          You didn&apos;t finish your bracket before kickoff, so the rest of your picks were filled
          in <span className="text-foreground">at random</span> — that way you&apos;re still in the
          running and on the leaderboard.
          {pools.length > 1 ? (
            <> This happened in: <span className="text-foreground">{pools.join(', ')}</span>.</>
          ) : null}{' '}
          Brackets are locked now, so these picks are final. Good luck!
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-4 min-h-11 w-full rounded-xl bg-accent font-bold text-[var(--accent-ink)] active:scale-95"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
