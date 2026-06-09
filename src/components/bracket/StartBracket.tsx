'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Copy } from 'lucide-react';

interface Source {
  id: string;
  poolName: string;
  submitted: boolean;
}

export default function StartBracket({
  poolId,
  sources = [],
}: {
  poolId: string;
  sources?: Source[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(copyFrom?: string) {
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
          ...(copyFrom ? { copyFrom } : {}),
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
    <div className="mt-8 space-y-3 reveal">
      {sources.length > 0 ? (
        <div className="card space-y-2 p-4">
          <div className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-accent" strokeWidth={2.2} />
            <h2 className="font-display text-xl leading-none">Reuse your picks</h2>
          </div>
          <p className="text-xs text-muted">
            Copy a bracket from another group, then tweak it here. You still submit
            separately per group.
          </p>
          {sources.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={busy}
              onClick={() => create(s.id)}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-edge bg-white/[0.03] px-3.5 text-left active:scale-95 disabled:opacity-40"
            >
              <span className="truncate text-sm font-semibold">{s.poolName}</span>
              <span className="shrink-0 text-xs font-bold text-accent">Use these →</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="card space-y-4 p-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/30">
          <ClipboardList className="h-7 w-7 text-accent" strokeWidth={2} />
        </div>
        <div>
          <h2 className="font-display text-3xl">
            {sources.length > 0 ? 'Or start fresh' : 'Name your bracket'}
          </h2>
          <p className="mt-1 text-sm text-muted">Give it some swagger.</p>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. The Group of Death"
          maxLength={60}
          className="min-h-12 w-full rounded-xl border border-edge bg-white/[0.03] px-3.5 text-center text-sm outline-none placeholder:text-muted-2 focus:border-accent/60"
        />
        {error ? <p className="text-sm text-live">{error}</p> : null}
        <button
          type="button"
          onClick={() => create()}
          disabled={busy}
          className="min-h-12 w-full rounded-2xl bg-accent text-base font-bold text-[var(--accent-ink)] shadow-lg shadow-accent/20 active:scale-95 disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Start picking'}
        </button>
      </div>
    </div>
  );
}
