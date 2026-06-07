import type { GroupLetter } from '@/lib/constants';

export interface GroupPick {
  first?: string;
  second?: string;
  third?: string;
  fourth?: string;
}

export const GROUP_POSITIONS = ['first', 'second', 'third', 'fourth'] as const;
export type GroupPosition = (typeof GROUP_POSITIONS)[number];

export interface KnockoutPicks {
  r16: string[];
  qf: string[];
  sf: string[];
  final: string[];
  champion?: string;
}

export interface Predictions {
  groups: Partial<Record<GroupLetter, GroupPick>>;
  thirdPlace: string[];
  knockout: KnockoutPicks;
}

export function emptyPredictions(): Predictions {
  return {
    groups: {},
    thirdPlace: [],
    knockout: { r16: [], qf: [], sf: [], final: [] },
  };
}
