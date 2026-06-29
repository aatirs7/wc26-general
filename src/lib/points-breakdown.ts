// Turns a bracket's points into plain-language lines so players can see
// exactly where each point comes from (e.g. "Mexico, 1st in Group A").
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
  // Which part of the bracket this point came from, for sectioning the
  // "score explained" view.
  category: 'group' | 'knockout';
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

  // One group's lines. Advancement: any of your top-3 picks that actually
  // finishes top two banks the advance points (with an exact-spot bonus if you
  // also nailed the position). Plus pure exact-position bonuses for an exact
  // 3rd or 4th that did not already score as an advancer. Live groups only
  // know the current top two, so exact 3rd/4th and best-third lines are skipped.
  const emitGroup = (
    letter: string,
    top2: Set<string>,
    order: { first: string | null; second: string | null; third?: string | null; fourth?: string | null } | undefined,
    live: boolean,
  ) => {
    const g = p.groups[letter as (typeof GROUP_LETTERS)[number]];
    if (!g) return;
    const advance = (code: string, exact: boolean) => {
      const r = rankOf(letter, code);
      const { name, flag } = t(code);
      lines.push({
        flag,
        name,
        reason: r ? `${ordinal(r)} in Group ${letter}` : `top 2 of Group ${letter}`,
        pts: SCORING.groupTop2 + (exact ? SCORING.groupExactRank : 0),
        live,
        category: 'group',
        exact,
      });
    };
    if (g.first && top2.has(g.first)) advance(g.first, order?.first === g.first);
    if (g.second && top2.has(g.second)) advance(g.second, order?.second === g.second);
    if (g.third && top2.has(g.third)) advance(g.third, order?.third === g.third);

    if (live) return;
    // Best-third advancement: the actual 3rd that qualifies, if you predicted it
    // to advance (slotted it in your top three). Only resolves once every group
    // is decided, matching the engine.
    const third = order?.third ?? null;
    const predictedThird =
      third && (g.first === third || g.second === third || g.third === third);
    if (third && facts.allGroupsDecided && facts.bestThirds.has(third) && predictedThird) {
      const exact = g.third === third;
      const { name, flag } = t(third);
      lines.push({
        flag,
        name,
        reason: 'qualified as a best third',
        pts: SCORING.thirdPlace + (exact ? SCORING.groupExactRank : 0),
        live: false,
        category: 'group',
        exact,
      });
    } else if (third && g.third === third) {
      // Exact 3rd that did not qualify: the standalone exact-spot bonus.
      const { name, flag } = t(third);
      lines.push({ flag, name, reason: `finished exactly 3rd in Group ${letter}`, pts: SCORING.groupExactRank, live: false, category: 'group', exact: true });
    }
    // Exact 4th: standalone exact-spot bonus.
    if (order?.fourth && g.fourth === order.fourth) {
      const { name, flag } = t(order.fourth);
      lines.push({ flag, name, reason: `finished exactly 4th in Group ${letter}`, pts: SCORING.groupExactRank, live: false, category: 'group', exact: true });
    }
  };

  for (const letter of facts.decidedGroups) {
    emitGroup(letter, facts.top2ByGroup.get(letter) ?? new Set(), facts.exactByGroup.get(letter), false);
  }
  for (const letter of facts.startedGroups) {
    const actual = facts.liveTop2ByGroup.get(letter);
    if (!actual) continue;
    emitGroup(letter, actual, facts.liveExactByGroup.get(letter), true);
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
          category: 'knockout',
        });
      }
    }
  }
  if (facts.champion && p.knockout.champion === facts.champion) {
    const { name, flag } = t(facts.champion);
    lines.push({ flag, name, reason: 'won the tournament', pts: SCORING.champion, live: false, category: 'knockout' });
  }

  return lines;
}
