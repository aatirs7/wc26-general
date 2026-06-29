import type { Predictions } from '@/types/bracket';
import type { Team } from '@/types/team';
import { GROUP_LETTERS, type GroupLetter } from '@/lib/constants';
import { resolveActualById, ROOT_ID, type ActualMatchRow } from '@/lib/knockout-bracket';
import FullBracket from '@/components/bracket/FullBracket';

export interface ActualStanding {
  groupLetter: string;
  teamCode: string;
  rank: number | null;
  isBestThird: boolean;
}

interface Props {
  matchRows: (ActualMatchRow & { id: number })[];
  standings: ActualStanding[];
  teams: Team[];
  // The viewer's own picks, so we can tick the spots they actually nailed.
  myPredictions: Predictions;
}

const MEDAL: Record<number, string> = { 1: 'medal-1', 2: 'medal-2', 3: 'medal-3', 4: 'medal-4' };

const emptyPreds: Predictions = { groups: {}, thirdPlace: [], knockout: { r16: [], qf: [], sf: [], final: [] } };

// Read-only render of the REAL bracket as it stands right now: actual knockout
// results, actual group finishes and actual best thirds. Spots the viewer
// called correctly get a tick so they can compare against their own picks.
export default function LiveBracketSummary({ matchRows, standings, teams, myPredictions }: Props) {
  const byCode = new Map(teams.map((t) => [t.code, t]));

  // Actual group winners and runners-up, so R32 winner/runner slots fill in
  // from the final standings even before the provider assigns the fixtures.
  const groupFirst = new Map<string, string | null>();
  const groupSecond = new Map<string, string | null>();
  const actualBestThirds: { code: string; group: string }[] = [];
  for (const s of standings) {
    if (s.rank === 1) groupFirst.set(s.groupLetter, s.teamCode);
    else if (s.rank === 2) groupSecond.set(s.groupLetter, s.teamCode);
    if (s.isBestThird) actualBestThirds.push({ code: s.teamCode, group: s.groupLetter });
  }
  const resolved = resolveActualById(matchRows, groupFirst, groupSecond, actualBestThirds);

  const championCode = matchRows.find((m) => m.id === ROOT_ID)?.winnerCode ?? null;
  const championTeam = championCode ? byCode.get(championCode) : undefined;

  // Index actual finishes by group and rank.
  const byGroupRank = new Map<string, Map<number, ActualStanding>>();
  const bestThirds: ActualStanding[] = [];
  for (const s of standings) {
    if (s.rank != null) {
      if (!byGroupRank.has(s.groupLetter)) byGroupRank.set(s.groupLetter, new Map());
      byGroupRank.get(s.groupLetter)!.set(s.rank, s);
    }
    if (s.isBestThird) bestThirds.push(s);
  }

  // The team the viewer slotted at a given position in a group.
  const myPickAt = (letter: GroupLetter, rank: number): string | undefined => {
    const g = myPredictions.groups[letter];
    return rank === 1 ? g?.first : rank === 2 ? g?.second : rank === 3 ? g?.third : g?.fourth;
  };

  return (
    <div className="space-y-7">
      <div className="rounded-xl border border-live/30 bg-live/[0.06] p-3 text-center text-xs text-muted">
        This is the <span className="font-bold text-live">real bracket</span> as it stands now. A
        tick marks a spot you called correctly.
      </div>

      {championTeam ? (
        <div className="card relative overflow-hidden p-5 text-center ring-1">
          <div className="text-5xl">{championTeam.flag}</div>
          <div className="shine mt-2 font-display text-3xl">{championTeam.name}</div>
          <div className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-gold">
            Actual champion
          </div>
        </div>
      ) : null}

      <section>
        <h3 className="mb-2 font-display text-xl text-muted">Knockout bracket (live)</h3>
        <FullBracket predictions={emptyPreds} resolved={resolved} teamsByCode={byCode} />
      </section>

      <section>
        <h3 className="mb-2 font-display text-xl text-muted">Group finishes (actual)</h3>
        <div className="grid grid-cols-2 gap-2">
          {GROUP_LETTERS.map((letter) => {
            const ranks = byGroupRank.get(letter);
            return (
              <div key={letter} className="card p-2.5">
                <div className="mb-1.5 font-display text-base text-foreground">Group {letter}</div>
                <ol className="space-y-1">
                  {[1, 2, 3, 4].map((rank) => {
                    const row = ranks?.get(rank);
                    const t = row ? byCode.get(row.teamCode) : undefined;
                    const correct = row && myPickAt(letter, rank) === row.teamCode;
                    return (
                      <li key={rank} className="flex items-center gap-2 text-xs">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[0.6rem] font-bold ${MEDAL[rank]}`}
                        >
                          {rank}
                        </span>
                        {t ? (
                          <span className="flex min-w-0 flex-1 items-center gap-1 truncate">
                            {t.flag} {t.name}
                            {row?.isBestThird ? (
                              <span className="rounded bg-accent/15 px-1 text-[0.55rem] font-bold uppercase text-accent">Q</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="flex-1 text-muted">–</span>
                        )}
                        {correct ? <span className="shrink-0 text-accent">✓</span> : null}
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-display text-xl text-muted">Best third-placed qualifiers (actual)</h3>
        <div className="flex flex-wrap gap-1.5">
          {bestThirds.length > 0 ? (
            bestThirds.map((s) => {
              const t = byCode.get(s.teamCode);
              const mine = myPredictions.thirdPlace.includes(s.teamCode);
              return (
                <span
                  key={s.teamCode}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    mine ? 'border-accent/50 bg-accent/[0.08] text-accent' : 'border-edge bg-white/[0.03]'
                  }`}
                >
                  <span>{t?.flag}</span>
                  {t?.name ?? s.teamCode}
                  {mine ? <span>✓</span> : null}
                </span>
              );
            })
          ) : (
            <span className="text-xs text-muted">Not decided yet</span>
          )}
        </div>
      </section>
    </div>
  );
}
