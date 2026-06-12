// Central tournament constants and scoring weights.
// Tweak SCORING values here; the scoring engine reads only this config.

export const SCORING = {
  groupTop2: 3, // per team correctly placed in the top 2 of its group
  groupExactRank: 1, // bonus per top-2 team you also put in its exact spot (1st/2nd)
  thirdPlace: 2, // per correct best-third qualifier
  reachR16: 5, // per predicted team that actually reached the Round of 16
  reachQF: 8,
  reachSF: 12,
  reachFinal: 18,
  champion: 30, // correct winner of the Final
} as const;

export const GROUP_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
] as const;
export type GroupLetter = (typeof GROUP_LETTERS)[number];

// One bracket_scores row per key per bracket.
export const ROUND_KEYS = [
  'groups', 'thirdPlace', 'r16', 'qf', 'sf', 'final', 'champion',
] as const;
export type RoundKey = (typeof ROUND_KEYS)[number];

// Rounds the user picks in the knockout stepper, in order.
export const KNOCKOUT_ROUNDS = ['r16', 'qf', 'sf', 'final'] as const;
export type KnockoutRoundKey = (typeof KNOCKOUT_ROUNDS)[number];

// Required selection counts for a complete bracket.
export const ROUND_SIZES: Record<KnockoutRoundKey, number> = {
  r16: 16,
  qf: 8,
  sf: 4,
  final: 2,
};

export const KNOCKOUT_ROUND_LABELS: Record<KnockoutRoundKey, string> = {
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  final: 'Final',
};

// Real-match stages stored in matches.stage.
export const STAGES = ['group', 'r32', 'r16', 'qf', 'sf', 'third', 'final'] as const;
export type Stage = (typeof STAGES)[number];

// A team "reaches" a picked round by winning its match in the prior stage.
// Reaching the knockout itself (R32) is paid via groupTop2 + thirdPlace.
export const REACHED_BY_WINNING: Record<KnockoutRoundKey, Stage> = {
  r16: 'r32',
  qf: 'r16',
  sf: 'qf',
  final: 'sf',
};

export const SCORING_BY_ROUND: Record<KnockoutRoundKey, number> = {
  r16: SCORING.reachR16,
  qf: SCORING.reachQF,
  sf: SCORING.reachSF,
  final: SCORING.reachFinal,
};

// Match statuses that mean the result is final.
export const FINAL_STATUSES = ['ft', 'et', 'pens'] as const;

export const THIRD_PLACE_PICKS = 8;
