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
}: {
  url: string;
  filename: string;
  title: string;
  text: string;
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<State>('idle');

  async function run() {
    setState('working');
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
    } catch (e) {
      // A cancelled share sheet rejects with AbortError, which is not a failure.
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
      className={`flex items-center justify-center gap-2 ${className}`}
    >
      {state === 'working' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === 'error' ? (
        <Download className="h-4 w-4" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
      {state === 'working' ? 'Building the image' : state === 'error' ? 'Try again' : label}
    </button>
  );
}
