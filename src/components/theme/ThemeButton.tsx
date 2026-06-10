'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'dark' | 'gray';

const EVENT = 'wc26themechange';

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'gray';
}

export default function ThemeButton({ initial }: { initial: Theme }) {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => initial);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'gray' : 'dark';
    document.documentElement.dataset.theme = next;
    document.cookie = `wc26_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to day theme' : 'Switch to night theme'}
      className="absolute right-3 top-3 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-edge-strong bg-surface-raised shadow-lg shadow-black/25 active:scale-90"
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-gold" strokeWidth={2.4} />
      ) : (
        <Moon className="h-5 w-5 text-accent" strokeWidth={2.4} />
      )}
    </button>
  );
}
