'use client';

import { useEffect, useState } from 'react';
import {
  HelpCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Target,
  ListOrdered,
  UserPlus,
  Copy,
  type LucideIcon,
} from 'lucide-react';

// Bump VERSION whenever CHANGELOG changes; the modal then auto-opens once
// for each user (tracked in localStorage), and the ? button reopens it.
const VERSION = '2026-06-09';
const KEY = 'wc26_whatsnew_seen';

const CHANGELOG: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Target,
    title: 'Predict scores',
    desc: 'Call the exact scoreline of upcoming matches for bonus points. Opens 24h before kickoff, locks at kickoff.',
  },
  {
    icon: ListOrdered,
    title: 'Combined standings',
    desc: 'The table ranks everyone by bracket points plus score-prediction bonus. Tap a player to see exactly where their points come from.',
  },
  {
    icon: UserPlus,
    title: 'Easy invites',
    desc: 'Share a join code or a link that drops friends straight into your group.',
  },
  {
    icon: Copy,
    title: 'Reuse a bracket',
    desc: 'Joined another group? Copy your picks from an existing group and tweak them.',
  },
];

export default function WhatsNew() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(KEY);
    } catch {
      // storage unavailable; skip auto-open
    }
    if (seen !== VERSION) {
      const t = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(t);
    }
  }, []);

  function start() {
    setStep(0);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    try {
      localStorage.setItem(KEY, VERSION);
    } catch {
      // ignore
    }
  }

  const last = CHANGELOG.length - 1;
  const entry = CHANGELOG[step];
  const Icon = entry.icon;

  return (
    <>
      <button
        type="button"
        onClick={start}
        aria-label="What's new"
        className="fixed left-3 top-3 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-edge-strong bg-surface-raised shadow-lg shadow-black/25 active:scale-90"
      >
        <HelpCircle className="h-5 w-5 text-accent" strokeWidth={2.4} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="relative w-full max-w-[20rem] rounded-2xl border border-edge-strong bg-surface-raised p-5 text-center shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-edge bg-surface text-muted active:scale-90"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/30">
              <Icon className="h-7 w-7 text-accent" strokeWidth={2} />
            </div>

            <p className="mt-3 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-muted-2">
              What&apos;s new · {step + 1} of {CHANGELOG.length}
            </p>
            <h2 className="mt-1 font-display text-2xl leading-tight text-foreground">{entry.title}</h2>
            <p className="mt-2 min-h-[3.5rem] text-sm leading-relaxed text-muted">{entry.desc}</p>

            <div className="mt-3 flex justify-center gap-1.5">
              {CHANGELOG.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-4 bg-accent' : 'w-1.5 bg-edge-strong'
                  }`}
                />
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex min-h-11 w-11 items-center justify-center rounded-xl border border-edge bg-surface text-foreground active:scale-95 disabled:opacity-30"
                aria-label="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {step < last ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(last, s + 1))}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-accent text-sm font-bold text-[var(--accent-ink)] active:scale-95"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={close}
                  className="min-h-11 flex-1 rounded-xl bg-accent text-sm font-bold text-[var(--accent-ink)] active:scale-95"
                >
                  Got it
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
