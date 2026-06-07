import { describe, expect, it } from 'vitest';
import {
  isComplete,
  pruneDownstream,
  validatePredictions,
} from '@/lib/predictions';
import { emptyPredictions, type Predictions } from '@/types/bracket';
import { GROUP_LETTERS } from '@/lib/constants';

// Synthetic codes: group X teams XAX/XBX/XCX/XDX ranked 1/2/3/4.
const T = (letter: string, n: number) => `${letter}${'ABCD'[n]}X`;

function completeBracket(): Predictions {
  const p = emptyPredictions();
  for (const letter of GROUP_LETTERS) {
    p.groups[letter] = {
      first: T(letter, 0),
      second: T(letter, 1),
      third: T(letter, 2),
      fourth: T(letter, 3),
    };
  }
  // 8 of the 12 third-placed teams advance.
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

describe('validatePredictions', () => {
  it('accepts an empty in-progress bracket', () => {
    expect(() => validatePredictions(emptyPredictions())).not.toThrow();
  });

  it('accepts a complete valid bracket', () => {
    const p = completeBracket();
    expect(() => validatePredictions(p)).not.toThrow();
    expect(isComplete(p)).toBe(true);
  });

  it('rejects duplicate teams within a group', () => {
    const p = emptyPredictions();
    p.groups.A = { first: 'MEX', second: 'MEX' };
    expect(() => validatePredictions(p)).toThrow();
  });

  it('rejects a third-place pick not ranked third anywhere', () => {
    const p = emptyPredictions();
    p.groups.A = { first: 'MEX', second: 'KOR', third: 'RSA', fourth: 'CZE' };
    p.thirdPlace = ['MEX']; // MEX is first, not third
    expect(() => validatePredictions(p)).toThrow();
  });

  it('accepts a third-place pick that is ranked third', () => {
    const p = emptyPredictions();
    p.groups.A = { first: 'MEX', second: 'KOR', third: 'RSA', fourth: 'CZE' };
    p.thirdPlace = ['RSA'];
    expect(() => validatePredictions(p)).not.toThrow();
  });

  it('rejects knockout picks outside the prior round pool', () => {
    const p = emptyPredictions();
    p.groups.A = { first: 'MEX', second: 'KOR' };
    p.knockout.r16 = ['BRA'];
    expect(() => validatePredictions(p)).toThrow();
  });

  it('rejects a champion not present in the final picks', () => {
    const p = completeBracket();
    p.knockout.champion = p.knockout.sf[3];
    expect(() => validatePredictions(p)).toThrow();
  });
});

describe('isComplete', () => {
  it('requires all four positions in every group', () => {
    const p = completeBracket();
    p.groups.A = { first: T('A', 0), second: T('A', 1), third: T('A', 2) };
    expect(isComplete(p)).toBe(false);
  });
});

describe('pruneDownstream', () => {
  it('removes a demoted team from every later round', () => {
    const p = completeBracket();
    const victim = p.groups.A!.first!;
    expect(p.knockout.r16).toContain(victim);
    // Demote the group winner out of the top two entirely.
    p.groups.A = { first: undefined, second: p.groups.A!.second, third: p.groups.A!.third, fourth: victim };

    const pruned = pruneDownstream(p);
    expect(pruned.knockout.r16).not.toContain(victim);
    expect(pruned.knockout.qf).not.toContain(victim);
    expect(pruned.knockout.sf).not.toContain(victim);
    expect(pruned.knockout.final).not.toContain(victim);
    expect(pruned.knockout.champion).not.toBe(victim);
    expect(isComplete(pruned)).toBe(false);
  });

  it('drops best-thirds picks no longer ranked third', () => {
    const p = completeBracket();
    const third = p.thirdPlace[0];
    // Promote that third-place team to first; it is no longer a third.
    p.groups.A = { first: third, second: p.groups.A!.second, third: undefined, fourth: p.groups.A!.fourth };
    const pruned = pruneDownstream(p);
    expect(pruned.thirdPlace).not.toContain(third);
  });

  it('keeps a valid bracket untouched', () => {
    const p = completeBracket();
    const pruned = pruneDownstream(p);
    expect(pruned).toEqual(p);
  });
});
