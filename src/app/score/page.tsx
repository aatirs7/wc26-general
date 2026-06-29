import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { Layers, Trophy, Target, ArrowLeft, Sparkles } from 'lucide-react';
import { db } from '@/lib/db';
import {
  brackets,
  groupStandings,
  matchPredictions,
  matches,
  poolMembers,
  pools,
  teams,
} from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import {
  attainablePoints,
  buildFacts,
  provisionalPoints,
  scoreBracket,
  totalOf,
} from '@/lib/scoring';
import { pointsBreakdown, type BreakdownLine } from '@/lib/points-breakdown';
import { PREDICT_EXACT_POINTS } from '@/lib/predict';
import { FINAL_STATUSES } from '@/lib/constants';
import LivePoller from '@/components/matches/LivePoller';

export const dynamic = 'force-dynamic';

function Line({ l }: { l: BreakdownLine }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="text-lg leading-none">{l.flag}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{l.name}</div>
        <div className="text-xs text-muted">
          {l.reason}
          {l.exact ? <span className="ml-1.5 rounded bg-gold/15 px-1 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-gold">exact</span> : null}
          {l.live ? <span className="ml-1.5 text-[0.6rem] font-bold uppercase tracking-wide text-gold">● live</span> : null}
        </div>
      </div>
      <span className="shrink-0 font-display text-lg text-accent">+{l.pts}</span>
    </li>
  );
}

function Section({
  icon,
  title,
  subtitle,
  total,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-edge bg-white/[0.02] p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/30">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display text-lg leading-tight">{title}</div>
          <div className="text-xs text-muted">{subtitle}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl leading-none text-accent">{total}</div>
          <div className="text-[0.55rem] font-bold uppercase tracking-wider text-muted">points</div>
        </div>
      </div>
      {children}
    </section>
  );
}

