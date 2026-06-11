import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brackets, poolMembers, pools, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { isLocked } from '@/lib/lock';
import RenameBracket from '@/components/me/RenameBracket';
import RenameSelf from '@/components/me/RenameSelf';
import BracketControls from '@/components/me/BracketControls';
import InstallGuide from '@/components/me/InstallGuide';
import SwitchPlayer from '@/components/auth/SwitchPlayer';
import InviteShare from '@/components/pools/InviteShare';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const userId = await currentUserId();
  if (!userId) redirect('/');

  const [me] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const myPools = await db
    .select({ poolId: pools.id, name: pools.name, joinCode: pools.joinCode })
    .from(poolMembers)
    .innerJoin(pools, eq(pools.id, poolMembers.poolId))
    .where(eq(poolMembers.userId, userId));

  const myBrackets = await Promise.all(
    myPools.map(async (p) => {
      const [b] = await db
        .select({ id: brackets.id, name: brackets.name, submitted: brackets.submitted })
        .from(brackets)
        .where(and(eq(brackets.ownerId, userId), eq(brackets.poolId, p.poolId)))
        .limit(1);
      return { pool: p, bracket: b ?? null };
    }),
  );

  return (
    <div className="space-y-7 py-4 lg:mx-auto lg:max-w-2xl">
      <header className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent font-display text-3xl text-[var(--accent-ink)]">
          {(me?.displayName ?? 'Y').slice(0, 1).toUpperCase()}
        </span>
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-display text-3xl leading-none">{me?.displayName ?? 'You'}</h1>
          <RenameSelf currentName={me?.displayName ?? ''} />
        </div>
        <SwitchPlayer />
      </header>

      <section className="space-y-3">
        <h2 className="text-center font-display text-xl text-muted">My bracket</h2>
        {myBrackets.length === 0 ? (
          <p className="text-center text-sm text-muted">
            You are not in a group yet. Create or join one from the home screen.
          </p>
        ) : null}
        {myBrackets.map(({ pool, bracket }) => (
          <div key={pool.poolId} className="card space-y-3 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate font-display text-lg leading-none">
                {pool.name}
              </span>
              <Link
                href={`/bracket?pool=${pool.poolId}`}
                className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent active:scale-95"
              >
                Open
              </Link>
            </div>
            <InviteShare code={pool.joinCode} groupName={pool.name} />
            {bracket ? (
              <>
                <RenameBracket bracketId={bracket.id} currentName={bracket.name} />
                {!bracket.submitted && !isLocked() ? (
                  <p className="text-xs font-semibold text-gold">Not submitted yet</p>
                ) : null}
                {!isLocked() ? <BracketControls bracketId={bracket.id} /> : null}
              </>
            ) : (
              <p className="text-xs text-muted">No bracket yet</p>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-center font-display text-xl text-muted">Add to home screen</h2>
        <InstallGuide />
      </section>
    </div>
  );
}
