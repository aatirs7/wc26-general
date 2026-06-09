'use client';

import { useEffect, useState } from 'react';
import { HelpCircle, X, Sparkles } from 'lucide-react';

// Bump VERSION whenever CHANGELOG changes; the modal then auto-opens once
// for each user (tracked in localStorage), and the ? button reopens it.
const VERSION = '2026-06-09';
const KEY = 'wc26_whatsnew_seen';

const CHANGELOG: { title: string; desc: string }[] = [
  {
    title: 'Predict scores for bonus points',
    desc: 'New Predict screen: call the exact scoreline of upcoming matches (opens 24h before kickoff, locks at kickoff) to earn bonus points.',
  },
  {
    title: 'Bonus & Combined standings',
    desc: 'The table now toggles between bracket points, prediction bonus, and the two combined.',
  },
  {
    title: 'A home dashboard',
    desc: 'Your group at a glance: rank, bracket status, what is coming up, and a one-tap invite.',
  },
  {
    title: 'Easy invites',
    desc: 'Share a join code or a link that drops friends straight into your group.',
  },
  {
    title: 'Reuse a bracket across groups',
    desc: 'Joined another group? Copy your picks from an existing group and tweak them.',
  },
  {
    title: 'Rename yourself & share brackets',
    desc: 'Change your display name in the Me tab, and share a bracket link with a rich preview.',
  },
];

export default function WhatsNew() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(KEY);
    } catch {
      // storage unavailable; skip auto-open
    }
    if (seen !== VERSION) {
      // Deferred so it does not fight hydration and reads as an intentional pop.
      const t = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(t);
    }
  }, []);

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(KEY, VERSION);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="What's new"
        className="fixed left-3 top-3 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-edge-strong bg-surface-raised shadow-lg shadow-black/25 active:scale-90"
      >
        <HelpCircle className="h-5 w-5 text-accent" strokeWidth={2.4} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
          onClick={close}
        >
          <div
            className="card max-h-[85vh] w-full max-w-sm overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-2xl leading-none">
                <Sparkles className="h-5 w-5 text-gold" /> What&apos;s new
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-edge bg-white/[0.03] active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-3">
              {CHANGELOG.map((c) => (
                <li key={c.title} className="flex gap-2.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <div>
                    <div className="text-sm font-bold">{c.title}</div>
                    <div className="text-xs leading-relaxed text-muted">{c.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={close}
              className="mt-4 min-h-11 w-full rounded-2xl bg-accent text-sm font-bold text-[var(--accent-ink)] active:scale-95"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
