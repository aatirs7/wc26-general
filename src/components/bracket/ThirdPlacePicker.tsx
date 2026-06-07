'use client';

import type { Team } from '@/types/team';
import type { Predictions } from '@/types/bracket';
import { GROUP_LETTERS, THIRD_PLACE_PICKS } from '@/lib/constants';
import TeamChip from './TeamChip';

interface Props {
  teams: Team[];
  predictions: Predictions;
  onToggle: (code: string) => void;
}

export default function ThirdPlacePicker({ teams, predictions, onToggle }: Props) {
  const byCode = new Map(teams.map((t) => [t.code, t]));
  // The 12 teams ranked third, one per group, in group order.
  const thirds = GROUP_LETTERS.map((l) => predictions.groups[l]?.third).filter(Boolean) as string[];
  const picked = new Set(predictions.thirdPlace);
  const full = picked.size >= THIRD_PLACE_PICKS;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        Only 8 of the 12 third-placed teams reach the knockout. Pick which of
        your third-place finishers sneak through. Worth 2 points each.
      </p>

      {thirds.length === 0 ? (
        <div className="card p-5 text-center text-sm text-muted">
          Rank a 3rd-place team in your groups first, then choose which advance.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
            <span className="text-muted">Qualifiers chosen</span>
            <span className="font-display text-xl text-accent">
              {picked.size}/{THIRD_PLACE_PICKS}
            </span>
          </div>
          <div className="space-y-2">
            {thirds.map((code) => {
              const team = byCode.get(code);
              if (!team) return null;
              const selected = picked.has(code);
              return (
                <TeamChip
                  key={code}
                  team={team}
                  selected={selected}
                  badge={selected ? 'THROUGH' : undefined}
                  disabled={!selected && full}
                  onTap={() => onToggle(code)}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
