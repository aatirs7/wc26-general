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

// One-off timed unlocks granted past the global kickoff: pool id -> ISO end
// time. The pool is editable (and submittable) again until that moment, then
// relocks automatically.
const TIMED_UNLOCKS: Record<string, string> = {
  '4897ca9f-e3d2-487f-b2ff-72a5d537d204': '2026-06-11T22:45:00Z', // Ba-Kamal: 2-hour grant
};

// The moment a pool's timed unlock ends, or null if it has none / it passed.
export function poolUnlockUntil(
  poolId: string | null | undefined,
  now: Date = new Date(),
): Date | null {
  const iso = poolId ? TIMED_UNLOCKS[poolId] : undefined;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || now.getTime() >= d.getTime()) return null;
  return d;
}

// Lock state for a specific pool: exempt pools are never locked, and a pool
// inside an active timed-unlock window is open even past kickoff.
export function isLockedForPool(poolId: string | null | undefined, now: Date = new Date()): boolean {
  if (isPoolLockExempt(poolId)) return false;
  if (poolUnlockUntil(poolId, now)) return false;
  return isLocked(now);
}
