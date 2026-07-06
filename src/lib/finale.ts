// The end-of-tournament "finale": podium, awards and recap. It unlocks when
// the World Cup final goes final. A preview override lets named players open it
// early (against live standings) to test the experience before the real final.

import { FINAL_STATUSES } from './constants';

export function isTournamentOver(finalMatchStatus: string | null | undefined): boolean {
  return !!finalMatchStatus && (FINAL_STATUSES as readonly string[]).includes(finalMatchStatus);
}

// Preview override: listed players see the finale immediately, computed from
// whatever the standings are right now. Empty this list to turn preview off.
export const FINALE_PREVIEW_NAMES: string[] = [];

export function isFinalePreview(displayName: string | null | undefined): boolean {
  if (!displayName) return false;
  return FINALE_PREVIEW_NAMES.includes(displayName.trim().toLowerCase());
}
