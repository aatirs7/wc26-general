'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

export interface PlayerRow {
  ownerId: string;
  name: string;
  bracketName: string | null;
  bracketId: string | null;
  rank: number;
  combined: number;
  bracketTotal: number;
  bonus: number;
  submitted: boolean;
  rounds: { label: string; pts: number }[];
  rankDelta: number;
  gained: number;
}

export default function Standings({ rows, meId }: { rows: PlayerRow[]; meId: string }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ol className="space-y-2">
      {rows.map((row) => {
        const isMe = row.ownerId === meId;
        const open = openId === row.ownerId;
        const medal = row.rank <= 3 ? `medal-${row.rank}` : '';
        return (
          <li key={row.ownerId}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : row.ownerId)}
              className="w-full text-left"
            >
              <div
                className={`card flex min-h-14 items-center gap-3 px-3 py-2.5 ${
                  isMe ? 'border-accent bg-accent/[0.06]' : row.rank <= 3 ? `ring-${row.rank}` : ''
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-lg ${
                    medal || 'bg-white/[0.04] text-muted'
                  }`}
                >
                  {row.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold">{row.name}</span>
                    {isMe ? (
                      <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-[var(--accent-ink)]">
                        You
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {row.bracketName ?? 'No bracket'}
                    {!row.submitted ? ' · not locked' : ''}
                  </div>
                </div>
                {row.rankDelta !== 0 || row.gained > 0 ? (
                  <div className="flex shrink-0 flex-col items-end text-[0.6rem] font-bold leading-tight">
                    {row.rankDelta > 0 ? (
                      <span className="text-accent">▲{row.rankDelta}</span>
                    ) : row.rankDelta < 0 ? (
                      <span className="text-live">▼{-row.rankDelta}</span>
                    ) : null}
                    {row.gained > 0 ? <span className="text-muted">+{row.gained}</span> : null}
                  </div>
                ) : null}
                <span className="font-display text-2xl leading-none text-accent">{row.combined}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-2 transition-transform ${open ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {open ? (
              <div className="mt-1.5 rounded-xl border border-edge bg-white/[0.02] p-3 text-center text-sm">
                <div className="mb-1.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted-2">
                  Where the points come from
                </div>
                {row.rounds.length === 0 && row.bonus === 0 ? (
                  <p className="text-xs text-muted">No points scored yet.</p>
                ) : (
                  <dl className="mx-auto max-w-[16rem] space-y-1 text-left">
                    {row.rounds.map((r) => (
                      <div key={r.label} className="flex justify-between">
                        <dt className="text-muted">{r.label}</dt>
                        <dd className="font-semibold">{r.pts}</dd>
                      </div>
                    ))}
                    {row.bonus > 0 ? (
                      <div className="flex justify-between">
                        <dt className="text-gold">Score-prediction bonus</dt>
                        <dd className="font-semibold text-gold">{row.bonus}</dd>
                      </div>
                    ) : null}
                    <div className="mt-1 flex justify-between border-t border-edge/60 pt-1.5">
                      <dt className="font-bold">Total</dt>
                      <dd className="font-display text-lg text-accent">{row.combined}</dd>
                    </div>
                  </dl>
                )}
                {row.bracketId ? (
                  <Link
                    href={`/bracket/${row.bracketId}`}
                    className="mt-2 inline-block text-xs font-bold text-accent"
                  >
                    View full bracket →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
