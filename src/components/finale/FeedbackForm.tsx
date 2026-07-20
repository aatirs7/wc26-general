'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Check, Loader2 } from 'lucide-react';

const MAX = 2000;

export default function FeedbackForm({ name }: { name: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function send() {
    const text = body.trim();
    if (!text) return;
    setState('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) throw new Error('failed');
      setBody('');
      setState('sent');
      router.refresh();
    } catch {
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div className="card p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent text-[var(--accent-ink)]">
          <Check className="h-6 w-6" strokeWidth={3} />
        </div>
        <h2 className="mt-3 font-display text-2xl leading-none">Got it, {name}</h2>
        <p className="mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed text-muted">
          Genuinely, thank you. Every note gets read.
        </p>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="mt-4 rounded-full border border-edge bg-white/[0.03] px-4 py-2 text-xs font-bold text-muted active:scale-95"
        >
          Say something else
        </button>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, MAX))}
        rows={6}
        placeholder="Anything at all. What you liked, what annoyed you, what should exist in 2030."
        className="w-full resize-none rounded-xl border border-edge bg-white/[0.02] p-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-2 focus:border-accent/50"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[0.65rem] text-muted-2">
          {body.length}/{MAX}
        </span>
        <button
          type="button"
          onClick={send}
          disabled={!body.trim() || state === 'sending'}
          className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-[var(--accent-ink)] disabled:opacity-40 active:scale-95"
        >
          {state === 'sending' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Send
        </button>
      </div>
      {state === 'error' ? (
        <p className="mt-2 text-center text-xs font-semibold text-live">
          That did not send. Give it another go.
        </p>
      ) : null}
    </div>
  );
}
