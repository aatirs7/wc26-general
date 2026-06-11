'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InviteShare from '@/components/pools/InviteShare';

type Mode = 'choose' | 'create' | 'join' | 'login';

interface Created {
  poolId: string;
  code: string;
  groupName: string;
}

// Signed-out onboarding: pick a group first (create one or join with a
// code), then enter a name. On submit we sign in by name and create/join
// the group in one step. After creating, we show the invite code and a
// shareable link before continuing to the bracket.
//
// When `invite` is passed (from /join/[code]) we skip the chooser and go
// straight to the name step, locked to that group's code.
export default function Onboard({
  lastName,
  invite,
}: {
  lastName?: string | null;
  invite?: { code: string; groupName: string };
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(invite ? 'join' : 'choose');
  const [groupName, setGroupName] = useState('');
  const [code, setCode] = useState(invite?.code ?? '');
  const [name, setName] = useState(lastName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [takenName, setTakenName] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  // Returns true if signed in, false if the name is taken and needs
  // confirmation (surfaced via takenName).
  async function signIn(confirm: boolean): Promise<boolean> {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), confirm }),
    });
    if (res.status === 409) {
      setTakenName(name.trim());
      return false;
    }
    if (!res.ok) throw new Error('sign in failed');
    return true;
  }

  async function joinOrCreate(): Promise<{ id: string; name: string; joinCode: string }> {
    const body =
      mode === 'create'
        ? { action: 'create', name: groupName.trim() }
        : { action: 'join', code: code.trim() };
    const res = await fetch('/api/pool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'something went wrong');
    return data.pool;
  }

  async function go(confirm: boolean) {
    setBusy(true);
    setError(null);
    try {
      const ok = await signIn(confirm);
      if (!ok) {
        setBusy(false);
        return;
      }
      const pool = await joinOrCreate();
      if (mode === 'create') {
        // Pause on a share screen so the owner sees the code and link.
        setCreated({ poolId: pool.id, code: pool.joinCode, groupName: pool.name });
        setBusy(false);
        return;
      }
      router.push(`/bracket?pool=${pool.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'something went wrong');
      setBusy(false);
    }
  }

  // Returning player: sign in by name only. confirm is true because they
  // are intentionally signing in as that existing name. The page then
  // re-renders to show their groups to pick from.
  async function login() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, confirm: true }),
      });
      if (!res.ok) throw new Error('sign in failed');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'sign in failed');
      setBusy(false);
    }
  }

  const primary =
    'flex min-h-13 w-full items-center justify-center rounded-2xl bg-accent text-lg font-bold text-[var(--accent-ink)] shadow-lg shadow-accent/20 active:scale-95 disabled:opacity-40';
  const outline =
    'min-h-13 w-full rounded-2xl border border-edge bg-white/[0.04] text-base font-semibold active:scale-95 disabled:opacity-40';
  const input =
    'min-h-13 w-full rounded-2xl border border-edge bg-white/[0.03] px-4 text-center text-lg font-semibold outline-none focus:border-accent';

  // Post-create: show the invite code and link before continuing.
  if (created) {
    return (
      <div className="space-y-3 text-center">
        <div>
          <p className="font-display text-2xl leading-tight">{created.groupName} is ready</p>
          <p className="mt-1 text-sm text-muted">
            Share this so friends can join. You can always find it again later.
          </p>
        </div>
        <InviteShare code={created.code} groupName={created.groupName} />
        <button
          type="button"
          onClick={() => {
            router.push(`/bracket?pool=${created.poolId}`);
            router.refresh();
          }}
          className={primary}
        >
          Continue to your bracket
        </button>
      </div>
    );
  }

  // Mid-flow: the chosen name is already in use.
  if (takenName) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-foreground">
          Someone already plays as{' '}
          <span className="font-bold text-accent">{takenName}</span>. Is that you?
        </p>
        <button type="button" disabled={busy} onClick={() => go(true)} className={primary}>
          Yes, that&apos;s me
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setTakenName(null);
            setName('');
          }}
          className={outline}
        >
          Use a different name
        </button>
        {error ? <p className="text-sm text-live">{error}</p> : null}
      </div>
    );
  }

  // Step 1: choose to create or join (skipped when arriving via invite).
  if (mode === 'choose') {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setMode('create')} className={primary}>
          Create a group
        </button>
        <button type="button" onClick={() => setMode('join')} className={outline}>
          Join a group
        </button>
        <p className="text-center text-xs text-muted">
          Start your own group and share the code, or join a friend&apos;s with theirs.
        </p>
        <div className="flex items-center gap-3 pt-1">
          <span className="h-px flex-1 bg-edge/60" />
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted-2">
            already playing
          </span>
          <span className="h-px flex-1 bg-edge/60" />
        </div>
        <button
          type="button"
          onClick={() => setMode('login')}
          className="min-h-13 w-full rounded-2xl border border-accent/50 bg-accent/10 text-base font-bold text-accent active:scale-95"
        >
          Log in with your name
        </button>
      </div>
    );
  }

  // Returning player logs in by name, then sees their groups.
  if (mode === 'login') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login();
        }}
        className="space-y-2"
      >
        <label className="block text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted">
          {lastName ? `Welcome back, ${lastName}` : 'Log in with your name'}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          autoComplete="off"
          placeholder="Your name"
          className={input}
        />
        <button type="submit" disabled={busy || !name.trim()} className={primary}>
          Log in
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setMode('choose');
            setError(null);
          }}
          className="min-h-9 w-full text-center text-xs font-semibold text-muted active:scale-95"
        >
          Back
        </button>
        {error ? <p className="text-center text-sm text-live">{error}</p> : null}
      </form>
    );
  }

  const ready =
    name.trim().length > 0 &&
    (mode === 'create' ? groupName.trim().length > 0 : code.trim().length >= 4);

  // Step 2: enter group details + name.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const isReturning = !!lastName && name.trim().toLowerCase() === lastName.toLowerCase();
        go(isReturning);
      }}
      className="space-y-2"
    >
      {mode === 'create' ? (
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          maxLength={60}
          autoComplete="off"
          placeholder="Group name"
          className={input}
        />
      ) : invite ? null : (
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={12}
          autoComplete="off"
          placeholder="Invite code"
          className={`${input} font-mono uppercase placeholder:font-sans placeholder:normal-case`}
        />
      )}

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        autoComplete="off"
        placeholder={lastName ? `Your name (${lastName}?)` : 'Your name'}
        className={input}
      />

      <button type="submit" disabled={busy || !ready} className={primary}>
        {mode === 'create' ? 'Create & play' : 'Join & play'}
      </button>
      {invite ? null : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setMode('choose');
            setError(null);
          }}
          className="min-h-9 w-full text-center text-xs font-semibold text-muted active:scale-95"
        >
          Back
        </button>
      )}
      {error ? <p className="text-center text-sm text-live">{error}</p> : null}
    </form>
  );
}
