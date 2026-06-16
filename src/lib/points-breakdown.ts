// Turns a bracket's points into plain-language lines so players can see
// exactly where each point comes from (e.g. "Mexico — 1st in Group A").
import type { Predictions } from '@/types/bracket';
import type { Facts } from './scoring';
import {
  GROUP_LETTERS,
  KNOCKOUT_ROUNDS,
  KNOCKOUT_ROUND_LABELS,
  SCORING,
  SCORING_BY_ROUND,
} from './constants';

export interface BreakdownLine {
  flag: string;
  name: string;
  reason: string;
  pts: number;
  live: boolean;
  // Group pick that also matched its exact position (shown as a badge).
  exact?: boolean;
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export function pointsBreakdown(
  p: Predictions,
  facts: Facts,
  rankOf: (group: string, code: string) => number | null,
  teamName: (code: string) => { name: string; flag: string },
): BreakdownLine[] {
  const lines: BreakdownLine[] = [];
  const t = (code: string) => teamName(code);

  // Group top-2: confirmed (decided groups) and live (in-progress groups).
  // `exact` flags a pick that also nailed its position, adding the bonus note
  // and points to that line.
  const groupLine = (letter: string, code: string, live: boolean, exact: boolean) => {
    const r = rankOf(letter, code);
    const reason = r ? ordinal(r) : 'top 2';
    const { name, flag } = t(code);
    lines.push({
      flag,
      name,
      reason,
      pts: SCORING.groupTop2 + (exact ? SCORING.groupExactRank : 0),
      live,
      exact,
    });
  };
  for (const letter of facts.decidedGroups) {
    const actual = facts.top2ByGroup.get(letter);
    if (!actual) continue;
    const order = facts.exactByGroup.get(letter);
    const g = p.groups[letter as (typeof GROUP_LETTERS)[number]];
    if (g?.first && actual.has(g.first)) groupLine(letter, g.first, false, order?.first === g.first);
    if (g?.second && actual.has(g.second)) groupLine(letter, g.second, false, order?.second === g.second);
  }
  for (const letter of facts.startedGroups) {
    const actual = facts.liveTop2ByGroup.get(letter);
    if (!actual) continue;
    const order = facts.liveExactByGroup.get(letter);
    const g = p.groups[letter as (typeof GROUP_LETTERS)[number]];
    if (g?.first && actual.has(g.first)) groupLine(letter, g.first, true, order?.first === g.first);
    if (g?.second && actual.has(g.second)) groupLine(letter, g.second, true, order?.second === g.second);
  }

  // Best thirds (only once every group is decided).
  if (facts.allGroupsDecided) {
    for (const pick of p.thirdPlace) {
      if (facts.bestThirds.has(pick)) {
        const { name, flag } = t(pick);
        lines.push({ flag, name, reason: 'qualified as a best third', pts: SCORING.thirdPlace, live: false });
      }
    }
  }

  // Knockout advancement.
  for (const round of KNOCKOUT_ROUNDS) {
    for (const pick of p.knockout[round]) {
      if (facts.reached[round].has(pick)) {
        const { name, flag } = t(pick);
        lines.push({
          flag,
          name,
          reason: `reached the ${KNOCKOUT_ROUND_LABELS[round]}`,
          pts: SCORING_BY_ROUND[round],
          live: false,
        });
      }
    }
  }
  if (facts.champion && p.knockout.champion === facts.champion) {
    const { name, flag } = t(facts.champion);
    lines.push({ flag, name, reason: 'won the tournament', pts: SCORING.champion, live: false });
  }

  return lines;
}
