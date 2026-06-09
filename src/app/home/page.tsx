import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
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
  type LucideIcon,
} from 'lucide-react';
import { db } from '@/lib/db';
import { brackets, bracketScores, poolMembers, pools, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { isLocked, kickoffUtc } from '@/lib/lock';
import { isComplete } from '@/lib/predictions';
import { DISPLAY_TZ_LABEL, matchDayLabel, matchTime } from '@/lib/format-time';
import Countdown from '@/components/home/Countdown';

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

  const { pool: requested } = await searchParams;
  const active =
    memberships.find((m) => m.poolId === requested) ??
    memberships.find((m) => m.poolId === process.env.NEXT_PUBLIC_DEFAULT_POOL_ID) ??
    memberships[0];

  // This app is multi-pool: bracket and standings are pool-scoped, so carry
  // the active pool through their links. Matches and stats are global.
  const poolQ = active ? `?pool=${active.poolId}` : '';

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
  let myBracket:
    | { id: string; name: string; submitted: boolean; points: number; complete: boolean }
    | null = null;

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
    for (const r of rows) {
      if (r.submitted) {
        rank += 1;
        if (r.ownerId === userId) myRank = rank;
      }
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
    <div className="space-y-6 py-4">
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
          <div className="mt-1 text-xs text-muted">
            {locked ? 'Live scoring' : 'Scores once it starts'}
          </div>
        </div>
      </section>

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

      {/* Trash talk + Score predict */}
      <section className="reveal grid grid-cols-2 gap-3" style={{ animationDelay: '210ms' }}>
        <Link
          href={`/chat${poolQ}`}
          className="flex flex-col items-center gap-3 rounded-[1.1rem] border border-gold/30 bg-gold/10 p-4 text-center active:scale-[0.98]"
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
          className="flex flex-col items-center gap-3 rounded-[1.1rem] border border-accent/30 bg-accent/10 p-4 text-center active:scale-[0.98]"
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
  );
}
