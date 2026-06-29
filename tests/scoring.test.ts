import { describe, expect, it } from 'vitest';
import {
  buildFacts,
  provisionalPoints,
  scoreBracket,
  totalOf,
  type MatchFact,
  type StandingFact,
} from '@/lib/scoring';
import { deriveAdvancement, type StandingInput } from '@/lib/standings';
import { emptyPredictions, type Predictions } from '@/types/bracket';
import { GROUP_LETTERS } from '@/lib/constants';

// Synthetic codes: group X has teams XAX (1st), XBX (2nd), XCX (3rd), XDX (4th).
const T = (letter: string, n: number) => `${letter}${'ABCD'[n]}X`;

function decidedGroupMatches(letters: readonly string[]): MatchFact[] {
  return letters.flatMap((letter) =>
    Array.from({ length: 6 }, () => ({
      stage: 'group',
      status: 'ft',
      groupLetter: letter,
      winnerCode: null,
    })),
  );
}

function fullStandings(bestThirdLetters: string[]): StandingFact[] {
  return GROUP_LETTERS.flatMap((letter) =>
    [0, 1, 2, 3].map((n) => ({
      groupLetter: letter,
      teamCode: T(letter, n),
      rank: n + 1,
      isBestThird: n === 2 && bestThirdLetters.includes(letter),
    })),
  );
}

function fullBracket(): Predictions {
  const p = emptyPredictions();
  for (const letter of GROUP_LETTERS) {
    p.groups[letter] = {
      first: T(letter, 0),
      second: T(letter, 1),
      third: T(letter, 2),
      fourth: T(letter, 3),
    };
  }
  p.thirdPlace = GROUP_LETTERS.slice(0, 8).map((l) => T(l, 2));
  const qualifiers = [
    ...GROUP_LETTERS.flatMap((l) => [T(l, 0), T(l, 1)]),
    ...p.thirdPlace,
  ];
  p.knockout.r16 = qualifiers.slice(0, 16);
  p.knockout.qf = p.knockout.r16.slice(0, 8);
  p.knockout.sf = p.knockout.qf.slice(0, 4);
  p.knockout.final = p.knockout.sf.slice(0, 2);
  p.knockout.champion = p.knockout.final[0];
  return p;
}

describe('buildFacts', () => {
  it('marks a group decided only when all 6 matches are final', () => {
    const five = decidedGroupMatches(['A']).slice(0, 5);
    const live: MatchFact = { stage: 'group', status: 'live', groupLetter: 'A', winnerCode: null };
    expect(buildFacts([...five, live], []).decidedGroups.has('A')).toBe(false);
    expect(buildFacts(decidedGroupMatches(['A']), []).decidedGroups.has('A')).toBe(true);
  });

  it('derives reached sets from prior-stage winners', () => {
    const facts = buildFacts(
      [
        { stage: 'r32', status: 'ft', groupLetter: null, winnerCode: 'AAX' },
        { stage: 'r32', status: 'pens', groupLetter: null, winnerCode: 'BAX' },
        { stage: 'r32', status: 'live', groupLetter: null, winnerCode: null },
        { stage: 'r16', status: 'et', groupLetter: null, winnerCode: 'AAX' },
        { stage: 'qf', status: 'ft', groupLetter: null, winnerCode: 'AAX' },
        { stage: 'sf', status: 'ft', groupLetter: null, winnerCode: 'AAX' },
        { stage: 'third', status: 'ft', groupLetter: null, winnerCode: 'CAX' },
        { stage: 'final', status: 'pens', groupLetter: null, winnerCode: 'AAX' },
      ],
      [],
    );
    expect([...facts.reached.r16].sort()).toEqual(['AAX', 'BAX']);
    expect([...facts.reached.qf]).toEqual(['AAX']);
    expect([...facts.reached.sf]).toEqual(['AAX']);
    expect([...facts.reached.final]).toEqual(['AAX']);
    expect(facts.champion).toBe('AAX');
  });
});

