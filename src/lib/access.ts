import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { brackets, poolMembers } from './schema';
import { isLockedForPool } from './lock';

export async function isPoolMember(userId: string, poolId: string): Promise<boolean> {
  const row = await db
    .select({ userId: poolMembers.userId })
    .from(poolMembers)
    .where(and(eq(poolMembers.poolId, poolId), eq(poolMembers.userId, userId)))
    .limit(1);
  return row.length > 0;
}

export interface BracketAccess {
  canView: boolean;
  canEdit: boolean;
}

// Brackets are viewable read-only by fellow pool members at any time,
// including before lock (owner decision 2026-06-06, overrides the
// original pre-lock privacy rule). Non-members get nothing.
export async function bracketAccess(
  viewerId: string | null,
  bracket: { ownerId: string; poolId: string },
): Promise<BracketAccess> {
  if (!viewerId) return { canView: false, canEdit: false };
  if (viewerId === bracket.ownerId) {
    return { canView: true, canEdit: !isLockedForPool(bracket.poolId) };
  }
  const member = await isPoolMember(viewerId, bracket.poolId);
  return { canView: member, canEdit: false };
}

export async function loadBracket(id: string) {
  const rows = await db.select().from(brackets).where(eq(brackets.id, id)).limit(1);
  return rows[0] ?? null;
}
