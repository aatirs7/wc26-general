// Loads and computes everything the end-of-tournament finale needs for one
// pool: the final standings, the podium, per-pool superlative awards, and the
// viewing player's personal recap. All derived from the same persisted facts
// and score rows the leaderboard uses, so the numbers always agree.

import { eq, inArray } from 'drizzle-orm';
import { db } from './db';
import {
  brackets,
  bracketScores,
  groupStandings,
  matchPredictions,
  matches,
  poolMembers,
  pools,
  standingSnapshots,
  teams,
  users,
} from './schema';
import { ROUND_KEYS, type RoundKey } from './constants';
import { ROOT_ID } from './knockout-bracket';
import { attainablePoints, buildFacts } from './scoring';
import { computeLiveGroupTables } from './standings';
import { pointsBreakdown } from './points-breakdown';
import { computeBadges } from './achievements';

export interface ResultPlayer {
  ownerId: string;
  name: string;
  bracketName: string;
  bracketId: string | null;
  combined: number;
  bracketTotal: number;
  bonus: number;
  accuracy: number | null;
  koPoints: number;
  groupPoints: number;
  championPick: { code: string; name: string; flag: string } | null;
  rank: number;
  submitted: boolean;
}

export interface Award {
  key: string;
  title: string;
  emoji: string;
  blurb: string;
  winnerName: string | null;
  detail: string;
}

export interface ResultsData {
  poolName: string;
  championTeam: { code: string; name: string; flag: string } | null;
  podium: ResultPlayer[];
  standings: ResultPlayer[];
  awards: Award[];
  viewer: {
    player: ResultPlayer;
    badges: { title: string; desc: string }[];
    rounds: { label: string; pts: number }[];
    bestPick: { label: string; pts: number } | null;
  } | null;
}

const ROUND_LABELS: Record<RoundKey, string> = {
  groups: 'Group finishes',
  thirdPlace: 'Best thirds',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  final: 'Final',
  champion: 'Champion',
};

const KO_ROUNDS: RoundKey[] = ['r16', 'qf', 'sf', 'final', 'champion'];

