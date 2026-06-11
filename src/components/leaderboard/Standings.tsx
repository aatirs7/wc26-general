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
  // Provisional points from in-progress groups (already inside `combined`).
  live: number;
  // Per-pick explanation of where the points come from.
  detail: { flag: string; name: string; reason: string; pts: number; live: boolean }[];
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
                  isMe ? (row.rank <= 3 ? 'border-accent' : 'border-accent bg-accent/[0.06]') : ''
                } ${row.rank <= 3 ? `podium-${row.rank}` : ''} ${isMe ? 'me-pulse' : ''}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-lg ${
                    medal || 'bg-white/[0.04] text-muted'
                  }`}
                >
                  {row.rank}
                </span>
                <div className="min-w-0 flex-1 text-center">
                  <div className="flex items-center justify-center gap-1.5">
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
                {row.rankDelta !== 0 ? (
                  <div className="flex shrink-0 flex-col items-end text-[0.6rem] font-bold leading-tight">
                    {row.rankDelta > 0 ? (
                      <span className="text-accent">▲{row.rankDelta}</span>
                    ) : (
                      <span className="text-live">▼{-row.rankDelta}</span>
                    )}
                  </div>
                ) : null}
                <div className="flex shrink-0 flex-col items-center leading-none">
                  <span className="font-display text-2xl text-accent">{row.combined}</span>
                  {row.live > 0 ? (
                    <span className="mt-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-gold">
                      live
                    </span>
                  ) : null}
                </div>
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
                {row.detail.length === 0 && row.bonus === 0 ? (
                  <p className="text-xs text-muted">No points scored yet.</p>
                ) : (
                  <dl className="mx-auto max-w-[19rem] space-y-1 text-left">
                    {row.detail.map((d, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="shrink-0 text-base leading-none">{d.flag}</span>
                        <dt className="min-w-0 flex-1 truncate">
                          <span className="font-semibold">{d.name}</span>
                          <span className="text-muted"> — {d.reason}</span>
                          {d.live ? (
                            <span className="ml-1 text-[0.55rem] font-bold uppercase tracking-wider text-gold">
                              live
                            </span>
                          ) : null}
                        </dt>
                        <dd className={`shrink-0 font-semibold ${d.live ? 'text-gold' : 'text-accent'}`}>
                          +{d.pts}
                        </dd>
                      </div>
                    ))}
                    {row.bonus > 0 ? (
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-gold">Score-prediction bonus</dt>
                        <dd className="shrink-0 font-semibold text-gold">+{row.bonus}</dd>
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
