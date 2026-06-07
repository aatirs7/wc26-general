'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  players: { id: string; displayName: string }[];
}

export default function NamePicker({ players }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(asName: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: asName }),
      });
      if (!res.ok) throw new Error('sign in failed');
      router.push('/bracket');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'sign in failed');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {players.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted">
            Who are you?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={busy}
                onClick={() => signIn(p.displayName)}
                className="min-h-11 rounded-full border border-edge bg-white/[0.03] px-4 text-sm font-semibold active:scale-95 disabled:opacity-40"
              >
                {p.displayName}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted">
          {players.length > 0 ? 'Or join as someone new' : 'Enter your name to play'}
        </p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={40}
            className="min-h-12 flex-1 rounded-xl border border-edge bg-white/[0.03] px-3.5 text-sm outline-none placeholder:text-muted-2 focus:border-accent/60"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) signIn(name);
            }}
          />
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={() => signIn(name)}
            className="min-h-12 rounded-xl bg-accent px-5 text-sm font-bold text-[var(--accent-ink)] active:scale-95 disabled:opacity-30"
          >
            Go
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-live">{error}</p> : null}
    </div>
  );
}
