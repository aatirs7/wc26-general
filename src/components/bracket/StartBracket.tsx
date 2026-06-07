'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StartBracket({ poolId }: { poolId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bracket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          poolId,
          name: name.trim() || 'My bracket',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'could not create bracket');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not create bracket');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-8 space-y-4 p-5 text-center reveal">
      <div className="text-4xl">🏟️</div>
      <div>
        <h2 className="font-display text-3xl">Name your bracket</h2>
        <p className="mt-1 text-sm text-muted">Give it some swagger.</p>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Siu Crew Special"
        maxLength={60}
        className="min-h-12 w-full rounded-xl border border-edge bg-white/[0.03] px-3.5 text-center text-sm outline-none placeholder:text-muted-2 focus:border-accent/60"
      />
      {error ? <p className="text-sm text-live">{error}</p> : null}
      <button
        type="button"
        onClick={create}
        disabled={busy}
        className="min-h-12 w-full rounded-2xl bg-accent text-base font-bold text-[var(--accent-ink)] shadow-lg shadow-accent/20 active:scale-95 disabled:opacity-40"
      >
        {busy ? 'Creating…' : 'Start picking'}
      </button>
    </div>
  );
}
