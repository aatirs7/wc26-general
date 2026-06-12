import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brackets, groupStandings, matches, poolMembers, pools, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { isLockedForPool } from '@/lib/lock';
import { buildFacts, scoreBracket } from '@/lib/scoring';
import { computeBadges, type Badge } from '@/lib/achievements';
import RenameBracket from '@/components/me/RenameBracket';
import RenameSelf from '@/components/me/RenameSelf';
import BracketControls from '@/components/me/BracketControls';
import InstallGuide from '@/components/me/InstallGuide';
import Achievements from '@/components/me/Achievements';
import CollapsibleSection from '@/components/me/CollapsibleSection';
import SwitchPlayer from '@/components/auth/SwitchPlayer';
import InviteShare from '@/components/pools/InviteShare';

export const dynamic = 'force-dynamic';

export default async function MePage() {
  const userId = await currentUserId();
  if (!userId) redirect('/');

  const [me] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const myPools = await db
    .select({ poolId: pools.id, name: pools.name, joinCode: pools.joinCode })
    .from(poolMembers)
    .innerJoin(pools, eq(pools.id, poolMembers.poolId))
    .where(eq(poolMembers.userId, userId));

  const myBrackets = await Promise.all(
    myPools.map(async (p) => {
      const [b] = await db
        .select({ id: brackets.id, name: brackets.name, submitted: brackets.submitted })
        .from(brackets)
        .where(and(eq(brackets.ownerId, userId), eq(brackets.poolId, p.poolId)))
        .limit(1);
      return { pool: p, bracket: b ?? null };
    }),
  );

  // Achievements: a personal trophy case merged across the user's brackets
  // (a badge counts as earned if it's earned in any of their groups).
  const matchRows = await db
    .select({
      stage: matches.stage,
      status: matches.status,
      groupLetter: matches.groupLetter,
      winnerCode: matches.winnerCode,
      // Scores let buildFacts build the live group tables (provisional points).
      homeCode: matches.homeCode,
      awayCode: matches.awayCode,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
    })
    .from(matches);
  const standingRows = await db
    .select({ groupLetter: groupStandings.groupLetter, teamCode: groupStandings.teamCode, rank: groupStandings.rank, isBestThird: groupStandings.isBestThird })
    .from(groupStandings);
  const facts = buildFacts(matchRows, standingRows);

  const perPool: Badge[][] = [];
  for (const p of myPools) {
    const poolBrackets = await db.select().from(brackets).where(eq(brackets.poolId, p.poolId));
    const mineB = poolBrackets.find((b) => b.ownerId === userId);
    if (!mineB) continue;
    const scores = scoreBracket(mineB.predictions, facts);
    const ranked = poolBrackets
      .map((b) => {
        const sc = scoreBracket(b.predictions, facts);
        return {
          ownerId: b.ownerId,
          points: b.totalPoints,
          tb: sc.final + sc.champion,
          submitted: b.submitted,
          lockedAtMs: b.lockedAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
        };
      })
      .sort((a, b) => {
        if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
        if (b.points !== a.points) return b.points - a.points;
        if (b.tb !== a.tb) return b.tb - a.tb;
        return a.lockedAtMs - b.lockedAtMs;
      });
    let rank: number | null = null;
    let r = 0;
    for (const x of ranked) {
      if (x.submitted) {
        r += 1;
        if (x.ownerId === userId) rank = r;
      }
    }
    const champ = mineB.predictions.knockout.champion;
    const sharers = champ
      ? poolBrackets.filter((b) => b.predictions.knockout.champion === champ).length
      : 0;
    perPool.push(
      computeBadges({
        predictions: mineB.predictions,
        scores,
        facts,
        totalPoints: mineB.totalPoints,
        rank,
        fieldSize: poolBrackets.length,
        loneWolfChampion: !!champ && sharers === 1,
      }),
    );
  }

  const badges: Badge[] = perPool.length
    ? perPool[0].map((b, i) => {
        const earned = perPool.some((pb) => pb[i].earned);
        const hint = earned ? undefined : perPool.find((pb) => pb[i].hint)?.[i].hint ?? b.hint;
        return { ...b, earned, hint };
      })
    : [];

  return (
    <div className="space-y-7 py-4 lg:mx-auto lg:max-w-2xl">
      <header className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent font-display text-3xl text-[var(--accent-ink)]">
          {(me?.displayName ?? 'Y').slice(0, 1).toUpperCase()}
        </span>
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-display text-3xl leading-none">{me?.displayName ?? 'You'}</h1>
          <RenameSelf currentName={me?.displayName ?? ''} />
        </div>
        <SwitchPlayer />
      </header>

      <CollapsibleSection title="My brackets" count={myBrackets.length}>
        {myBrackets.length === 0 ? (
          <p className="text-center text-sm text-muted">
            You are not in a group yet. Create or join one from the home screen.
          </p>
        ) : null}
        {myBrackets.map(({ pool, bracket }) => (
          <div key={pool.poolId} className="card space-y-3 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate font-display text-lg leading-none">
                {pool.name}
              </span>
              <Link
                href={`/bracket?pool=${pool.poolId}`}
                className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent active:scale-95"
              >
                Open
              </Link>
            </div>
            <InviteShare code={pool.joinCode} groupName={pool.name} />
            {bracket ? (
              <>
                <RenameBracket bracketId={bracket.id} currentName={bracket.name} />
                {!bracket.submitted && !isLockedForPool(pool.poolId) ? (
                  <p className="text-xs font-semibold text-gold">Not submitted yet</p>
                ) : null}
                {!isLockedForPool(pool.poolId) ? <BracketControls bracketId={bracket.id} /> : null}
              </>
            ) : (
              <p className="text-xs text-muted">No bracket yet</p>
            )}
          </div>
        ))}
      </CollapsibleSection>

      {badges.length > 0 ? <Achievements badges={badges} /> : null}

      <section id="install" className="scroll-mt-20 space-y-3">
        <div className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-1.5 text-accent">
            <Sparkles className="h-4 w-4" strokeWidth={2.4} />
            <span className="text-[0.7rem] font-bold uppercase tracking-[0.2em]">Best experience</span>
          </div>
          <h2 className="font-display text-2xl leading-none">Add it to your home screen</h2>
          <p className="text-sm text-muted">
            Install the app for a full-screen, faster, app-like experience. Takes a few taps:
          </p>
        </div>
        <InstallGuide />
      </section>
    </div>
  );
}
