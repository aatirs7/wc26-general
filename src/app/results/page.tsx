import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { matches, poolMembers, pools, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { ROOT_ID } from '@/lib/knockout-bracket';
import { isTournamentOver, isFinalePreview } from '@/lib/finale';
import { loadResults } from '@/lib/results';
import ResultsView from '@/components/results/ResultsView';

export const dynamic = 'force-dynamic';

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect('/');

  const [me] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const [finalMatch] = await db
    .select({ status: matches.status })
    .from(matches)
    .where(eq(matches.id, ROOT_ID))
    .limit(1);

  const over = isTournamentOver(finalMatch?.status);
  const preview = isFinalePreview(me?.displayName);

  if (!over && !preview) {
    return (
      <div className="py-4 lg:mx-auto lg:max-w-2xl">
        <header className="pt-10 text-center">
          <div className="text-6xl">🏆</div>
          <h1 className="mt-3 font-display text-4xl">The finale</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            The podium, the superlative awards and your tournament recap all unlock the moment the
            World Cup final ends. Come back once the trophy is lifted.
          </p>
        </header>
      </div>
    );
  }

  const memberships = await db
    .select({ poolId: poolMembers.poolId, poolName: pools.name })
    .from(poolMembers)
    .innerJoin(pools, eq(pools.id, poolMembers.poolId))
    .where(eq(poolMembers.userId, userId));
  if (memberships.length === 0) redirect('/bracket');

  const { pool: requested } = await searchParams;
  const cookiePool = (await cookies()).get('wc26_active_pool')?.value;
  const active =
    memberships.find((m) => m.poolId === requested) ??
    memberships.find((m) => m.poolId === cookiePool) ??
    memberships.find((m) => m.poolId === process.env.NEXT_PUBLIC_DEFAULT_POOL_ID) ??
    memberships[0];

  const data = await loadResults(active.poolId, userId);

  return (
    <div className="py-4 lg:mx-auto lg:max-w-2xl">
      {memberships.length > 1 ? (
        <div className="mb-3 flex justify-center gap-2 overflow-x-auto pb-1">
          {memberships.map((m) => (
            <Link
              key={m.poolId}
              href={`/results?pool=${m.poolId}`}
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

      <ResultsView data={data} over={over} poolId={active.poolId} />
    </div>
  );
}
