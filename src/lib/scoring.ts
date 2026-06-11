// Advance-to-round scoring engine. Pure functions compute everything
// from persisted facts (match winners + group standings); the writer
// replaces each bracket's score rows wholesale, so re-running a sync
// never inflates points.

import { eq } from 'drizzle-orm';
import type { Predictions } from '@/types/bracket';
import { computeLiveStandings } from './standings';
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

export interface Facts {
  decidedGroups: Set<string>;
  allGroupsDecided: boolean;
  top2ByGroup: Map<string, Set<string>>;
  bestThirds: Set<string>;
  reached: Record<KnockoutRoundKey, Set<string>>;
  champion: string | null;
  // Live (provisional) group stage: groups that have kicked off but are not
  // yet decided, with their current top-2 derived from live match scores.
  // These pay out provisionally and harden once the group finishes.
  startedGroups: Set<string>;
  liveTop2ByGroup: Map<string, Set<string>>;
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
  const bestThirds = new Set<string>();
  for (const row of standingRows) {
    if (row.rank === 1 || row.rank === 2) {
      if (!top2ByGroup.has(row.groupLetter)) top2ByGroup.set(row.groupLetter, new Set());
      top2ByGroup.get(row.groupLetter)!.add(row.teamCode);
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

  // Live group tables from the match scores (counts in-progress games), so
  // a group that has kicked off but not finished still produces a current
  // top-2. Decided groups keep using the provider's authoritative table.
  const liveRows = computeLiveStandings(matchRows);
  const liveTop2ByGroup = new Map<string, Set<string>>();
  const liveGroups = new Set<string>();
  for (const r of liveRows) {
    liveGroups.add(r.groupLetter);
    if (r.rank === 1 || r.rank === 2) {
      if (!liveTop2ByGroup.has(r.groupLetter)) liveTop2ByGroup.set(r.groupLetter, new Set());
      liveTop2ByGroup.get(r.groupLetter)!.add(r.teamCode);
    }
  }
  const startedGroups = new Set([...liveGroups].filter((g) => !decidedGroups.has(g)));

  return {
    decidedGroups,
    allGroupsDecided: decidedGroups.size === GROUP_LETTERS.length,
    top2ByGroup,
    bestThirds,
    reached,
    champion,
    startedGroups,
    liveTop2ByGroup,
  };
}

export function scoreBracket(p: Predictions, facts: Facts): Record<RoundKey, number> {
  const scores = Object.fromEntries(ROUND_KEYS.map((k) => [k, 0])) as Record<RoundKey, number>;

  for (const letter of facts.decidedGroups) {
    const actual = facts.top2ByGroup.get(letter);
    if (!actual) continue;
    const g = p.groups[letter as (typeof GROUP_LETTERS)[number]];
    for (const pick of [g?.first, g?.second]) {
      if (pick && actual.has(pick)) scores.groups += SCORING.groupTop2;
    }
  }

  // Live (provisional) points: groups that have kicked off but are not yet
  // decided pay out on their current top-2, so the leaderboard moves during
  // matches. These shift as scores change and lock in when the group ends.
  for (const letter of facts.startedGroups) {
    const actual = facts.liveTop2ByGroup.get(letter);
    if (!actual) continue;
    const g = p.groups[letter as (typeof GROUP_LETTERS)[number]];
    for (const pick of [g?.first, g?.second]) {
      if (pick && actual.has(pick)) scores.groups += SCORING.groupTop2;
    }
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
    for (const pick of [g?.first, g?.second]) {
      if (pick && actual.has(pick)) pts += SCORING.groupTop2;
    }
  }
  return pts;
}

// Maximum points a perfect bracket could have banked given how far the
// tournament has actually progressed. Used as the accuracy denominator.
export function attainablePoints(matchRows: MatchFact[], facts: Facts): number {
  const finalsInStage = (stage: string) =>
    matchRows.filter((m) => m.stage === stage && isFinal(m.status)).length;

  let total = 0;
  // Each decided group: at best both top-2 picks correct.
  total += facts.decidedGroups.size * (SCORING.groupTop2 * 2);
  // In-progress groups pay provisional top-2 points, so count them too or
  // accuracy could read above 100% while a group is live.
  total += facts.startedGroups.size * (SCORING.groupTop2 * 2);
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
