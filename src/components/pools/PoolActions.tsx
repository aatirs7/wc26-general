'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InviteShare from './InviteShare';

export default function PoolActions() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ poolId: string; code: string; groupName: string } | null>(
    null,
  );

  async function call(body: { action: 'create' | 'join'; name?: string; code?: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/pool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'request failed');
      setName('');
      setCode('');
      if (body.action === 'create') {
        // Show the invite code and link before moving on.
        setCreated({ poolId: data.pool.id, code: data.pool.joinCode, groupName: data.pool.name });
        return;
      }
      // Joining: drop straight into the group's bracket.
      router.push(`/bracket?pool=${data.pool.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed');
    } finally {
      setBusy(false);
    }
  }

  const input =
    'min-h-11 flex-1 rounded-xl border border-edge bg-white/[0.03] px-3.5 text-sm outline-none placeholder:text-muted-2 focus:border-accent/60';
  const btn =
    'min-h-11 rounded-xl bg-accent px-4 text-sm font-bold text-[var(--accent-ink)] active:scale-95 disabled:opacity-30';

  if (created) {
    return (
      <div className="card space-y-3 p-4 text-center">
        <div>
          <h3 className="font-display text-xl leading-tight">{created.groupName} is ready</h3>
          <p className="mt-1 text-xs text-muted">Share this so friends can join.</p>
        </div>
        <InviteShare code={created.code} groupName={created.groupName} />
        <button
          type="button"
          onClick={() => {
            router.push(`/bracket?pool=${created.poolId}`);
            router.refresh();
          }}
          className="min-h-11 w-full rounded-xl bg-accent text-sm font-bold text-[var(--accent-ink)] active:scale-95"
        >
          Continue to your bracket
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-xl border border-live/40 bg-live/[0.08] p-3 text-sm text-live">
          {error}
        </p>
      ) : null}

      <div className="card p-4">
        <h3 className="mb-2 font-display text-xl">Join a group</h3>
        <p className="mb-2 text-xs text-muted">Have a code from a friend? Enter it to join their group.</p>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Invite code"
            className={`${input} font-mono uppercase placeholder:font-sans placeholder:normal-case`}
          />
          <button
            type="button"
            disabled={busy || code.trim().length < 4}
            onClick={() => call({ action: 'join', code })}
            className={btn}
          >
            Join
          </button>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-2 font-display text-xl">Create a group</h3>
        <p className="mb-2 text-xs text-muted">Start your own group and share the code so others can join.</p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            className={input}
          />
          <button
            type="button"
            disabled={busy || name.trim().length === 0}
            onClick={() => call({ action: 'create', name })}
            className={btn}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
