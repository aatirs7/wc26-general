// Shared gate for every finale route. Resolves the signed-in player, whether
// the finale is unlocked for them, and which pool they are looking at, using
// the same request/cookie/default precedence the rest of the app uses.

import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { matches, poolMembers, pools, users } from './schema';
import { currentUserId } from './auth';
import { ROOT_ID } from './knockout-bracket';
import { isFinalePreview, isTournamentOver } from './finale';

export interface Membership {
  poolId: string;
  poolName: string;
}

export type FinaleGate =
  | { state: 'anon' }
  | { state: 'no-pool'; userId: string }
  | { state: 'locked'; userId: string; displayName: string }
  | {
      state: 'open';
      userId: string;
      displayName: string;
      over: boolean;
      preview: boolean;
      memberships: Membership[];
      active: Membership;
      // True when the caller named a pool they actually belong to. Someone in
      // several pools has to pick one before a recap means anything, so the
      // deck routes refuse to guess and send them to the chooser instead.
      explicit: boolean;
      needsChoice: boolean;
    };

export async function finaleGate(requestedPool?: string): Promise<FinaleGate> {
  const userId = await currentUserId();
  if (!userId) return { state: 'anon' };

  const [me] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const displayName = me?.displayName ?? 'Player';

  const [finalMatch] = await db
    .select({ status: matches.status })
    .from(matches)
    .where(eq(matches.id, ROOT_ID))
    .limit(1);

  const over = isTournamentOver(finalMatch?.status);
  const preview = isFinalePreview(displayName);
  if (!over && !preview) return { state: 'locked', userId, displayName };

  const memberships = await db
    .select({ poolId: poolMembers.poolId, poolName: pools.name })
    .from(poolMembers)
    .innerJoin(pools, eq(pools.id, poolMembers.poolId))
    .where(eq(poolMembers.userId, userId));
  if (memberships.length === 0) return { state: 'no-pool', userId };

  const cookiePool = (await cookies()).get('wc26_active_pool')?.value;
  const requested = memberships.find((m) => m.poolId === requestedPool) ?? null;
  const active =
    requested ??
    memberships.find((m) => m.poolId === cookiePool) ??
    memberships.find((m) => m.poolId === process.env.NEXT_PUBLIC_DEFAULT_POOL_ID) ??
    memberships[0];

  const explicit = requested !== null;

  return {
    state: 'open',
    userId,
    displayName,
    over,
    preview,
    memberships,
    active,
    explicit,
    needsChoice: memberships.length > 1 && !explicit,
  };
}

// Whether the finale is live at all, for the home page and layout. Cheap
// enough to call on every render: one indexed row.
export async function isFinaleActive(displayName: string | null | undefined): Promise<boolean> {
  const [finalMatch] = await db
    .select({ status: matches.status })
    .from(matches)
    .where(eq(matches.id, ROOT_ID))
    .limit(1);
  return isTournamentOver(finalMatch?.status) || isFinalePreview(displayName);
}
