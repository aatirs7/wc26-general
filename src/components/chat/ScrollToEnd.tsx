'use client';

import { useLayoutEffect } from 'react';

// Jumps the smack-talk feed to the newest message when the page opens, so you
// land on the latest line instead of having to scroll past the whole history.
// Keyed on poolId so switching pools re-anchors; the 12s background refresh
// does not remount this, so it never yanks you down while you are reading.
export default function ScrollToEnd({ poolId }: { poolId: string }) {
  useLayoutEffect(() => {
    // Two rafs: let the feed paint, then settle at the bottom.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [poolId]);
  return null;
}
