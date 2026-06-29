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

// The actual finishing teams of a group, by rank, used for the exact-rank
// bonus (right team AND right position). For live (in-progress) groups only
// first/second are known; third/fourth stay null so the exact 3rd/4th bonus
// never fires provisionally.
export interface GroupOrder {
  first: string | null;
  second: string | null;
  third: string | null;
  fourth: string | null;
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
    }
    // Capture the exact finishing team for every rank 1-4 (exact-position bonus).
    if (row.rank != null && row.rank >= 1 && row.rank <= 4) {
      const order =
        exactByGroup.get(row.groupLetter) ??
        ({ first: null, second: null, third: null, fourth: null } as GroupOrder);
      if (row.rank === 1) order.first = row.teamCode;
      else if (row.rank === 2) order.second = row.teamCode;
      else if (row.rank === 3) order.third = row.teamCode;
      else if (row.rank === 4) order.fourth = row.teamCode;
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
    const order =
      liveExactByGroup.get(row.groupLetter) ??
      ({ first: null, second: null, third: null, fourth: null } as GroupOrder);
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

type GroupPick = { first?: string; second?: string; third?: string; fourth?: string } | undefined;

// Group points for one group's four picks:
//   - Advancement: any team you slotted in your top 3 (1st/2nd/3rd) that
//     actually finished in the top two earns the advance points, no matter
//     which lane you put it in. (Best-third advancement is scored separately
//     in scoreBracket since it can only resolve once every group is decided.)
//   - Exact-position bonus: +1 for each of the four slots where your pick
//     matches the team that finished in that exact rank. `order` carries the
//     actual finishers by rank; live groups only know 1st/2nd, so the exact
//     3rd/4th bonus never fires provisionally.
function groupPoints(g: GroupPick, actualTop2: Set<string>, order: GroupOrder | undefined): number {
  if (!g) return 0;
  let pts = 0;
  for (const pick of [g.first, g.second, g.third]) {
    if (pick && actualTop2.has(pick)) pts += SCORING.groupTop2;
  }
  if (g.first && order?.first === g.first) pts += SCORING.groupExactRank;
  if (g.second && order?.second === g.second) pts += SCORING.groupExactRank;
  if (g.third && order?.third === g.third) pts += SCORING.groupExactRank;
  if (g.fourth && order?.fourth === g.fourth) pts += SCORING.groupExactRank;
  return pts;
}

// Did this bracket predict `code` to advance from group `letter`? True when the
// team sits in any of the bracket's top three slots for that group (1st/2nd as
// a top-two pick, 3rd as a best-third hope) -- a 4th-place slot means you
// predicted it out.
function predictedToAdvance(g: GroupPick, code: string): boolean {
  return !!g && (g.first === code || g.second === code || g.third === code);
}

export function scoreBracket(p: Predictions, facts: Facts): Record<RoundKey, number> {
  const scores = Object.fromEntries(ROUND_KEYS.map((k) => [k, 0])) as Record<RoundKey, number>;

  for (const letter of facts.decidedGroups) {
    const g = p.groups[letter as (typeof GROUP_LETTERS)[number]];
    scores.groups += groupPoints(g, facts.top2ByGroup.get(letter) ?? new Set(), facts.exactByGroup.get(letter));
  }

  // Live (provisional) points: groups that have kicked off but are not yet
  // decided pay out on their current top-2 (plus the exact-rank bonus), so the
  // leaderboard moves during matches. These shift as scores change and lock in
  // when the group ends.
  for (const letter of facts.startedGroups) {
    const actual = facts.liveTop2ByGroup.get(letter);
    if (!actual) continue;
    const g = p.groups[letter as (typeof GROUP_LETTERS)[number]];
    scores.groups += groupPoints(g, actual, facts.liveExactByGroup.get(letter));
  }

  // Best-third advancement is a cross-group ranking, so it only pays out once
  // every group is decided. A team that qualifies as a best third earns the
  // points for any bracket that predicted it to advance (slotted it in the top
  // three of its group), regardless of the exact lane. No provisional points.
  if (facts.allGroupsDecided) {
    for (const letter of facts.decidedGroups) {
      const third = facts.exactByGroup.get(letter)?.third;
      if (!third || !facts.bestThirds.has(third)) continue;
      const g = p.groups[letter as (typeof GROUP_LETTERS)[number]];
      if (predictedToAdvance(g, third)) scores.thirdPlace += SCORING.thirdPlace;
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
    pts += groupPoints(g, actual, facts.liveExactByGroup.get(letter));
  }
  return pts;
}

// Maximum points a perfect bracket could have banked given how far the
// tournament has actually progressed. Used as the accuracy denominator.
export function attainablePoints(matchRows: MatchFact[], facts: Facts): number {
  const finalsInStage = (stage: string) =>
    matchRows.filter((m) => m.stage === stage && isFinal(m.status)).length;

  let total = 0;
  // Each decided group: at best both top-2 advancers banked (groupTop2 each)
  // AND all four positions nailed exactly (the exact-rank bonus on every slot).
  total += facts.decidedGroups.size * (2 * SCORING.groupTop2 + 4 * SCORING.groupExactRank);
  // In-progress groups pay their current provisional top two (1 or 2 teams,
  // whoever has actually played), each able to bank top-2 plus an exact bonus,
  // so the denominator tracks how many provisional units are live, or accuracy
  // could read above 100%.
  for (const g of facts.startedGroups) {
    total += (facts.liveTop2ByGroup.get(g)?.size ?? 0) * (SCORING.groupTop2 + SCORING.groupExactRank);
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
