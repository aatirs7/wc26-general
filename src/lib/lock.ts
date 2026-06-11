// Single tournament-wide lock moment. Before kickoff brackets are
// editable by their owners; at kickoff everything freezes.

export function kickoffUtc(): Date {
  const raw = process.env.TOURNAMENT_KICKOFF_UTC;
  if (!raw) throw new Error('TOURNAMENT_KICKOFF_UTC is not set');
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`TOURNAMENT_KICKOFF_UTC is not a valid date: ${raw}`);
  }
  return d;
}

export function isLocked(now: Date = new Date()): boolean {
  return now.getTime() >= kickoffUtc().getTime();
}

// Pools granted extra time past the global kickoff. Sourced from
// LOCK_EXEMPT_POOL_IDS (comma-separated) plus a hardcoded list for one-off
// grants. An exempt pool stays editable until its members submit.
const EXEMPT_POOL_IDS = new Set(
  [
    ...(process.env.LOCK_EXEMPT_POOL_IDS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    '894978dd-9ccd-44de-94e5-57c4a6c040aa', // Cousins — extra time after kickoff
  ],
);

export function isPoolLockExempt(poolId: string | null | undefined): boolean {
  return !!poolId && EXEMPT_POOL_IDS.has(poolId);
}

// Lock state for a specific pool: exempt pools are never locked.
export function isLockedForPool(poolId: string | null | undefined, now: Date = new Date()): boolean {
  if (isPoolLockExempt(poolId)) return false;
  return isLocked(now);
}
