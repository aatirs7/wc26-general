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
  // code -> short label for how far the viewer's bracket backs that team
  // (e.g. "1st", "R16", "Final"). Shown as an accent tag.
  pickLabels?: Map<string, string>;
}

function Side({
  code,
  placeholder,
  score,
  isWinner,
  played,
  teamsByCode,
  pickLabel,
}: {
  code: string | null;
  placeholder: string | null;
  score: number | null;
  isWinner: boolean;
  played: boolean;
  teamsByCode: Map<string, Team>;
  pickLabel?: string;
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
      {pickLabel ? (
        <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wide text-accent">
          {pickLabel}
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

export default function MatchRow({ match, teamsByCode, pickLabels }: Props) {
  const played = match.homeScore !== null && match.awayScore !== null;
  const homeLabel = match.homeCode ? pickLabels?.get(match.homeCode) : undefined;
  const awayLabel = match.awayCode ? pickLabels?.get(match.awayCode) : undefined;
  return (
    <div className={`card flex items-stretch gap-3 p-3 ${homeLabel || awayLabel ? 'border-accent/40' : ''}`}>
      <div className="min-w-0 flex-1 space-y-2">
        <Side
          code={match.homeCode}
          placeholder={match.homePlaceholder}
          score={match.homeScore}
          isWinner={match.winnerCode != null && match.winnerCode === match.homeCode}
          played={played}
          teamsByCode={teamsByCode}
          pickLabel={homeLabel}
        />
        <Side
          code={match.awayCode}
          placeholder={match.awayPlaceholder}
          score={match.awayScore}
          isWinner={match.winnerCode != null && match.winnerCode === match.awayCode}
          played={played}
          teamsByCode={teamsByCode}
          pickLabel={awayLabel}
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
