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
    p.groups[letter] = { first: T(letter, 0), second: T(letter, 1) };
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

  it('scores decided groups only, 3 points per correct top-2 team', () => {
    // Groups A and B decided; bracket has both right in A, top-2 set
    // right in B. Order within the top 2 does not matter.
    const facts = buildFacts(decidedGroupMatches(['A', 'B']), fullStandings([]));
    const p = fullBracket();
    p.groups.B = { first: T('B', 1), second: T('B', 0) };
    const scores = scoreBracket(p, facts);
    expect(scores.groups).toBe(4 * 3);
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
  // A kicked-off group match with a current score.
  const liveGroupMatch = (
    letter: string,
    homeN: number,
    awayN: number,
    hs: number,
    as: number,
    status = 'live',
  ): MatchFact => ({
    stage: 'group',
    status,
    groupLetter: letter,
    winnerCode: null,
    homeCode: T(letter, homeN),
    awayCode: T(letter, awayN),
    homeScore: hs,
    awayScore: as,
  });

  it('marks a kicked-off, undecided group as started', () => {
    const facts = buildFacts([liveGroupMatch('A', 0, 1, 1, 0)], fullStandings([]));
    expect(facts.startedGroups.has('A')).toBe(true);
    expect(facts.decidedGroups.has('A')).toBe(false);
  });

  it('awards provisional top-2 points from the live table', () => {
    // A: AAX beats ABX 1-0 live, so both are the current top 2.
    const facts = buildFacts([liveGroupMatch('A', 0, 1, 1, 0)], fullStandings([]));
    const p = fullBracket(); // A.first = AAX, A.second = ABX
    const scores = scoreBracket(p, facts);
    expect(scores.groups).toBe(6); // two correct current top-2 picks, 3 each
    expect(provisionalPoints(p, facts)).toBe(6);
  });

  it('moves as the score changes', () => {
    // ACX leads its match, so it displaces a picked team out of the top 2.
    const facts = buildFacts(
      [liveGroupMatch('A', 2, 0, 2, 0), liveGroupMatch('A', 1, 3, 0, 0)],
      fullStandings([]),
    );
    // Live top 2: ACX (3 pts) and one of the 0-pt teams by tiebreak.
    expect(facts.liveTop2ByGroup.get('A')!.has(T('A', 2))).toBe(true);
  });

  it('gives no provisional points before kickoff', () => {
    const facts = buildFacts([liveGroupMatch('A', 0, 1, 0, 0, 'scheduled')], fullStandings([]));
    expect(facts.startedGroups.size).toBe(0);
    expect(scoreBracket(fullBracket(), facts).groups).toBe(0);
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
