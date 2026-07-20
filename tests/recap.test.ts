import { describe, expect, it } from 'vitest';
import { buildTimeline, pickArchetype, ordinal, type FinaleContext } from '@/lib/recap';
import { emptyPredictions, type Predictions } from '@/types/bracket';
import { GROUP_LETTERS } from '@/lib/constants';

// Synthetic codes: group X has teams XAX, XBX, XCX, XDX, in that finishing
// order. Mirrors the fixture style used in scoring.test.ts.
const T = (letter: string, n: number) => `${letter}${'ABCD'[n]}X`;

// Six group matches per group with a fixed, decisive set of results, ordered
// so the first two matchdays are genuinely earlier than the third.
function groupMatches() {
  const rows: Record<string, unknown>[] = [];
  let id = 1;
  // Matchday m pairs up the four teams so every side plays three times.
  const pairsByDay = [
    [
      [0, 1],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 3],
    ],
    [
      [0, 3],
      [1, 2],
    ],
  ];
  for (let day = 0; day < 3; day += 1) {
    for (const letter of GROUP_LETTERS) {
      for (const [a, b] of pairsByDay[day]) {
        // The better-seeded side always wins, so the table resolves to
        // XAX, XBX, XCX, XDX.
        rows.push({
          id: id++,
          stage: 'group',
          status: 'ft',
          groupLetter: letter,
          winnerCode: T(letter, a),
          homeCode: T(letter, a),
          awayCode: T(letter, b),
          homeScore: 1,
          awayScore: 0,
          kickoffUtc: new Date(Date.UTC(2026, 5, 11 + day, 18, 0, 0)),
          roundLabel: `Matchday ${day + 1}`,
        });
      }
    }
  }
  return rows;
}

function bracketFor(ownerId: string, picks: Partial<Predictions['knockout']> = {}): Record<string, unknown> {
  const p = emptyPredictions();
  for (const letter of GROUP_LETTERS) {
    p.groups[letter] = {
      first: T(letter, 0),
      second: T(letter, 1),
      third: T(letter, 2),
      fourth: T(letter, 3),
    };
  }
  Object.assign(p.knockout, picks);
  return {
    id: `b-${ownerId}`,
    ownerId,
    predictions: p,
    submitted: true,
    lockedAt: new Date(Date.UTC(2026, 5, 11, 0, 0, 0)),
    totalPoints: 0,
  };
}

// buildTimeline only reads a handful of context fields, so a focused partial
// context is enough and keeps the test free of a database.
function contextWith(
  members: { userId: string; name: string }[],
  brackets: Record<string, unknown>[],
  matchRows: Record<string, unknown>[],
): FinaleContext {
  return {
    members,
    bracketByOwner: new Map(brackets.map((b) => [b.ownerId as string, b])),
    matchRows,
    standingRows: GROUP_LETTERS.flatMap((letter) =>
      [0, 1, 2, 3].map((n) => ({
        groupLetter: letter,
        teamCode: T(letter, n),
        rank: n + 1,
        isBestThird: false,
      })),
    ),
    predsByUser: new Map(),
  } as unknown as FinaleContext;
}

describe('ordinal', () => {
  it('handles the awkward cases', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(21)).toBe('21st');
  });
});

describe('buildTimeline', () => {
  const matchRows = groupMatches();

  it('produces one checkpoint per matchday actually played', () => {
    const ctx = contextWith(
      [{ userId: 'u1', name: 'One' }],
      [bracketFor('u1')],
      matchRows,
    );
    const timeline = buildTimeline(ctx);
    // 72 group matches and no knockout matches: matchday 1, 2 and the full
    // group stage, and nothing after that.
    expect(timeline.map((c) => c.key)).toEqual(['md1', 'md2', 'groups']);
  });

  it('ranks everyone at every checkpoint', () => {
    const ctx = contextWith(
      [
        { userId: 'u1', name: 'One' },
        { userId: 'u2', name: 'Two' },
      ],
      [bracketFor('u1'), bracketFor('u2')],
      matchRows,
    );
    const timeline = buildTimeline(ctx);
    for (const c of timeline) {
      expect(c.byUser.size).toBe(2);
      expect([...c.byUser.values()].map((v) => v.rank).sort()).toEqual([1, 2]);
    }
  });

  it('scores a perfect group bracket above an empty one, and never decreases', () => {
    const empty = { ...bracketFor('u2'), predictions: emptyPredictions() };
    const ctx = contextWith(
      [
        { userId: 'u1', name: 'One' },
        { userId: 'u2', name: 'Two' },
      ],
      [bracketFor('u1'), empty],
      matchRows,
    );
    const timeline = buildTimeline(ctx);
    const last = timeline[timeline.length - 1];
    expect(last.byUser.get('u1')!.rank).toBe(1);
    expect(last.byUser.get('u2')!.points).toBe(0);

    // Points only accumulate as more matches are played.
    let previous = -1;
    for (const c of timeline) {
      const pts = c.byUser.get('u1')!.points;
      expect(pts).toBeGreaterThanOrEqual(previous);
      previous = pts;
    }
  });

  it('skips checkpoints when nothing has been played', () => {
    const ctx = contextWith([{ userId: 'u1', name: 'One' }], [bracketFor('u1')], []);
    expect(buildTimeline(ctx)).toEqual([]);
  });
});

describe('pickArchetype', () => {
  const base = {
    me: {
      userId: 'u1',
      name: 'One',
      bracketName: 'B',
      combined: 100,
      bracketTotal: 100,
      bonus: 0,
      rank: 5,
      accuracy: 50,
      submitted: true,
      champion: null,
    },
    fieldSize: 10,
    journey: [],
    predictions: null,
    chat: null,
    rideOrDie: null,
    champion: null,
    twin: null,
  };

  it('crowns the winner above everything else', () => {
    const a = pickArchetype({ ...base, me: { ...base.me, rank: 1 } });
    expect(a.title).toBe('The Champion');
  });

  it('spots a big climb', () => {
    const journey = [
      { label: 'After matchday one', short: 'MD1', rank: 10, points: 0 },
      { label: 'Full time', short: 'FT', rank: 2, points: 100 },
    ];
    const a = pickArchetype({ ...base, me: { ...base.me, rank: 2 }, journey });
    expect(a.title).toBe('The Late Bloomer');
  });

  it('spots a big collapse', () => {
    const journey = [
      { label: 'After matchday one', short: 'MD1', rank: 1, points: 10 },
      { label: 'Full time', short: 'FT', rank: 9, points: 40 },
    ];
    const a = pickArchetype({ ...base, me: { ...base.me, rank: 9 }, journey });
    expect(a.title).toBe('The Slow Puncture');
  });

  it('calls out someone who never said a word', () => {
    const a = pickArchetype({
      ...base,
      chat: { sent: 0, poolTotal: 40, sharePct: 0, longest: null, busiestDay: null, rank: 6 },
    });
    expect(a.title).toBe('The Ghost');
  });

  it('always returns something', () => {
    const a = pickArchetype(base);
    expect(a.title.length).toBeGreaterThan(0);
    expect(a.line.length).toBeGreaterThan(0);
  });
});
