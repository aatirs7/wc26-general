import Link from 'next/link';
import { redirect } from 'next/navigation';
import { and, eq, inArray } from 'drizzle-orm';
import {
  Trophy,
  ListOrdered,
  CalendarDays,
  BarChart3,
  Lock,
  Timer,
  ArrowRight,
  MessageCircle,
  Target,
  Radio,
  type LucideIcon,
} from 'lucide-react';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { brackets, bracketScores, groupStandings, matches, poolMembers, pools, standingSnapshots, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { buildFacts, provisionalPoints } from '@/lib/scoring';
import RememberPool from '@/components/RememberPool';
import PoolSwitcher from '@/components/PoolSwitcher';
import { isLocked, kickoffUtc, poolUnlockUntil } from '@/lib/lock';
import { isComplete } from '@/lib/predictions';
import { DISPLAY_TZ_LABEL, matchDayLabel, matchTime } from '@/lib/format-time';
import Countdown from '@/components/home/Countdown';
import AutofillNotice from '@/components/AutofillNotice';
import DailyRecap, { type RecapData } from '@/components/home/DailyRecap';
import UnlockBanner from '@/components/home/UnlockBanner';

export const dynamic = 'force-dynamic';

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect('/');

  const locked = isLocked();
  const kickoff = kickoffUtc();

  const [me] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const memberships = await db
    .select({ poolId: poolMembers.poolId, poolName: pools.name })
    .from(poolMembers)
    .innerJoin(pools, eq(pools.id, poolMembers.poolId))
    .where(eq(poolMembers.userId, userId));

  // No group yet: send them to the landing chooser.
  if (memberships.length === 0) redirect('/');

  // Pools where this player's bracket was auto-filled at lock, for the
  // one-time "your bracket was auto-filled" popup.
  const autofilledRows = await db
    .select({ name: pools.name })
    .from(brackets)
    .innerJoin(pools, eq(pools.id, brackets.poolId))
    .where(and(eq(brackets.ownerId, userId), eq(brackets.autofilled, true)));
  const autofilledPools = autofilledRows.map((r) => r.name);

  const { pool: requested } = await searchParams;
  const activePoolCookie = (await cookies()).get('wc26_active_pool')?.value;
  const active =
    memberships.find((m) => m.poolId === requested) ??
    memberships.find((m) => m.poolId === activePoolCookie) ??
    memberships.find((m) => m.poolId === process.env.NEXT_PUBLIC_DEFAULT_POOL_ID) ??
    memberships[0];

  // This app is multi-pool: bracket and standings are pool-scoped, so carry
  // the active pool through their links. Matches and stats are global.
  const poolQ = active ? `?pool=${active.poolId}` : '';

  // Pools of this player re-opened past kickoff (timed unlock), for the
  // notification banner + countdown.
  const unlocks = memberships
    .map((m) => ({ poolId: m.poolId, poolName: m.poolName, until: poolUnlockUntil(m.poolId) }))
    .filter((u): u is { poolId: string; poolName: string; until: Date } => u.until !== null);

  const JUMPS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
    { href: `/bracket${poolQ}`, label: 'Bracket', hint: 'Build & view', icon: Trophy },
    { href: `/leaderboard${poolQ}`, label: 'Standings', hint: 'Who is winning', icon: ListOrdered },
    { href: '/matches', label: 'Matches', hint: 'Fixtures & groups', icon: CalendarDays },
    { href: '/stats', label: 'Stats', hint: 'Adults vs kids', icon: BarChart3 },
  ];

  // Compute the player's rank within the active pool, mirroring the
  // leaderboard's ordering (submitted first, then points, then tiebreak).
  let myRank: number | null = null;
  let fieldSize = 0;
  let myLive = 0;
  let myBracket:
    | { id: string; name: string; submitted: boolean; points: number; complete: boolean }
    | null = null;
  let recap: RecapData = { climber: null, faller: null, gainer: null, you: null };

  if (active) {
    const members = await db
      .select({ userId: poolMembers.userId })
      .from(poolMembers)
      .where(eq(poolMembers.poolId, active.poolId));
    fieldSize = members.length;

    const poolBrackets = await db
      .select()
      .from(brackets)
      .where(eq(brackets.poolId, active.poolId));

    const scoreRows = poolBrackets.length
      ? await db
          .select()
          .from(bracketScores)
          .where(inArray(bracketScores.bracketId, poolBrackets.map((b) => b.id)))
      : [];

    const tiebreakByBracket = new Map<string, number>();
    for (const s of scoreRows) {
      if (s.roundKey === 'champion' || s.roundKey === 'final') {
        tiebreakByBracket.set(s.bracketId, (tiebreakByBracket.get(s.bracketId) ?? 0) + s.points);
      }
    }

    const bracketByOwner = new Map(poolBrackets.map((b) => [b.ownerId, b]));
    const rows = members.map((m) => {
      const b = bracketByOwner.get(m.userId);
      return {
        ownerId: m.userId,
        points: b?.totalPoints ?? 0,
        tiebreak: b ? (tiebreakByBracket.get(b.id) ?? 0) : 0,
        submitted: b?.submitted ?? false,
        lockedAtMs: b?.lockedAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
      };
    });
    rows.sort((a, b) => {
      if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
      if (b.points !== a.points) return b.points - a.points;
      if (b.tiebreak !== a.tiebreak) return b.tiebreak - a.tiebreak;
      return a.lockedAtMs - b.lockedAtMs;
    });
    let rank = 0;
    const curRank = new Map<string, number>();
    const curPoints = new Map<string, number>();
    for (const r of rows) {
      curPoints.set(r.ownerId, r.points);
      if (r.submitted) {
        rank += 1;
        curRank.set(r.ownerId, rank);
        if (r.ownerId === userId) myRank = rank;
      }
    }

    // Daily recap: movement since the morning snapshot. Only meaningful
    // once games are scoring; before kickoff "movement" is just submissions
    // reshuffling the order, which reads as noise.
    const snaps = await db
      .select({ userId: standingSnapshots.userId, points: standingSnapshots.points, rank: standingSnapshots.rank })
      .from(standingSnapshots)
      .where(eq(standingSnapshots.poolId, active.poolId));
    if (locked && snaps.length > 0) {
      const nameRows = await db
        .select({ id: users.id, name: users.displayName })
        .from(users)
        .where(inArray(users.id, members.map((m) => m.userId)));
      const nameByUser = new Map(nameRows.map((n) => [n.id, n.name]));

      // Only call out a standout: a UNIQUE top mover. When lots of people move
      // together (e.g. they all share one live group-leader point), there is no
      // single "most", so we leave that line out instead of naming someone
      // arbitrarily from the tie.
      let climberName: string | null = null;
      let climberUp = 0;
      let climberTies = 0;
      let fallerName: string | null = null;
      let fallerDown = 0;
      let fallerTies = 0;
      let gainerName: string | null = null;
      let gainerPts = 0;
      let gainerTies = 0;
      for (const s of snaps) {
        if (s.userId === userId) continue; // the "you" line already covers the viewer
        const name = nameByUser.get(s.userId) ?? '?';
        const nowRank = curRank.get(s.userId);
        const gained = (curPoints.get(s.userId) ?? 0) - s.points;
        if (s.rank != null && nowRank != null) {
          const up = s.rank - nowRank;
          if (up > 0) {
            if (up > climberUp) {
              climberUp = up;
              climberName = name;
              climberTies = 1;
            } else if (up === climberUp) climberTies += 1;
          } else if (up < 0) {
            const down = -up;
            if (down > fallerDown) {
              fallerDown = down;
              fallerName = name;
              fallerTies = 1;
            } else if (down === fallerDown) fallerTies += 1;
          }
        }
        if (gained > 0) {
          if (gained > gainerPts) {
            gainerPts = gained;
            gainerName = name;
            gainerTies = 1;
          } else if (gained === gainerPts) gainerTies += 1;
        }
      }
      const climber = climberTies === 1 && climberName ? { name: climberName, up: climberUp } : null;
      const faller = fallerTies === 1 && fallerName ? { name: fallerName, down: fallerDown } : null;
      const gainer = gainerTies === 1 && gainerName ? { name: gainerName, pts: gainerPts } : null;
      const mySnap = snaps.find((s) => s.userId === userId);
      const you =
        mySnap && myRank != null
          ? {
              rankDelta: mySnap.rank != null ? mySnap.rank - myRank : 0,
              gained: (curPoints.get(userId) ?? 0) - mySnap.points,
              rank: myRank,
            }
          : null;
      recap = { climber, faller, gainer, you };
    }

    const mine = bracketByOwner.get(userId);
    if (mine) {
      myBracket = {
        id: mine.id,
        name: mine.name,
        submitted: mine.submitted,
        points: mine.totalPoints,
        complete: isComplete(mine.predictions),
      };

      // Provisional (live) portion of my points: group positions that count
      // now but harden when each group finishes.
      const matchRows = await db
        .select({
          stage: matches.stage,
          status: matches.status,
          groupLetter: matches.groupLetter,
          winnerCode: matches.winnerCode,
          homeCode: matches.homeCode,
          awayCode: matches.awayCode,
          homeScore: matches.homeScore,
          awayScore: matches.awayScore,
        })
        .from(matches);
      const standingRows = await db
        .select({
          groupLetter: groupStandings.groupLetter,
          teamCode: groupStandings.teamCode,
          rank: groupStandings.rank,
          isBestThird: groupStandings.isBestThird,
        })
        .from(groupStandings);
      myLive = provisionalPoints(mine.predictions, buildFacts(matchRows, standingRows));
    }
  }

  const cta =
    !myBracket || (!locked && !myBracket.submitted)
      ? locked
        ? 'View your bracket'
        : myBracket
          ? 'Finish your bracket'
          : 'Build your bracket'
      : 'View your bracket';

  return (
    <div className="space-y-6 py-4 lg:mx-auto lg:max-w-5xl lg:space-y-8 lg:pt-2">
      <AutofillNotice pools={autofilledPools} />
      <RememberPool poolId={active.poolId} />
      <header className="reveal flex flex-col items-center gap-2 pt-2 text-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent font-display text-2xl text-[var(--accent-ink)]">
          {(me?.displayName ?? 'Y').slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted">
            Welcome back
          </p>
          <h1 className="truncate font-display text-3xl leading-none">
            {me?.displayName ?? 'Player'}
          </h1>
        </div>
      </header>

      {memberships.length > 1 ? (
        <PoolSwitcher pools={memberships} activeId={active.poolId} />
      ) : null}

      {unlocks.map((u) => (
        <UnlockBanner key={u.poolId} poolName={u.poolName} poolId={u.poolId} untilMs={u.until.getTime()} />
      ))}

      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      <div className="space-y-6">
      {/* Kickoff / lock banner */}
      <section
        className="reveal card space-y-3 p-4 text-center"
        style={{ animationDelay: '60ms' }}
      >
        {locked ? (
          <div className="inline-flex items-center justify-center gap-2 text-live">
            <Lock className="h-4 w-4" />
            <span className="text-sm font-semibold">The tournament is live</span>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center justify-center gap-2 text-gold">
              <Timer className="h-4 w-4" />
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.2em]">
                Brackets lock in
              </span>
            </div>
            <Countdown kickoffMs={kickoff.getTime()} />
            <p className="text-xs text-muted">
              Kickoff {matchDayLabel(kickoff)}, {matchTime(kickoff)} {DISPLAY_TZ_LABEL}
            </p>
          </>
        )}
      </section>

      {/* Match Day live hub */}
      <Link
        href={`/live${poolQ}`}
        className="reveal flex items-center gap-3 rounded-[1.1rem] border border-live/40 bg-live/[0.1] p-4 active:scale-[0.99]"
        style={{ animationDelay: '100ms' }}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-live/15 ring-1 ring-live/40">
          <Radio className="h-5 w-5 text-live" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1 text-center">
          <div className="font-display text-xl leading-none text-live">Match Day</div>
          <div className="mt-0.5 text-xs text-muted">Live scores, your picks & next kickoff</div>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-live" />
      </Link>

      {/* Overview: rank + points */}
      <section className="reveal grid grid-cols-2 gap-3" style={{ animationDelay: '120ms' }}>
        <div className="card flex flex-col items-center justify-between p-4 text-center">
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">
            Your rank
          </div>
          <div className="mt-2 font-display text-4xl leading-none">
            {myRank ? (
              <>
                {ordinal(myRank)} <span className="text-muted">of {fieldSize}</span>
              </>
            ) : (
              <span className="text-gold">&ndash;</span>
            )}
          </div>
          {active && memberships.length > 1 ? (
            <div className="mt-1 max-w-full truncate text-xs text-muted">{active.poolName}</div>
          ) : null}
        </div>
        <div className="card flex flex-col items-center justify-between p-4 text-center">
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">
            Points
          </div>
          <div className="mt-2 font-display text-4xl leading-none text-accent">
            {myBracket?.points ?? 0}
          </div>
          {myLive > 0 ? (
            <div className="mt-1 text-[0.6rem] font-bold uppercase tracking-wider text-gold">
              ● {myLive} live
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted">
              {locked ? 'Live scoring' : 'Scores once it starts'}
            </div>
          )}
        </div>
      </section>

      {/* Daily recap (self-hides until there is movement) */}
      <DailyRecap data={recap} />

      {/* Bracket status headline */}
      <section className="reveal" style={{ animationDelay: '180ms' }}>
        <Link
          href={`/bracket${poolQ}`}
          className="card flex items-center gap-3 p-4 active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/30">
            <Trophy className="h-5 w-5 text-accent" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">
              {myBracket?.name ?? 'Your bracket'}
            </div>
          </div>
          <span className="flex items-center gap-1 text-sm font-bold text-accent">
            {cta}
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </section>
      </div>

      <div className="space-y-6">
      {/* Trash talk + Score predict */}
      <section className="reveal grid grid-cols-2 gap-3" style={{ animationDelay: '210ms' }}>
        <Link
          href={`/chat${poolQ}`}
          className="shine-sweep flex flex-col items-center gap-3 rounded-[1.1rem] border border-gold/30 bg-gold/10 p-4 text-center active:scale-[0.98]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/40">
            <MessageCircle className="h-5 w-5 text-gold" strokeWidth={2.2} />
          </span>
          <div>
            <div className="font-display text-xl leading-none text-gold">Trash Talk</div>
            <div className="mt-0.5 text-xs text-muted">Chat your group</div>
          </div>
        </Link>
        <Link
          href="/predict"
          className="shine-sweep-2 flex flex-col items-center gap-3 rounded-[1.1rem] border border-accent/30 bg-accent/10 p-4 text-center active:scale-[0.98]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 ring-1 ring-accent/40">
            <Target className="h-5 w-5 text-accent" strokeWidth={2.2} />
          </span>
          <div>
            <div className="font-display text-xl leading-none text-accent">Score Predict</div>
            <div className="mt-0.5 text-xs text-muted">Call the scores</div>
          </div>
        </Link>
      </section>

      {/* Quick jumps */}
      <section className="reveal space-y-3" style={{ animationDelay: '270ms' }}>
        <h2 className="text-center font-display text-xl text-muted">Jump to</h2>
        <div className="grid grid-cols-2 gap-3">
          {JUMPS.map((j) => {
            const Icon = j.icon;
            return (
              <Link
                key={j.href}
                href={j.href}
                className="card flex flex-col items-center gap-2 p-4 text-center active:scale-[0.98]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-edge">
                  <Icon className="h-5 w-5 text-accent" strokeWidth={2.2} />
                </span>
                <div>
                  <div className="font-display text-xl leading-none">{j.label}</div>
                  <div className="mt-0.5 text-xs text-muted">{j.hint}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      </div>
      </div>
    </div>
  );
}
