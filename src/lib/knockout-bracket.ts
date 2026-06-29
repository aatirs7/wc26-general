// Real WC26 knockout bracket structure (from openfootball fixtures) used
// to render the picks as a head-to-head tree. The 32 qualifiers a bracket
// produces (group winners + runners-up + 8 best thirds) are seeded into
// the R32 slots; winners advance through the feeder tree.
//
// Scoring never reads this: it only cares which teams a bracket sends to
// each round (knockout.r16/qf/sf/final/champion). This module is purely a
// presentation + interaction layer over those sets.

import type { Predictions } from '@/types/bracket';
import { GROUP_LETTERS } from './constants';

export type Slot =
  | { kind: 'winner'; group: string }
  | { kind: 'runner'; group: string }
  | { kind: 'third'; groups: string[] }
  | { kind: 'feeder'; from: number };

export interface MatchupDef {
  id: number;
  a: Slot;
  b: Slot;
}

// Round of 32, openfootball match numbers 73-88.
export const R32: MatchupDef[] = [
  { id: 73, a: { kind: 'runner', group: 'A' }, b: { kind: 'runner', group: 'B' } },
  { id: 74, a: { kind: 'winner', group: 'E' }, b: { kind: 'third', groups: ['A', 'B', 'C', 'D', 'F'] } },
  { id: 75, a: { kind: 'winner', group: 'F' }, b: { kind: 'runner', group: 'C' } },
  { id: 76, a: { kind: 'winner', group: 'C' }, b: { kind: 'runner', group: 'F' } },
  { id: 77, a: { kind: 'winner', group: 'I' }, b: { kind: 'third', groups: ['C', 'D', 'F', 'G', 'H'] } },
  { id: 78, a: { kind: 'runner', group: 'E' }, b: { kind: 'runner', group: 'I' } },
  { id: 79, a: { kind: 'winner', group: 'A' }, b: { kind: 'third', groups: ['C', 'E', 'F', 'H', 'I'] } },
  { id: 80, a: { kind: 'winner', group: 'L' }, b: { kind: 'third', groups: ['E', 'H', 'I', 'J', 'K'] } },
  { id: 81, a: { kind: 'winner', group: 'D' }, b: { kind: 'third', groups: ['B', 'E', 'F', 'I', 'J'] } },
  { id: 82, a: { kind: 'winner', group: 'G' }, b: { kind: 'third', groups: ['A', 'E', 'H', 'I', 'J'] } },
  { id: 83, a: { kind: 'runner', group: 'K' }, b: { kind: 'runner', group: 'L' } },
  { id: 84, a: { kind: 'winner', group: 'H' }, b: { kind: 'runner', group: 'J' } },
  { id: 85, a: { kind: 'winner', group: 'B' }, b: { kind: 'third', groups: ['E', 'F', 'G', 'I', 'J'] } },
  { id: 86, a: { kind: 'winner', group: 'J' }, b: { kind: 'runner', group: 'H' } },
  { id: 87, a: { kind: 'winner', group: 'K' }, b: { kind: 'third', groups: ['D', 'E', 'I', 'J', 'L'] } },
  { id: 88, a: { kind: 'runner', group: 'D' }, b: { kind: 'runner', group: 'G' } },
];

export const R16: MatchupDef[] = [
  { id: 89, a: { kind: 'feeder', from: 74 }, b: { kind: 'feeder', from: 77 } },
  { id: 90, a: { kind: 'feeder', from: 73 }, b: { kind: 'feeder', from: 75 } },
  { id: 91, a: { kind: 'feeder', from: 76 }, b: { kind: 'feeder', from: 78 } },
  { id: 92, a: { kind: 'feeder', from: 79 }, b: { kind: 'feeder', from: 80 } },
  { id: 93, a: { kind: 'feeder', from: 83 }, b: { kind: 'feeder', from: 84 } },
  { id: 94, a: { kind: 'feeder', from: 81 }, b: { kind: 'feeder', from: 82 } },
  { id: 95, a: { kind: 'feeder', from: 86 }, b: { kind: 'feeder', from: 88 } },
  { id: 96, a: { kind: 'feeder', from: 85 }, b: { kind: 'feeder', from: 87 } },
];

export const QF: MatchupDef[] = [
  { id: 97, a: { kind: 'feeder', from: 89 }, b: { kind: 'feeder', from: 90 } },
  { id: 98, a: { kind: 'feeder', from: 93 }, b: { kind: 'feeder', from: 94 } },
  { id: 99, a: { kind: 'feeder', from: 91 }, b: { kind: 'feeder', from: 92 } },
  { id: 100, a: { kind: 'feeder', from: 95 }, b: { kind: 'feeder', from: 96 } },
];

