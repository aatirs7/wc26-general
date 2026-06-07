'use client';

import type { Team } from '@/types/team';
import type { Predictions } from '@/types/bracket';
import { GROUP_LETTERS, type GroupLetter } from '@/lib/constants';
import { isGroupComplete } from '@/lib/predictions';
import TeamChip from './TeamChip';

interface Props {
  teams: Team[];
  predictions: Predictions;
  onRank: (letter: GroupLetter, code: string) => void;
}

type Rank = 1 | 2 | 3 | 4;

export default function GroupPicker({ teams, predictions, onRank }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        Tap teams in your predicted finishing order. First tap is 1st, then
        2nd, 3rd, 4th. Tap a ranked team to clear it.
      </p>
      {GROUP_LETTERS.map((letter, gi) => {
        const groupTeams = teams.filter((t) => t.groupLetter === letter);
        const pick = predictions.groups[letter];
        const done = isGroupComplete(pick);
        const rankOf = (code: string): Rank | undefined => {
          if (pick?.first === code) return 1;
          if (pick?.second === code) return 2;
          if (pick?.third === code) return 3;
          if (pick?.fourth === code) return 4;
          return undefined;
        };
        return (
          <section
            key={letter}
            className="card reveal p-3"
            style={{ animationDelay: `${gi * 28}ms` }}
          >
            <header className="mb-2.5 flex items-center justify-between">
              <h3 className="font-display text-2xl leading-none">
                Group <span className="text-accent">{letter}</span>
              </h3>
              <span
                className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wider ${
                  done ? 'bg-accent/15 text-accent' : 'bg-white/5 text-muted'
                }`}
              >
                {done ? 'Locked in' : 'Rank 4'}
              </span>
            </header>
            <div className="space-y-2">
              {groupTeams.map((team) => (
                <TeamChip
                  key={team.code}
                  team={team}
                  rank={rankOf(team.code)}
                  onTap={() => onRank(letter, team.code)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
