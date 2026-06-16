import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  brackets,
  groupStandings,
  matchPredictions,
  matches,
  poolMembers,
  pools,
  standingSnapshots,
  teams,
  users,
} from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { buildFacts, provisionalPoints, scoreBracket, totalOf } from '@/lib/scoring';
import { pointsBreakdown } from '@/lib/points-breakdown';
import { computeLiveGroupTables } from '@/lib/standings';
import Standings, { type PlayerRow } from '@/components/leaderboard/Standings';
import RememberPool from '@/components/RememberPool';
import PullToRefresh from '@/components/PullToRefresh';

export const dynamic = 'force-dynamic';

const ROUND_ORDER = ['groups', 'thirdPlace', 'r16', 'qf', 'sf', 'final', 'champion'] as const;
const ROUND_LABELS: Record<string, string> = {
  groups: 'Group finishes',
  thirdPlace: 'Best thirds',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  final: 'Final',
  champion: 'Champion',
};

export default async function LeaderboardPage({
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
        <h1 className="text-xl font-bold">Leaderboard</h1>
        <p className="mt-2 text-sm text-muted">Create or join a group from the home screen first.</p>
      </div>
    );
  }

  const { pool: requested } = await searchParams;
  const activePoolCookie = (await cookies()).get('wc26_active_pool')?.value;
  const active =
    memberships.find((m) => m.poolId === requested) ??
    memberships.find((m) => m.poolId === activePoolCookie) ??
    memberships[0];

  const members = await db
    .select({ userId: poolMembers.userId, displayName: users.displayName })
    .from(poolMembers)
    .innerJoin(users, eq(users.id, poolMembers.userId))
    .where(eq(poolMembers.poolId, active.poolId));
  const memberIds = members.map((m) => m.userId);

  const poolBrackets = await db.select().from(brackets).where(eq(brackets.poolId, active.poolId));

  // Live group-stage facts, so we can flag the provisional portion of each
  // player's points (group points that update as live tables move).
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
  const facts = buildFacts(matchRows, standingRows);
  const groupStageLive = facts.startedGroups.size > 0;
  const liveByOwner = new Map<string, number>();
  for (const b of poolBrackets) liveByOwner.set(b.ownerId, provisionalPoints(b.predictions, facts));

  // Per-pick breakdown ("Mexico — 1st in Group A · +3") so the expanded row
  // explains where every point comes from. Ranks come from the live table
  // while a group is in progress, the provider table once it is decided.
  const teamRows = await db.select({ code: teams.code, name: teams.name, flag: teams.flag }).from(teams);
  const teamByCode = new Map(teamRows.map((t) => [t.code, t]));
  const teamName = (code: string) => ({
    name: teamByCode.get(code)?.name ?? code,
    flag: teamByCode.get(code)?.flag ?? '⚽',
  });
  // Ranks come from the same live group tables the Matches > Groups view
  // shows (computed from match scores), so the breakdown ("1st in Group A")
  // matches it -- the provider standings only refresh at full time.
  const rankByKey = new Map<string, number>();
  for (const r of computeLiveGroupTables(matchRows)) {
    rankByKey.set(`${r.groupLetter}:${r.teamCode}`, r.rank);
  }
  const rankOf = (group: string, code: string) => rankByKey.get(`${group}:${code}`) ?? null;
  const detailByOwner = new Map<string, ReturnType<typeof pointsBreakdown>>();
  for (const b of poolBrackets) {
    detailByOwner.set(b.ownerId, pointsBreakdown(b.predictions, facts, rankOf, teamName));
  }

  const predRows = memberIds.length
    ? await db
        .select({ userId: matchPredictions.userId, points: matchPredictions.points })
        .from(matchPredictions)
        .where(inArray(matchPredictions.userId, memberIds))
    : [];
  const bonusByUser = new Map<string, number>();
  for (const p of predRows) bonusByUser.set(p.userId, (bonusByUser.get(p.userId) ?? 0) + p.points);

  const snaps = await db
    .select()
    .from(standingSnapshots)
    .where(eq(standingSnapshots.poolId, active.poolId));
  const snapByUser = new Map(snaps.map((s) => [s.userId, s]));

  const bracketByOwner = new Map(poolBrackets.map((b) => [b.ownerId, b]));

  // Combined standing = bracket points + score-prediction bonus. Recompute the
  // bracket total from the SAME live facts the per-pick breakdown uses, so the
  // headline number always equals the sum of the breakdown lines. (The persisted
  // brackets.totalPoints is written by the cron rescore and can lag mid-game,
  // which made the big number and the itemised lines disagree during live play.)
  const computed = members.map((m) => {
    const b = bracketByOwner.get(m.userId);
    const liveScores = b ? scoreBracket(b.predictions, facts) : null;
    const bracketTotal = liveScores ? totalOf(liveScores) : 0;
    const bonus = bonusByUser.get(m.userId) ?? 0;
    const rounds = liveScores
      ? ROUND_ORDER.map((k) => ({ label: ROUND_LABELS[k], pts: liveScores[k] })).filter((r) => r.pts > 0)
      : [];
    return {
      ownerId: m.userId,
      name: m.displayName,
      bracketId: b?.id ?? null,
      bracketName: b?.name ?? null,
      bracketTotal,
      bonus,
      combined: bracketTotal + bonus,
      live: liveByOwner.get(m.userId) ?? 0,
      detail: detailByOwner.get(m.userId) ?? [],
      submitted: b?.submitted ?? false,
      tiebreak: liveScores ? liveScores.champion + liveScores.final : 0,
      lockedAtMs: b?.lockedAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
      rounds,
    };
  });

  computed.sort((a, b) => {
    if (b.combined !== a.combined) return b.combined - a.combined;
    if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
    if (b.tiebreak !== a.tiebreak) return b.tiebreak - a.tiebreak;
    return a.lockedAtMs - b.lockedAtMs;
  });

  const rows: PlayerRow[] = computed.map((c, i) => {
    const rank = i + 1;
    const snap = snapByUser.get(c.ownerId);
    const rankDelta = snap?.rank != null ? snap.rank - rank : 0;
    const gained = snap ? c.combined - snap.points : 0;
    return {
      ownerId: c.ownerId,
      name: c.name,
      bracketName: c.bracketName,
      bracketId: c.bracketId,
      rank,
      combined: c.combined,
      bracketTotal: c.bracketTotal,
      bonus: c.bonus,
      live: c.live,
      detail: c.detail,
      submitted: c.submitted,
      rounds: c.rounds,
      rankDelta,
      gained,
    };
  });

  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
  };
  const me = rows.find((r) => r.ownerId === userId);

  return (
    <div className="space-y-4 py-4 lg:mx-auto lg:max-w-2xl">
      <PullToRefresh />
      <p className="-mt-2 flex items-center justify-center gap-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted-2 lg:hidden">
        ↓ Pull to refresh
      </p>
      <RememberPool poolId={active.poolId} />
      <header className="pt-2 text-center">
        <h1 className="font-display text-4xl leading-none">Standings</h1>
        <p className="mt-1 text-xs text-muted">{active.poolName}</p>
        <Link
          href="/scoring"
          className="mt-0.5 inline-block text-[0.65rem] font-semibold text-accent underline"
        >
          How it&apos;s scored
        </Link>
      </header>

      {me ? (
        <div className="card flex items-center justify-center px-4 py-3 text-center">
          <div>
            <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">
              Your rank
            </div>
            <div className="font-display text-3xl leading-none">
              {ordinal(me.rank)} <span className="text-muted">of {rows.length}</span>
            </div>
          </div>
        </div>
      ) : null}

      {memberships.length > 1 ? (
        <div className="flex justify-center gap-2 overflow-x-auto pb-1">
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

      {groupStageLive ? (
        <div className="rounded-xl border border-gold/30 bg-gold/[0.08] px-3 py-2 text-center">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.15em] text-gold">
            ● Live group points
          </p>
          <p className="mt-0.5 text-[0.7rem] leading-snug text-muted">
            Points for current group positions count live and shift as scores change. They lock in
            when each group finishes.
          </p>
        </div>
      ) : null}

      <p className="text-center text-[0.7rem] text-muted-2">Tap a player to see where their points come from.</p>

      <Standings rows={rows} meId={userId} />
    </div>
  );
}