export const SF: MatchupDef[] = [
  { id: 101, a: { kind: 'feeder', from: 97 }, b: { kind: 'feeder', from: 98 } },
  { id: 102, a: { kind: 'feeder', from: 99 }, b: { kind: 'feeder', from: 100 } },
];

export const FINAL: MatchupDef[] = [
  { id: 104, a: { kind: 'feeder', from: 101 }, b: { kind: 'feeder', from: 102 } },
];

// Each round's winners fill this knockout set.
export type FillKey = 'r16' | 'qf' | 'sf' | 'final' | 'champion';

export interface KoRound {
  key: 'r32' | 'r16' | 'qf' | 'sf' | 'final';
  title: string;
  short: string;
  fills: FillKey;
  matchups: MatchupDef[];
}

export const KO_ROUNDS: KoRound[] = [
  { key: 'r32', title: 'Round of 32', short: 'R32', fills: 'r16', matchups: R32 },
  { key: 'r16', title: 'Round of 16', short: 'R16', fills: 'qf', matchups: R16 },
  { key: 'qf', title: 'Quarter-finals', short: 'QF', fills: 'sf', matchups: QF },
  { key: 'sf', title: 'Semi-finals', short: 'SF', fills: 'final', matchups: SF },
  { key: 'final', title: 'Final', short: 'Final', fills: 'champion', matchups: FINAL },
];

function slotLabel(slot: Slot): string {
  switch (slot.kind) {
    case 'winner':
      return `1${slot.group}`;
    case 'runner':
      return `2${slot.group}`;
    case 'third':
      return `3rd ${slot.groups.join('/')}`;
    case 'feeder':
      return `W${slot.from}`;
  }
}

// code -> the group where this bracket ranked it third.
function thirdGroupMap(p: Predictions): Map<string, string> {
  const m = new Map<string, string>();
  for (const letter of GROUP_LETTERS) {
    const t = p.groups[letter]?.third;
    if (t) m.set(t, letter);
  }
  return m;
}

// Assigns the bracket's picked third-place teams to the eligible R32
// third-slots (matchup id -> team code). Any valid matching works since
// scoring ignores exact matchups; FIFA's eligibility table guarantees a
// perfect matching exists for any set of 8 qualifying thirds.
export function assignThirds(p: Predictions): Map<number, string> {
  const slots = R32.filter((m) => m.b.kind === 'third').map((m) => ({
    id: m.id,
    groups: (m.b as { kind: 'third'; groups: string[] }).groups,
  }));
  const codeGroup = thirdGroupMap(p);
  const items = p.thirdPlace
    .filter((c) => codeGroup.has(c))
    .map((c) => ({ code: c, group: codeGroup.get(c)! }));

  const result = new Map<number, string>();
  const usedSlot = new Set<number>();

  // Place every picked third into some eligible, unused slot.
  const place = (i: number): boolean => {
    if (i >= items.length) return true;
    for (const slot of slots) {
      if (usedSlot.has(slot.id)) continue;
      if (!slot.groups.includes(items[i].group)) continue;
      usedSlot.add(slot.id);
      result.set(slot.id, items[i].code);
      if (place(i + 1)) return true;
      usedSlot.delete(slot.id);
      result.delete(slot.id);
    }
    return false;
  };

  if (!place(0)) {
    // Best effort fallback: greedy assign whatever fits.
    result.clear();
    usedSlot.clear();
    for (const item of items) {
      const slot = slots.find((s) => !usedSlot.has(s.id) && s.groups.includes(item.group));
      if (slot) {
        usedSlot.add(slot.id);
        result.set(slot.id, item.code);
      }
    }
  }
  return result;
}

export interface ResolvedMatchup {
  id: number;
  fills: FillKey;
  aCode: string | null;
  bCode: string | null;
  aLabel: string;
  bLabel: string;
  winner: string | null;
}

export type ResolvedBracket = Record<KoRound['key'], ResolvedMatchup[]>;

export const ALL_MATCHUPS: MatchupDef[] = [...R32, ...R16, ...QF, ...SF, ...FINAL];
export const MATCHUP_BY_ID = new Map(ALL_MATCHUPS.map((m) => [m.id, m]));
export const ROOT_ID = 104;

const FILLS_BY_ID = new Map<number, FillKey>();
for (const round of KO_ROUNDS) for (const m of round.matchups) FILLS_BY_ID.set(m.id, round.fills);

export function fillsForId(id: number): FillKey {
  return FILLS_BY_ID.get(id) ?? 'champion';
}

// The two matchup ids that feed this one, or null for a Round-of-32 tie.
export function feedersOf(id: number): [number, number] | null {
  const def = MATCHUP_BY_ID.get(id);
  if (!def) return null;
  if (def.a.kind === 'feeder' && def.b.kind === 'feeder') return [def.a.from, def.b.from];
  return null;
}

