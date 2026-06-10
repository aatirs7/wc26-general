import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  brackets,
  bracketScores,
  matchPredictions,
  poolMembers,
  pools,
  standingSnapshots,
  users,
} from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import InviteButton from '@/components/pools/InviteButton';
import Standings, { type PlayerRow } from '@/components/leaderboard/Standings';
import RememberPool from '@/components/RememberPool';

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

  const scoreRows = poolBrackets.length
    ? await db
        .select()
        .from(bracketScores)
        .where(inArray(bracketScores.bracketId, poolBrackets.map((b) => b.id)))
    : [];
  const roundsByBracket = new Map<string, Map<string, number>>();
  const tiebreakByBracket = new Map<string, number>();
  for (const s of scoreRows) {
    const m = roundsByBracket.get(s.bracketId) ?? new Map<string, number>();
    m.set(s.roundKey, s.points);
    roundsByBracket.set(s.bracketId, m);
    if (s.roundKey === 'champion' || s.roundKey === 'final') {
      tiebreakByBracket.set(s.bracketId, (tiebreakByBracket.get(s.bracketId) ?? 0) + s.points);
    }
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

  // Combined standing = bracket points + score-prediction bonus.
  const computed = members.map((m) => {
    const b = bracketByOwner.get(m.userId);
    const bracketTotal = b?.totalPoints ?? 0;
    const bonus = bonusByUser.get(m.userId) ?? 0;
    const roundMap = b ? roundsByBracket.get(b.id) : undefined;
    const rounds = ROUND_ORDER.map((k) => ({ label: ROUND_LABELS[k], pts: roundMap?.get(k) ?? 0 })).filter(
      (r) => r.pts > 0,
    );
    return {
      ownerId: m.userId,
      name: m.displayName,
      bracketId: b?.id ?? null,
      bracketName: b?.name ?? null,
      bracketTotal,
      bonus,
      combined: bracketTotal + bonus,
      submitted: b?.submitted ?? false,
      tiebreak: b ? tiebreakByBracket.get(b.id) ?? 0 : 0,
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
    <div className="space-y-4 py-4">
      <RememberPool poolId={active.poolId} />
      <header className="pt-2 text-center">
        <h1 className="font-display text-4xl leading-none">Standings</h1>
        <p className="mt-1 text-xs text-muted">{active.poolName} · bracket + bonus</p>
      </header>

      <InviteButton code={active.joinCode} groupName={active.poolName} />

      {me ? (
        <div className="card flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">
              Your rank
            </div>
            <div className="font-display text-3xl leading-none">
              {ordinal(me.rank)} <span className="text-muted">of {rows.length}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-4xl leading-none text-accent">{me.combined}</div>
            <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted">pts</div>
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

      <p className="text-center text-[0.7rem] text-muted-2">Tap a player to see where their points come from.</p>

      <Standings rows={rows} meId={userId} />
    </div>
  );
}
