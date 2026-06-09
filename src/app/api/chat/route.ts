import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { messages } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { isPoolMember } from '@/lib/access';

const postSchema = z.object({
  poolId: z.string().uuid(),
  body: z.string().trim().min(1).max(280),
});

// Post a message to a group's smack-talk feed. Members only.
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  if (!(await isPoolMember(userId, parsed.data.poolId))) {
    return NextResponse.json({ error: 'not a member' }, { status: 403 });
  }

  await db.insert(messages).values({
    poolId: parsed.data.poolId,
    userId,
    body: parsed.data.body,
  });
  return NextResponse.json({ ok: true });
}
