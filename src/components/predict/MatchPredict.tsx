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
  homeCode,
  awayCode,
  knockout = false,
  initial,
}: {
  matchId: number;
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  homeCode?: string | null;
  awayCode?: string | null;
  knockout?: boolean;
  initial: { home: number; away: number; pensWinner?: string | null } | null;
}) {
  const [h, setH] = useState(initial?.home ?? 0);
  const [a, setA] = useState(initial?.away ?? 0);
  const [pensWinner, setPensWinner] = useState<string | null>(initial?.pensWinner ?? null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    initial ? 'saved' : 'idle',
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The shootout picker only applies to knockout ties you call level.
  const isDraw = h === a;
  const showPens = knockout && isDraw && !!homeCode && !!awayCode;

  function schedule(nh: number, na: number, pw: string | null) {
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId, home: nh, away: na, pensWinner: pw }),
        });
        if (!res.ok) throw new Error('save failed');
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    }, 600);
  }

  function setScore(nh: number, na: number) {
    setH(nh);
    setA(na);
    // A non-level score cannot go to penalties, so drop any shootout pick.
    const nextPens = nh === na ? pensWinner : null;
    if (nextPens !== pensWinner) setPensWinner(nextPens);
    schedule(nh, na, nextPens);
  }

  function pickPens(code: string) {
    const next = pensWinner === code ? null : code;
    setPensWinner(next);
    schedule(h, a, next);
  }

  const pensBtn = (code: string, flag: string, label: string) => {
    const on = pensWinner === code;
    return (
      <button
        type="button"
        onClick={() => pickPens(code)}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-bold active:scale-95 ${
          on ? 'border-gold/60 bg-gold/15 text-gold' : 'border-edge bg-white/[0.03] text-muted'
        }`}
      >
        <span className="text-sm leading-none">{flag}</span>
        <span className="min-w-0 truncate">{label}</span>
      </button>
    );
  };

  return (
    <div className="card space-y-2 p-3">
      <Side label={home} flag={homeFlag} value={h} onChange={(v) => setScore(v, a)} />
      <Side label={away} flag={awayFlag} value={a} onChange={(v) => setScore(h, v)} />

      {showPens ? (
        <div className="rounded-lg border border-gold/25 bg-gold/[0.05] p-2">
          <div className="mb-1.5 text-center text-[0.7rem] font-bold uppercase tracking-wider text-gold">
            Level after extra time, who wins on penalties?
          </div>
          <div className="flex gap-2">
            {pensBtn(homeCode!, homeFlag, home)}
            {pensBtn(awayCode!, awayFlag, away)}
          </div>
          <div className="mt-1 text-center text-[0.6rem] text-muted-2">
            Optional. Tap again to clear. Worth a bonus point if it goes to pens and you call it.
          </div>
        </div>
      ) : null}

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
