'use client';

import { useEffect, useState } from 'react';
import { Share, MoreVertical, PlusSquare, Download, Check } from 'lucide-react';

type Platform = 'ios' | 'android';

// Chrome/Edge fire this before offering an install; it is not in the DOM lib.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STEPS: Record<Platform, { icon: typeof Share; text: string }[]> = {
  ios: [
    { icon: Share, text: 'Open this page in Safari, then tap the Share button (the square with an up arrow).' },
    { icon: PlusSquare, text: 'Scroll down and tap "Add to Home Screen".' },
    { icon: PlusSquare, text: 'Tap "Add" in the top corner. The trophy icon lands on your home screen.' },
  ],
  android: [
    { icon: MoreVertical, text: 'Open this page in Chrome, then tap the three-dot menu (top right).' },
    { icon: PlusSquare, text: 'Tap "Add to Home screen" (or "Install app").' },
    { icon: PlusSquare, text: 'Tap "Add" to confirm. Find it with your other apps.' },
  ],
};

export default function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>('ios');
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    // Detected after mount to avoid an SSR/hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (standalone) setInstalled(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  }

  return (
    <div className="card space-y-3 p-4">
      {installed ? (
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-accent">
          <Check className="h-4 w-4" strokeWidth={2.6} />
          Installed on this device
        </div>
      ) : (
        <>
          {prompt ? (
            <>
              <button
                type="button"
                onClick={install}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-[var(--accent-ink)] shadow-lg shadow-accent/20 active:scale-95"
              >
                <Download className="h-5 w-5" strokeWidth={2.4} />
                Install app
              </button>
              <p className="text-center text-xs text-muted-2">Or add it manually:</p>
            </>
          ) : null}

          <div className="flex rounded-full border border-edge bg-white/[0.03] p-1 text-sm font-bold">
            {(['ios', 'android'] as Platform[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
                  platform === p ? 'bg-accent text-[var(--accent-ink)]' : 'text-muted'
                }`}
              >
                {p === 'ios' ? 'iPhone' : 'Android'}
              </button>
            ))}
          </div>
          <ol className="space-y-2.5">
            {STEPS[platform].map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Icon className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                  <span className="pt-0.5 text-sm leading-snug text-muted">{step.text}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
