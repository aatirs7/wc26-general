import type { Team } from '@/types/team';
import { matchTime } from '@/lib/format-time';
import StatusPill from './StatusPill';

export interface MatchRowData {
  id: number;
  status: string;
  homeCode: string | null;
  awayCode: string | null;
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
  homeScore: number | null;
  awayScore: number | null;
  winnerCode: string | null;
  kickoffUtc: Date;
  roundLabel: string;
  groupLetter: string | null;
}

interface Props {
  match: MatchRowData;
  teamsByCode: Map<string, Team>;
  // Teams the viewer's bracket is backing; highlighted as "your pick".
  backed?: Set<string>;
}

function Side({
  code,
  placeholder,
  score,
  isWinner,
  played,
  teamsByCode,
  backed,
}: {
  code: string | null;
  placeholder: string | null;
  score: number | null;
  isWinner: boolean;
  played: boolean;
  teamsByCode: Map<string, Team>;
  backed: boolean;
}) {
  const team = code ? teamsByCode.get(code) : undefined;
  return (
    <div className={`flex items-center gap-2.5 ${played && !isWinner ? 'opacity-55' : ''}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-black/30 text-base">
        {team?.flag ?? '⚽'}
      </span>
      <span className="flex-1 truncate text-sm font-semibold">
        {team?.name ?? placeholder ?? 'TBD'}
      </span>
      {backed ? (
        <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-wider text-accent">
          Pick
        </span>
      ) : null}
      {played ? (
        <span className={`font-display text-xl tabular-nums ${isWinner ? 'text-accent' : ''}`}>
          {score}
        </span>
      ) : null}
    </div>
  );
}

export default function MatchRow({ match, teamsByCode, backed }: Props) {
  const played = match.homeScore !== null && match.awayScore !== null;
  const homeBacked = match.homeCode != null && (backed?.has(match.homeCode) ?? false);
  const awayBacked = match.awayCode != null && (backed?.has(match.awayCode) ?? false);
  return (
    <div className={`card flex items-stretch gap-3 p-3 ${homeBacked || awayBacked ? 'border-accent/40' : ''}`}>
      <div className="min-w-0 flex-1 space-y-2">
        <Side
          code={match.homeCode}
          placeholder={match.homePlaceholder}
          score={match.homeScore}
          isWinner={match.winnerCode != null && match.winnerCode === match.homeCode}
          played={played}
          teamsByCode={teamsByCode}
          backed={homeBacked}
        />
        <Side
          code={match.awayCode}
          placeholder={match.awayPlaceholder}
          score={match.awayScore}
          isWinner={match.winnerCode != null && match.winnerCode === match.awayCode}
          played={played}
          teamsByCode={teamsByCode}
          backed={awayBacked}
        />
      </div>
      <div className="flex w-16 flex-col items-end justify-between border-l border-edge pl-2.5 text-right">
        <StatusPill status={match.status} />
        {match.status === 'scheduled' ? (
          <span className="font-display text-base leading-none text-foreground">
            {matchTime(match.kickoffUtc)}
          </span>
        ) : null}
        <span className="text-[0.62rem] font-semibold uppercase tracking-wider text-muted-2">
          {match.groupLetter ? `Group ${match.groupLetter}` : match.roundLabel}
        </span>
      </div>
    </div>
  );
}
