// Score-prediction mini-game rules. Predictions open 24h before kickoff
// and lock at kickoff. An exact scoreline is worth bonus points; anything
// else scores nothing (kept deliberately simple). The point scores live --
// the moment the running score matches the prediction -- and locks at full
// time, so it can come and go as the scoreline moves during the match.

export const PREDICT_OPEN_MS = 24 * 60 * 60 * 1000;
export const PREDICT_EXACT_POINTS = 1;
export const PREDICT_MAX_GOALS = 20;

export type PredictState = 'upcoming' | 'open' | 'closed';

// Where a match sits relative to its prediction window.
export function predictState(kickoffUtc: Date, nowMs: number): PredictState {
  const t = kickoffUtc.getTime();
  if (nowMs >= t) return 'closed';
  if (nowMs >= t - PREDICT_OPEN_MS) return 'open';
  return 'upcoming';
}

// Statuses that carry a usable score (a kicked-off match), so a prediction
// scores live the instant the running score matches and locks at full time.
const PREDICT_COUNTED = new Set(['live', 'ht', 'ft', 'et', 'pens']);

// Points for one prediction against a match's current score (live or final).
export function scorePrediction(
  pred: { homeScore: number; awayScore: number },
  match: { homeScore: number | null; awayScore: number | null; status: string },
): number {
  if (!PREDICT_COUNTED.has(match.status) || match.homeScore == null || match.awayScore == null) {
    return 0;
  }
  return pred.homeScore === match.homeScore && pred.awayScore === match.awayScore
    ? PREDICT_EXACT_POINTS
    : 0;
}
