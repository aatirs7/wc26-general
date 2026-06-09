'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';

// Rename your own display name. Reflects everywhere your name shows
// (leaderboards, group member lists).
export default function RenameSelf({ currentName }: { currentName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) throw new Error('That name is taken');
      if (!res.ok) throw new Error(data.error ?? 'could not rename');
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'could not rename');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-accent active:scale-95"
      >
        <Pencil className="h-3 w-3" /> Rename
      </button>
    );
  }

  return (
    <div className="w-full max-w-xs space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoFocus
          className="min-h-10 flex-1 rounded-xl border border-edge bg-white/[0.03] px-3 text-center text-sm outline-none focus:border-accent/60"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy || !name.trim() || name.trim() === currentName}
          className="min-h-10 rounded-xl bg-accent px-3 text-sm font-bold text-[var(--accent-ink)] active:scale-95 disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {error ? <p className="text-xs text-live">{error}</p> : null}
    </div>
  );
}
