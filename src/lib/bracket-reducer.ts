// Pure reducer behind the bracket builder. Every action that can shrink
// an upstream pool runs pruneDownstream so later rounds never hold
// invalidated picks.

import type { Predictions } from '@/types/bracket';
import { GROUP_POSITIONS } from '@/types/bracket';
import {
  ROUND_SIZES,
  THIRD_PLACE_PICKS,
  type GroupLetter,
  type KnockoutRoundKey,
  KNOCKOUT_ROUNDS,
} from './constants';
import { pruneDownstream, qualifiersOf } from './predictions';

import { normalizeKnockout, type FillKey } from './knockout-bracket';

export type BracketAction =
  | { type: 'load'; predictions: Predictions }
  | { type: 'rankGroupTeam'; letter: GroupLetter; code: string }
  | { type: 'toggleThird'; code: string }
  | { type: 'toggleRoundPick'; round: KnockoutRoundKey; code: string }
  | { type: 'toggleChampion'; code: string }
  | { type: 'pickWinner'; fills: FillKey; winner: string; loser: string | null }
  | { type: 'clearStep'; step: 'groups' | 'thirds' | 'knockout' };

// Every mutation runs through this: prune picks invalidated by an upstream
// change, then normalize the knockout sets to exactly what the bracket
// structure shows. Normalizing drops "orphan" advancers a round can be left
// holding after an upstream edit, so a round can never overflow its size and
// the saved predictions always validate.
function settle(p: Predictions): Predictions {
  return normalizeKnockout(pruneDownstream(p));
}

export function poolForRound(p: Predictions, round: KnockoutRoundKey): Set<string> {
  const idx = KNOCKOUT_ROUNDS.indexOf(round);
  if (idx === 0) return qualifiersOf(p);
  return new Set(p.knockout[KNOCKOUT_ROUNDS[idx - 1]]);
}

export function bracketReducer(state: Predictions, action: BracketAction): Predictions {
  switch (action.type) {
    case 'load':
      return settle(action.predictions);

    case 'rankGroupTeam': {
      // Tap an unranked team to give it the next open finishing spot
      // (1st, then 2nd, 3rd, 4th); tap a ranked team to clear it.
      const { letter, code } = action;
      const g = { ...(state.groups[letter] ?? {}) };
      const current = GROUP_POSITIONS.find((pos) => g[pos] === code);
      if (current) {
        g[current] = undefined;
      } else {
        const free = GROUP_POSITIONS.find((pos) => !g[pos]);
        if (!free) return state;
        g[free] = code;
      }
      return settle({
        ...state,
        groups: { ...state.groups, [letter]: g },
      });
    }

    case 'toggleThird': {
      const { code } = action;
      if (state.thirdPlace.includes(code)) {
        return settle({
          ...state,
          thirdPlace: state.thirdPlace.filter((c) => c !== code),
        });
      }
      if (state.thirdPlace.length >= THIRD_PLACE_PICKS) return state;
      const thirds = new Set(
        Object.values(state.groups).map((g) => g?.third).filter(Boolean) as string[],
      );
      if (!thirds.has(code)) return state;
      return { ...state, thirdPlace: [...state.thirdPlace, code] };
    }

    case 'toggleRoundPick': {
      const { round, code } = action;
      const picks = state.knockout[round];
      if (picks.includes(code)) {
        return settle({
          ...state,
          knockout: { ...state.knockout, [round]: picks.filter((c) => c !== code) },
        });
      }
      if (picks.length >= ROUND_SIZES[round]) return state;
      if (!poolForRound(state, round).has(code)) return state;
      return {
        ...state,
        knockout: { ...state.knockout, [round]: [...picks, code] },
      };
    }

    case 'toggleChampion': {
      const { code } = action;
      if (state.knockout.champion === code) {
        return { ...state, knockout: { ...state.knockout, champion: undefined } };
      }
      if (!state.knockout.final.includes(code)) return state;
      return { ...state, knockout: { ...state.knockout, champion: code } };
    }

    case 'pickWinner': {
      // Head-to-head: set the winner of one tie. Drops the beaten team
      // (and its downstream) so each tie yields exactly one advancer.
      const { fills, winner, loser } = action;
      if (fills === 'champion') {
        return {
          ...state,
          knockout: {
            ...state.knockout,
            champion: state.knockout.champion === winner ? undefined : winner,
          },
        };
      }
      const set = state.knockout[fills];
      if (set.includes(winner)) {
        // Tapping the current winner again clears the tie.
        return settle({
          ...state,
          knockout: { ...state.knockout, [fills]: set.filter((c) => c !== winner) },
        });
      }
      const next = [...set.filter((c) => c !== loser), winner];
      return settle({
        ...state,
        knockout: { ...state.knockout, [fills]: next },
      });
    }

    case 'clearStep': {
      // Wipe just the current step's picks. pruneDownstream cascades the
      // clear to anything that depended on it.
      const empty = { r16: [], qf: [], sf: [], final: [], champion: undefined };
      switch (action.step) {
        case 'groups':
          return settle({ ...state, groups: {} });
        case 'thirds':
          return settle({ ...state, thirdPlace: [] });
        case 'knockout':
          return { ...state, knockout: empty };
      }
    }
  }
}
