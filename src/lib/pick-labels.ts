import type { Predictions } from '@/types/bracket';
import { GROUP_LETTERS, type GroupLetter } from './constants';

// Short tag for how far a bracket backs each team (furthest stage wins).
// Used for counting how many of a viewer's picks are in play.
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

// Plain-language description of what the bracket predicted for a team in a
// given fixture. Group matches describe the group-finish call; knockout
// matches describe how far the team is backed to go.
export function pickNote(
  p: Predictions,
  code: string,
  stage: string,
  groupLetter: string | null,
  teamName: string,
): string | null {
  if (stage === 'group') {
    if (groupLetter) {
      const g = p.groups[groupLetter as GroupLetter];
      if (g?.first === code) return `You picked ${teamName} to win Group ${groupLetter}`;
      if (g?.second === code) return `You picked ${teamName} to finish 2nd in Group ${groupLetter}`;
    }
    if (p.thirdPlace.includes(code)) return `You backed ${teamName} as a best third`;
    return null;
  }
  if (p.knockout.champion === code) return `You picked ${teamName} to win it all`;
  if (p.knockout.final.includes(code)) return `You picked ${teamName} to reach the Final`;
  if (p.knockout.sf.includes(code)) return `You picked ${teamName} to reach the Semi-finals`;
  if (p.knockout.qf.includes(code)) return `You picked ${teamName} to reach the Quarter-finals`;
  if (p.knockout.r16.includes(code)) return `You picked ${teamName} to reach the Round of 16`;
  return null;
}
