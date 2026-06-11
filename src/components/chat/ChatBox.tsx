'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SendHorizontal } from 'lucide-react';

// Smack-talk composer plus a light poller so new messages from others
// appear without a manual refresh.
export default function ChatBox({ poolId }: { poolId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      // Avoid refreshing mid-send to not clobber the input.
      if (!inFlight.current) router.refresh();
    }, 12000);
    return () => clearInterval(id);
  }, [router]);

  async function send() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    inFlight.current = true;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId, body: text }),
      });
      if (res.ok) {
        setBody('');
        router.refresh();
      }
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6">
      <div className="mx-auto flex max-w-md items-end gap-2 rounded-2xl border border-edge bg-surface-raised p-1.5 shadow-2xl shadow-black/30 lg:max-w-2xl">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
          maxLength={280}
          placeholder="Talk your talk…"
          className="min-h-10 flex-1 rounded-xl bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-2"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !body.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-[var(--accent-ink)] active:scale-90 disabled:opacity-30"
        >
          <SendHorizontal className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
