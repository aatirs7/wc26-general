'use client';

import { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';

// Shows a group's invite code plus a one-tap shareable link that
// auto-joins the group when opened (see /join/[code]). Used on the
// post-create screen and on the Me page for any group.
export default function InviteShare({ code, groupName }: { code: string; groupName?: string }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  // Built at click time so we never render an absolute URL during SSR
  // (which would mismatch on hydration).
  const inviteLink = () => `${window.location.origin}/join/${code}`;

  async function copy(text: string, which: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard blocked; ignore
    }
  }

  async function share() {
    const link = inviteLink();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: groupName ? `Join ${groupName}` : 'Join my bracket group',
          text: `Join my World Cup 2026 bracket group${groupName ? ` "${groupName}"` : ''}`,
          url: link,
        });
      } catch {
        // user cancelled the share sheet; ignore
      }
    } else {
      copy(link, 'link');
    }
  }

  const btn =
    'flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-40';

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => copy(code, 'code')}
        className="w-full rounded-xl border border-edge bg-white/[0.03] p-3 text-center active:scale-[0.98]"
      >
        <div className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-muted">
          {copied === 'code' ? 'Copied' : 'Invite code (tap to copy)'}
        </div>
        <div className="mt-0.5 font-mono text-2xl tracking-[0.3em] text-accent">{code}</div>
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => copy(inviteLink(), 'link')}
          className={`${btn} border border-edge bg-white/[0.04]`}
        >
          {copied === 'link' ? (
            <>
              <Check className="h-4 w-4" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Copy link
            </>
          )}
        </button>
        <button
          type="button"
          onClick={share}
          className={`${btn} bg-accent text-[var(--accent-ink)]`}
        >
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>

      <p className="text-center text-[0.7rem] text-muted-2">
        Friends who open the link join this group automatically.
      </p>
    </div>
  );
}
