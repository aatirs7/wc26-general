'use client';

import { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import InstallGuide from './me/InstallGuide';

const KEY = 'wc26_install_prompt_dismissed';

// One-time nudge to add the PWA to the home screen. Skipped if the app is
// already running standalone or the user has dismissed it before.
export default function InstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const standalone =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (standalone) return;
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // ignore (private mode); it just shows again next session
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={dismiss}
    >
      <div
        className="glass max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl p-4 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-full text-muted active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="px-6 text-center">
            <div className="flex items-center justify-center gap-1.5 text-accent">
              <Sparkles className="h-4 w-4" strokeWidth={2.4} />
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.2em]">Best experience</span>
            </div>
            <h2 className="mt-1 font-display text-2xl leading-none">Add it to your home screen</h2>
            <p className="mt-1 text-sm text-muted">
              Install the app for a full-screen, faster, app-like experience. Takes a few taps:
            </p>
          </div>
        </div>

        <div className="mt-3">
          <InstallGuide />
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="mt-3 min-h-11 w-full rounded-xl border border-edge text-sm font-semibold text-muted active:scale-95"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
