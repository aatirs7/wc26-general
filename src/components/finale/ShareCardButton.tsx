'use client';

import { useState } from 'react';
import { Share2, Download, Loader2 } from 'lucide-react';

type State = 'idle' | 'working' | 'error';

// Shares the generated PNG as an actual file, so iOS and Android open their
// native share sheet with the image already attached and it can be sent
// straight into Messages or WhatsApp.
//
// Opening the image URL in a tab (what this used to do) technically "worked"
// but left you looking at a bare PNG with no way to send it, which is why it
// read as broken. Desktop browsers mostly cannot share files, so there we fall
// back to a plain download.
export default function ShareCardButton({
  url,
  filename,
  title,
  text,
  className = '',
  label = 'Share',
  onBusyChange,
}: {
  url: string;
  filename: string;
  title: string;
  text: string;
  className?: string;
  // Empty string renders an icon-only button, for the story deck header.
  label?: string;
  // Lets a caller pause itself while the share sheet is open.
  onBusyChange?: (busy: boolean) => void;
}) {
  const [state, setState] = useState<State>('idle');

  async function run() {
    setState('working');
    onBusyChange?.(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('could not build the image');
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || 'image/png' });

      // Feature-detect properly: canShare with files is the only reliable
      // signal, and Safari throws if you pass files it will not accept.
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title, text });
        setState('idle');
        onBusyChange?.(false);
        return;
      }

      // Fallback: save it, then the viewer can attach it themselves.
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
      setState('idle');
      onBusyChange?.(false);
    } catch (e) {
      // A cancelled share sheet rejects with AbortError, which is not a failure.
      onBusyChange?.(false);
      if (e instanceof DOMException && e.name === 'AbortError') {
        setState('idle');
        return;
      }
      setState('error');
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={state === 'working'}
      aria-label={label || 'Share this slide'}
      className={`flex items-center justify-center gap-2 ${className}`}
    >
      {state === 'working' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === 'error' ? (
        <Download className="h-4 w-4" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      {label ? (state === 'working' ? 'Building the image' : state === 'error' ? 'Try again' : label) : null}
    </button>
  );
}
