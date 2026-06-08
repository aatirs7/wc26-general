// Lightweight name-based auth: type your name, get a long-lived cookie
// with your user id. No passwords, intentionally, for a small pool.
// Anyone can act as anyone by entering their name; that trade-off is
// accepted here. The landing page warns before reusing an existing name.

import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { poolMembers, users } from './schema';

export const AUTH_COOKIE = 'wc26_uid';
export const LAST_NAME_COOKIE = 'wc26_lastname';
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // one year

// Returns the signed-in user's id, or null. Verifies the cookie points
// at a real user so stale cookies act as signed out.
export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  const uid = jar.get(AUTH_COOKIE)?.value;
  if (!uid) return null;
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.id, uid)).limit(1);
  return u?.id ?? null;
}

// Finds or creates a user by display name (case-insensitive on find)
// and joins them to the default pool. Returns the user row.
export async function signInByName(rawName: string) {
  const name = rawName.trim();
  if (!name) throw new Error('name required');

  const all = await db.select().from(users);
  let user = all.find((u) => u.displayName.toLowerCase() === name.toLowerCase());
  if (!user) {
    const [created] = await db.insert(users).values({ displayName: name }).returning();
    user = created;
  }

  const defaultPoolId = process.env.NEXT_PUBLIC_DEFAULT_POOL_ID;
  if (defaultPoolId) {
    await db
      .insert(poolMembers)
      .values({ poolId: defaultPoolId, userId: user.id })
      .onConflictDoNothing();
  }

  return user;
}

// True if a user already plays under this name (case-insensitive). Used
// to warn on the landing page before signing someone in as an existing
// player, since names are the only identity here.
export async function nameExists(rawName: string): Promise<boolean> {
  const name = rawName.trim().toLowerCase();
  if (!name) return false;
  const all = await db.select({ displayName: users.displayName }).from(users);
  return all.some((u) => u.displayName.toLowerCase() === name);
}
