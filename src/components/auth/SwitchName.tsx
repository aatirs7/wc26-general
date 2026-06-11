'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Sign out / switch player from the landing page. Clears the auth cookie
// (the remembered name is kept server-side) and refreshes back to the
// name picker. Names are the only identity here, so this is the way to
// hand the device to another player.
export default function SwitchName({ name }: { name: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function switchName() {
    setBusy(true);
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <p className="text-center text-xs text-muted-2">
      {name ? <>Signed in as <span className="font-semibold text-muted">{name}</span>. </> : null}
      <button
        type="button"
        onClick={switchName}
        disabled={busy}
        className="font-semibold text-accent underline-offset-2 hover:underline disabled:opacity-40"
      >
        Switch name
      </button>
    </p>
  );
}