// Flattened lookup of every resolved tie by matchup id.
export function resolveById(p: Predictions): Map<number, ResolvedMatchup> {
  const byRound = resolveBracket(p);
  const out = new Map<number, ResolvedMatchup>();
  for (const round of KO_ROUNDS) for (const m of byRound[round.key]) out.set(m.id, m);
  return out;
}

export interface ActualMatchRow {
  id: number;
  homeCode: string | null;
  awayCode: string | null;
  homePlaceholder: string | null;
  awayPlaceholder: string | null;
  winnerCode: string | null;
}

// The REAL knockout bracket as it actually stands. The match table ids line up
// with the matchup ids (openfootball numbering), so each tie reads its real
// teams and winner. When a real slot is not populated yet, we fill it from what
// is actually known: a group winner/runner from the final standings, and a
// feeder slot from the actual winner of the match that feeds it, propagated
// forward (so a decided R32 winner shows up in its R16 slot immediately instead
// of a "W76" placeholder). Third-place feeder slots stay as a label until the
// real fixture assigns the team. Used for the live bracket view.
export function resolveActualById(
  matchRows: ActualMatchRow[],
  groupFirst?: Map<string, string | null>,
  groupSecond?: Map<string, string | null>,
): Map<number, ResolvedMatchup> {
  const byId = new Map(matchRows.map((m) => [m.id, m]));
  const out = new Map<number, ResolvedMatchup>();
  const winnerById = new Map<number, string | null>();

  const seed = (slot: Slot, realCode: string | null | undefined): string | null => {
    if (realCode) return realCode;
    switch (slot.kind) {
      case 'winner':
        return groupFirst?.get(slot.group) ?? null;
      case 'runner':
        return groupSecond?.get(slot.group) ?? null;
      case 'third':
        return null;
      case 'feeder':
        return winnerById.get(slot.from) ?? null;
    }
  };

  // ALL_MATCHUPS runs R32 -> R16 -> QF -> SF -> FINAL, so every feeder is
  // resolved before the tie that consumes it.
  for (const def of ALL_MATCHUPS) {
    const real = byId.get(def.id);
    const winner = real?.winnerCode ?? null;
    winnerById.set(def.id, winner);
    out.set(def.id, {
      id: def.id,
      fills: fillsForId(def.id),
      aCode: seed(def.a, real?.homeCode),
      bCode: seed(def.b, real?.awayCode),
      aLabel: real?.homePlaceholder ?? slotLabel(def.a),
      bLabel: real?.awayPlaceholder ?? slotLabel(def.b),
      winner,
    });
  }
  return out;
}

// Reconcile the stored knockout sets with what the bracket structure
// actually shows: each round becomes exactly the winners of its matchups,
// walked in feeder order. This drops "orphans" (teams a round still holds
// after an upstream group/third change even though they no longer win any
// tie) and can never exceed a round's size, so the predictions stay valid
// no matter how the picks were edited.
export function normalizeKnockout(p: Predictions): Predictions {
  const resolved = resolveBracket(p);
  const winnersOf = (key: KoRound['key']): string[] =>
    resolved[key].map((m) => m.winner).filter((c): c is string => c != null);
  return {
    ...p,
    knockout: {
      r16: winnersOf('r32'),
      qf: winnersOf('r16'),
      sf: winnersOf('qf'),
      final: winnersOf('sf'),
      champion: resolved.final[0]?.winner ?? undefined,
    },
  };
}

export function resolveBracket(p: Predictions): ResolvedBracket {
  const thirds = assignThirds(p);
  const winnerById = new Map<number, string | null>();

  const seed = (slot: Slot, matchupId: number): string | null => {
    switch (slot.kind) {
      case 'winner':
        return p.groups[slot.group as (typeof GROUP_LETTERS)[number]]?.first ?? null;
      case 'runner':
        return p.groups[slot.group as (typeof GROUP_LETTERS)[number]]?.second ?? null;
      case 'third':
        return thirds.get(matchupId) ?? null;
      case 'feeder':
        return winnerById.get(slot.from) ?? null;
    }
  };

  const out = {} as ResolvedBracket;
  for (const round of KO_ROUNDS) {
    out[round.key] = round.matchups.map((m) => {
      const aCode = seed(m.a, m.id);
      const bCode = seed(m.b, m.id);
      let winner: string | null = null;
      if (round.fills === 'champion') {
        const champ = p.knockout.champion ?? null;
        winner = champ && (champ === aCode || champ === bCode) ? champ : null;
      } else {
        const set = p.knockout[round.fills];
        if (aCode && set.includes(aCode)) winner = aCode;
        else if (bCode && set.includes(bCode)) winner = bCode;
      }
      winnerById.set(m.id, winner);
      return {
        id: m.id,
        fills: round.fills,
        aCode,
        bCode,
        aLabel: slotLabel(m.a),
        bLabel: slotLabel(m.b),
        winner,
      };
    });
  }
  return out;
}
