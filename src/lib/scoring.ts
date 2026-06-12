// Advance-to-round scoring engine. Pure functions compute everything
// from persisted facts (match winners + group standings); the writer
// replaces each bracket's score rows wholesale, so re-running a sync
// never inflates points.

import { eq } from 'drizzle-orm';
import type { Predictions } from '@/types/bracket';
import {
  FINAL_STATUSES,
  GROUP_LETTERS,
  KNOCKOUT_ROUNDS,
  REACHED_BY_WINNING,
  ROUND_KEYS,
  SCORING,
  SCORING_BY_ROUND,
  THIRD_PLACE_PICKS,
  type KnockoutRoundKey,
  type RoundKey,
} from './constants';
import { computeLiveGroupTables } from './standings';

export interface MatchFact {
  stage: string;
  status: string;
  groupLetter: string | null;
  winnerCode: string | null;
  // Optional live score so the engine can build a provisional group table
  // from in-progress matches. Absent in older callers/tests, which then
  // simply contribute no live points.
  homeCode?: string | null;
  awayCode?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface StandingFact {
  groupLetter: string;
  teamCode: string;
  rank: number | null;
  isBestThird: boolean;
}

// The actual 1st- and 2nd-placed teams of a group, in order, used for the
// exact-rank bonus (right team AND right position).
export interface GroupOrder {
  first: string | null;
  second: string | null;
}

export interface Facts {
  decidedGroups: Set<string>;
  allGroupsDecided: boolean;
  top2ByGroup: Map<string, Set<string>>;
  // Ordered top two per decided group (rank 1, rank 2) for the exact-rank bonus.
  exactByGroup: Map<string, GroupOrder>;
  bestThirds: Set<string>;
  reached: Record<KnockoutRoundKey, Set<string>>;
  champion: string | null;
  // Live (provisional) group stage: groups that have kicked off but are not
  // yet decided, with their current top-2 derived from live match scores.
  // These pay out provisionally and harden once the group finishes.
  startedGroups: Set<string>;
  liveTop2ByGroup: Map<string, Set<string>>;
  // Ordered live top two (rank 1, rank 2) for the provisional exact-rank bonus.
  liveExactByGroup: Map<string, GroupOrder>;
}

const isFinal = (status: string) =>
  (FINAL_STATUSES as readonly string[]).includes(status);

export function buildFacts(matchRows: MatchFact[], standingRows: StandingFact[]): Facts {
  // A group is decided once all 6 of its matches are final.
  const decidedGroups = new Set<string>();
  for (const letter of GROUP_LETTERS) {
    const groupMatches = matchRows.filter(
      (m) => m.stage === 'group' && m.groupLetter === letter,
    );
    if (groupMatches.length === 6 && groupMatches.every((m) => isFinal(m.status))) {
      decidedGroups.add(letter);
    }
  }

  const top2ByGroup = new Map<string, Set<string>>();
  const exactByGroup = new Map<string, GroupOrder>();
  const bestThirds = new Set<string>();
  for (const row of standingRows) {
    if (row.rank === 1 || row.rank === 2) {
      if (!top2ByGroup.has(row.groupLetter)) top2ByGroup.set(row.groupLetter, new Set());
      top2ByGroup.get(row.groupLetter)!.add(row.teamCode);
      const order = exactByGroup.get(row.groupLetter) ?? { first: null, second: null };
      if (row.rank === 1) order.first = row.teamCode;
      else order.second = row.teamCode;
      exactByGroup.set(row.groupLetter, order);
    }
    if (row.isBestThird) bestThirds.add(row.teamCode);
  }

  // A team reaches a picked round by winning its match in the prior stage.
  const reached: Record<KnockoutRoundKey, Set<string>> = {
    r16: new Set(),
    qf: new Set(),
    sf: new Set(),
    final: new Set(),
  };
  let champion: string | null = null;
  for (const m of matchRows) {
    if (!m.winnerCode || !isFinal(m.status)) continue;
    for (const round of KNOCKOUT_ROUNDS) {
      if (m.stage === REACHED_BY_WINNING[round]) reached[round].add(m.winnerCode);
    }
    if (m.stage === 'final') champion = m.winnerCode;
  }

  // Live group points: as soon as a group kicks off, award the current top
  // TWO of the live table -- both the leader and the runner-up -- matching
  // the final scoring where the top two advance, since the bracket pays for
  // guessing both 1st and 2nd. The table is built from match scores (the
  // provider's own standings only refresh at full time), so points move on
  // every goal. A side that has not yet played can sit in a top-two slot on
  // zero stats, so computeLiveGroupTables excludes it from `advanced` until
  // it kicks off. Decided groups pay the full, final top 2 (see scoreBracket).
  const COUNTED_STATUS = new Set(['live', 'ht', 'ft', 'et', 'pens']);
  const startedSet = new Set<string>();
  for (const m of matchRows) {
    if (m.stage === 'group' && m.groupLetter && COUNTED_STATUS.has(m.status)) {
      startedSet.add(m.groupLetter);
    }
  }
  const startedGroups = new Set([...startedSet].filter((g) => !decidedGroups.has(g)));
  const liveTop2ByGroup = new Map<string, Set<string>>();
  const liveExactByGroup = new Map<string, GroupOrder>();
  for (const row of computeLiveGroupTables(matchRows)) {
    if (!row.advanced || !startedGroups.has(row.groupLetter)) continue;
    if (!liveTop2ByGroup.has(row.groupLetter)) liveTop2ByGroup.set(row.groupLetter, new Set());
    liveTop2ByGroup.get(row.groupLetter)!.add(row.teamCode);
    const order = liveExactByGroup.get(row.groupLetter) ?? { first: null, second: null };
    if (row.rank === 1) order.first = row.teamCode;
    else if (row.rank === 2) order.second = row.teamCode;
    liveExactByGroup.set(row.groupLetter, order);
  }

  return {
    decidedGroups,
    allGroupsDecided: decidedGroups.size === GROUP_LETTERS.length,
    top2ByGroup,
    exactByGroup,
    bestThirds,
    reached,
    champion,
    startedGroups,
    liveTop2ByGroup,
    liveExactByGroup,
  };
}

// Group points for a pair of picks: the order-free top-2 advance points (per
// team that actually lands in the top two) plus an exact-rank bonus when a
// pick also matches the position it was slotted into (your 1st pick is the
// actual 1st, your 2nd pick is the actual 2nd).
function groupPoints(
  first: string | undefined,
  second: string | undefined,
  actual: Set<string>,
  order: GroupOrder | undefined,
): number {
  let pts = 0;
  if (first && actual.has(first)) {
    pts += SCORING.groupTop2;
    if (order?.first === first) pts += SCORING.groupExactRank;
  }
  if (second && actual.has(second)) {
    pts += SCORING.groupTop2;
    if (order?.second === second) pts += SCORING.groupExactRank;
  }
  return pts;
}

export function scoreBracket(p: Predictions, facts: Facts): Record<RoundKey, number> {
  const scores = Object.fromEntries(ROUND_KEYS.map((k) => [k, 0])) as Record<RoundKey, number>;

  for (const letter of facts.decidedGroups) {
    const actual = facts.top2ByGroup.get(letter);
    if (!actual) continue;
    const g = p.groups[letter as (typeof GROUP_LETTERS)[number]];
    scores.groups += groupPoints(g?.first, g?.second, actual, facts.exactByGroup.get(letter));
  }

  // Live (provisional) points: groups that have kicked off but are not yet
  // decided pay out on their current top-2 (plus the exact-rank bonus), so the
  // leaderboard moves during matches. These shift as scores change and lock in
  // when the group ends.
  for (const letter of facts.startedGroups) {
    const actual = facts.liveTop2ByGroup.get(letter);
    if (!actual) continue;
    const g = p.groups[letter as (typeof GROUP_LETTERS)[number]];
    scores.groups += groupPoints(g?.first, g?.second, actual, facts.liveExactByGroup.get(letter));
  }

  // Best-thirds is a cross-group ranking, so it only pays out once every
  // group is decided. No provisional points.
  if (facts.allGroupsDecided) {
    for (const pick of p.thirdPlace) {
      if (facts.bestThirds.has(pick)) scores.thirdPlace += SCORING.thirdPlace;
    }
  }

  for (const round of KNOCKOUT_ROUNDS) {
    for (const pick of p.knockout[round]) {
      if (facts.reached[round].has(pick)) scores[round] += SCORING_BY_ROUND[round];
    }
  }

  if (facts.champion && p.knockout.champion === facts.champion) {
    scores.champion = SCORING.champion;
  }

  return scores;
}

export function totalOf(scores: Record<RoundKey, number>): number {
  return ROUND_KEYS.reduce((sum, k) => sum + scores[k], 0);
}

// The portion of a bracket's points that is still provisional: group points
// from groups that have kicked off but not finished. Used to badge "live"
// points in the UI. Already included in scoreBracket's total.
export function provisionalPoints(p: Predictions, facts: Facts): number {
  let pts = 0;
  for (const letter of facts.startedGroups) {
    const actual = facts.liveTop2ByGroup.get(letter);
    if (!actual) continue;
    const g = p.groups[letter as (typeof GROUP_LETTERS)[number]];
    pts += groupPoints(g?.first, g?.second, actual, facts.liveExactByGroup.get(letter));
  }
  return pts;
}

// Maximum points a perfect bracket could have banked given how far the
// tournament has actually progressed. Used as the accuracy denominator.
export function attainablePoints(matchRows: MatchFact[], facts: Facts): number {
  const finalsInStage = (stage: string) =>
    matchRows.filter((m) => m.stage === stage && isFinal(m.status)).length;

  let total = 0;
  // Each decided group: at best both top-2 picks correct AND both in the exact
  // spot, so each of the two slots can bank top-2 plus the exact-rank bonus.
  const perGroupSlot = SCORING.groupTop2 + SCORING.groupExactRank;
  total += facts.decidedGroups.size * 2 * perGroupSlot;
  // In-progress groups pay their current provisional top two (1 or 2 teams,
  // whoever has actually played), each able to bank top-2 plus the bonus, so
  // the denominator tracks how many provisional units are live, or accuracy
  // could read above 100%.
  for (const g of facts.startedGroups) {
    total += (facts.liveTop2ByGroup.get(g)?.size ?? 0) * perGroupSlot;
  }
  // Best-thirds only resolve once every group is in.
  if (facts.allGroupsDecided) total += SCORING.thirdPlace * THIRD_PLACE_PICKS;
  // Each completed knockout match yields one advancer worth the round weight.
  total += finalsInStage('r32') * SCORING.reachR16;
  total += finalsInStage('r16') * SCORING.reachQF;
  total += finalsInStage('qf') * SCORING.reachSF;
  total += finalsInStage('sf') * SCORING.reachFinal;
  total += finalsInStage('final') * SCORING.champion;
  return total;
}

// Recomputes and replaces every bracket's scores. Idempotent.
export async function rescoreAll(): Promise<void> {
  const { db } = await import('./db');
  const { brackets, bracketScores, groupStandings, matches } = await import('./schema');

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
  const allBrackets = await db.select().from(brackets);

  for (const b of allBrackets) {
    const scores = scoreBracket(b.predictions, facts);
    await db.delete(bracketScores).where(eq(bracketScores.bracketId, b.id));
    await db.insert(bracketScores).values(
      ROUND_KEYS.map((roundKey) => ({ bracketId: b.id, roundKey, points: scores[roundKey] })),
    );
    await db
      .update(brackets)
      .set({ totalPoints: totalOf(scores) })
      .where(eq(brackets.id, b.id));
  }
}
