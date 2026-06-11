'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Keeps an installed (standalone) PWA fresh without a manual quit + relaunch:
// re-fetch server data whenever the app returns to the foreground, regains
// focus, or reconnects, plus a gentle poll while it is visible. router.refresh
// re-renders server components but preserves client state (inputs, scroll).
const THROTTLE_MS = 8000;
const POLL_MS = 90000;

export default function AutoRefresh() {
  const router = useRouter();
  const last = useRef(0);

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      if (now - last.current < THROTTLE_MS) return;
      last.current = now;
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(id);
    };
  }, [router]);

  return null;
}
