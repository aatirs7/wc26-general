// Score-prediction mini-game rules. Predictions open 24h before kickoff
// and lock at kickoff. An exact scoreline is worth bonus points; anything
// else scores nothing (kept deliberately simple).

export const PREDICT_OPEN_MS = 24 * 60 * 60 * 1000;
export const PREDICT_EXACT_POINTS = 3;
export const PREDICT_MAX_GOALS = 20;

export type PredictState = 'upcoming' | 'open' | 'closed';

// Where a match sits relative to its prediction window.
export function predictState(kickoffUtc: Date, nowMs: number): PredictState {
  const t = kickoffUtc.getTime();
  if (nowMs >= t) return 'closed';
  if (nowMs >= t - PREDICT_OPEN_MS) return 'open';
  return 'upcoming';
}

// Points for one prediction against a finished match.
export function scorePrediction(
  pred: { homeScore: number; awayScore: number },
  match: { homeScore: number | null; awayScore: number | null; isFinal: boolean },
): number {
  if (!match.isFinal || match.homeScore == null || match.awayScore == null) return 0;
  return pred.homeScore === match.homeScore && pred.awayScore === match.awayScore
    ? PREDICT_EXACT_POINTS
    : 0;
}
