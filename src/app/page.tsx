import Link from 'next/link';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { Trophy, Lock, Timer } from 'lucide-react';
import { db } from '@/lib/db';
import { poolMembers, pools } from '@/lib/schema';
import { currentUserId, LAST_NAME_COOKIE } from '@/lib/auth';
import { isLocked, kickoffUtc } from '@/lib/lock';
import { DISPLAY_TZ_LABEL, matchDayLabel, matchTime } from '@/lib/format-time';
import Onboard from '@/components/auth/Onboard';
import SwitchName from '@/components/auth/SwitchName';
import PoolActions from '@/components/pools/PoolActions';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const userId = await currentUserId();
  const locked = isLocked();
  const kickoff = kickoffUtc();
  const lastName = (await cookies()).get(LAST_NAME_COOKIE)?.value ?? null;
  const groups = userId
    ? await db
        .select({ id: poolMembers.poolId, name: pools.name })
        .from(poolMembers)
        .innerJoin(pools, eq(pools.id, poolMembers.poolId))
        .where(eq(poolMembers.userId, userId))
    : [];

  return (
    <div className="flex min-h-[88vh] flex-col items-center justify-center gap-8 py-12 text-center lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:text-left">
      <div className="reveal space-y-4 lg:space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/30 lg:mx-0">
          <Trophy className="h-10 w-10 text-accent" strokeWidth={2} />
        </div>
        <div>
          <p className="font-display text-lg tracking-[0.45em] text-accent">FIFA</p>
          <h1 className="font-display text-7xl leading-[0.82] tracking-tight lg:text-8xl">
            World Cup
            <span className="block shine text-8xl lg:text-9xl">2026</span>
          </h1>
          <p className="mt-1 font-display text-2xl tracking-[0.3em] text-muted">Bracket Pool</p>
        </div>

        <div className="mx-auto max-w-xs space-y-1 lg:mx-0 lg:max-w-md">
          <p className="font-display text-2xl tracking-wide text-foreground">
            World Cup 2026 Bracket Pool
          </p>
          <p className="text-sm leading-relaxed text-muted">
            Rank every group, call the knockouts, and see who has the best ball knowledge...
            May the best bracket win.
          </p>
          <p className="text-xs text-muted-2">
            Developed by Aatir Siddiqui
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-8 lg:items-stretch">
      <div
        className={`reveal inline-flex items-center gap-2 self-center rounded-full border px-4 py-2 text-sm font-semibold lg:self-start ${
          locked ? 'border-live/30 bg-live/10 text-live' : 'border-gold/30 bg-gold/10 text-gold'
        }`}
        style={{ animationDelay: '80ms' }}
      >
        {locked ? <Lock className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
        {locked
          ? 'Brackets locked — the tournament is on'
          : `Locks ${matchDayLabel(kickoff)}, ${matchTime(kickoff)} ${DISPLAY_TZ_LABEL}`}
      </div>

      <div className="reveal w-full max-w-sm lg:max-w-md" style={{ animationDelay: '160ms' }}>
        {!userId ? (
          <Onboard lastName={lastName} />
        ) : (
          <div className="space-y-4">
            {groups.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted">
                  {groups.length > 1 ? 'Your groups' : 'Your group'}
                </p>
                {groups.map((g) => (
                  <Link
                    key={g.id}
                    href={`/home?pool=${g.id}`}
                    className="flex min-h-13 w-full items-center justify-between gap-2 rounded-2xl border border-edge bg-white/[0.03] px-4 text-left active:scale-95"
                  >
                    <span className="truncate font-semibold">{g.name}</span>
                    <span className="shrink-0 text-sm font-bold text-accent">Open &rarr;</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">
                You are not in a group yet. Create one and share the code, or join a
                friend&apos;s group below.
              </p>
            )}
            <section className="space-y-2">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted">
                {groups.length > 0 ? 'Start or join another group' : 'Get started'}
              </p>
              <PoolActions />
            </section>
            <SwitchName name={lastName} />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
