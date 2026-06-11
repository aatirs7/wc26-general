'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

// A section whose body folds away behind its heading. Defaults closed so a
// long list (e.g. many brackets) does not bury what sits below it.
export default function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center gap-2 active:scale-95"
      >
        <h2 className="font-display text-xl text-muted">{title}</h2>
        {count != null ? (
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-xs font-bold text-muted">
            {count}
          </span>
        ) : null}
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="space-y-3">{children}</div> : null}
    </section>
  );
}