// A plain-language, always-current breakdown of where every one of your points
// comes from, split into Group stage, Knockouts and Score predictions.
export default async function ScorePage({
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
  if (memberships.length === 0) redirect('/');

  const { pool: requested } = await searchParams;
  const cookiePool = (await cookies()).get('wc26_active_pool')?.value;
  const active =
    memberships.find((m) => m.poolId === requested) ??
    memberships.find((m) => m.poolId === cookiePool) ??
    memberships.find((m) => m.poolId === process.env.NEXT_PUBLIC_DEFAULT_POOL_ID) ??
    memberships[0];

  const [bracket] = await db
    .select()
    .from(brackets)
    .where(and(eq(brackets.ownerId, userId), eq(brackets.poolId, active.poolId)))
    .limit(1);

  const allTeams = await db.select().from(teams);
  const teamByCode = new Map(allTeams.map((t) => [t.code, t]));
  const teamName = (code: string) => {
    const t = teamByCode.get(code);
    return { name: t?.name ?? code, flag: t?.flag ?? '⚽' };
  };

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

  const rankByTeam = new Map(standingRows.map((s) => [`${s.groupLetter}:${s.teamCode}`, s.rank]));
  const rankOf = (group: string, code: string) => rankByTeam.get(`${group}:${code}`) ?? null;

  const facts = buildFacts(matchRows, standingRows);

  // Bracket lines (group + knockout). Empty when there is no bracket yet.
  const lines: BreakdownLine[] = bracket
    ? pointsBreakdown(bracket.predictions, facts, rankOf, teamName)
    : [];
  const groupLines = lines.filter((l) => l.category === 'group');
  const knockoutLines = lines.filter((l) => l.category === 'knockout');

  const bracketScores = bracket
    ? scoreBracket(bracket.predictions, facts)
    : null;
  const groupTotal = bracketScores ? bracketScores.groups + bracketScores.thirdPlace : 0;
  const knockoutTotal = bracketScores
    ? bracketScores.r16 + bracketScores.qf + bracketScores.sf + bracketScores.final + bracketScores.champion
    : 0;
  const live = bracket ? provisionalPoints(bracket.predictions, facts) : 0;

  // Score predictions (the mini-game): list the exact-score hits.
  const isFinal = (s: string) => (FINAL_STATUSES as readonly string[]).includes(s);
  const allMatches = await db.select().from(matches).orderBy(asc(matches.kickoffUtc), asc(matches.id));
  const matchById = new Map(allMatches.map((m) => [m.id, m]));
  const preds = await db
    .select()
    .from(matchPredictions)
    .where(eq(matchPredictions.userId, userId));
  const predTotal = preds.reduce((s, p) => s + p.points, 0);
  const predHits = preds
    .filter((p) => p.points > 0)
    .map((p) => ({ p, m: matchById.get(p.matchId) }))
    .filter((x) => x.m)
    .sort((a, b) => (b.m!.kickoffUtc.getTime() - a.m!.kickoffUtc.getTime()));
  const predMade = preds.length;
  const predSettled = preds.filter((p) => {
    const m = matchById.get(p.matchId);
    return m && isFinal(m.status);
  }).length;

  const combined = (bracket?.totalPoints ?? 0) + predTotal;
  const bracketTotal = bracketScores ? totalOf(bracketScores) : 0;
  const attainable = attainablePoints(matchRows, facts);
  const accuracy = attainable > 0 ? Math.round((bracketTotal / attainable) * 100) : null;

  const anyLive = allMatches.some((m) => m.status === 'live' || m.status === 'ht');

  return (
    <div className="space-y-5 py-4 lg:mx-auto lg:max-w-2xl">
      <LivePoller active={anyLive} />

      <header className="pt-2 text-center">
        <Link href="/home" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted">
          <ArrowLeft className="h-3.5 w-3.5" /> Home
        </Link>
        <h1 className="font-display text-4xl leading-none">Your score, explained</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Every point you have, where it came from, in plain English. This updates by itself as
          results come in.
        </p>
      </header>

      <div className="card flex items-center justify-between p-4">
        <div>
          <div className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted">Total points</div>
          <div className="font-display text-5xl leading-none text-accent">{combined}</div>
          {live > 0 ? (
            <div className="mt-1 text-[0.6rem] font-bold uppercase tracking-wider text-gold">● {live} still live</div>
          ) : null}
        </div>
        <div className="text-right text-xs text-muted">
          <div><span className="font-bold text-foreground">{groupTotal}</span> group stage</div>
          <div><span className="font-bold text-foreground">{knockoutTotal}</span> knockouts</div>
          <div><span className="font-bold text-foreground">{predTotal}</span> predictions</div>
          {accuracy != null ? <div className="mt-1">{accuracy}% accuracy</div> : null}
        </div>
      </div>

      <Section
        icon={<Layers className="h-5 w-5 text-accent" strokeWidth={2.2} />}
        title="Group stage"
        subtitle="Teams you sent through + exact finishes"
        total={groupTotal}
      >
        {groupLines.length > 0 ? (
          <ul className="divide-y divide-edge/60">
            {groupLines.map((l, i) => (
              <Line key={`g${i}`} l={l} />
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted">No group points yet.</p>
        )}
      </Section>

      <Section
        icon={<Trophy className="h-5 w-5 text-accent" strokeWidth={2.2} />}
        title="Knockouts"
        subtitle="Teams you rode deeper into the bracket"
        total={knockoutTotal}
      >
        {knockoutLines.length > 0 ? (
          <ul className="divide-y divide-edge/60">
            {knockoutLines.map((l, i) => (
              <Line key={`k${i}`} l={l} />
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted">
            The knockouts are just starting. You score here for every team you picked that keeps
            winning: {' '}
            5 for the Round of 16, 8 the quarters, 12 the semis, 18 the final, and 30 if your champion
            lifts the trophy.
          </p>
        )}
      </Section>

      <Section
        icon={<Target className="h-5 w-5 text-accent" strokeWidth={2.2} />}
        title="Score predictions"
        subtitle={`${predSettled} settled · ${predMade} made · ${PREDICT_EXACT_POINTS} pt per exact score`}
        total={predTotal}
      >
        {predHits.length > 0 ? (
          <ul className="divide-y divide-edge/60">
            {predHits.map(({ p, m }) => {
              const h = teamName(m!.homeCode ?? '');
              const a = teamName(m!.awayCode ?? '');
              const exactHit = p.homeScore === m!.homeScore && p.awayScore === m!.awayScore;
              const pensHit = m!.status === 'pens' && !!p.pensWinner && p.pensWinner === m!.winnerCode;
              const reason = exactHit && pensHit
                ? `Exact score ${p.homeScore}–${p.awayScore} and the shootout`
                : pensHit
                  ? `Called the penalty shootout`
                  : `Called it exactly: ${p.homeScore}–${p.awayScore}`;
              return (
                <li key={p.matchId} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-lg leading-none">🎯</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {h.flag} {h.name} <span className="text-muted-2">v</span> {a.flag} {a.name}
                    </div>
                    <div className="text-xs text-muted">{reason}</div>
                  </div>
                  <span className="shrink-0 font-display text-lg text-accent">+{p.points}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted">
            No exact-score hits yet. Nail a final score on the{' '}
            <Link href="/predict" className="font-semibold text-accent">Predict</Link> page to bank a
            bonus point.
          </p>
        )}
      </Section>

      <Link
        href="/scoring"
        className="card flex items-center justify-center gap-2 p-3 text-sm font-semibold text-accent active:scale-[0.99]"
      >
        <Sparkles className="h-4 w-4" /> See the full scoring rules
      </Link>
    </div>
  );
}