export async function loadResults(poolId: string, viewerId: string | null): Promise<ResultsData> {
  const [pool] = await db.select().from(pools).where(eq(pools.id, poolId)).limit(1);

  const members = await db
    .select({ userId: poolMembers.userId, displayName: users.displayName })
    .from(poolMembers)
    .innerJoin(users, eq(users.id, poolMembers.userId))
    .where(eq(poolMembers.poolId, poolId));
  const memberIds = members.map((m) => m.userId);

  const poolBrackets = await db.select().from(brackets).where(eq(brackets.poolId, poolId));
  const bracketByOwner = new Map(poolBrackets.map((b) => [b.ownerId, b]));

  const matchRows = await db
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

  const teamRows = await db.select({ code: teams.code, name: teams.name, flag: teams.flag }).from(teams);
  const teamByCode = new Map(teamRows.map((t) => [t.code, t]));
  const team = (code: string | null | undefined) =>
    code ? { code, name: teamByCode.get(code)?.name ?? code, flag: teamByCode.get(code)?.flag ?? '⚽' } : null;

  // Live group ranks so the breakdown text lines up with the Groups view.
  const rankByKey = new Map<string, number>();
  for (const r of computeLiveGroupTables(matchRows)) rankByKey.set(`${r.groupLetter}:${r.teamCode}`, r.rank);
  const rankOf = (group: string, code: string) => rankByKey.get(`${group}:${code}`) ?? null;

  // Per-round scores, and champion+final tiebreak, by bracket.
  const scoreRows = poolBrackets.length
    ? await db.select().from(bracketScores).where(inArray(bracketScores.bracketId, poolBrackets.map((b) => b.id)))
    : [];
  const roundsByBracket = new Map<string, Record<RoundKey, number>>();
  for (const s of scoreRows) {
    const m = roundsByBracket.get(s.bracketId) ?? (Object.fromEntries(ROUND_KEYS.map((k) => [k, 0])) as Record<RoundKey, number>);
    m[s.roundKey as RoundKey] = s.points;
    roundsByBracket.set(s.bracketId, m);
  }

  // Score-prediction bonus per user.
  const predRows = memberIds.length
    ? await db
        .select({ userId: matchPredictions.userId, points: matchPredictions.points })
        .from(matchPredictions)
        .where(inArray(matchPredictions.userId, memberIds))
    : [];
  const bonusByUser = new Map<string, number>();
  for (const p of predRows) bonusByUser.set(p.userId, (bonusByUser.get(p.userId) ?? 0) + p.points);

  // Baseline snapshot rank (for best-effort "biggest riser").
  const snaps = await db
    .select({ userId: standingSnapshots.userId, rank: standingSnapshots.rank })
    .from(standingSnapshots)
    .where(eq(standingSnapshots.poolId, poolId));
  const snapRankByUser = new Map(snaps.map((s) => [s.userId, s.rank]));

  // How many players share each champion pick (for Lone Wolf and badges).
  const championCounts = new Map<string, number>();
  for (const b of poolBrackets) {
    const c = b.predictions.knockout.champion;
    if (c) championCounts.set(c, (championCounts.get(c) ?? 0) + 1);
  }

  type Row = ResultPlayer & { tiebreak: number; lockedAtMs: number };
  const rows: Row[] = members.map((m) => {
    const b = bracketByOwner.get(m.userId);
    const roundMap = b ? roundsByBracket.get(b.id) : undefined;
    const bracketTotal = b?.totalPoints ?? 0;
    const bonus = bonusByUser.get(m.userId) ?? 0;
    const koPoints = KO_ROUNDS.reduce((s, k) => s + (roundMap?.[k] ?? 0), 0);
    const tiebreak = (roundMap?.final ?? 0) + (roundMap?.champion ?? 0);
    return {
      ownerId: m.userId,
      name: m.displayName,
      bracketName: b?.name ?? '—',
      bracketId: b?.id ?? null,
      bracketTotal,
      bonus,
      combined: bracketTotal + bonus,
      accuracy: attainable > 0 ? Math.min(100, Math.round((bracketTotal / attainable) * 100)) : null,
      koPoints,
      groupPoints: roundMap?.groups ?? 0,
      championPick: team(b?.predictions.knockout.champion),
      rank: 0,
      submitted: b?.submitted ?? false,
      tiebreak,
      lockedAtMs: b?.lockedAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
    };
  });

  // Same comparator as the leaderboard, so the podium matches the standings.
  rows.sort((a, b) => {
    if (b.combined !== a.combined) return b.combined - a.combined;
    if (b.bonus !== a.bonus) return b.bonus - a.bonus;
    if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
    if (b.tiebreak !== a.tiebreak) return b.tiebreak - a.tiebreak;
    return a.lockedAtMs - b.lockedAtMs;
  });
  rows.forEach((r, i) => (r.rank = i + 1));

  // Row extends ResultPlayer, so this is a widening assignment.
  const standings: ResultPlayer[] = rows;
  const podium = standings.slice(0, 3);

  const championTeam = team(matchRows.find((m) => m.id === ROOT_ID)?.winnerCode ?? null);

  // --- Superlative awards -------------------------------------------------
  const awards: Award[] = [];
  const pushMax = (
    key: string,
    title: string,
    emoji: string,
    blurb: string,
    value: (r: ResultPlayer) => number | null,
    detail: (r: ResultPlayer, v: number) => string,
    minValue = 1,
  ) => {
    let best: ResultPlayer | null = null;
    let bestV = -Infinity;
    for (const r of standings) {
      const v = value(r);
      if (v == null || v < minValue) continue;
      if (v > bestV) {
        bestV = v;
        best = r;
      }
    }
    awards.push({
      key,
      title,
      emoji,
      blurb,
      winnerName: best?.name ?? null,
      detail: best ? detail(best, bestV) : 'Not decided',
    });
  };

  pushMax('oracle', 'The Oracle', '🔮', 'Most accurate bracket in the pool.', (r) => r.accuracy, (_r, v) => `${v}% accurate`);
  pushMax('deep-run', 'Deep-Run King', '🏰', 'Rode teams the furthest through the knockouts.', (r) => r.koPoints, (_r, v) => `${v} knockout pts`);
  pushMax('prediction-king', 'Prediction King', '🎯', 'Called the most exact scorelines.', (r) => r.bonus, (_r, v) => `${v} prediction pts`);
  pushMax('group-guru', 'Group Stage Guru', '📋', 'Owned the group stage.', (r) => r.groupPoints, (_r, v) => `${v} group pts`);

  // Lone Wolf: highest-ranked player who backed a champion nobody else did.
  const wolf = standings.find((r) => r.championPick && (championCounts.get(r.championPick.code) ?? 0) === 1);
  awards.push({
    key: 'lone-wolf',
    title: 'Lone Wolf',
    emoji: '🐺',
    blurb: 'Backed a champion no one else dared to.',
    winnerName: wolf?.name ?? null,
    detail: wolf?.championPick ? `Solo on ${wolf.championPick.flag} ${wolf.championPick.name}` : 'Everyone doubled up',
  });

  // Biggest Riser: best climb from the baseline snapshot rank (best-effort).
  let riser: ResultPlayer | null = null;
  let riserGain = 0;
  for (const r of standings) {
    const base = snapRankByUser.get(r.ownerId);
    if (base == null) continue;
    const gain = base - r.rank;
    if (gain > riserGain) {
      riserGain = gain;
      riser = r;
    }
  }
  if (riser) {
    awards.push({
      key: 'riser',
      title: 'Biggest Riser',
      emoji: '📈',
      blurb: 'Climbed the standings hardest down the stretch.',
      winnerName: riser.name,
      detail: `Up ${riserGain} spot${riserGain === 1 ? '' : 's'}`,
    });
  }

  // Wooden Spoon: dead last (playful).
  const last = standings[standings.length - 1];
  if (last && standings.length > 3) {
    awards.push({
      key: 'wooden-spoon',
      title: 'Wooden Spoon',
      emoji: '🥄',
      blurb: 'Someone has to hold it. Better luck in 2030.',
      winnerName: last.name,
      detail: `${last.combined} pts, ${last.rank}${last.rank === standings.length ? ' (last)' : ''}`,
    });
  }

  // --- Viewer recap -------------------------------------------------------
  let viewer: ResultsData['viewer'] = null;
  const mePlayer = standings.find((r) => r.ownerId === viewerId) ?? null;
  if (mePlayer) {
    const b = bracketByOwner.get(mePlayer.ownerId);
    const roundMap = b ? roundsByBracket.get(b.id) : undefined;
    const rounds = ROUND_KEYS.map((k) => ({ label: ROUND_LABELS[k], pts: roundMap?.[k] ?? 0 })).filter((r) => r.pts > 0);

    let badges: { title: string; desc: string }[] = [];
    let bestPick: { label: string; pts: number } | null = null;
    if (b) {
      const champ = b.predictions.knockout.champion;
      const loneWolfChampion = !!champ && (championCounts.get(champ) ?? 0) === 1;
      badges = computeBadges({
        predictions: b.predictions,
        scores: roundMap ?? (Object.fromEntries(ROUND_KEYS.map((k) => [k, 0])) as Record<RoundKey, number>),
        facts,
        totalPoints: mePlayer.bracketTotal,
        rank: mePlayer.rank,
        fieldSize: standings.length,
        loneWolfChampion,
      })
        .filter((bd) => bd.earned)
        .map((bd) => ({ title: bd.title, desc: bd.desc }));

      const lines = pointsBreakdown(b.predictions, facts, rankOf, (code) => ({
        name: teamByCode.get(code)?.name ?? code,
        flag: teamByCode.get(code)?.flag ?? '⚽',
      }));
      const top = lines.filter((l) => l.pts > 0).sort((a, c) => c.pts - a.pts)[0];
      if (top) bestPick = { label: `${top.flag} ${top.name}, ${top.reason}`, pts: top.pts };
    }

    viewer = { player: mePlayer, badges, rounds, bestPick };
  }

  return {
    poolName: pool?.name ?? 'Pool',
    championTeam,
    podium,
    standings,
    awards,
    viewer,
  };
}
