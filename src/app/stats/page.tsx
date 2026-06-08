import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brackets, groupStandings, matches, poolMembers, pools, teams, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { attainablePoints, buildFacts } from '@/lib/scoring';
import type { Predictions } from '@/types/bracket';
import MemberList, { type Member } from '@/components/stats/MemberList';

export const dynamic = 'force-dynamic';

export default async function StatsPage({
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
      <div className="py-4">
        <h1 className="font-display text-4xl">Stats</h1>
        <p className="mt-2 text-sm text-muted">
          Create or join a group from the home screen first.
        </p>
      </div>
    );
  }

  const { pool: requested } = await searchParams;
  const active = memberships.find((m) => m.poolId === requested) ?? memberships[0];
  const poolId = active.poolId;

  const members = await db
    .select({ name: users.displayName, userId: poolMembers.userId })
    .from(poolMembers)
    .innerJoin(users, eq(users.id, poolMembers.userId))
    .where(eq(poolMembers.poolId, poolId));

  const poolBrackets = await db.select().from(brackets).where(eq(brackets.poolId, poolId));
  const byOwner = new Map(poolBrackets.map((b) => [b.ownerId, b]));

  // Accuracy denominator: max points a perfect bracket could hold so far.
  const matchRows = await db
    .select({
      stage: matches.stage,
      status: matches.status,
      groupLetter: matches.groupLetter,
      winnerCode: matches.winnerCode,
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
  const attainable = attainablePoints(matchRows, facts);
  const accuracyOf = (points: number) =>
    attainable > 0 ? Math.round((points / attainable) * 100) : null;

  const teamRows = await db.select({ code: teams.code, name: teams.name, flag: teams.flag }).from(teams);
  const teamByCode = new Map(teamRows.map((t) => [t.code, t]));

  const myName = members.find((m) => m.userId === userId)?.name ?? null;

  const rows = members.map((m) => {
    const b = byOwner.get(m.userId);
    const preds = (b?.predictions ?? null) as Predictions | null;
    return {
      name: m.name,
      points: b?.totalPoints ?? 0,
      submitted: b?.submitted ?? false,
      champion: preds?.knockout?.champion ?? null,
    };
  });

  const toMember = (r: { name: string; points: number }): Member => ({
    name: r.name,
    points: r.points,
    accuracy: accuracyOf(r.points),
  });

  // Pool-wide snapshot.
  const players = rows.length;
  const submitted = rows.filter((r) => r.submitted).length;
  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const avgPoints = players ? Math.round((totalPoints / players) * 10) / 10 : 0;
  const poolAccuracy =
    attainable > 0 && players ? Math.round((totalPoints / (attainable * players)) * 100) : null;

  // Most popular champion pick across the pool.
  const myChampion = rows.find((r) => r.name === myName)?.champion ?? null;
  const championCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.champion) championCounts.set(r.champion, (championCounts.get(r.champion) ?? 0) + 1);
  }
  const championPicks = [...championCounts.entries()]
    .map(([code, count]) => ({
      code,
      count,
      name: teamByCode.get(code)?.name ?? code,
      flag: teamByCode.get(code)?.flag ?? '',
      mine: code === myChampion,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxChampionCount = championPicks[0]?.count ?? 0;

  const topOverall = rows.slice().sort((a, b) => b.points - a.points).slice(0, 8);
  const anyPoints = rows.some((r) => r.points > 0);
  const allMembers = rows.map(toMember);

  return (
    <div className="space-y-5 py-4">
      <header className="pt-2 text-center">
        <h1 className="font-display text-4xl leading-none">Stats</h1>
        <p className="mt-1 text-sm text-muted">
          {active.poolName} ·{' '}
          <Link href="/scoring" className="font-semibold text-accent underline">
            How it&apos;s scored
          </Link>
        </p>
      </header>

      {memberships.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {memberships.map((m) => (
            <Link
              key={m.poolId}
              href={`/stats?pool=${m.poolId}`}
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

      <div className="card p-4">
        <div className="text-center text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted">
          Group snapshot
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="font-display text-4xl leading-none">{avgPoints}</div>
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-muted">avg pts</div>
          </div>
          <div>
            <div className="font-display text-4xl leading-none">
              {poolAccuracy === null ? '—' : `${poolAccuracy}%`}
            </div>
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-muted">accuracy</div>
          </div>
          <div>
            <div className="font-display text-4xl leading-none">
              {submitted}/{players}
            </div>
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-muted">locked in</div>
          </div>
        </div>
        <div className="mt-3 border-t border-edge/50 pt-2">
          <MemberList members={allMembers} highlight={myName ?? undefined} />
        </div>
      </div>

      {championPicks.length > 0 ? (
        <section>
          <h2 className="mb-2 text-center font-display text-2xl">Popular champion picks</h2>
          <p className="mb-3 text-center text-xs text-muted">Who the pool is backing to lift the trophy.</p>
          <ol className="space-y-2">
            {championPicks.map((c) => (
              <li key={c.code} className={`card p-3 ${c.mine ? 'border-accent' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl leading-none">{c.flag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-display text-lg leading-tight">{c.name}</span>
                      {c.mine ? (
                        <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[0.5rem] font-bold uppercase tracking-wider text-[var(--accent-ink)]">
                          You
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${maxChampionCount ? (c.count / maxChampionCount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl leading-none text-accent">{c.count}</div>
                    <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted">
                      {c.count === 1 ? 'pick' : 'picks'}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-center font-display text-xl text-muted">Top of the table</h3>
        {anyPoints ? (
          <ol className="space-y-2">
            {topOverall.map((r, i) => (
              <li
                key={r.name}
                className={`card flex items-center gap-3 px-3 py-2.5 ${
                  r.name === myName ? 'border-accent bg-accent/[0.06]' : ''
                }`}
              >
                <span className="w-5 text-center font-display text-lg text-muted">{i + 1}</span>
                <span className="flex-1 truncate text-sm font-bold">
                  {r.name}
                  {r.name === myName ? (
                    <span className="ml-1.5 text-[0.6rem] font-bold uppercase text-accent">You</span>
                  ) : null}
                </span>
                {accuracyOf(r.points) !== null ? (
                  <span className="text-xs font-semibold text-muted">{accuracyOf(r.points)}%</span>
                ) : null}
                <span className="font-display text-xl text-accent">{r.points}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="card p-4 text-sm text-muted">
            No points yet. Once the tournament kicks off, accuracy and points land here round by round.
          </p>
        )}
      </section>
    </div>
  );
}
