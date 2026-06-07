'use client';

import type { Team } from '@/types/team';
import type { Predictions } from '@/types/bracket';
import { ROUND_SIZES, type KnockoutRoundKey } from '@/lib/constants';
import { poolForRound } from '@/lib/bracket-reducer';
import TeamChip from './TeamChip';

interface Props {
  teams: Team[];
  predictions: Predictions;
  round: KnockoutRoundKey;
  description: string;
  onToggle: (code: string) => void;
}

export default function KnockoutRound({ teams, predictions, round, description, onToggle }: Props) {
  const pool = poolForRound(predictions, round);
  const picks = new Set(predictions.knockout[round]);
  const size = ROUND_SIZES[round];
  const full = picks.size >= size;
  const candidates = teams.filter((t) => pool.has(t.code));

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">{description}</p>

      {candidates.length === 0 ? (
        <div className="card p-5 text-center text-sm text-muted">
          Finish the previous step first. The teams you advance there appear here.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
            <span className="text-muted">Advancing</span>
            <span className="font-display text-xl text-accent">
              {picks.size}/{size}
            </span>
          </div>
          <div className="space-y-2">
            {candidates.map((team) => {
              const selected = picks.has(team.code);
              return (
                <TeamChip
                  key={team.code}
                  team={team}
                  selected={selected}
                  badge={selected ? 'ADVANCE' : undefined}
                  disabled={!selected && full}
                  onTap={() => onToggle(team.code)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
