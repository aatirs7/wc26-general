import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE, LAST_NAME_COOKIE, nameExists, signInByName } from '@/lib/auth';

const bodySchema = z.object({
  name: z.string().trim().min(1).max(40),
  // Set once the user has acknowledged the "name already taken" warning,
  // confirming they want to sign in as that existing player.
  confirm: z.boolean().optional(),
});

// Sign in (or sign up) by name.
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid name' }, { status: 400 });

  // Open name entry: warn before reusing an existing name so a newcomer
  // does not silently sign in as someone already in the pool.
  if (!parsed.data.confirm && (await nameExists(parsed.data.name))) {
    return NextResponse.json({ error: 'name taken', exists: true }, { status: 409 });
  }

  const user = await signInByName(parsed.data.name);
  const res = NextResponse.json({ user: { id: user.id, displayName: user.displayName } });
  res.cookies.set(AUTH_COOKIE, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  });
  // Remembered across sign-out so the picker can highlight your name.
  res.cookies.set(LAST_NAME_COOKIE, user.displayName, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: '/',
  });
  return res;
}

// Sign out / switch player. Keeps the remembered name on purpose.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
  return res;
}
