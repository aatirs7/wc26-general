import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { Radio, ArrowRight, Timer } from 'lucide-react';
import { db } from '@/lib/db';
import { brackets, groupStandings, matches, poolMembers, pools, teams } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { buildFacts, scoreBracket, totalOf } from '@/lib/scoring';
import { pickLabels } from '@/lib/pick-labels';
import { DISPLAY_TZ_LABEL, matchDayKey, matchDayLabel, matchTime } from '@/lib/format-time';
import MatchRow from '@/components/matches/MatchRow';
import LivePoller from '@/components/matches/LivePoller';
import Countdown from '@/components/home/Countdown';
import RememberPool from '@/components/RememberPool';
import type { Team } from '@/types/team';

export const dynamic = 'force-dynamic';

function TeamMini({ code, placeholder, teamsByCode }: { code: string | null; placeholder: string | null; teamsByCode: Map<string, Team> }) {
  const team = code ? teamsByCode.get(code) : undefined;
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="text-2xl leading-none">{team?.flag ?? '⚽'}</span>
      <span className="truncate text-xs font-bold">{team?.name ?? placeholder ?? 'TBD'}</span>
    </div>
  );
}

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect('/');

  const memberships = await db
    .select({ poolId: poolMembers.poolId, poolName: pools.name })
    .from(poolMembers)
    .innerJoin(pools, eq(pools.id, poolMembers.poolId))
    .where(eq(poolMembers.userId, userId));
  if (memberships.length === 0) redirect('/');

  const { pool: requested } = await searchParams;
  const activePoolCookie = (await cookies()).get('wc26_active_pool')?.value;
  const active =
    memberships.find((m) => m.poolId === requested) ??
    memberships.find((m) => m.poolId === activePoolCookie) ??
    memberships.find((m) => m.poolId === process.env.NEXT_PUBLIC_DEFAULT_POOL_ID) ??
    memberships[0];

  const allTeams = await db.select().from(teams);
  const teamsByCode = new Map(allTeams.map((t) => [t.code, t]));

  const allMatches = await db.select().from(matches).orderBy(asc(matches.kickoffUtc), asc(matches.id));

  const standingRows = await db
    .select({
      groupLetter: groupStandings.groupLetter,
      teamCode: groupStandings.teamCode,
      rank: groupStandings.rank,
      isBestThird: groupStandings.isBestThird,
    })
    .from(groupStandings);
  const facts = buildFacts(
    allMatches.map((m) => ({ stage: m.stage, status: m.status, groupLetter: m.groupLetter, winnerCode: m.winnerCode })),
    standingRows,
  );

  const [mine] = await db
    .select()
    .from(brackets)
    .where(and(eq(brackets.ownerId, userId), eq(brackets.poolId, active.poolId)))
    .limit(1);
  const labels = mine ? pickLabels(mine.predictions) : new Map<string, string>();
  const livePoints = mine ? totalOf(scoreBracket(mine.predictions, facts)) : 0;

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const isLive = (s: string) => s === 'live' || s === 'ht';
  const liveMatches = allMatches.filter((m) => isLive(m.status));
  const anySoon = allMatches.some(
    (m) => m.status === 'scheduled' && m.kickoffUtc.getTime() > now - 3 * 3600 * 1000 && m.kickoffUtc.getTime() < now + 3600 * 1000,
  );

  const today = matchDayKey(new Date());
  const todayMatches = allMatches.filter((m) => matchDayKey(m.kickoffUtc) === today && !isLive(m.status));

  // Next scheduled kickoff in the future, for the countdown.
  const nextMatch = allMatches.find((m) => m.status === 'scheduled' && m.kickoffUtc.getTime() > now) ?? null;

  const inPlay = [...liveMatches, ...todayMatches].filter(
    (m) => (m.homeCode && labels.has(m.homeCode)) || (m.awayCode && labels.has(m.awayCode)),
  ).length;

  const statCard = 'card flex flex-col items-center justify-center gap-1 p-4 text-center';

  return (
    <div className="space-y-5 py-4 lg:mx-auto lg:max-w-2xl">
      <RememberPool poolId={active.poolId} />
      <LivePoller active={liveMatches.length > 0 || anySoon} />

      <header className="pt-2 text-center">
        <h1 className="flex items-center justify-center gap-2 font-display text-4xl leading-none">
          <Radio className="h-7 w-7 text-live" strokeWidth={2.2} />
          Match Day
        </h1>
        <p className="mt-1 text-sm text-muted">{active.poolName}</p>
      </header>

      {memberships.length > 1 ? (
        <div className="flex justify-center gap-2 overflow-x-auto pb-1">
          {memberships.map((m) => (
            <Link
              key={m.poolId}
              href={`/live?pool=${m.poolId}`}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                m.poolId === active.poolId
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-edge bg-white/[0.02] text-muted'
              }`}
            >
              {m.poolName}
            </Link>
          ))}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <div className={statCard}>
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">Your points</div>
          <div className="font-display text-4xl leading-none text-accent">{livePoints}</div>
        </div>
        <div className={statCard}>
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">Picks in play</div>
          <div className="font-display text-4xl leading-none">{inPlay}</div>
          <div className="text-[0.6rem] text-muted-2">live + today</div>
        </div>
      </section>

      {nextMatch ? (
        <section className="card space-y-3 p-4">
          <div className="flex items-center justify-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-gold">
            <Timer className="h-3.5 w-3.5" />
            Next kickoff
          </div>
          <div className="flex items-center gap-2">
            <TeamMini code={nextMatch.homeCode} placeholder={nextMatch.homePlaceholder} teamsByCode={teamsByCode} />
            <span className="shrink-0 font-display text-lg text-muted-2">vs</span>
            <TeamMini code={nextMatch.awayCode} placeholder={nextMatch.awayPlaceholder} teamsByCode={teamsByCode} />
          </div>
          <Countdown kickoffMs={nextMatch.kickoffUtc.getTime()} />
          <p className="text-center text-xs text-muted">
            {nextMatch.groupLetter ? `Group ${nextMatch.groupLetter}` : nextMatch.roundLabel} ·{' '}
            {matchDayLabel(nextMatch.kickoffUtc)}, {matchTime(nextMatch.kickoffUtc)} {DISPLAY_TZ_LABEL}
          </p>
        </section>
      ) : null}

      {liveMatches.length > 0 ? (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-display text-2xl">
            <span className="live-dot h-2.5 w-2.5 rounded-full bg-live" />
            Live now
          </h2>
          {liveMatches.map((m) => (
            <MatchRow key={m.id} match={m} teamsByCode={teamsByCode} />
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-2xl">Today</h2>
        {todayMatches.length > 0 ? (
          todayMatches.map((m) => <MatchRow key={m.id} match={m} teamsByCode={teamsByCode} />)
        ) : (
          <p className="card p-4 text-center text-sm text-muted">
            {liveMatches.length > 0 ? 'That is every match today.' : 'No matches today. The next kickoff is counting down above.'}
          </p>
        )}
      </section>

      <Link
        href="/matches"
        className="card flex items-center justify-center gap-1.5 p-3 text-sm font-bold text-accent active:scale-[0.99]"
      >
        Full schedule & groups
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
