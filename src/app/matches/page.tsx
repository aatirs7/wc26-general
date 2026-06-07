import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { groupStandings, matches, teams } from '@/lib/schema';
import { GROUP_LETTERS } from '@/lib/constants';
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

  // Group fixtures by calendar day (UTC) for scannable sections.
  const byDay = new Map<string, typeof allMatches>();
  for (const m of allMatches) {
    const day = m.kickoffUtc.toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(m);
  }

  // Jump to today (or the next day with matches) by listing past days last.
  const today = new Date().toISOString().slice(0, 10);
  const days = [...byDay.keys()].sort();
  const upcoming = days.filter((d) => d >= today);
  const past = days.filter((d) => d < today).reverse();

  return (
    <div className="space-y-4 py-4">
      <LivePoller active={anyLive || anySoon} />

      <header className="flex items-center justify-between pt-2">
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
        <div className="space-y-3">
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
        <div className="space-y-5">
          {[...upcoming, ...past].map((day) => (
            <section key={day}>
              <h2 className="sticky top-0 z-10 mb-2 -mx-1 bg-bg/80 px-1 py-1 font-display text-lg tracking-wide text-muted backdrop-blur">
                {new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h2>
              <div className="space-y-2">
                {byDay.get(day)!.map((m) => (
                  <MatchRow key={m.id} match={m} teamsByCode={teamsByCode} />
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
