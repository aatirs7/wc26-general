import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brackets, bracketScores, matchPredictions, poolMembers, pools, standingSnapshots, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import InviteButton from '@/components/pools/InviteButton';

export const dynamic = 'force-dynamic';

type Metric = 'bracket' | 'bonus' | 'combined';

interface Row {
  rank: number | null;
  bracketId: string | null;
  bracketName: string;
  ownerId: string;
  ownerName: string;
  value: number;
  submitted: boolean;
  tiebreak: number;
  lockedAtMs: number;
}

const METRICS: { key: Metric; label: string }[] = [
  { key: 'bracket', label: 'Bracket' },
  { key: 'bonus', label: 'Bonus' },
  { key: 'combined', label: 'Combined' },
];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string; metric?: string }>;
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

  const { pool: requested, metric: metricParam } = await searchParams;
  const metric: Metric =
    metricParam === 'bonus' || metricParam === 'combined' ? metricParam : 'bracket';
  const active = memberships.find((m) => m.poolId === requested) ?? memberships[0];

  const members = await db
    .select({ userId: poolMembers.userId, displayName: users.displayName })
    .from(poolMembers)
    .innerJoin(users, eq(users.id, poolMembers.userId))
    .where(eq(poolMembers.poolId, active.poolId));
  const memberIds = members.map((m) => m.userId);

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

  // Score-prediction bonus is per user (global), summed for this group's members.
  const predRows = memberIds.length
    ? await db
        .select({ userId: matchPredictions.userId, points: matchPredictions.points })
        .from(matchPredictions)
        .where(inArray(matchPredictions.userId, memberIds))
    : [];
  const bonusByUser = new Map<string, number>();
  for (const p of predRows) bonusByUser.set(p.userId, (bonusByUser.get(p.userId) ?? 0) + p.points);

  const bracketByOwner = new Map(poolBrackets.map((b) => [b.ownerId, b]));
  const rows: Row[] = members.map((m) => {
    const b = bracketByOwner.get(m.userId);
    const bracketPts = b?.totalPoints ?? 0;
    const bonus = bonusByUser.get(m.userId) ?? 0;
    const value = metric === 'bonus' ? bonus : metric === 'combined' ? bracketPts + bonus : bracketPts;
    return {
      rank: null,
      bracketId: b?.id ?? null,
      bracketName: b?.name ?? 'No bracket',
      ownerId: m.userId,
      ownerName: m.displayName,
      value,
      submitted: b?.submitted ?? false,
      tiebreak: b ? tiebreakByBracket.get(b.id) ?? 0 : 0,
      lockedAtMs: b?.lockedAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
    };
  });

  if (metric === 'bracket') {
    // Submitted brackets ranked; unsubmitted shown greyed at the bottom.
    rows.sort((a, b) => {
      if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
      if (b.value !== a.value) return b.value - a.value;
      if (b.tiebreak !== a.tiebreak) return b.tiebreak - a.tiebreak;
      return a.lockedAtMs - b.lockedAtMs;
    });
    let rank = 0;
    for (const r of rows) if (r.submitted) r.rank = ++rank;
  } else {
    // Bonus / combined: everyone is ranked by the value.
    rows.sort((a, b) => b.value - a.value || a.ownerName.localeCompare(b.ownerName));
    rows.forEach((r, i) => {
      r.rank = i + 1;
    });
  }

  // Movement since the start of today's baseline snapshot (bracket metric only).
  const snaps = await db
    .select()
    .from(standingSnapshots)
    .where(eq(standingSnapshots.poolId, active.poolId));
  const snapByUser = new Map(snaps.map((s) => [s.userId, s]));
  const movementOf = (row: Row): { rankDelta: number; gained: number } | null => {
    if (metric !== 'bracket') return null;
    const s = snapByUser.get(row.ownerId);
    if (!s) return null;
    const rankDelta = s.rank != null && row.rank != null ? s.rank - row.rank : 0;
    return { rankDelta, gained: row.value - s.points };
  };

  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
  };
  const rankedCount = metric === 'bracket' ? rows.filter((r) => r.submitted).length : rows.length;
  const me = rows.find((r) => r.ownerId === userId);
  const dims = (r: Row) => metric === 'bracket' && !r.submitted;
  const href = (pool: string, m: Metric) => `/leaderboard?pool=${pool}&metric=${m}`;
  const unitLabel = metric === 'bonus' ? 'bonus' : 'pts';

  return (
    <div className="space-y-4 py-4">
      <header className="pt-2 text-center">
        <h1 className="font-display text-4xl leading-none">Standings</h1>
        <p className="mt-1 text-xs text-muted">{active.poolName}</p>
      </header>

      <InviteButton code={active.joinCode} groupName={active.poolName} />

      {/* Bracket / Bonus / Combined */}
      <div className="flex rounded-full border border-edge bg-white/[0.03] p-1 text-xs font-bold">
        {METRICS.map((mt) => (
          <Link
            key={mt.key}
            href={href(active.poolId, mt.key)}
            className={`flex-1 rounded-full py-1.5 text-center transition-colors ${
              mt.key === metric ? 'bg-accent text-[var(--accent-ink)]' : 'text-muted'
            }`}
          >
            {mt.label}
          </Link>
        ))}
      </div>

      {me ? (
        <div className="card flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">
              Your rank
            </div>
            <div className="font-display text-3xl leading-none">
              {me.rank ? (
                <>
                  {ordinal(me.rank)} <span className="text-muted">of {rankedCount}</span>
                </>
              ) : (
                <span className="text-gold">Not locked in</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-4xl leading-none text-accent">{me.value}</div>
            <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted">{unitLabel}</div>
          </div>
        </div>
      ) : null}

      {memberships.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {memberships.map((m) => (
            <Link
              key={m.poolId}
              href={href(m.poolId, metric)}
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
          const mv = movementOf(row);
          const inner = (
            <div
              className={`card flex min-h-14 items-center gap-3 px-3 py-2.5 ${
                isMe ? 'border-accent bg-accent/[0.06]' : row.rank && row.rank <= 3 ? `ring-${row.rank}` : ''
              } ${dims(row) ? 'opacity-60' : ''}`}
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
                  <span className="truncate text-sm font-bold">
                    {metric === 'bracket' ? row.bracketName : row.ownerName}
                  </span>
                  {isMe ? (
                    <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-[var(--accent-ink)]">
                      You
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-muted">
                  {metric === 'bracket'
                    ? `${row.ownerName}${!row.submitted ? ' · did not lock' : ''}`
                    : row.bracketName}
                </div>
              </div>
              {mv && (mv.rankDelta !== 0 || mv.gained > 0) ? (
                <div className="flex shrink-0 flex-col items-end text-[0.6rem] font-bold leading-tight">
                  {mv.rankDelta > 0 ? (
                    <span className="text-accent">▲{mv.rankDelta}</span>
                  ) : mv.rankDelta < 0 ? (
                    <span className="text-live">▼{-mv.rankDelta}</span>
                  ) : null}
                  {mv.gained > 0 ? <span className="text-muted">+{mv.gained}</span> : null}
                </div>
              ) : null}
              <span className="font-display text-2xl leading-none text-accent">{row.value}</span>
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
