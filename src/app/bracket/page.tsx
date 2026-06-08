import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { Lock } from 'lucide-react';
import { brackets, poolMembers, pools, teams } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { isLocked } from '@/lib/lock';
import BracketBuilder from '@/components/bracket/BracketBuilder';
import BracketSummary from '@/components/brackets/BracketSummary';
import StartBracket from '@/components/bracket/StartBracket';
import PoolActions from '@/components/pools/PoolActions';

export const dynamic = 'force-dynamic';

export default async function BracketPage({
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

  if (memberships.length === 0) {
    return (
      <div className="py-6">
        <h1 className="mb-4 text-xl font-bold">Join or create a group to play</h1>
        <PoolActions />
      </div>
    );
  }

  const { pool: requested } = await searchParams;
  const activePoolId =
    memberships.find((m) => m.poolId === requested)?.poolId ??
    memberships.find((m) => m.poolId === process.env.NEXT_PUBLIC_DEFAULT_POOL_ID)?.poolId ??
    memberships[0].poolId;

  const [bracket] = await db
    .select()
    .from(brackets)
    .where(and(eq(brackets.ownerId, userId), eq(brackets.poolId, activePoolId)))
    .limit(1);

  const allTeams = await db
    .select()
    .from(teams)
    .orderBy(asc(teams.groupLetter), asc(teams.name));

  const locked = isLocked();

  return (
    <div className="py-4">
      {memberships.length > 1 ? (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 pt-2">
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
          <StartBracket poolId={activePoolId} />
        )
      ) : locked ? (
        <div className="space-y-4 py-2">
          <header>
            <h1 className="font-display text-4xl leading-none">{bracket.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {bracket.submitted ? 'Locked in. Good luck.' : 'Not submitted before kickoff.'}
            </p>
          </header>
          <BracketSummary predictions={bracket.predictions} teams={allTeams} />
        </div>
      ) : (
        <BracketBuilder
          bracket={{
            id: bracket.id,
            name: bracket.name,
            predictions: bracket.predictions,
            submitted: bracket.submitted,
          }}
          teams={allTeams}
        />
      )}
    </div>
  );
}
