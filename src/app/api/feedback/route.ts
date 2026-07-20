import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { feedback } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';

const postSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

// Leave a suggestion or a review of the whole thing. Signed in players only,
// so replies have a name attached, but otherwise completely free-form.
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  await db.insert(feedback).values({ userId, body: parsed.data.body });
  return NextResponse.json({ ok: true });
}
