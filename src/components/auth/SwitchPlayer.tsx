'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SwitchPlayer() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function switchPlayer() {
    setBusy(true);
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={switchPlayer}
      disabled={busy}
      className="min-h-11 rounded-xl border border-edge bg-white/[0.03] px-4 text-sm font-semibold active:scale-95 disabled:opacity-40"
    >
      Switch
    </button>
  );
}
