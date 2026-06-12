'use client';

import { useEffect } from 'react';

// Marks the pool's smack-talk as read up to the current total, so the home
// Trash Talk badge clears once the feed has been opened.
export default function ChatSeen({ poolId, count }: { poolId: string; count: number }) {
  useEffect(() => {
    if (!poolId) return;
    localStorage.setItem(`wc26_chat_seen_${poolId}`, String(count));
  }, [poolId, count]);
  return null;
}
