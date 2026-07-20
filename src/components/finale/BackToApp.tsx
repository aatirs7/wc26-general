'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Once the tournament ends the home screen leads with the finale, but the
// normal dashboard is still one tap away rather than gone.
export default function BackToApp({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-edge bg-white/[0.03] py-3 text-sm font-bold text-muted active:scale-[0.99]"
      >
        {open ? 'Hide the rest of the app' : 'Back to the app'}
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="reveal space-y-6">{children}</div> : null}
    </div>
  );
}
