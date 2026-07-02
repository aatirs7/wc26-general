import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { Lock } from 'lucide-react';
import { brackets, groupStandings, matches, poolMembers, pools, teams } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { isLockedForPool, poolUnlockUntil } from '@/lib/lock';
import { DISPLAY_TZ_LABEL, matchDayLabel, matchTime } from '@/lib/format-time';
import BracketBuilder from '@/components/bracket/BracketBuilder';
import AutofillRestart from '@/components/bracket/AutofillRestart';
import BracketSummary from '@/components/brackets/BracketSummary';
import LiveBracketSummary from '@/components/brackets/LiveBracketSummary';
import BracketTabs from '@/components/brackets/BracketTabs';
import StartBracket from '@/components/bracket/StartBracket';
import PoolActions from '@/components/pools/PoolActions';
import RememberPool from '@/components/RememberPool';

export const dynamic = 'force-dynamic';

export default async function BracketPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect('/');

  const memberships = await db
    .select({ poolId: poolMembers.poolId, poolName: pools.name, joinCode: pools.joinCode })
    .from(poolMembers)
    .innerJoin(pools, eq(pools.id, poolMembers.poolId))
    .where(eq(poolMembers.userId, userId));

  if (memberships.length === 0) {
    return (
      <div className="py-6">
        <h1 className="mb-4 text-xl font-bold">Join or create a group to play</h1>
        <PoolActions />
      </div>
    );
  }

  const { pool: requested } = await searchParams;
  const activePoolCookie = (await cookies()).get('wc26_active_pool')?.value;
  const activePoolId =
    memberships.find((m) => m.poolId === requested)?.poolId ??
    memberships.find((m) => m.poolId === activePoolCookie)?.poolId ??
    memberships[0].poolId;

  const [bracket] = await db
    .select()
    .from(brackets)
    .where(and(eq(brackets.ownerId, userId), eq(brackets.poolId, activePoolId)))
    .limit(1);

  // The user's brackets in their other groups, used both for the "reuse
  // your picks" empty state and the "copy from another group" action in the
  // builder.
  const otherBrackets = await db
    .select({
      id: brackets.id,
      poolName: pools.name,
      submitted: brackets.submitted,
      predictions: brackets.predictions,
    })
    .from(brackets)
    .innerJoin(pools, eq(pools.id, brackets.poolId))
    .where(and(eq(brackets.ownerId, userId), ne(brackets.poolId, activePoolId)));

  const allTeams = await db
    .select()
    .from(teams)
    .orderBy(asc(teams.groupLetter), asc(teams.name));

  const locked = isLockedForPool(activePoolId);
  // If this pool is inside an active timed-unlock window past kickoff, show a
  // heads-up with the deadline.
  const unlockUntil = poolUnlockUntil(activePoolId);
  const activePoolName = memberships.find((m) => m.poolId === activePoolId)?.poolName ?? 'This group';

  // Live "actual results" bracket data, only needed for the locked view's
  // My picks / Live toggle.
  const liveData =
    bracket && locked
      ? {
          matchRows: await db
            .select({
              id: matches.id,
              homeCode: matches.homeCode,
              awayCode: matches.awayCode,
              homePlaceholder: matches.homePlaceholder,
              awayPlaceholder: matches.awayPlaceholder,
              winnerCode: matches.winnerCode,
            })
            .from(matches),
          standings: await db
            .select({
              groupLetter: groupStandings.groupLetter,
              teamCode: groupStandings.teamCode,
              rank: groupStandings.rank,
              isBestThird: groupStandings.isBestThird,
            })
            .from(groupStandings),
        }
      : null;

  return (
    <div className="py-4 lg:mx-auto lg:max-w-3xl">
      <RememberPool poolId={activePoolId} />
      {memberships.length > 1 ? (
        <div className="mb-3 flex justify-center gap-2 overflow-x-auto pb-1 pt-2">
          {memberships.map((m) => (
            <Link
              key={m.poolId}
              href={`/bracket?pool=${m.poolId}`}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                m.poolId === activePoolId
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-edge bg-white/[0.02] text-muted'
              }`}
            >
              {m.poolName}
            </Link>
          ))}
        </div>
      ) : null}

      {unlockUntil ? (
        <div className="mb-4 rounded-xl border border-gold/40 bg-gold/[0.08] p-3.5 text-center">
          <p className="font-display text-xl leading-none text-gold">⏱️ Stoppage time</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            The final whistle blew, but the ref waved play on. <span className="font-semibold text-foreground">{activePoolName}</span> is
            open again to finish and lock in your bracket until{' '}
            <span className="font-semibold text-foreground">
              {matchDayLabel(unlockUntil)} at {matchTime(unlockUntil)} {DISPLAY_TZ_LABEL}
            </span>
            . Don&apos;t get caught offside, it shuts for good after that.
          </p>
        </div>
      ) : null}

      {!bracket ? (
        locked ? (
          <div className="card mt-8 p-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-muted" />
            <h1 className="mt-2 font-display text-3xl">Brackets are locked</h1>
            <p className="mt-2 text-sm text-muted">
              The tournament has started, so new brackets cannot be entered.
              You can still follow the pool on the leaderboard.
            </p>
          </div>
        ) : (
          <StartBracket poolId={activePoolId} sources={otherBrackets} />
        )
      ) : locked ? (
        <div className="space-y-4 py-2">
          <header className="text-center">
            <h1 className="font-display text-4xl leading-none">{bracket.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {bracket.submitted ? 'Locked in. May the best bracket win.' : 'Not submitted before kickoff.'}
            </p>
          </header>
          {liveData ? (
            <BracketTabs
              picks={<BracketSummary predictions={bracket.predictions} teams={allTeams} />}
              live={
                <LiveBracketSummary
                  matchRows={liveData.matchRows}
                  standings={liveData.standings}
                  teams={allTeams}
                  myPredictions={bracket.predictions}
                />
              }
            />
          ) : (
            <BracketSummary predictions={bracket.predictions} teams={allTeams} />
          )}
        </div>
      ) : (
        <>
          {bracket.autofilled ? <AutofillRestart bracketId={bracket.id} /> : null}
          <BracketBuilder
            bracket={{
              id: bracket.id,
              name: bracket.name,
              predictions: bracket.predictions,
              submitted: bracket.submitted,
            }}
            teams={allTeams}
            copySources={otherBrackets.map((o) => ({
              id: o.id,
              poolName: o.poolName,
              predictions: o.predictions,
            }))}
          />
        </>
      )}
    </div>
  );
}
