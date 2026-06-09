'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

// Share a bracket's link. Opening it shows a rich preview (see the
// bracket opengraph-image). Falls back to copying when the native share
// sheet is unavailable.
export default function ShareBracket({ title }: { title?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: title ?? 'My World Cup 2026 bracket', url });
      } catch {
        // cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // clipboard blocked
      }
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 text-sm font-bold text-accent active:scale-95"
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? 'Copied' : 'Share'}
    </button>
  );
}
