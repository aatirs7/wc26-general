'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  HelpCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Calculator,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

// Bump VERSION whenever CHANGELOG changes; the modal then auto-opens once
// for each user (tracked in localStorage), and the ? button reopens it.
const VERSION = '2026-06-29-knockouts';
const KEY = 'wc26_whatsnew_seen';

type Entry = {
  icon: LucideIcon;
  title: string;
  desc: string;
  showGain?: boolean; // render the personalised points-gained badge
  cta?: { label: string; href: string };
};

const CHANGELOG: Entry[] = [
  {
    icon: Trophy,
    title: 'Welcome to the knockouts',
    desc: 'The group stage is done and the Round of 32 is underway. From here your bracket scores for every team you rode deeper: 5 for the Round of 16, 8 the quarters, 12 the semis, 18 the final, and 30 if your champion lifts the trophy.',
  },
  {
    icon: Calculator,
    title: 'Group scoring got fairer',
    desc: 'You now bank the advance points for any team you picked to go through, even if you had it 2nd and it finished 3rd (or the other way around). On top of that, every exact finish you nailed (1st, 2nd, 3rd or 4th in a group) is worth a bonus point.',
    showGain: true,
  },
  {
    icon: Sparkles,
    title: 'See your score, explained',
    desc: 'There is a new "My score explained" page on the home screen: a plain-English, always-updating breakdown of every single point you have, split into group stage, knockouts and predictions.',
    cta: { label: 'Open my score', href: '/score' },
  },
];

export default function WhatsNew({ gain }: { gain?: number | null }) {
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
        className="absolute left-3 top-3 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-edge-strong bg-surface-raised shadow-lg shadow-black/25 active:scale-90"
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

            {entry.showGain && gain != null && gain > 0 ? (
              <div className="mt-3 rounded-xl border border-gold/40 bg-gold/[0.1] px-3 py-2 text-sm">
                <span className="font-display text-2xl text-gold">+{gain}</span>{' '}
                <span className="font-semibold text-foreground">points</span>{' '}
                <span className="text-muted">added to your total from this update</span>
              </div>
            ) : null}

            {entry.cta ? (
              <Link
                href={entry.cta.href}
                onClick={close}
                className="mt-3 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-gold/40 bg-gold/[0.1] text-sm font-bold text-gold active:scale-95"
              >
                <Sparkles className="h-4 w-4" /> {entry.cta.label}
              </Link>
            ) : null}

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
