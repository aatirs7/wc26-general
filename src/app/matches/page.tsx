import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brackets, groupStandings, matches, poolMembers, teams } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { pickNote } from '@/lib/pick-labels';
import type { Predictions } from '@/types/bracket';
import { GROUP_LETTERS } from '@/lib/constants';
import { DISPLAY_TZ_LABEL, matchDayKey, matchDayLabel } from '@/lib/format-time';
import MatchRow from '@/components/matches/MatchRow';
import GroupStandingsTable, { type GroupRow } from '@/components/matches/GroupStandingsTable';
import LivePoller from '@/components/matches/LivePoller';
import { computeLiveGroupTables } from '@/lib/standings';
import { resolveActualById } from '@/lib/knockout-bracket';

export const dynamic = 'force-dynamic';

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; fix?: string }>;
}) {
  const { view, fix } = await searchParams;
  const showGroups = view === 'groups';
  const showKnockouts = view === 'knockouts';
  // Fixtures tab sub-picker: group-stage fixtures vs knockout fixtures.
  const fixStage: 'group' | 'ko' = fix === 'group' ? 'group' : 'ko';

  // Note fixtures with the signed-in player's picks.
  const userId = await currentUserId();
  let myPredictions: Predictions | null = null;
  if (userId) {
    const memberships = await db
      .select({ poolId: poolMembers.poolId })
      .from(poolMembers)
      .where(eq(poolMembers.userId, userId));
    if (memberships.length > 0) {
      const active =
        memberships.find((m) => m.poolId === process.env.NEXT_PUBLIC_DEFAULT_POOL_ID) ?? memberships[0];
      const [mine] = await db
        .select()
        .from(brackets)
        .where(and(eq(brackets.ownerId, userId), eq(brackets.poolId, active.poolId)))
        .limit(1);
      if (mine) myPredictions = mine.predictions;
    }
  }

  const allTeams = await db.select().from(teams);
  const teamsByCode = new Map(allTeams.map((t) => [t.code, t]));

  const allMatches = await db.select().from(matches).orderBy(asc(matches.kickoffUtc), asc(matches.id));

  const notesByMatch = new Map<number, string[]>();
  if (myPredictions) {
    for (const m of allMatches) {
      const ns: string[] = [];
      if (m.homeCode) {
        const n = pickNote(myPredictions, m.homeCode, m.stage, m.groupLetter, teamsByCode.get(m.homeCode)?.name ?? m.homeCode);
        if (n) ns.push(n);
      }
      if (m.awayCode) {
        const n = pickNote(myPredictions, m.awayCode, m.stage, m.groupLetter, teamsByCode.get(m.awayCode)?.name ?? m.awayCode);
        if (n) ns.push(n);
      }
      if (ns.length) notesByMatch.set(m.id, ns);
    }
  }

  const anyLive = allMatches.some((m) => m.status === 'live' || m.status === 'ht');
  // Server component rendered per request (force-dynamic), so reading the
  // clock here is fine.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const anySoon = allMatches.some(
    (m) =>
      m.status === 'scheduled' &&
      m.kickoffUtc.getTime() > now - 3 * 3600 * 1000 &&
      m.kickoffUtc.getTime() < now + 3600 * 1000,
  );

  // Live "as it stands" group tables, computed straight from the match
  // scores so an in-progress game's goals count the instant they land (the
  // provider's own standings only refresh once a match is final). The top two
  // that have played are flagged provisional qualifiers (Q), matching the
  // live points; best-thirds only matter once groups end.
  // Each group card holds both tables (live + your bracket picks) and toggles
  // between them on the client, so groups can be flipped independently.
  const teamMeta = (code: string) => {
    const t = teamsByCode.get(code);
    return { name: t?.name ?? code, flag: t?.flag ?? '⚽' };
  };
  let liveStandings: GroupRow[] = [];
  let picksStandings: GroupRow[] = [];
  if (showGroups) {
    liveStandings = computeLiveGroupTables(
      allMatches.map((m) => ({
        stage: m.stage,
        status: m.status,
        groupLetter: m.groupLetter,
        homeCode: m.homeCode,
        awayCode: m.awayCode,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
      })),
    ).map((r) => ({
      groupLetter: r.groupLetter,
      teamCode: r.teamCode,
      ...teamMeta(r.teamCode),
      played: r.played,
      points: r.points,
      gd: r.gd,
      gf: r.gf,
      rank: r.rank,
      advanced: r.advanced,
      isBestThird: false,
    }));

    if (myPredictions) {
      // Predicted tables: your bracket's full 1-2-3-4 ranking for each group,
      // exactly as you set it. Falls back to the remaining group teams only if
      // a position was left blank.
      const teamsByGroup = new Map<string, string[]>();
      for (const t of allTeams) {
        if (!teamsByGroup.has(t.groupLetter)) teamsByGroup.set(t.groupLetter, []);
        teamsByGroup.get(t.groupLetter)!.push(t.code);
      }
      picksStandings = GROUP_LETTERS.flatMap((letter) => {
        const g = myPredictions!.groups[letter as (typeof GROUP_LETTERS)[number]];
        const ranked = [g?.first, g?.second, g?.third, g?.fourth].filter((c): c is string => !!c);
        const rest = (teamsByGroup.get(letter) ?? []).filter((c) => !ranked.includes(c)).sort();
        const ordered = [...ranked, ...rest];
        return ordered.map((code, i) => ({
          groupLetter: letter,
          teamCode: code,
          ...teamMeta(code),
          played: 0,
          points: 0,
          gd: 0,
          gf: 0,
          rank: i + 1,
          advanced: i < 2,
          isBestThird: false,
        }));
      });
    }
  }

  // Resolve the real knockout bracket so knockout fixtures show the teams that
  // have actually advanced (group winners/runners and best thirds from the
  // final standings, plus feeder winners propagated forward) before the
  // provider populates each fixture. Shared by the Fixtures (Knockouts filter)
  // and the Knockouts tab.
  let resolvedKo: ReturnType<typeof resolveActualById> | null = null;
  if (!showGroups) {
    const standings = await db
      .select({
        groupLetter: groupStandings.groupLetter,
        teamCode: groupStandings.teamCode,
        rank: groupStandings.rank,
        isBestThird: groupStandings.isBestThird,
      })
      .from(groupStandings);
    const groupFirst = new Map<string, string | null>();
    const groupSecond = new Map<string, string | null>();
    const bestThirds: { code: string; group: string }[] = [];
    for (const s of standings) {
      if (s.rank === 1) groupFirst.set(s.groupLetter, s.teamCode);
      else if (s.rank === 2) groupSecond.set(s.groupLetter, s.teamCode);
      if (s.isBestThird) bestThirds.push({ code: s.teamCode, group: s.groupLetter });
    }
    resolvedKo = resolveActualById(allMatches, groupFirst, groupSecond, bestThirds);
  }

  // Fill a knockout fixture's teams from the resolved bracket when the provider
  // has not assigned them yet, leaving scores and status intact.
  const fillKo = (m: (typeof allMatches)[number]): (typeof allMatches)[number] => {
    const r = resolvedKo?.get(m.id);
    if (!r) return m;
    return { ...m, homeCode: m.homeCode ?? r.aCode, awayCode: m.awayCode ?? r.bCode };
  };

  // Fixtures tab is split by the sub-picker: group-stage fixtures, or knockout
  // fixtures with their teams filled in (and future spots). Grouped by calendar
  // day in the display timezone so the heading matches each row's kickoff time.
  const fixSource =
    fixStage === 'group'
      ? allMatches.filter((m) => m.stage === 'group')
      : allMatches.filter((m) => m.stage !== 'group').map(fillKo);
  const byDay = new Map<string, typeof allMatches>();
  for (const m of fixSource) {
    const day = matchDayKey(m.kickoffUtc);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(m);
  }

  // Jump to today (or the next day with matches) by listing past days last.
  const today = matchDayKey(new Date());
  const days = [...byDay.keys()].sort();
  const upcoming = days.filter((d) => d >= today);
  const past = days.filter((d) => d < today).reverse();

  // Knockout fixtures grouped by round, in bracket order.
  const KO_STAGES: { stage: string; label: string }[] = [
    { stage: 'r32', label: 'Round of 32' },
    { stage: 'r16', label: 'Round of 16' },
    { stage: 'qf', label: 'Quarter-finals' },
    { stage: 'sf', label: 'Semi-finals' },
    { stage: 'third', label: 'Third-place playoff' },
    { stage: 'final', label: 'Final' },
  ];
  const koRounds = showKnockouts
    ? KO_STAGES.map((s) => ({
        ...s,
        games: allMatches
          .filter((m) => m.stage === s.stage)
          .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime() || a.id - b.id)
          .map(fillKo),
      })).filter((r) => r.games.length > 0)
    : [];

  return (
    <div className="space-y-4 py-4">
      <LivePoller active={anyLive || anySoon} />

      <header className="flex flex-col items-center gap-3 pt-2">
        <h1 className="font-display text-4xl leading-none">Matches</h1>
        <div className="flex rounded-full border border-edge bg-white/[0.03] p-1 text-xs font-bold">
          <Link
            href="/matches"
            className={`rounded-full px-3 py-1.5 transition-colors ${!showGroups && !showKnockouts ? 'bg-accent text-[var(--accent-ink)]' : 'text-muted'}`}
          >
            Fixtures
          </Link>
          <Link
            href="/matches?view=groups"
            className={`rounded-full px-3 py-1.5 transition-colors ${showGroups ? 'bg-accent text-[var(--accent-ink)]' : 'text-muted'}`}
          >
            Groups
          </Link>
          <Link
            href="/matches?view=knockouts"
            className={`rounded-full px-3 py-1.5 transition-colors ${showKnockouts ? 'bg-accent text-[var(--accent-ink)]' : 'text-muted'}`}
          >
            Knockouts
          </Link>
        </div>
      </header>

      {showGroups ? (
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
          {GROUP_LETTERS.map((letter) => (
            <GroupStandingsTable
              key={letter}
              letter={letter}
              liveRows={liveStandings.filter((s) => s.groupLetter === letter)}
              picksRows={picksStandings.filter((s) => s.groupLetter === letter)}
              hasPicks={!!myPredictions}
            />
          ))}
        </div>
      ) : showKnockouts ? (
        <div className="space-y-5 lg:mx-auto lg:max-w-2xl">
          <p className="text-center text-xs text-muted-2">All times Eastern ({DISPLAY_TZ_LABEL})</p>
          {koRounds.map((round) => (
            <section key={round.stage}>
              <h2 className="sticky top-0 z-10 mb-2 -mx-1 bg-bg/80 px-1 py-1 font-display text-lg tracking-wide text-muted backdrop-blur lg:top-16">
                {round.label}
              </h2>
              <div className="space-y-2">
                {round.games.map((m, i) => {
                  // Date sub-heading whenever the day changes within a round.
                  const prev = round.games[i - 1];
                  const showDate = !prev || matchDayKey(prev.kickoffUtc) !== matchDayKey(m.kickoffUtc);
                  return (
                    <div key={m.id} className="space-y-2">
                      {showDate ? (
                        <p className="px-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-2">
                          {matchDayLabel(m.kickoffUtc)}
                        </p>
                      ) : null}
                      <MatchRow match={m} teamsByCode={teamsByCode} notes={notesByMatch.get(m.id)} />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {koRounds.length === 0 ? (
            <p className="card p-5 text-sm text-muted">
              The knockout bracket is set once the group stage finishes.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-5 lg:mx-auto lg:max-w-2xl">
          <div className="flex justify-center">
            <div className="flex rounded-full border border-edge bg-white/[0.03] p-1 text-xs font-bold">
              <Link
                href="/matches?fix=group"
                className={`rounded-full px-3 py-1.5 transition-colors ${fixStage === 'group' ? 'bg-accent text-[var(--accent-ink)]' : 'text-muted'}`}
              >
                Group stage
              </Link>
              <Link
                href="/matches?fix=ko"
                className={`rounded-full px-3 py-1.5 transition-colors ${fixStage === 'ko' ? 'bg-accent text-[var(--accent-ink)]' : 'text-muted'}`}
              >
                Knockouts
              </Link>
            </div>
          </div>
          <p className="text-center text-xs text-muted-2">All times Eastern ({DISPLAY_TZ_LABEL})</p>
          {[...upcoming, ...past].map((day) => (
            <section key={day}>
              <h2 className="sticky top-0 z-10 mb-2 -mx-1 bg-bg/80 px-1 py-1 font-display text-lg tracking-wide text-muted backdrop-blur lg:top-16">
                {matchDayLabel(new Date(`${day}T12:00:00Z`))}
              </h2>
              <div className="space-y-2">
                {byDay.get(day)!.map((m) => (
                  <MatchRow key={m.id} match={m} teamsByCode={teamsByCode} notes={notesByMatch.get(m.id)} />
                ))}
              </div>
            </section>
          ))}
          {fixSource.length === 0 ? (
            <p className="card p-5 text-sm text-muted">
              {fixStage === 'group'
                ? 'No group-stage fixtures loaded yet.'
                : 'The knockout bracket is set once the group stage finishes.'}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
