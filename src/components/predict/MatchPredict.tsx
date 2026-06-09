'use client';

import { useRef, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { PREDICT_MAX_GOALS } from '@/lib/predict';

interface SideProps {
  label: string;
  flag: string;
  value: number;
  onChange: (v: number) => void;
}

function Side({ label, flag, value, onChange }: SideProps) {
  const btn =
    'flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-white/[0.04] text-foreground active:scale-90 disabled:opacity-30';
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg leading-none">{flag}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
      <button type="button" aria-label="minus" disabled={value <= 0} onClick={() => onChange(value - 1)} className={btn}>
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <span className="w-6 text-center font-display text-2xl leading-none">{value}</span>
      <button
        type="button"
        aria-label="plus"
        disabled={value >= PREDICT_MAX_GOALS}
        onClick={() => onChange(value + 1)}
        className={btn}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function MatchPredict({
  matchId,
  home,
  away,
  homeFlag,
  awayFlag,
  initial,
}: {
  matchId: number;
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  initial: { home: number; away: number } | null;
}) {
  const [h, setH] = useState(initial?.home ?? 0);
  const [a, setA] = useState(initial?.away ?? 0);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    initial ? 'saved' : 'idle',
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function schedule(nh: number, na: number) {
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId, home: nh, away: na }),
        });
        if (!res.ok) throw new Error('save failed');
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, 600);
  }

  return (
    <div className="card space-y-2 p-3">
      <Side
        label={home}
        flag={homeFlag}
        value={h}
        onChange={(v) => {
          setH(v);
          schedule(v, a);
        }}
      />
      <Side
        label={away}
        flag={awayFlag}
        value={a}
        onChange={(v) => {
          setA(v);
          schedule(h, v);
        }}
      />
      <div className="text-right text-[0.7rem] font-semibold">
        {status === 'saving' ? (
          <span className="text-muted">Saving…</span>
        ) : status === 'saved' ? (
          <span className="inline-flex items-center gap-1 text-accent">
            <Check className="h-3 w-3" /> Prediction saved
          </span>
        ) : status === 'error' ? (
          <span className="text-live">Could not save</span>
        ) : (
          <span className="text-muted-2">Tap + / − to set a scoreline</span>
        )}
      </div>
    </div>
  );
}
