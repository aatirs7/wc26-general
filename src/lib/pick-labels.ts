import type { Predictions } from '@/types/bracket';
import { GROUP_LETTERS } from './constants';

// Short tag for how far a bracket backs each team (furthest stage wins).
// Used to highlight a viewer's picks on match lists; disambiguates a match
// where both sides are in the bracket, e.g. one team to win its group and
// the other as a best third.
export function pickLabels(p: Predictions): Map<string, string> {
  const m = new Map<string, string>();
  const set = (code: string | undefined, label: string) => {
    if (code && !m.has(code)) m.set(code, label);
  };
  set(p.knockout.champion, 'Champ');
  for (const c of p.knockout.final) set(c, 'Final');
  for (const c of p.knockout.sf) set(c, 'SF');
  for (const c of p.knockout.qf) set(c, 'QF');
  for (const c of p.knockout.r16) set(c, 'R16');
  for (const letter of GROUP_LETTERS) {
    const g = p.groups[letter];
    set(g?.first, '1st');
    set(g?.second, '2nd');
  }
  for (const c of p.thirdPlace) set(c, '3rd');
  return m;
}
