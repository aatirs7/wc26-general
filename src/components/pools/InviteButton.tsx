'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import InviteShare from './InviteShare';

// A visible "Invite friends" affordance for the main group pages, so the
// code and share link are not buried. Expands to reveal InviteShare.
export default function InviteButton({ code, groupName }: { code: string; groupName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 text-sm font-bold text-accent active:scale-95"
      >
        <UserPlus className="h-4 w-4" />
        {open ? 'Hide invite' : 'Invite friends'}
      </button>
      {open ? <InviteShare code={code} groupName={groupName} /> : null}
    </div>
  );
}
