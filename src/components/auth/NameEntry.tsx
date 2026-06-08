'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  lastName?: string | null;
}

// Open name entry for a generalized pool: type a name to play. The server
// creates the user on first sign-in. If the name already belongs to someone,
// we surface a one-tap confirmation instead of silently signing in as them.
export default function NameEntry({ lastName }: Props) {
  const router = useRouter();
  const [name, setName] = useState(lastName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState<string | null>(null);

  async function submit(value: string, confirm: boolean) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, confirm }),
      });
      if (res.status === 409) {
        setTaken(trimmed);
        setBusy(false);
        return;
      }
      if (!res.ok) throw new Error('sign in failed');
      router.push('/bracket');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'sign in failed');
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // A returning player typing their remembered name is almost certainly
    // themselves, so skip the "name taken" warning for that case.
    const isReturning = !!lastName && name.trim().toLowerCase() === lastName.toLowerCase();
    submit(name, isReturning);
  }

  // Mid-confirmation: the chosen name is already in use.
  if (taken) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-foreground">
          Someone already plays as{' '}
          <span className="font-bold text-accent">{taken}</span>. Is that you?
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit(taken, true)}
            className="min-h-13 w-full rounded-2xl bg-accent text-lg font-bold text-[var(--accent-ink)] shadow-lg shadow-accent/20 active:scale-95 disabled:opacity-40"
          >
            Yes, that&apos;s me
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setTaken(null);
              setName('');
            }}
            className="min-h-11 w-full rounded-2xl border border-edge bg-white/[0.03] text-sm font-semibold active:scale-95 disabled:opacity-40"
          >
            Use a different name
          </button>
        </div>
        {error ? <p className="text-sm text-live">{error}</p> : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label className="block text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted">
        {lastName ? `Welcome back, ${lastName}` : 'Enter your name to play'}
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoComplete="off"
        placeholder="Your name"
        className="min-h-13 w-full rounded-2xl border border-edge bg-white/[0.03] px-4 text-center text-lg font-semibold outline-none focus:border-accent"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="flex min-h-13 w-full items-center justify-center rounded-2xl bg-accent text-lg font-bold text-[var(--accent-ink)] shadow-lg shadow-accent/20 active:scale-95 disabled:opacity-40"
      >
        Let&apos;s go
      </button>
      {error ? <p className="text-sm text-live">{error}</p> : null}
      <p className="pt-1 text-center text-xs text-muted-2">Made by Aatir Siddiqui</p>
    </form>
  );
}
