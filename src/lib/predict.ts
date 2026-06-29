// Score-prediction mini-game rules. Predictions open 24h before kickoff
// and lock at kickoff. An exact scoreline is worth bonus points; anything
// else scores nothing (kept deliberately simple). The point scores live --
// the moment the running score matches the prediction -- and locks at full
// time, so it can come and go as the scoreline moves during the match.

export const PREDICT_OPEN_MS = 24 * 60 * 60 * 1000;
export const PREDICT_EXACT_POINTS = 1;
// Bonus for calling a knockout shootout: predict a level score AND the team
// that wins on penalties, and the match really is decided on penalties.
export const PREDICT_PENS_POINTS = 1;
export const PREDICT_MAX_GOALS = 20;

// Match stages that can be decided by a penalty shootout (every knockout tie).
export const KNOCKOUT_STAGES = new Set(['r32', 'r16', 'qf', 'sf', 'third', 'final']);

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
// Two independent bonuses: the exact scoreline, and (knockouts only) calling
// the penalty-shootout winner when the tie is actually decided on penalties.
export function scorePrediction(
  pred: { homeScore: number; awayScore: number; pensWinner?: string | null },
  match: {
    homeScore: number | null;
    awayScore: number | null;
    status: string;
    winnerCode?: string | null;
  },
): number {
  if (!PREDICT_COUNTED.has(match.status) || match.homeScore == null || match.awayScore == null) {
    return 0;
  }
  let pts = 0;
  if (pred.homeScore === match.homeScore && pred.awayScore === match.awayScore) {
    pts += PREDICT_EXACT_POINTS;
  }
  // Only knockout ties reach the 'pens' status; award when the shootout winner
  // was called correctly.
  if (match.status === 'pens' && pred.pensWinner && pred.pensWinner === match.winnerCode) {
    pts += PREDICT_PENS_POINTS;
  }
  return pts;
}
