import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brackets, bracketScores, groupStandings, matches, poolMembers, pools, teams, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { attainablePoints, buildFacts } from '@/lib/scoring';
import { GROUP_LETTERS, type RoundKey } from '@/lib/constants';
import type { Predictions } from '@/types/bracket';
import MemberList, { type Member } from '@/components/stats/MemberList';
import RememberPool from '@/components/RememberPool';

export const dynamic = 'force-dynamic';

const ROUND_LABELS: Record<RoundKey, string> = {
  groups: 'Group finishes',
  thirdPlace: 'Best thirds',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  final: 'Final',
  champion: 'Champion',
};

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
  const activePoolCookie = (await cookies()).get('wc26_active_pool')?.value;
  const active =
    memberships.find((m) => m.poolId === requested) ??
    memberships.find((m) => m.poolId === activePoolCookie) ??
    memberships[0];
  const poolId = active.poolId;

  const members = await db
    .select({ name: users.displayName, userId: poolMembers.userId })
    .from(poolMembers)
    .innerJoin(users, eq(users.id, poolMembers.userId))
    .where(eq(poolMembers.poolId, poolId));

  const poolBrackets = await db.select().from(brackets).where(eq(brackets.poolId, poolId));
  const byOwner = new Map(poolBrackets.map((b) => [b.ownerId, b]));
  const ownerName = new Map(members.map((m) => [m.userId, m.name]));

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
  // Clamp at 100: accuracy is banked / attainable. During a scoring-rule
  // rollout, persisted points (banked by the latest sync) can briefly outrun
  // the freshly computed denominator, but accuracy can never truly exceed
  // 100%, so we never display more.
  const accuracyOf = (points: number) =>
    attainable > 0 ? Math.min(100, Math.round((points / attainable) * 100)) : null;

  const scoreRows = poolBrackets.length
    ? await db
        .select()
        .from(bracketScores)
        .where(inArray(bracketScores.bracketId, poolBrackets.map((b) => b.id)))
    : [];

  const teamRows = await db.select({ code: teams.code, name: teams.name, flag: teams.flag }).from(teams);
  const teamByCode = new Map(teamRows.map((t) => [t.code, t]));
  const label = (code: string) => ({
    name: teamByCode.get(code)?.name ?? code,
    flag: teamByCode.get(code)?.flag ?? '',
  });

  const myName = members.find((m) => m.userId === userId)?.name ?? null;

  const rows = members.map((m) => {
    const b = byOwner.get(m.userId);
    return {
      name: m.name,
      points: b?.totalPoints ?? 0,
      submitted: b?.submitted ?? false,
    };
  });
  const toMember = (r: { name: string; points: number }): Member => ({
    name: r.name,
    points: r.points,
    accuracy: accuracyOf(r.points),
  });

  // Snapshot.
  const players = rows.length;
  const submitted = rows.filter((r) => r.submitted).length;
  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const avgPoints = players ? Math.round((totalPoints / players) * 10) / 10 : 0;
  const poolAccuracy =
    attainable > 0 && players
      ? Math.min(100, Math.round((totalPoints / (attainable * players)) * 100))
      : null;

  const predOf = (ownerId: string) => byOwner.get(ownerId)?.predictions as Predictions | undefined;

  // Champion picks across the group.
  const champCount = new Map<string, number>();
  const champOwner = new Map<string, string[]>();
  for (const b of poolBrackets) {
    const c = (b.predictions as Predictions).knockout?.champion;
    if (!c) continue;
    champCount.set(c, (champCount.get(c) ?? 0) + 1);
    const arr = champOwner.get(c) ?? [];
    arr.push(ownerName.get(b.ownerId) ?? '?');
    champOwner.set(c, arr);
  }
  const myChampion = predOf(userId)?.knockout?.champion ?? null;
  const championPicks = [...champCount.entries()]
    .map(([code, count]) => ({ code, count, ...label(code), mine: code === myChampion }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxChampion = championPicks[0]?.count ?? 0;

  // Teams the group backs to reach the Final.
  const finalCount = new Map<string, number>();
  for (const b of poolBrackets) {
    for (const code of (b.predictions as Predictions).knockout?.final ?? []) {
      finalCount.set(code, (finalCount.get(code) ?? 0) + 1);
    }
  }
  const finalistPicks = [...finalCount.entries()]
    .map(([code, count]) => ({ code, count, ...label(code) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const maxFinalist = finalistPicks[0]?.count ?? 0;

  // Consensus group winner: most-picked 1st place in each group.
  const groupWinners = GROUP_LETTERS.map((letter) => {
    const counts = new Map<string, number>();
    let total = 0;
    for (const b of poolBrackets) {
      const first = (b.predictions as Predictions).groups?.[letter]?.first;
      if (first) {
        counts.set(first, (counts.get(first) ?? 0) + 1);
        total += 1;
      }
    }
    if (total === 0) return null;
    const [topCode, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return { letter, ...label(topCode), pct: Math.round((n / total) * 100) };
  }).filter((g): g is NonNullable<typeof g> => g !== null);

  // Lone-wolf champion picks (backed by exactly one player).
  const loneWolves = [...champCount.entries()]
    .filter(([, count]) => count === 1)
    .map(([code]) => ({ owner: champOwner.get(code)?.[0] ?? '?', ...label(code) }));

  // Performance.
  const topOverall = rows.slice().sort((a, b) => b.points - a.points).slice(0, 8);
  const anyPoints = rows.some((r) => r.points > 0);
  const allMembers = rows.map(toMember);

  const roundPoints = new Map<RoundKey, number>();
  for (const s of scoreRows) {
    roundPoints.set(s.roundKey as RoundKey, (roundPoints.get(s.roundKey as RoundKey) ?? 0) + s.points);
  }
  const roundBreakdown = [...roundPoints.entries()]
    .filter(([, pts]) => pts > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, pts]) => ({ label: ROUND_LABELS[key], pts }));

  const sectionLabel = 'text-[0.7rem] font-bold uppercase tracking-[0.25em] text-muted-2';

  return (
    <div className="space-y-5 py-4 lg:mx-auto lg:max-w-4xl">
      <RememberPool poolId={poolId} />
      <header className="pt-2 text-center">
        <h1 className="font-display text-4xl leading-none">Stats</h1>
        <p className="mt-1 text-sm text-muted">{active.poolName}</p>
        <p className="mt-0.5 text-xs text-muted">
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

      {poolBrackets.length === 0 ? (
        <p className="card p-4 text-center text-sm text-muted">
          No brackets in this group yet. Once people start picking, the group&apos;s
          favourites and standings show up here.
        </p>
      ) : null}

      <div className="card p-4">
        <div className={`text-center ${sectionLabel}`}>Group snapshot</div>
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

      {championPicks.length > 0 || finalistPicks.length > 0 || groupWinners.length > 0 ? (
        <div className={`text-center ${sectionLabel}`}>What the group is picking</div>
      ) : null}

      {championPicks.length > 0 ? (
        <section>
          <h2 className="mb-2 text-center font-display text-2xl">Champion picks</h2>
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
                        style={{ width: `${maxChampion ? (c.count / maxChampion) * 100 : 0}%` }}
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

      {finalistPicks.length > 0 ? (
        <section>
          <h2 className="mb-2 text-center font-display text-2xl">Backed to reach the final</h2>
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {finalistPicks.map((f) => (
              <li key={f.code} className="card flex items-center gap-2 p-2.5">
                <span className="text-xl leading-none">{f.flag}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{f.name}</span>
                <span className="font-display text-lg leading-none text-accent">{f.count}</span>
              </li>
            ))}
          </ul>
          {maxFinalist > 0 ? (
            <p className="mt-2 text-center text-[0.7rem] text-muted-2">
              Times each team was picked to make the Final.
            </p>
          ) : null}
        </section>
      ) : null}

      {groupWinners.length > 0 ? (
        <section>
          <h2 className="mb-2 text-center font-display text-2xl">Consensus group winners</h2>
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
            {groupWinners.map((g) => (
              <li key={g.letter} className="card flex items-center gap-2 p-2.5">
                <span className="font-display text-base text-muted">{g.letter}</span>
                <span className="text-lg leading-none">{g.flag}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.name}</span>
                <span className="text-xs font-bold text-accent">{g.pct}%</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {loneWolves.length > 0 ? (
        <section>
          <h2 className="mb-2 text-center font-display text-2xl">Lone wolves</h2>
          <p className="mb-2 text-center text-xs text-muted">
            Champions only one person is backing.
          </p>
          <ul className="space-y-2">
            {loneWolves.map((w, i) => (
              <li key={`${w.owner}-${i}`} className="card flex items-center gap-3 px-3 py-2.5">
                <span className="flex-1 truncate text-sm font-bold">{w.owner}</span>
                <span className="text-lg leading-none">{w.flag}</span>
                <span className="truncate text-sm text-muted">{w.name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {poolBrackets.length > 0 ? (
        <div className={`text-center ${sectionLabel}`}>Standings</div>
      ) : null}

      {poolBrackets.length > 0 ? (
        <section>
          <h2 className="mb-2 text-center font-display text-2xl">Top of the table</h2>
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
              No points yet. Once the tournament kicks off, accuracy and points land here
              round by round.
            </p>
          )}
        </section>
      ) : null}

      {roundBreakdown.length > 0 ? (
        <section>
          <h2 className="mb-2 text-center font-display text-2xl">Points by round</h2>
          <ul className="space-y-2">
            {roundBreakdown.map((r) => (
              <li key={r.label} className="card flex items-center justify-between px-3 py-2.5">
                <span className="text-sm font-semibold">{r.label}</span>
                <span className="font-display text-xl text-accent">{r.pts}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-center text-[0.7rem] text-muted-2">
            Total points the group has earned in each round.
          </p>
        </section>
      ) : null}
    </div>
  );
}
