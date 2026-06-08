import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brackets, bracketScores, poolMembers, pools, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import InviteButton from '@/components/pools/InviteButton';

export const dynamic = 'force-dynamic';

interface Row {
  rank: number | null;
  bracketId: string | null;
  bracketName: string;
  ownerId: string;
  ownerName: string;
  points: number;
  tiebreak: number;
  submitted: boolean;
  lockedAtMs: number;
}

export default async function LeaderboardPage({
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
        <h1 className="text-xl font-bold">Leaderboard</h1>
        <p className="mt-2 text-sm text-muted">Create or join a group from the home screen first.</p>
      </div>
    );
  }

  const { pool: requested } = await searchParams;
  const active =
    memberships.find((m) => m.poolId === requested) ??
    memberships.find((m) => m.poolId === process.env.NEXT_PUBLIC_DEFAULT_POOL_ID) ??
    memberships[0];

  const members = await db
    .select({ userId: poolMembers.userId, displayName: users.displayName })
    .from(poolMembers)
    .innerJoin(users, eq(users.id, poolMembers.userId))
    .where(eq(poolMembers.poolId, active.poolId));

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

  // Tiebreaks: champion + final points, then earliest submit time.
  const tiebreakByBracket = new Map<string, number>();
  for (const s of scoreRows) {
    if (s.roundKey === 'champion' || s.roundKey === 'final') {
      tiebreakByBracket.set(s.bracketId, (tiebreakByBracket.get(s.bracketId) ?? 0) + s.points);
    }
  }

  const bracketByOwner = new Map(poolBrackets.map((b) => [b.ownerId, b]));
  const rows: Row[] = members.map((m) => {
    const b = bracketByOwner.get(m.userId);
    return {
      rank: null,
      bracketId: b?.id ?? null,
      bracketName: b?.name ?? 'No bracket',
      ownerId: m.userId,
      ownerName: m.displayName,
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
    if (r.submitted) r.rank = ++rank;
  }

  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
  };
  const me = rows.find((r) => r.ownerId === userId);

  return (
    <div className="space-y-4 py-4">
      <header className="pt-2 text-center">
        <h1 className="font-display text-4xl leading-none">Standings</h1>
        <p className="mt-1 text-xs text-muted">{active.poolName}</p>
      </header>

      <InviteButton code={active.joinCode} groupName={active.poolName} />

      {me ? (
        <div className="card flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">
              Your rank
            </div>
            <div className="font-display text-3xl leading-none">
              {me.submitted && me.rank ? (
                <>
                  {ordinal(me.rank)} <span className="text-muted">of {rows.length}</span>
                </>
              ) : (
                <span className="text-gold">Not locked in</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-4xl leading-none text-accent">{me.points}</div>
            <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted">pts</div>
          </div>
        </div>
      ) : null}

      {memberships.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {memberships.map((m) => (
            <Link
              key={m.poolId}
              href={`/leaderboard?pool=${m.poolId}`}
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

      <ol className="space-y-2">
        {rows.map((row) => {
          const medal = row.rank && row.rank <= 3 ? `medal-${row.rank}` : '';
          const isMe = row.ownerId === userId;
          const inner = (
            <div
              className={`card flex min-h-14 items-center gap-3 px-3 py-2.5 ${
                isMe ? 'border-accent bg-accent/[0.06]' : row.rank && row.rank <= 3 ? `ring-${row.rank}` : ''
              } ${!row.submitted ? 'opacity-60' : ''}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-lg ${
                  medal || 'bg-white/[0.04] text-muted'
                }`}
              >
                {row.rank ?? '–'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold">{row.bracketName}</span>
                  {isMe ? (
                    <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-[var(--accent-ink)]">
                      You
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted">
                  {row.ownerName}
                  {!row.submitted ? ' · did not lock' : ''}
                </div>
              </div>
              <span className="font-display text-2xl leading-none text-accent">{row.points}</span>
            </div>
          );
          return (
            <li key={row.ownerId}>
              {row.bracketId ? <Link href={`/bracket/${row.bracketId}`}>{inner}</Link> : inner}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
