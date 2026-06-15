import Link from 'next/link';
import { cookies } from 'next/headers';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brackets, matches, poolMembers, teams } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { pickNote } from '@/lib/pick-labels';
import type { Predictions } from '@/types/bracket';
import { GROUP_LETTERS } from '@/lib/constants';
import { DISPLAY_TZ_LABEL, matchDayKey, matchDayLabel } from '@/lib/format-time';
import MatchRow from '@/components/matches/MatchRow';
import GroupStandingsTable, { type GroupRow } from '@/components/matches/GroupStandingsTable';
import LivePoller from '@/components/matches/LivePoller';
import { computeLiveGroupTables } from '@/lib/standings';

export const dynamic = 'force-dynamic';

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const showGroups = view === 'groups';

  // Note fixtures with the signed-in player's picks (from their active pool).
  const userId = await currentUserId();
  let myPredictions: Predictions | null = null;
  if (userId) {
    const memberships = await db
      .select({ poolId: poolMembers.poolId })
      .from(poolMembers)
      .where(eq(poolMembers.userId, userId));
    if (memberships.length > 0) {
      const activePoolCookie = (await cookies()).get('wc26_active_pool')?.value;
      const active =
        memberships.find((m) => m.poolId === activePoolCookie) ??
        memberships.find((m) => m.poolId === process.env.NEXT_PUBLIC_DEFAULT_POOL_ID) ??
        memberships[0];
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

  // Group fixtures by calendar day in the display timezone so the heading
  // matches the kickoff time shown on each row.
  const byDay = new Map<string, typeof allMatches>();
  for (const m of allMatches) {
    const day = matchDayKey(m.kickoffUtc);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(m);
  }

  // Jump to today (or the next day with matches) by listing past days last.
  const today = matchDayKey(new Date());
  const days = [...byDay.keys()].sort();
  const upcoming = days.filter((d) => d >= today);
  const past = days.filter((d) => d < today).reverse();

  return (
    <div className="space-y-4 py-4">
      <LivePoller active={anyLive || anySoon} />

      <header className="flex flex-col items-center gap-3 pt-2">
        <h1 className="font-display text-4xl leading-none">Matches</h1>
        <div className="flex rounded-full border border-edge bg-white/[0.03] p-1 text-xs font-bold">
          <Link
            href="/matches"
            className={`rounded-full px-3 py-1.5 transition-colors ${!showGroups ? 'bg-accent text-[var(--accent-ink)]' : 'text-muted'}`}
          >
            Fixtures
          </Link>
          <Link
            href="/matches?view=groups"
            className={`rounded-full px-3 py-1.5 transition-colors ${showGroups ? 'bg-accent text-[var(--accent-ink)]' : 'text-muted'}`}
          >
            Groups
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
      ) : (
        <div className="space-y-5 lg:mx-auto lg:max-w-2xl">
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
          {allMatches.length === 0 ? (
            <p className="card p-5 text-sm text-muted">
              No fixtures yet. Run the seed script to load the schedule.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
