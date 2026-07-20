// The finale data layer: everything the personal and pool "Recap" story
// decks need. Two ideas do the heavy lifting here.
//
// 1. A stage-by-stage REPLAY of the whole tournament. The scoring engine is
//    pure, so feeding it a time-truncated slice of matches reproduces exactly
//    what the leaderboard showed at that moment. Replaying eight cut points
//    gives every player a real rank journey, which is where most of the good
//    material comes from (peaks, collapses, lead changes, nemeses).
// 2. Everything else is aggregation over data the app already stores:
//    brackets, per-round scores, score predictions, and chat messages.
//
// Nothing here writes. All of it agrees with the leaderboard by construction,
// because the final checkpoint uses the same facts and the same comparator.

import { asc, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import {
  brackets,
  bracketScores,
  groupStandings,
  matchPredictions,
  matches,
  messages,
  poolMembers,
  pools,
  teams,
  users,
} from './schema';
import { ROUND_KEYS, SCORING, SCORING_BY_ROUND, type RoundKey } from './constants';
import type { Predictions } from '@/types/bracket';
import {
  attainablePoints,
  buildFacts,
  scoreBracket,
  totalOf,
  type Facts,
  type MatchFact,
  type StandingFact,
} from './scoring';
import { computeLiveGroupTables, deriveAdvancement } from './standings';
import { pointsBreakdown } from './points-breakdown';
import { computeBadges } from './achievements';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface TeamRef {
  code: string;
  name: string;
  flag: string;
}

export interface Checkpoint {
  key: string;
  label: string;
  // Short form for chart axes.
  short: string;
  byUser: Map<string, { points: number; rank: number }>;
}

export interface JourneyPoint {
  label: string;
  short: string;
  rank: number;
  points: number;
}

export interface Standing {
  userId: string;
  name: string;
  bracketName: string;
  combined: number;
  bracketTotal: number;
  bonus: number;
  rank: number;
  accuracy: number | null;
  submitted: boolean;
  champion: TeamRef | null;
}

// ---------------------------------------------------------------------------
// Stage labels
// ---------------------------------------------------------------------------

const STAGE_DEPTH: Record<string, number> = {
  group: 0,
  r32: 1,
  r16: 2,
  qf: 3,
  sf: 4,
  third: 4, // the third-place playoff is not a deeper run than the semi-final
  final: 5,
};

const EXIT_LABEL: Record<string, string> = {
  group: 'the group stage',
  r32: 'the Round of 32',
  r16: 'the Round of 16',
  qf: 'the quarter-finals',
  sf: 'the semi-finals',
  final: 'the final',
};

const ROUND_LABELS: Record<RoundKey, string> = {
  groups: 'Group finishes',
  thirdPlace: 'Best thirds',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  final: 'Final',
  champion: 'Champion',
};

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

const pluralise = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

// ---------------------------------------------------------------------------
// Context: one database pass everything else reads from
// ---------------------------------------------------------------------------

type MatchRow = {
  id: number;
  stage: string;
  status: string;
  groupLetter: string | null;
  winnerCode: string | null;
  homeCode: string | null;
  awayCode: string | null;
  homeScore: number | null;
  awayScore: number | null;
  kickoffUtc: Date;
  roundLabel: string;
};

export interface FinaleContext {
  poolId: string;
  poolName: string;
  members: { userId: string; name: string }[];
  nameOf: Map<string, string>;
  poolBrackets: (typeof brackets.$inferSelect)[];
  bracketByOwner: Map<string, typeof brackets.$inferSelect>;
  roundsByBracket: Map<string, Record<RoundKey, number>>;
  matchRows: MatchRow[];
  matchById: Map<number, MatchRow>;
  standingRows: StandingFact[];
  facts: Facts;
  attainable: number;
  teamByCode: Map<string, TeamRef>;
  team: (code: string | null | undefined) => TeamRef | null;
  predsByUser: Map<string, (typeof matchPredictions.$inferSelect)[]>;
  bonusByUser: Map<string, number>;
  messageRows: { userId: string; body: string; createdAt: Date }[];
  championTeam: TeamRef | null;
  standings: Standing[];
  rankOf: (group: string, code: string) => number | null;
}

const emptyScores = () =>
  Object.fromEntries(ROUND_KEYS.map((k) => [k, 0])) as Record<RoundKey, number>;

export async function loadFinaleContext(poolId: string): Promise<FinaleContext> {
  const [pool] = await db.select().from(pools).where(eq(pools.id, poolId)).limit(1);

  const memberRows = await db
    .select({ userId: poolMembers.userId, name: users.displayName })
    .from(poolMembers)
    .innerJoin(users, eq(users.id, poolMembers.userId))
    .where(eq(poolMembers.poolId, poolId));
  const memberIds = memberRows.map((m) => m.userId);

  const poolBrackets = await db.select().from(brackets).where(eq(brackets.poolId, poolId));
  const bracketByOwner = new Map(poolBrackets.map((b) => [b.ownerId, b]));

  const matchRows = (await db
    .select({
      id: matches.id,
      stage: matches.stage,
      status: matches.status,
      groupLetter: matches.groupLetter,
      winnerCode: matches.winnerCode,
      homeCode: matches.homeCode,
      awayCode: matches.awayCode,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      kickoffUtc: matches.kickoffUtc,
      roundLabel: matches.roundLabel,
    })
    .from(matches)
    .orderBy(asc(matches.kickoffUtc), asc(matches.id))) as MatchRow[];

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

  const teamRows = await db
    .select({ code: teams.code, name: teams.name, flag: teams.flag })
    .from(teams);
  const teamByCode = new Map(teamRows.map((t) => [t.code, t]));
  const team = (code: string | null | undefined): TeamRef | null =>
    code
      ? { code, name: teamByCode.get(code)?.name ?? code, flag: teamByCode.get(code)?.flag ?? '⚽' }
      : null;

  const scoreRows = poolBrackets.length
    ? await db
        .select()
        .from(bracketScores)
        .where(inArray(bracketScores.bracketId, poolBrackets.map((b) => b.id)))
    : [];
  const roundsByBracket = new Map<string, Record<RoundKey, number>>();
  for (const s of scoreRows) {
    const m = roundsByBracket.get(s.bracketId) ?? emptyScores();
    m[s.roundKey as RoundKey] = s.points;
    roundsByBracket.set(s.bracketId, m);
  }

  const predRows = memberIds.length
    ? await db.select().from(matchPredictions).where(inArray(matchPredictions.userId, memberIds))
    : [];
  const predsByUser = new Map<string, (typeof matchPredictions.$inferSelect)[]>();
  const bonusByUser = new Map<string, number>();
  for (const p of predRows) {
    const list = predsByUser.get(p.userId) ?? [];
    list.push(p);
    predsByUser.set(p.userId, list);
    bonusByUser.set(p.userId, (bonusByUser.get(p.userId) ?? 0) + p.points);
  }

  const messageRows = await db
    .select({ userId: messages.userId, body: messages.body, createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.poolId, poolId));

  // Live group ranks, so breakdown copy lines up with the Groups view.
  const rankByKey = new Map<string, number>();
  for (const r of computeLiveGroupTables(matchRows)) {
    rankByKey.set(`${r.groupLetter}:${r.teamCode}`, r.rank);
  }
  const rankOf = (group: string, code: string) => rankByKey.get(`${group}:${code}`) ?? null;

  // Final standings, using exactly the leaderboard's comparator.
  type Row = Standing & { tiebreak: number; lockedAtMs: number };
  const rows: Row[] = memberRows.map((m) => {
    const b = bracketByOwner.get(m.userId);
    const roundMap = b ? roundsByBracket.get(b.id) : undefined;
    const bracketTotal = b?.totalPoints ?? 0;
    const bonus = bonusByUser.get(m.userId) ?? 0;
    return {
      userId: m.userId,
      name: m.name,
      bracketName: b?.name ?? 'No bracket',
      bracketTotal,
      bonus,
      combined: bracketTotal + bonus,
      accuracy: attainable > 0 ? Math.min(100, Math.round((bracketTotal / attainable) * 100)) : null,
      rank: 0,
      submitted: b?.submitted ?? false,
      champion: team(b?.predictions.knockout.champion),
      tiebreak: (roundMap?.final ?? 0) + (roundMap?.champion ?? 0),
      lockedAtMs: b?.lockedAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
    };
  });
  rows.sort(compareStandings);
  rows.forEach((r, i) => (r.rank = i + 1));

  return {
    poolId,
    poolName: pool?.name ?? 'Pool',
    members: memberRows,
    nameOf: new Map(memberRows.map((m) => [m.userId, m.name])),
    poolBrackets,
    bracketByOwner,
    roundsByBracket,
    matchRows,
    matchById: new Map(matchRows.map((m) => [m.id, m])),
    standingRows,
    facts,
    attainable,
    teamByCode,
    team,
    predsByUser,
    bonusByUser,
    messageRows,
    championTeam: team(facts.champion),
    standings: rows,
    rankOf,
  };
}

// The one ordering rule the whole app shares. Kept here so the replay ranks
// people the same way the live leaderboard does.
function compareStandings(
  a: { combined: number; bonus: number; submitted: boolean; tiebreak: number; lockedAtMs: number },
  b: { combined: number; bonus: number; submitted: boolean; tiebreak: number; lockedAtMs: number },
): number {
  if (b.combined !== a.combined) return b.combined - a.combined;
  if (b.bonus !== a.bonus) return b.bonus - a.bonus;
  if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
  if (b.tiebreak !== a.tiebreak) return b.tiebreak - a.tiebreak;
  return a.lockedAtMs - b.lockedAtMs;
}

// ---------------------------------------------------------------------------
// The replay
// ---------------------------------------------------------------------------

interface CheckpointDef {
  key: string;
  label: string;
  short: string;
  // How many group matches (in kickoff order) are counted as played.
  groupCount: number;
  // Which knockout stages are counted as played.
  stages: string[];
}

const CHECKPOINTS: CheckpointDef[] = [
  { key: 'md1', label: 'After matchday one', short: 'MD1', groupCount: 24, stages: [] },
  { key: 'md2', label: 'After matchday two', short: 'MD2', groupCount: 48, stages: [] },
  { key: 'groups', label: 'After the group stage', short: 'Groups', groupCount: 72, stages: [] },
  { key: 'r32', label: 'After the Round of 32', short: 'R32', groupCount: 72, stages: ['r32'] },
  { key: 'r16', label: 'After the Round of 16', short: 'R16', groupCount: 72, stages: ['r32', 'r16'] },
  { key: 'qf', label: 'After the quarter-finals', short: 'QF', groupCount: 72, stages: ['r32', 'r16', 'qf'] },
  { key: 'sf', label: 'After the semi-finals', short: 'SF', groupCount: 72, stages: ['r32', 'r16', 'qf', 'sf'] },
  {
    key: 'ft',
    label: 'Full time',
    short: 'FT',
    groupCount: 72,
    stages: ['r32', 'r16', 'qf', 'sf', 'third', 'final'],
  },
];

const isPlayed = (status: string) => status === 'ft' || status === 'et' || status === 'pens';

// Rebuilds the standings table as it stood after a slice of matches. Once
// every group is complete we use the persisted, officially-tiebroken rows so
// the last checkpoints match the real leaderboard exactly; before that we
// derive a provisional table from the scores themselves.
function standingsAt(included: MatchRow[], persisted: StandingFact[], groupsComplete: boolean): StandingFact[] {
  if (groupsComplete) return persisted;
  const live = computeLiveGroupTables(included);
  const { bestThirds } = deriveAdvancement(live);
  return live.map((r) => ({
    groupLetter: r.groupLetter,
    teamCode: r.teamCode,
    rank: r.rank,
    isBestThird: bestThirds.has(r.teamCode),
  }));
}

export function buildTimeline(ctx: FinaleContext): Checkpoint[] {
  const playedGroup = ctx.matchRows.filter((m) => m.stage === 'group' && isPlayed(m.status));
  const out: Checkpoint[] = [];
  let lastSignature = '';

  for (const def of CHECKPOINTS) {
    const stageSet = new Set(def.stages);
    const included = ctx.matchRows.filter((m) => {
      if (!isPlayed(m.status)) return false;
      if (m.stage === 'group') return playedGroup.indexOf(m) < def.groupCount;
      return stageSet.has(m.stage);
    });
    if (included.length === 0) continue;

    // Nothing new happened since the previous checkpoint (the tournament has
    // not got that far yet), so do not draw a flat repeated point.
    const signature = `${included.length}`;
    if (signature === lastSignature) continue;
    lastSignature = signature;

    const groupsComplete = playedGroup.length >= 72 && def.groupCount >= 72;
    const facts = buildFacts(included as MatchFact[], standingsAt(included, ctx.standingRows, groupsComplete));
    const includedIds = new Set(included.map((m) => m.id));

    const rows = ctx.members.map((m) => {
      const b = ctx.bracketByOwner.get(m.userId);
      const scores = b ? scoreBracket(b.predictions, facts) : emptyScores();
      const bracketTotal = totalOf(scores);
      let bonus = 0;
      for (const p of ctx.predsByUser.get(m.userId) ?? []) {
        if (includedIds.has(p.matchId)) bonus += p.points;
      }
      return {
        userId: m.userId,
        combined: bracketTotal + bonus,
        bonus,
        submitted: b?.submitted ?? false,
        tiebreak: scores.final + scores.champion,
        lockedAtMs: b?.lockedAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
      };
    });
    rows.sort(compareStandings);

    const byUser = new Map<string, { points: number; rank: number }>();
    rows.forEach((r, i) => byUser.set(r.userId, { points: r.combined, rank: i + 1 }));
    out.push({ key: def.key, label: def.label, short: def.short, byUser });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Team exits: how far each team actually went
// ---------------------------------------------------------------------------

function buildExits(ctx: FinaleContext): Map<string, { stage: string; label: string; champion: boolean }> {
  const deepest = new Map<string, string>();
  for (const m of ctx.matchRows) {
    if (!isPlayed(m.status)) continue;
    if (m.stage === 'third') continue; // losing a playoff is not how far you went
    for (const code of [m.homeCode, m.awayCode]) {
      if (!code) continue;
      const cur = deepest.get(code);
      if (!cur || STAGE_DEPTH[m.stage] > STAGE_DEPTH[cur]) deepest.set(code, m.stage);
    }
  }
  const out = new Map<string, { stage: string; label: string; champion: boolean }>();
  for (const [code, stage] of deepest) {
    const champion = ctx.facts.champion === code;
    out.set(code, { stage, label: EXIT_LABEL[stage] ?? stage, champion });
  }
  return out;
}

// Every team a bracket committed to, with the weight of that commitment.
function heaviestPicks(p: Predictions): { code: string; weight: number; round: string }[] {
  const out: { code: string; weight: number; round: string }[] = [];
  if (p.knockout.champion) {
    out.push({ code: p.knockout.champion, weight: SCORING.champion, round: 'to win the whole thing' });
  }
  for (const code of p.knockout.final) out.push({ code, weight: SCORING_BY_ROUND.final, round: 'to reach the final' });
  for (const code of p.knockout.sf) out.push({ code, weight: SCORING_BY_ROUND.sf, round: 'to reach the semi-finals' });
  for (const code of p.knockout.qf) out.push({ code, weight: SCORING_BY_ROUND.qf, round: 'to reach the quarter-finals' });
  for (const code of p.knockout.r16) out.push({ code, weight: SCORING_BY_ROUND.r16, round: 'to reach the Round of 16' });
  return out.sort((a, b) => b.weight - a.weight);
}

// ---------------------------------------------------------------------------
// Personal recap
// ---------------------------------------------------------------------------

export interface PersonalRecap {
  poolId: string;
  poolName: string;
  name: string;
  fieldSize: number;
  me: Standing;
  beat: number;
  journey: JourneyPoint[];
  peak: JourneyPoint | null;
  trough: JourneyPoint | null;
  biggestClimb: { from: JourneyPoint; to: JourneyPoint; spots: number } | null;
  biggestFall: { from: JourneyPoint; to: JourneyPoint; spots: number } | null;
  champion: {
    pick: TeamRef;
    correct: boolean;
    exitLabel: string | null;
    actual: TeamRef | null;
  } | null;
  rideOrDie: { team: TeamRef; pts: number; picks: number } | null;
  betrayal: { team: TeamRef; promised: string; exitLabel: string; cost: number } | null;
  bestCall: { team: TeamRef; reason: string; pts: number } | null;
  leftOnTable: number;
  rounds: { label: string; pts: number }[];
  predictions: {
    made: number;
    exact: number;
    pensCalled: number;
    points: number;
    boldest: { label: string; total: number } | null;
    goalsPredicted: number;
    goalsActual: number;
  } | null;
  chat: {
    sent: number;
    poolTotal: number;
    sharePct: number;
    longest: string | null;
    busiestDay: { day: string; count: number } | null;
    rank: number;
  } | null;
  nemesis: { name: string; crossings: number; gap: number; aheadOfThem: boolean } | null;
  twin: { name: string; pct: number; shared: number } | null;
  badges: { title: string; desc: string }[];
  archetype: { title: string; emoji: string; line: string };
}

export async function loadPersonalRecap(
  poolId: string,
  userId: string,
): Promise<PersonalRecap | null> {
  const ctx = await loadFinaleContext(poolId);
  const me = ctx.standings.find((s) => s.userId === userId);
  if (!me) return null;

  const timeline = buildTimeline(ctx);
  const exits = buildExits(ctx);
  const bracket = ctx.bracketByOwner.get(userId);
  const roundMap = bracket ? ctx.roundsByBracket.get(bracket.id) ?? emptyScores() : emptyScores();

  // --- Journey ---
  const journey: JourneyPoint[] = timeline
    .map((c) => {
      const at = c.byUser.get(userId);
      return at ? { label: c.label, short: c.short, rank: at.rank, points: at.points } : null;
    })
    .filter((j): j is JourneyPoint => j !== null);

  let peak: JourneyPoint | null = null;
  let trough: JourneyPoint | null = null;
  for (const j of journey) {
    if (!peak || j.rank < peak.rank) peak = j;
    if (!trough || j.rank > trough.rank) trough = j;
  }

  let biggestClimb: PersonalRecap['biggestClimb'] = null;
  let biggestFall: PersonalRecap['biggestFall'] = null;
  for (let i = 1; i < journey.length; i += 1) {
    const delta = journey[i - 1].rank - journey[i].rank;
    if (delta > 0 && (!biggestClimb || delta > biggestClimb.spots)) {
      biggestClimb = { from: journey[i - 1], to: journey[i], spots: delta };
    }
    if (delta < 0 && (!biggestFall || -delta > biggestFall.spots)) {
      biggestFall = { from: journey[i - 1], to: journey[i], spots: -delta };
    }
  }

  // --- Champion ---
  let champion: PersonalRecap['champion'] = null;
  if (me.champion) {
    const exit = exits.get(me.champion.code);
    champion = {
      pick: me.champion,
      correct: ctx.facts.champion === me.champion.code,
      exitLabel: exit && !exit.champion ? exit.label : null,
      actual: ctx.championTeam,
    };
  }

  // --- Ride or die, best call, betrayal ---
  let rideOrDie: PersonalRecap['rideOrDie'] = null;
  let bestCall: PersonalRecap['bestCall'] = null;
  let betrayal: PersonalRecap['betrayal'] = null;

  if (bracket) {
    const lines = pointsBreakdown(bracket.predictions, ctx.facts, ctx.rankOf, (code) => ({
      name: ctx.teamByCode.get(code)?.name ?? code,
      flag: ctx.teamByCode.get(code)?.flag ?? '⚽',
    }));

    // pointsBreakdown emits display names, so map back to codes for the
    // bias copy and any code-keyed lookups.
    const codeOfName = new Map<string, string>();
    for (const [code, t] of ctx.teamByCode) codeOfName.set(t.name, code);

    const byTeam = new Map<string, { name: string; flag: string; pts: number; picks: number }>();
    for (const l of lines) {
      const cur = byTeam.get(l.name) ?? { name: l.name, flag: l.flag, pts: 0, picks: 0 };
      cur.pts += l.pts;
      cur.picks += 1;
      byTeam.set(l.name, cur);
    }
    const top = [...byTeam.values()].sort((a, b) => b.pts - a.pts)[0];
    if (top && top.pts > 0) {
      rideOrDie = {
        team: { code: codeOfName.get(top.name) ?? '', name: top.name, flag: top.flag },
        pts: top.pts,
        picks: top.picks,
      };
    }

    const best = lines.filter((l) => l.pts > 0).sort((a, b) => b.pts - a.pts)[0];
    if (best) {
      bestCall = {
        team: { code: codeOfName.get(best.name) ?? '', name: best.name, flag: best.flag },
        reason: best.reason,
        pts: best.pts,
      };
    }

    // The heaviest commitment that did not pay: the biggest weight you staked
    // on a team that went out before the round you promised.
    for (const pick of heaviestPicks(bracket.predictions)) {
      const paid =
        pick.round === 'to win the whole thing'
          ? ctx.facts.champion === pick.code
          : pick.round === 'to reach the final'
            ? ctx.facts.reached.final.has(pick.code)
            : pick.round === 'to reach the semi-finals'
              ? ctx.facts.reached.sf.has(pick.code)
              : pick.round === 'to reach the quarter-finals'
                ? ctx.facts.reached.qf.has(pick.code)
                : ctx.facts.reached.r16.has(pick.code);
      if (paid) continue;
      const exit = exits.get(pick.code);
      const ref = ctx.team(pick.code);
      if (!exit || !ref) continue;
      betrayal = { team: ref, promised: pick.round, exitLabel: exit.label, cost: pick.weight };
      break;
    }
  }

  // --- Score predictions ---
  const myPreds = ctx.predsByUser.get(userId) ?? [];
  let predictions: PersonalRecap['predictions'] = null;
  if (myPreds.length > 0) {
    let exact = 0;
    let pensCalled = 0;
    let goalsPredicted = 0;
    let goalsActual = 0;
    let boldest: { label: string; total: number } | null = null;
    for (const p of myPreds) {
      const m = ctx.matchById.get(p.matchId);
      goalsPredicted += p.homeScore + p.awayScore;
      const total = p.homeScore + p.awayScore;
      if (!boldest || total > boldest.total) {
        const home = ctx.team(m?.homeCode)?.name ?? 'Home';
        const away = ctx.team(m?.awayCode)?.name ?? 'Away';
        boldest = { label: `${home} ${p.homeScore} - ${p.awayScore} ${away}`, total };
      }
      if (!m || !isPlayed(m.status) || m.homeScore == null || m.awayScore == null) continue;
      goalsActual += m.homeScore + m.awayScore;
      if (p.homeScore === m.homeScore && p.awayScore === m.awayScore) exact += 1;
      if (m.status === 'pens' && p.pensWinner && p.pensWinner === m.winnerCode) pensCalled += 1;
    }
    predictions = {
      made: myPreds.length,
      exact,
      pensCalled,
      points: me.bonus,
      boldest,
      goalsPredicted,
      goalsActual,
    };
  }

  // --- Chat ---
  let chat: PersonalRecap['chat'] = null;
  if (ctx.messageRows.length > 0) {
    const mine = ctx.messageRows.filter((m) => m.userId === userId);
    const countByUser = new Map<string, number>();
    for (const m of ctx.messageRows) countByUser.set(m.userId, (countByUser.get(m.userId) ?? 0) + 1);
    const ordered = [...countByUser.entries()].sort((a, b) => b[1] - a[1]);
    const dayCounts = new Map<string, number>();
    for (const m of mine) {
      const day = m.createdAt.toISOString().slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    }
    const busiest = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const longest = mine.slice().sort((a, b) => b.body.length - a.body.length)[0];
    chat = {
      sent: mine.length,
      poolTotal: ctx.messageRows.length,
      sharePct: Math.round((mine.length / ctx.messageRows.length) * 100),
      longest: longest?.body ?? null,
      busiestDay: busiest ? { day: busiest[0], count: busiest[1] } : null,
      rank: Math.max(1, ordered.findIndex(([id]) => id === userId) + 1),
    };
  }

  // --- Nemesis: most rank crossings across the replay ---
  let nemesis: PersonalRecap['nemesis'] = null;
  if (timeline.length > 1) {
    let bestCrossings = 0;
    let bestGap = Number.MAX_SAFE_INTEGER;
    for (const other of ctx.standings) {
      if (other.userId === userId) continue;
      let crossings = 0;
      let prev = 0;
      for (const c of timeline) {
        const a = c.byUser.get(userId);
        const b = c.byUser.get(other.userId);
        if (!a || !b) continue;
        const sign = Math.sign(a.rank - b.rank);
        if (sign !== 0 && prev !== 0 && sign !== prev) crossings += 1;
        if (sign !== 0) prev = sign;
      }
      const gap = Math.abs(other.combined - me.combined);
      if (crossings > bestCrossings || (crossings === bestCrossings && crossings > 0 && gap < bestGap)) {
        bestCrossings = crossings;
        bestGap = gap;
        nemesis = { name: other.name, crossings, gap, aheadOfThem: me.rank < other.rank };
      }
    }
    if (nemesis && nemesis.crossings === 0) nemesis = null;
  }

  // --- Bracket twin ---
  let twin: PersonalRecap['twin'] = null;
  if (bracket) {
    const mine = pickSet(bracket.predictions);
    let best: { name: string; pct: number; shared: number } | null = null;
    for (const other of ctx.poolBrackets) {
      if (other.ownerId === userId) continue;
      const theirs = pickSet(other.predictions);
      let shared = 0;
      for (const k of mine) if (theirs.has(k)) shared += 1;
      const union = mine.size + theirs.size - shared;
      if (union === 0) continue;
      const pct = Math.round((shared / union) * 100);
      if (!best || pct > best.pct) {
        best = { name: ctx.nameOf.get(other.ownerId) ?? 'Someone', pct, shared };
      }
    }
    if (best && best.pct > 0) twin = best;
  }

  // --- Badges ---
  let badges: { title: string; desc: string }[] = [];
  if (bracket) {
    const champ = bracket.predictions.knockout.champion;
    const championCounts = new Map<string, number>();
    for (const b of ctx.poolBrackets) {
      const c = b.predictions.knockout.champion;
      if (c) championCounts.set(c, (championCounts.get(c) ?? 0) + 1);
    }
    badges = computeBadges({
      predictions: bracket.predictions,
      scores: roundMap,
      facts: ctx.facts,
      totalPoints: me.bracketTotal,
      rank: me.rank,
      fieldSize: ctx.standings.length,
      loneWolfChampion: !!champ && (championCounts.get(champ) ?? 0) === 1,
    })
      .filter((b) => b.earned)
      .map((b) => ({ title: b.title, desc: b.desc }));
  }

  const rounds = ROUND_KEYS.map((k) => ({ label: ROUND_LABELS[k], pts: roundMap[k] })).filter(
    (r) => r.pts > 0,
  );

  const archetype = pickArchetype({
    me,
    fieldSize: ctx.standings.length,
    journey,
    predictions,
    chat,
    rideOrDie,
    champion,
    twin,
  });

  return {
    poolId,
    poolName: ctx.poolName,
    name: me.name,
    fieldSize: ctx.standings.length,
    me,
    beat: Math.max(0, ctx.standings.length - me.rank),
    journey,
    peak,
    trough,
    biggestClimb,
    biggestFall,
    champion,
    rideOrDie,
    betrayal,
    bestCall,
    leftOnTable: Math.max(0, ctx.attainable - me.bracketTotal),
    rounds,
    predictions,
    chat,
    nemesis,
    twin,
    badges,
    archetype,
  };
}

// A comparable set of a bracket's commitments, for the twin similarity score.
function pickSet(p: Predictions): Set<string> {
  const s = new Set<string>();
  for (const [letter, g] of Object.entries(p.groups)) {
    if (!g) continue;
    if (g.first) s.add(`g:${letter}:1:${g.first}`);
    if (g.second) s.add(`g:${letter}:2:${g.second}`);
    if (g.third) s.add(`g:${letter}:3:${g.third}`);
    if (g.fourth) s.add(`g:${letter}:4:${g.fourth}`);
  }
  for (const r of ['r16', 'qf', 'sf', 'final'] as const) {
    for (const code of p.knockout[r]) s.add(`k:${r}:${code}`);
  }
  if (p.knockout.champion) s.add(`c:${p.knockout.champion}`);
  return s;
}

// ---------------------------------------------------------------------------
// Archetypes: a persona from the shape of someone's tournament
// ---------------------------------------------------------------------------

interface ArchetypeInput {
  me: Standing;
  fieldSize: number;
  journey: JourneyPoint[];
  predictions: PersonalRecap['predictions'];
  chat: PersonalRecap['chat'];
  rideOrDie: PersonalRecap['rideOrDie'];
  champion: PersonalRecap['champion'];
  twin: PersonalRecap['twin'];
}

// Ordered rules: the first one that fits wins, so the more specific and more
// interesting personas sit at the top.
export function pickArchetype(i: ArchetypeInput): { title: string; emoji: string; line: string } {
  const first = i.journey[0]?.rank ?? i.me.rank;
  const last = i.journey[i.journey.length - 1]?.rank ?? i.me.rank;
  const swing = first - last;
  const top = Math.max(1, Math.round(i.fieldSize * 0.25));

  if (i.me.rank === 1) {
    return {
      title: 'The Champion',
      emoji: '👑',
      line: 'You won. Everything else on this page is a footnote.',
    };
  }
  if (swing >= Math.max(3, Math.round(i.fieldSize * 0.35))) {
    return {
      title: 'The Late Bloomer',
      emoji: '🌄',
      line: `You started ${ordinal(first)} and finished ${ordinal(last)}. Nobody who saw matchday one saw this coming.`,
    };
  }
  if (swing <= -Math.max(3, Math.round(i.fieldSize * 0.35))) {
    return {
      title: 'The Slow Puncture',
      emoji: '🕳️',
      line: `You were ${ordinal(first)} once. You finished ${ordinal(last)}. It happened quietly, over weeks.`,
    };
  }
  if (i.champion?.correct && i.me.rank <= top) {
    return {
      title: 'The Oracle',
      emoji: '🔮',
      line: 'You called the champion and finished near the top. There is nothing to explain.',
    };
  }
  if ((i.chat?.sent ?? 0) === 0) {
    return {
      title: 'The Ghost',
      emoji: '👻',
      line: 'Not a single message all tournament. Whatever you were thinking, you kept it.',
    };
  }
  if ((i.chat?.sharePct ?? 0) >= 25 && i.me.rank > top) {
    return {
      title: 'The Pundit',
      emoji: '🎙️',
      line: `You produced ${i.chat?.sharePct}% of the group chat and finished ${ordinal(i.me.rank)}. Analysis is easy.`,
    };
  }
  if (i.predictions && i.predictions.made >= 20 && i.predictions.exact <= 2) {
    return {
      title: 'The Degenerate',
      emoji: '🎰',
      line: `${i.predictions.made} scorelines called. ${i.predictions.exact} landed. You kept pulling the lever.`,
    };
  }
  if (i.rideOrDie && i.rideOrDie.pts >= Math.max(20, i.me.bracketTotal * 0.35)) {
    return {
      title: 'The Loyalist',
      emoji: '🛡️',
      line: `${i.rideOrDie.team.flag} ${i.rideOrDie.team.name} carried ${i.rideOrDie.pts} of your points. That was the plan and it worked.`,
    };
  }
  if ((i.twin?.pct ?? 0) >= 70) {
    return {
      title: 'The Consensus',
      emoji: '📋',
      line: `Your bracket was ${i.twin?.pct}% identical to ${i.twin?.name}. Safe is a strategy.`,
    };
  }
  if (i.me.rank > i.fieldSize - Math.max(1, Math.round(i.fieldSize * 0.15))) {
    return {
      title: 'The Optimist',
      emoji: '🌤️',
      line: 'It did not work. You will be back in 2030 with the exact same energy.',
    };
  }
  return {
    title: 'The Realist',
    emoji: '⚖️',
    line: `${ordinal(i.me.rank)} of ${i.fieldSize}. No disasters, no miracles. A respectable tournament.`,
  };
}

// ---------------------------------------------------------------------------
// Pool recap
// ---------------------------------------------------------------------------

export interface PoolRecap {
  poolId: string;
  poolName: string;
  fieldSize: number;
  standings: Standing[];
  championTeam: TeamRef | null;
  totals: { points: number; messages: number; predictions: number; exactPredictions: number };
  championPicks: { team: TeamRef; count: number; pct: number; correct: boolean }[];
  believedIn: { team: TeamRef; count: number; pct: number; exitLabel: string; champion: boolean } | null;
  nobodySaw: { team: TeamRef; count: number; pct: number; exitLabel: string } | null;
  consensusWrong: { team: TeamRef; count: number; pct: number; promised: string; exitLabel: string } | null;
  biggestSwing: { label: string; movement: number; risers: { name: string; spots: number }[] } | null;
  reign: { holders: { name: string; label: string }[]; changes: number; longest: { name: string; spells: number } | null };
  chat: {
    total: number;
    leaders: { name: string; count: number }[];
    busiestDay: { day: string; count: number } | null;
    longest: { name: string; body: string } | null;
  } | null;
  predictionWall: {
    total: number;
    exact: number;
    easiest: { label: string; hits: number; of: number } | null;
    hardest: { label: string; attempts: number } | null;
  } | null;
  journeys: { name: string; ranks: (number | null)[]; isLeaderAtEnd: boolean }[];
  checkpointLabels: { label: string; short: string }[];
}

export async function loadPoolRecap(poolId: string): Promise<PoolRecap> {
  const ctx = await loadFinaleContext(poolId);
  const timeline = buildTimeline(ctx);
  const exits = buildExits(ctx);
  const field = ctx.standings.length;
  const pct = (n: number) => (field > 0 ? Math.round((n / field) * 100) : 0);

  // --- Champion picks ---
  const champCounts = new Map<string, number>();
  for (const b of ctx.poolBrackets) {
    const c = b.predictions.knockout.champion;
    if (c) champCounts.set(c, (champCounts.get(c) ?? 0) + 1);
  }
  const championPicks = [...champCounts.entries()]
    .map(([code, count]) => ({
      team: ctx.team(code)!,
      count,
      pct: pct(count),
      correct: ctx.facts.champion === code,
    }))
    .sort((a, b) => b.count - a.count);

  // --- How many brackets backed each team anywhere in the knockouts ---
  const backing = new Map<string, number>();
  for (const b of ctx.poolBrackets) {
    const seen = new Set<string>();
    for (const r of ['r16', 'qf', 'sf', 'final'] as const) {
      for (const code of b.predictions.knockout[r]) seen.add(code);
    }
    if (b.predictions.knockout.champion) seen.add(b.predictions.knockout.champion);
    for (const code of seen) backing.set(code, (backing.get(code) ?? 0) + 1);
  }

  const believedEntry = [...backing.entries()].sort((a, b) => b[1] - a[1])[0];
  const believedIn = believedEntry
    ? {
        team: ctx.team(believedEntry[0])!,
        count: believedEntry[1],
        pct: pct(believedEntry[1]),
        exitLabel: exits.get(believedEntry[0])?.label ?? 'the group stage',
        champion: exits.get(believedEntry[0])?.champion ?? false,
      }
    : null;

  // Least-backed team that still made the semi-finals, but ONLY when the
  // backing was genuinely thin. Taking the minimum unconditionally produced
  // nonsense like "nobody saw it coming" about a team 25 of 27 brackets had
  // picked; if every semi-finalist was well backed, the slide is simply wrong
  // and gets skipped.
  const UNDERDOG_MAX_PCT = 35;
  const semiFinalists = [...ctx.facts.reached.final, ...ctx.facts.reached.sf];
  let nobodySaw: PoolRecap['nobodySaw'] = null;
  for (const code of new Set(semiFinalists)) {
    const count = backing.get(code) ?? 0;
    if (pct(count) > UNDERDOG_MAX_PCT) continue;
    if (!nobodySaw || count < nobodySaw.count) {
      nobodySaw = {
        team: ctx.team(code)!,
        count,
        pct: pct(count),
        exitLabel: exits.get(code)?.label ?? 'the semi-finals',
      };
    }
  }

  // The pick the pool was most united behind that did not deliver.
  let consensusWrong: PoolRecap['consensusWrong'] = null;
  const finalBacking = new Map<string, number>();
  for (const b of ctx.poolBrackets) {
    for (const code of b.predictions.knockout.final) {
      finalBacking.set(code, (finalBacking.get(code) ?? 0) + 1);
    }
  }
  for (const [code, count] of [...finalBacking.entries()].sort((a, b) => b[1] - a[1])) {
    if (ctx.facts.reached.final.has(code)) continue;
    consensusWrong = {
      team: ctx.team(code)!,
      count,
      pct: pct(count),
      promised: 'the final',
      exitLabel: exits.get(code)?.label ?? 'the group stage',
    };
    break;
  }

  // --- Biggest standings shakeup between consecutive checkpoints ---
  let biggestSwing: PoolRecap['biggestSwing'] = null;
  for (let i = 1; i < timeline.length; i += 1) {
    let movement = 0;
    const risers: { name: string; spots: number }[] = [];
    for (const m of ctx.members) {
      const before = timeline[i - 1].byUser.get(m.userId);
      const after = timeline[i].byUser.get(m.userId);
      if (!before || !after) continue;
      const delta = before.rank - after.rank;
      movement += Math.abs(delta);
      if (delta > 0) risers.push({ name: m.name, spots: delta });
    }
    if (!biggestSwing || movement > biggestSwing.movement) {
      biggestSwing = {
        label: timeline[i].label,
        movement,
        risers: risers.sort((a, b) => b.spots - a.spots).slice(0, 3),
      };
    }
  }

  // --- Who held first place, and for how long ---
  const holders: { name: string; label: string }[] = [];
  const spells = new Map<string, number>();
  let changes = 0;
  let prevLeader: string | null = null;
  for (const c of timeline) {
    let leaderId: string | null = null;
    for (const [uid, v] of c.byUser) if (v.rank === 1) leaderId = uid;
    if (!leaderId) continue;
    const name = ctx.nameOf.get(leaderId) ?? 'Someone';
    holders.push({ name, label: c.short });
    spells.set(name, (spells.get(name) ?? 0) + 1);
    if (prevLeader && prevLeader !== leaderId) changes += 1;
    prevLeader = leaderId;
  }
  const longestEntry = [...spells.entries()].sort((a, b) => b[1] - a[1])[0];

  // --- Chat ---
  let chat: PoolRecap['chat'] = null;
  if (ctx.messageRows.length > 0) {
    const counts = new Map<string, number>();
    const days = new Map<string, number>();
    for (const m of ctx.messageRows) {
      counts.set(m.userId, (counts.get(m.userId) ?? 0) + 1);
      const day = m.createdAt.toISOString().slice(0, 10);
      days.set(day, (days.get(day) ?? 0) + 1);
    }
    const busiest = [...days.entries()].sort((a, b) => b[1] - a[1])[0];
    const longestMsg = ctx.messageRows.slice().sort((a, b) => b.body.length - a.body.length)[0];
    chat = {
      total: ctx.messageRows.length,
      leaders: [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([uid, count]) => ({ name: ctx.nameOf.get(uid) ?? 'Someone', count })),
      busiestDay: busiest ? { day: busiest[0], count: busiest[1] } : null,
      longest: longestMsg
        ? { name: ctx.nameOf.get(longestMsg.userId) ?? 'Someone', body: longestMsg.body }
        : null,
    };
  }

  // --- Score prediction wall ---
  let predictionWall: PoolRecap['predictionWall'] = null;
  const allPreds = [...ctx.predsByUser.values()].flat();
  if (allPreds.length > 0) {
    const byMatch = new Map<number, { hits: number; of: number }>();
    let exact = 0;
    for (const p of allPreds) {
      const m = ctx.matchById.get(p.matchId);
      if (!m || !isPlayed(m.status) || m.homeScore == null || m.awayScore == null) continue;
      const cur = byMatch.get(p.matchId) ?? { hits: 0, of: 0 };
      cur.of += 1;
      if (p.homeScore === m.homeScore && p.awayScore === m.awayScore) {
        cur.hits += 1;
        exact += 1;
      }
      byMatch.set(p.matchId, cur);
    }
    const labelFor = (id: number) => {
      const m = ctx.matchById.get(id);
      if (!m) return 'A match';
      const home = ctx.team(m.homeCode)?.name ?? 'Home';
      const away = ctx.team(m.awayCode)?.name ?? 'Away';
      return `${home} ${m.homeScore} - ${m.awayScore} ${away}`;
    };
    const entries = [...byMatch.entries()];
    const easiestEntry = entries.filter(([, v]) => v.hits > 0).sort((a, b) => b[1].hits - a[1].hits)[0];
    const hardestEntry = entries.filter(([, v]) => v.hits === 0).sort((a, b) => b[1].of - a[1].of)[0];
    predictionWall = {
      total: allPreds.length,
      exact,
      easiest: easiestEntry
        ? { label: labelFor(easiestEntry[0]), hits: easiestEntry[1].hits, of: easiestEntry[1].of }
        : null,
      hardest: hardestEntry ? { label: labelFor(hardestEntry[0]), attempts: hardestEntry[1].of } : null,
    };
  }

  const journeys = ctx.standings.map((s) => ({
    name: s.name,
    ranks: timeline.map((c) => c.byUser.get(s.userId)?.rank ?? null),
    isLeaderAtEnd: s.rank === 1,
  }));

  return {
    poolId,
    poolName: ctx.poolName,
    fieldSize: field,
    standings: ctx.standings,
    championTeam: ctx.championTeam,
    totals: {
      points: ctx.standings.reduce((s, r) => s + r.combined, 0),
      messages: ctx.messageRows.length,
      predictions: allPreds.length,
      exactPredictions: predictionWall?.exact ?? 0,
    },
    championPicks,
    believedIn,
    nobodySaw,
    consensusWrong,
    biggestSwing,
    reign: {
      holders,
      changes,
      longest: longestEntry ? { name: longestEntry[0], spells: longestEntry[1] } : null,
    },
    chat,
    predictionWall,
    journeys,
    checkpointLabels: timeline.map((c) => ({ label: c.label, short: c.short })),
  };
}

export { pluralise };