describe('scoreBracket', () => {
  it('scores nothing before any group is decided', () => {
    const facts = buildFacts([], fullStandings([]));
    const scores = scoreBracket(fullBracket(), facts);
    expect(totalOf(scores)).toBe(0);
  });

  it('scores decided groups: advance points plus exact-position bonuses', () => {
    // Group A ranked perfectly (1-2-3-4): 2 advancers * 3 + 4 exact spots = 10.
    // Group B has the right top two but with 1st/2nd swapped and no 3rd/4th:
    // 2 advancers * 3, no exact bonus = 6.
    const facts = buildFacts(decidedGroupMatches(['A', 'B']), fullStandings([]));
    const p = fullBracket();
    p.groups.B = { first: T('B', 1), second: T('B', 0) };
    const scores = scoreBracket(p, facts);
    expect(scores.groups).toBe(10 + 6);
    expect(scores.thirdPlace).toBe(0);
  });

  it('awards advancement no matter which lane you slotted the team in', () => {
    // Group B actual: 1st BAX, 2nd BBX, 3rd BCX (best third), 4th BDX.
    // Bracket swaps lanes like Alyaan did: 2nd and 3rd flipped.
    const facts = buildFacts(decidedGroupMatches(GROUP_LETTERS), fullStandings(['B']));
    const p = emptyPredictions(); // only group B picked, so only B scores
    p.groups.B = { first: T('B', 0), second: T('B', 2), third: T('B', 1), fourth: T('B', 3) };
    const scores = scoreBracket(p, facts);
    // BAX (1st) advances, slotted 1st: +3 advance +1 exact.
    // BBX (2nd) advances, slotted 3rd: +3 advance (no exact).
    // BCX (3rd, best third) qualifies, slotted 2nd: +2 best-third (no exact).
    // BDX (4th) slotted 4th: +1 exact.
    // groups = 3+1 + 3 + 1(BDX exact) = 8 ; thirdPlace = 2.
    expect(scores.groups).toBe(8);
    expect(scores.thirdPlace).toBe(2);
  });

  it('pays an exact 3rd/4th bonus even when the team does not advance', () => {
    // No best thirds, so the 3rd-placed team does not qualify; the only points
    // are the exact-position bonuses for nailing 3rd and 4th.
    const facts = buildFacts(decidedGroupMatches(['A']), fullStandings([]));
    const p = emptyPredictions();
    // Only 3rd and 4th picked, both exactly right; no top-two picks at all.
    p.groups.A = { third: T('A', 2), fourth: T('A', 3) };
    const scores = scoreBracket(p, facts);
    expect(scores.groups).toBe(2); // exact 3rd + exact 4th
    expect(scores.thirdPlace).toBe(0);
  });

  it('pays third-place picks only when all 12 groups are decided', () => {
    const p = fullBracket();
    const someDecided = buildFacts(
      decidedGroupMatches(['A', 'B', 'C']),
      fullStandings(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
    );
    expect(scoreBracket(p, someDecided).thirdPlace).toBe(0);

    const allDecided = buildFacts(
      decidedGroupMatches(GROUP_LETTERS),
      fullStandings(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
    );
    // All 8 third-place picks correct: 8 * 2
    expect(scoreBracket(p, allDecided).thirdPlace).toBe(16);
  });

  it('awards knockout round weights per team that actually reached', () => {
    const p = fullBracket();
    const aTop = T('A', 0);
    const bTop = T('B', 0);
    const facts = buildFacts(
      [
        { stage: 'r32', status: 'ft', groupLetter: null, winnerCode: aTop },
        { stage: 'r32', status: 'ft', groupLetter: null, winnerCode: bTop },
        { stage: 'r16', status: 'ft', groupLetter: null, winnerCode: aTop },
        { stage: 'qf', status: 'ft', groupLetter: null, winnerCode: aTop },
        { stage: 'sf', status: 'ft', groupLetter: null, winnerCode: aTop },
        { stage: 'final', status: 'ft', groupLetter: null, winnerCode: aTop },
      ],
      [],
    );
    const scores = scoreBracket(p, facts);
    // aTop and bTop reached r16 (5 each), aTop alone progressed further.
    expect(scores.r16).toBe(10);
    expect(scores.qf).toBe(8);
    expect(scores.sf).toBe(12);
    expect(scores.final).toBe(18);
    expect(scores.champion).toBe(30);
    expect(totalOf(scores)).toBe(10 + 8 + 12 + 18 + 30);
  });

  it('gives no champion bonus when the predicted champion lost the final', () => {
    const p = fullBracket();
    const facts = buildFacts(
      [{ stage: 'final', status: 'ft', groupLetter: null, winnerCode: T('B', 0) }],
      [],
    );
    expect(scoreBracket(p, facts).champion).toBe(0);
  });

  it('is deterministic: same inputs, same scores', () => {
    const p = fullBracket();
    const matches: MatchFact[] = [
      ...decidedGroupMatches(GROUP_LETTERS),
      { stage: 'r32', status: 'ft', groupLetter: null, winnerCode: T('A', 0) },
    ];
    const standings = fullStandings(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    const a = scoreBracket(p, buildFacts(matches, standings));
    const b = scoreBracket(p, buildFacts(matches, standings));
    expect(a).toEqual(b);
  });
});

describe('live provisional scoring', () => {
  // One live group match between the 1st- and 2nd-placed teams, leader winning,
  // so both have played and sit in the live top two.
  const liveMatch = (letter: string, status = 'live'): MatchFact => ({
    stage: 'group',
    status,
    groupLetter: letter,
    winnerCode: null,
    homeCode: T(letter, 0),
    awayCode: T(letter, 1),
    homeScore: 1,
    awayScore: 0,
  });

  it('starts a group as soon as it kicks off', () => {
    const facts = buildFacts([liveMatch('A')], fullStandings([]));
    expect(facts.startedGroups.has('A')).toBe(true);
    expect(facts.startedGroups.has('B')).toBe(false);
  });

  it('awards the current live top two that have played', () => {
    const facts = buildFacts([liveMatch('A')], fullStandings([]));
    const p = fullBracket(); // A: 1st AAX, 2nd ABX, 3rd ACX, 4th ADX
    // Both AAX and ABX have played and lead the live table: 3 advance each,
    // plus exact-spot bonuses on 1st and 2nd. ACX/ADX have not played.
    expect(scoreBracket(p, facts).groups).toBe(3 + 1 + 3 + 1);
    expect(provisionalPoints(p, facts)).toBe(8);
  });

  it('credits a live qualifier even when slotted in the wrong lane', () => {
    const facts = buildFacts([liveMatch('A')], fullStandings([]));
    const p = fullBracket();
    // Leader AAX slotted 3rd: still earns advance points (top-3 pick), no exact.
    p.groups.A = { first: T('A', 1), second: T('A', 3), third: T('A', 0), fourth: T('A', 2) };
    // ABX (2nd) slotted 1st: advance, no exact. AAX (1st) slotted 3rd: advance.
    expect(scoreBracket(p, facts).groups).toBe(3 + 3);
  });

  it('does not credit a team that has not played yet', () => {
    const facts = buildFacts([liveMatch('A')], fullStandings([]));
    const p = fullBracket();
    p.groups.A = { first: T('A', 2), second: T('A', 3) }; // 3rd and 4th, neither played
    expect(scoreBracket(p, facts).groups).toBe(0);
  });

  it('gives no live points before kickoff', () => {
    const facts = buildFacts([liveMatch('A', 'scheduled')], fullStandings([]));
    expect(facts.startedGroups.size).toBe(0);
  });
});

describe('deriveAdvancement', () => {
  function standingsWithThirds(): StandingInput[] {
    return GROUP_LETTERS.flatMap((letter, gi) =>
      [0, 1, 2, 3].map((n) => ({
        groupLetter: letter,
        teamCode: T(letter, n),
        // Third-placed teams get descending points by group index so
        // groups A..H produce the 8 best thirds.
        points: n === 2 ? 12 - gi : 9 - n * 3,
        gd: 0,
        gf: 0,
        rank: n + 1,
      })),
    );
  }

  it('advances 24 top-2 teams plus the 8 best thirds', () => {
    const { advanced, bestThirds } = deriveAdvancement(standingsWithThirds());
    expect(advanced.size).toBe(32);
    expect(bestThirds.size).toBe(8);
    for (const letter of GROUP_LETTERS.slice(0, 8)) {
      expect(bestThirds.has(T(letter, 2))).toBe(true);
    }
    for (const letter of GROUP_LETTERS.slice(8)) {
      expect(bestThirds.has(T(letter, 2))).toBe(false);
    }
  });

  it('breaks third-place ties by gd then gf', () => {
    const rows: StandingInput[] = GROUP_LETTERS.flatMap((letter, gi) =>
      [0, 1, 2, 3].map((n) => ({
        groupLetter: letter,
        teamCode: T(letter, n),
        points: n === 2 ? 4 : 9 - n * 3,
        gd: n === 2 ? (gi < 8 ? 5 : -5) : 0,
        gf: 0,
        rank: n + 1,
      })),
    );
    const { bestThirds } = deriveAdvancement(rows);
    expect(bestThirds.has(T('A', 2))).toBe(true);
    expect(bestThirds.has(T('L', 2))).toBe(false);
  });
});
