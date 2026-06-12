'use client';

import { useEffect, useState } from 'react';

// Unread smack-talk count for the home Trash Talk button. "Seen" is the
// message total the user had when they last opened the chat (or first landed
// on home), stored per pool in localStorage; anything past that counts as new.
export default function ChatBadge({ poolId, count }: { poolId: string; count: number }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!poolId) return;
    const key = `wc26_chat_seen_${poolId}`;
    const raw = localStorage.getItem(key);
    let next = 0;
    if (raw === null) {
      // First time we see this pool: baseline to the current total so only
      // genuinely new messages light up the badge.
      localStorage.setItem(key, String(count));
    } else {
      next = Math.max(0, count - (Number(raw) || 0));
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnread(next);
  }, [poolId, count]);

  if (unread <= 0) return null;
  return (
    <span className="absolute right-2 top-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-live px-1 text-[0.6rem] font-bold leading-none text-white shadow-sm">
      {unread > 99 ? '99+' : unread}
    </span>
  );
}
