'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Mode = 'choose' | 'create' | 'join';

// Signed-out onboarding: pick a group first (create one or join with a
// code), then enter a name. On submit we sign in by name and create/join
// the group in one step, then drop into that group's bracket.
export default function Onboard({ lastName }: { lastName?: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('choose');
  const [groupName, setGroupName] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState(lastName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [takenName, setTakenName] = useState<string | null>(null);

  // Returns true if signed in, false if the name is taken and needs
  // confirmation (the warning is surfaced via takenName).
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

  async function joinOrCreate(): Promise<string> {
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
    return data.pool.id;
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
      const poolId = await joinOrCreate();
      router.push(`/bracket?pool=${poolId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'something went wrong');
      setBusy(false);
    }
  }

  const primary =
    'flex min-h-13 w-full items-center justify-center rounded-2xl bg-accent text-lg font-bold text-[var(--accent-ink)] shadow-lg shadow-accent/20 active:scale-95 disabled:opacity-40';
  const outline =
    'min-h-13 w-full rounded-2xl border border-edge bg-white/[0.04] text-base font-semibold active:scale-95 disabled:opacity-40';
  const input =
    'min-h-13 w-full rounded-2xl border border-edge bg-white/[0.03] px-4 text-center text-lg font-semibold outline-none focus:border-accent';

  const credit = (
    <p className="pt-1 text-center text-xs text-muted-2">Made by Aatir Siddiqui</p>
  );

  // Step 1: choose to create or join.
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
        {credit}
      </div>
    );
  }

  // Step 2 (mid-flow): the chosen name is already in use.
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
      ) : (
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
      {credit}
    </form>
  );
}
