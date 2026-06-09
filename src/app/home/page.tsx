import Link from 'next/link';
import { redirect } from 'next/navigation';
import { asc, eq, gt, inArray } from 'drizzle-orm';
import { ClipboardList, CheckCircle2, ChevronRight, Lock, Timer, CalendarDays, Target, MessageCircle } from 'lucide-react';
import { db } from '@/lib/db';
import { brackets, bracketScores, matches, poolMembers, pools, teams, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { isLocked, kickoffUtc } from '@/lib/lock';
import { DISPLAY_TZ_LABEL, matchDayLabel, matchTime } from '@/lib/format-time';
import InviteButton from '@/components/pools/InviteButton';

export const dynamic = 'force-dynamic';

export default async function HomePage({
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

  // No group yet: send them to the landing chooser.
  if (memberships.length === 0) redirect('/');

  const { pool: requested } = await searchParams;
  const active = memberships.find((m) => m.poolId === requested) ?? memberships[0];
  const poolId = active.poolId;

  const [me] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const members = await db
    .select({ userId: poolMembers.userId, displayName: users.displayName })
    .from(poolMembers)
    .innerJoin(users, eq(users.id, poolMembers.userId))
    .where(eq(poolMembers.poolId, poolId));

  const poolBrackets = await db.select().from(brackets).where(eq(brackets.poolId, poolId));
  const byOwner = new Map(poolBrackets.map((b) => [b.ownerId, b]));

  const scoreRows = poolBrackets.length
    ? await db
        .select()
        .from(bracketScores)
        .where(inArray(bracketScores.bracketId, poolBrackets.map((b) => b.id)))
    : [];
  const tiebreak = new Map<string, number>();
  for (const s of scoreRows) {
    if (s.roundKey === 'champion' || s.roundKey === 'final') {
      tiebreak.set(s.bracketId, (tiebreak.get(s.bracketId) ?? 0) + s.points);
    }
  }

  // Same ranking as the leaderboard so the dashboard rank matches.
  const ranked = members
    .map((m) => {
      const b = byOwner.get(m.userId);
      return {
        userId: m.userId,
        name: m.displayName,
        points: b?.totalPoints ?? 0,
        submitted: b?.submitted ?? false,
        tb: b ? tiebreak.get(b.id) ?? 0 : 0,
        lockedAtMs: b?.lockedAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => {
      if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
      if (b.points !== a.points) return b.points - a.points;
      if (b.tb !== a.tb) return b.tb - a.tb;
      return a.lockedAtMs - b.lockedAtMs;
    });
  let rank = 0;
  const rankByUser = new Map<string, number>();
  for (const r of ranked) if (r.submitted) rankByUser.set(r.userId, ++rank);
  const submittedCount = rank;
  const myRow = ranked.find((r) => r.userId === userId);
  const myRank = rankByUser.get(userId) ?? null;
  const myBracket = byOwner.get(userId) ?? null;

  const locked = isLocked();
  const kickoff = kickoffUtc();

  const allTeams = await db.select().from(teams);
  const teamsByCode = new Map(allTeams.map((t) => [t.code, t]));

  const now = new Date();
  const nextMatches = await db
    .select()
    .from(matches)
    .where(gt(matches.kickoffUtc, now))
    .orderBy(asc(matches.kickoffUtc))
    .limit(3);

  const slot = (code: string | null, placeholder: string | null) => {
    const t = code ? teamsByCode.get(code) : null;
    return t ? `${t.flag} ${t.name}` : placeholder ?? 'TBD';
  };

  const top3 = ranked.slice(0, 3);
  const showMeSeparately = myRank != null && myRank > 3;

  const initial = (me?.displayName ?? 'P').trim().charAt(0).toUpperCase() || 'P';

  return (
    <div className="space-y-4 py-4">
      <header className="reveal flex flex-col items-center pt-6 pb-1 text-center">
        <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-accent/10 font-display text-4xl leading-none text-accent ring-1 ring-accent/30">
          {initial}
        </div>
        <p className="mt-4 text-[0.7rem] font-bold uppercase tracking-[0.3em] text-muted">
          Welcome back
        </p>
        <h1 className="font-display text-5xl leading-none">{me?.displayName ?? 'Player'}</h1>
      </header>

      {memberships.length > 1 ? (
        <div className="reveal flex justify-center gap-2 overflow-x-auto pb-1" style={{ animationDelay: '60ms' }}>
          {memberships.map((m) => (
            <Link
              key={m.poolId}
              href={`/home?pool=${m.poolId}`}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                m.poolId === poolId
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-edge bg-white/[0.02] text-muted'
              }`}
            >
              {m.poolName}
            </Link>
          ))}
        </div>
      ) : null}

      <div
        className={`reveal mx-auto flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
          locked ? 'border-live/30 bg-live/10 text-live' : 'border-gold/30 bg-gold/10 text-gold'
        }`}
        style={{ animationDelay: '120ms' }}
      >
        {locked ? <Lock className="h-4 w-4 shrink-0" /> : <Timer className="h-4 w-4 shrink-0" />}
        {locked
          ? 'Tournament underway — brackets are locked'
          : `Brackets lock ${matchDayLabel(kickoff)}, ${matchTime(kickoff)} ${DISPLAY_TZ_LABEL}`}
      </div>

      {/* Your bracket */}
      <Link
        href={`/bracket?pool=${poolId}`}
        className="reveal card flex items-center gap-3 p-4 active:scale-[0.99]"
        style={{ animationDelay: '180ms' }}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/30">
          {myBracket?.submitted ? (
            <CheckCircle2 className="h-6 w-6 text-accent" strokeWidth={2} />
          ) : (
            <ClipboardList className="h-6 w-6 text-accent" strokeWidth={2} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl leading-none">{active.poolName}</div>
          <div className="mt-1 text-sm text-muted">
            {!myBracket
              ? locked
                ? 'No bracket — entries closed'
                : 'You have not started your bracket'
              : myBracket.submitted
                ? `Submitted${myRank ? ` · ${ordinal(myRank)} of ${submittedCount}` : ''}`
                : locked
                  ? 'Not submitted before kickoff'
                  : 'Draft saved — finish and submit'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-3xl leading-none text-accent">{myRow?.points ?? 0}</div>
          <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted">pts</div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-2" />
      </Link>

      {/* Predict mini-game */}
      <Link
        href="/predict"
        className="reveal card flex items-center gap-3 p-4 active:scale-[0.99]"
        style={{ animationDelay: '210ms' }}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/10 ring-1 ring-gold/30">
          <Target className="h-6 w-6 text-gold" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl leading-none">Predict scores</div>
          <div className="mt-1 text-sm text-muted">Call exact scorelines for bonus points</div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-2" />
      </Link>

      {/* Standings preview */}
      <section className="reveal card p-4" style={{ animationDelay: '240ms' }}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl leading-none">Standings</h2>
          <Link href={`/leaderboard?pool=${poolId}`} className="text-xs font-bold text-accent">
            Full table →
          </Link>
        </div>
        {submittedCount === 0 ? (
          <p className="text-sm text-muted">No submitted brackets yet. Be the first to lock in.</p>
        ) : (
          <ol className="space-y-1.5">
            {top3.map((r, i) => (
              <li
                key={r.userId}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${
                  r.userId === userId ? 'bg-accent/[0.08]' : ''
                }`}
              >
                <span className="w-4 text-center font-display text-base text-muted">{i + 1}</span>
                <span className="flex-1 truncate text-sm font-semibold">
                  {r.name}
                  {r.userId === userId ? (
                    <span className="ml-1.5 text-[0.6rem] font-bold uppercase text-accent">You</span>
                  ) : null}
                </span>
                <span className="font-display text-lg text-accent">{r.points}</span>
              </li>
            ))}
            {showMeSeparately && myRow ? (
              <li className="flex items-center gap-2.5 rounded-lg bg-accent/[0.08] px-2 py-1.5">
                <span className="w-4 text-center font-display text-base text-muted">{myRank}</span>
                <span className="flex-1 truncate text-sm font-semibold">
                  {myRow.name}
                  <span className="ml-1.5 text-[0.6rem] font-bold uppercase text-accent">You</span>
                </span>
                <span className="font-display text-lg text-accent">{myRow.points}</span>
              </li>
            ) : null}
          </ol>
        )}
      </section>

      {/* Next matches */}
      <section className="reveal card p-4" style={{ animationDelay: '300ms' }}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-display text-xl leading-none">
            <CalendarDays className="h-4 w-4 text-muted" /> Up next
          </h2>
          <Link href="/matches" className="text-xs font-bold text-accent">
            All matches →
          </Link>
        </div>
        {nextMatches.length === 0 ? (
          <p className="text-sm text-muted">No upcoming matches.</p>
        ) : (
          <ul className="space-y-2">
            {nextMatches.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {slot(m.homeCode, m.homePlaceholder)}
                  <span className="px-1.5 text-muted-2">v</span>
                  {slot(m.awayCode, m.awayPlaceholder)}
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {matchDayLabel(m.kickoffUtc).split(',')[0]} {matchTime(m.kickoffUtc)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="reveal" style={{ animationDelay: '360ms' }}>
        <Link
        href={`/chat?pool=${poolId}`}
        className="reveal card flex items-center gap-3 p-4 active:scale-[0.99]"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/30">
          <MessageCircle className="h-6 w-6 text-accent" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl leading-none">Smack talk</div>
          <div className="mt-1 text-sm text-muted">Trash talk the group chat</div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-2" />
      </Link>

      <InviteButton code={active.joinCode} groupName={active.poolName} />
      </div>
    </div>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
