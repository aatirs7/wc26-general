'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { emptyPredictions } from '@/types/bracket';

// Shown above an auto-filled bracket: explains it was filled in for them and
// offers a clean restart (clears every pick so they can build their own).
export default function AutofillRestart({ bracketId }: { bracketId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startOver() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bracket', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bracketId, predictions: emptyPredictions() }),
      });
      if (!res.ok) throw new Error('reset failed');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'reset failed');
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-gold/50 bg-gold/[0.1] p-3.5">
      <div className="flex items-center gap-2 text-gold">
        <AlertTriangle className="h-4 w-4" strokeWidth={2.4} />
        <span className="text-sm font-bold">This bracket was auto-filled</span>
      </div>
      <p className="mt-1 text-sm text-foreground">
        It was filled in for you at kickoff. Edit the picks below, or start fresh and build your own.
      </p>
      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-gold/50 bg-gold/15 px-3 py-1.5 text-xs font-bold text-gold active:scale-95"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} />
          Start over
        </button>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={startOver}
            disabled={busy}
            className="min-h-9 flex-1 rounded-lg bg-gold text-sm font-bold text-[#2b1d00] disabled:opacity-40"
          >
            {busy ? 'Clearing…' : 'Yes, clear all picks'}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="min-h-9 flex-1 rounded-lg border border-edge text-sm font-semibold"
          >
            Cancel
          </button>
        </div>
      )}
      {error ? <p className="mt-1 text-xs text-live">{error}</p> : null}
    </div>
  );
}
