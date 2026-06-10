'use client';

import { useEffect } from 'react';

// Remembers the group you are currently viewing so tabs that do not carry a
// ?pool= (the bottom nav) still open on it. Pages read the cookie as a
// fallback when no pool is in the URL.
export default function RememberPool({ poolId }: { poolId: string }) {
  useEffect(() => {
    document.cookie = `wc26_active_pool=${poolId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [poolId]);
  return null;
}
