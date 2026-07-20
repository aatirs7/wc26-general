import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { superlativeVotes } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { isPoolMember } from '@/lib/access';
import { superlativeByKey } from '@/lib/superlatives';

const postSchema = z.object({
  poolId: z.string().uuid(),
  categoryKey: z.string().min(1).max(64),
  subjectId: z.string().uuid(),
});

const deleteSchema = z.object({
  poolId: z.string().uuid(),
  categoryKey: z.string().min(1).max(64),
});

// Cast (or change) your vote in one superlative category. One vote per voter
// per category per pool, so voting again simply replaces the previous pick.
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const { poolId, categoryKey, subjectId } = parsed.data;

  const category = superlativeByKey(categoryKey);
  if (!category) return NextResponse.json({ error: 'unknown category' }, { status: 400 });

  if (subjectId === userId && !category.allowSelf) {
    return NextResponse.json({ error: 'no self votes in this category' }, { status: 400 });
  }

  // Both the voter and the person being crowned have to be in the pool.
  if (!(await isPoolMember(userId, poolId))) {
    return NextResponse.json({ error: 'not a member' }, { status: 403 });
  }
  if (!(await isPoolMember(subjectId, poolId))) {
    return NextResponse.json({ error: 'subject is not a member' }, { status: 400 });
  }

  await db
    .insert(superlativeVotes)
    .values({ poolId, voterId: userId, categoryKey, subjectId })
    .onConflictDoUpdate({
      target: [superlativeVotes.poolId, superlativeVotes.voterId, superlativeVotes.categoryKey],
      set: { subjectId, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}

// Withdraw your vote in a category.
export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  await db
    .delete(superlativeVotes)
    .where(
      and(
        eq(superlativeVotes.poolId, parsed.data.poolId),
        eq(superlativeVotes.voterId, userId),
        eq(superlativeVotes.categoryKey, parsed.data.categoryKey),
      ),
    );

  return NextResponse.json({ ok: true });
}
