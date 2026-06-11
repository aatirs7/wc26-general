import Link from 'next/link';
import { cookies } from 'next/headers';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brackets, groupStandings, matches, poolMembers, teams } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { pickLabels } from '@/lib/pick-labels';
import { GROUP_LETTERS } from '@/lib/constants';
import { DISPLAY_TZ_LABEL, matchDayKey, matchDayLabel } from '@/lib/format-time';
import MatchRow from '@/components/matches/MatchRow';
import GroupStandingsTable from '@/components/matches/GroupStandingsTable';
import LivePoller from '@/components/matches/LivePoller';

export const dynamic = 'force-dynamic';

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const showGroups = view === 'groups';

  // Tag fixtures with the signed-in player's picks (from their active pool).
  const userId = await currentUserId();
  let labels: Map<string, string> | undefined;
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
      if (mine) labels = pickLabels(mine.predictions);
    }
  }

  const allTeams = await db.select().from(teams);
  const teamsByCode = new Map(allTeams.map((t) => [t.code, t]));

  const allMatches = await db.select().from(matches).orderBy(asc(matches.kickoffUtc), asc(matches.id));
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

  const standings = showGroups ? await db.select().from(groupStandings) : [];

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
              rows={standings.filter((s) => s.groupLetter === letter)}
              teamsByCode={teamsByCode}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-5 lg:mx-auto lg:max-w-2xl">
          <p className="text-center text-xs text-muted-2">All times Eastern ({DISPLAY_TZ_LABEL})</p>
          {labels && labels.size > 0 ? (
            <p className="-mt-3 text-center text-[0.7rem] text-muted-2">
              Your picks are tagged with how far you backed them.
            </p>
          ) : null}
          {[...upcoming, ...past].map((day) => (
            <section key={day}>
              <h2 className="sticky top-0 z-10 mb-2 -mx-1 bg-bg/80 px-1 py-1 font-display text-lg tracking-wide text-muted backdrop-blur lg:top-16">
                {matchDayLabel(new Date(`${day}T12:00:00Z`))}
              </h2>
              <div className="space-y-2">
                {byDay.get(day)!.map((m) => (
                  <MatchRow key={m.id} match={m} teamsByCode={teamsByCode} pickLabels={labels} />
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
