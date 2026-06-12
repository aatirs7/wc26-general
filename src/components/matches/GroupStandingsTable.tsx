import type { Team } from '@/types/team';

export interface StandingRowData {
  groupLetter: string;
  teamCode: string;
  played: number;
  points: number;
  gd: number;
  gf: number;
  rank: number | null;
  advanced: boolean;
  isBestThird: boolean;
}

interface Props {
  letter: string;
  rows: StandingRowData[];
  teamsByCode: Map<string, Team>;
  // Predicted view: the rows are the player's bracket picks, not live results,
  // so the played/GD/points columns have no value and show a dash instead.
  predicted?: boolean;
}

export default function GroupStandingsTable({ letter, rows, teamsByCode, predicted }: Props) {
  // Sort by the provider rank, then a deterministic tiebreak so teams level
  // on rank (e.g. two sides yet to play, both rank 2) always appear in the
  // same order across databases instead of arbitrary insertion order.
  const sorted = [...rows].sort(
    (a, b) =>
      (a.rank ?? 99) - (b.rank ?? 99) ||
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.teamCode.localeCompare(b.teamCode),
  );
  return (
    <section className="card p-3">
      <h3 className="mb-2 font-display text-2xl leading-none">
        Group <span className="text-accent">{letter}</span>
      </h3>
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
            const team = teamsByCode.get(row.teamCode);
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
                    <span className="text-base">{team?.flag}</span>
                    <span className="truncate font-semibold">{team?.name ?? row.teamCode}</span>
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
