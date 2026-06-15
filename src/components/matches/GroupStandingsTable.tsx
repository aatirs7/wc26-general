'use client';

import { useState } from 'react';

export interface GroupRow {
  groupLetter: string;
  teamCode: string;
  name: string;
  flag: string;
  played: number;
  points: number;
  gd: number;
  gf: number;
  rank: number;
  advanced: boolean;
  isBestThird: boolean;
}

interface Props {
  letter: string;
  liveRows: GroupRow[];
  picksRows: GroupRow[];
  // Whether the viewer has a bracket to compare against (controls the toggle).
  hasPicks: boolean;
}

// One group's table with its own Live / My picks toggle, so each group can be
// flipped independently between the live standings and the player's bracket.
export default function GroupStandingsTable({ letter, liveRows, picksRows, hasPicks }: Props) {
  const [mode, setMode] = useState<'live' | 'picks'>('live');
  const predicted = hasPicks && mode === 'picks';
  const rows = predicted ? picksRows : liveRows;

  // Sort by rank, then a deterministic tiebreak so teams level on rank always
  // appear in the same order instead of arbitrary insertion order.
  const sorted = [...rows].sort(
    (a, b) =>
      a.rank - b.rank ||
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.teamCode.localeCompare(b.teamCode),
  );

  return (
    <section className="card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-display text-2xl leading-none">
          Group <span className="text-accent">{letter}</span>
        </h3>
        {hasPicks ? (
          <div className="flex shrink-0 rounded-full border border-edge bg-white/[0.03] p-0.5 text-[0.55rem] font-bold">
            <button
              type="button"
              onClick={() => setMode('live')}
              className={`rounded-full px-2 py-1 transition-colors ${!predicted ? 'bg-accent text-[var(--accent-ink)]' : 'text-muted'}`}
            >
              Live
            </button>
            <button
              type="button"
              onClick={() => setMode('picks')}
              className={`rounded-full px-2 py-1 transition-colors ${predicted ? 'bg-accent text-[var(--accent-ink)]' : 'text-muted'}`}
            >
              My picks
            </button>
          </div>
        ) : null}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[0.6rem] uppercase tracking-wider text-muted-2">
            <th className="w-5 pb-1.5 font-semibold">#</th>
            <th className="pb-1.5 font-semibold">Team</th>
            <th className="w-7 pb-1.5 text-right font-semibold">P</th>
            <th className="w-8 pb-1.5 text-right font-semibold">GD</th>
            <th className="w-9 pb-1.5 text-right font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const pos = row.rank ?? i + 1;
            return (
              <tr key={row.teamCode} className="border-t border-edge/60">
                <td className="py-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.6rem] font-bold ${
                      pos <= 3 ? `medal-${pos}` : 'text-muted'
                    }`}
                  >
                    {pos}
                  </span>
                </td>
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <span className="text-base">{row.flag}</span>
                    <span className="truncate font-semibold">{row.name}</span>
                    {row.advanced ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold ${
                          row.isBestThird ? 'bg-bronze/20 text-bronze' : 'bg-accent/20 text-accent'
                        }`}
                      >
                        {row.isBestThird ? '3RD' : 'Q'}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums text-muted">
                  {predicted ? '—' : row.played}
                </td>
                <td className="py-2 text-right tabular-nums text-muted">
                  {predicted ? '—' : row.gd > 0 ? `+${row.gd}` : row.gd}
                </td>
                <td className="py-2 text-right font-display text-lg tabular-nums">
                  {predicted ? '—' : row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
