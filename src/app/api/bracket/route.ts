import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { bracketScores, brackets } from '@/lib/schema';
import { isPoolMember } from '@/lib/access';
import { currentUserId } from '@/lib/auth';
import { isLocked } from '@/lib/lock';
import { isComplete, pruneDownstream, validatePredictions } from '@/lib/predictions';
import { emptyPredictions } from '@/types/bracket';

const postSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    poolId: z.string().uuid(),
    name: z.string().trim().min(1).max(60).default('My bracket'),
    // Optional: copy picks from one of the user's own brackets in another group.
    copyFrom: z.string().uuid().optional(),
  }),
  z.object({ action: z.literal('submit'), id: z.string().uuid() }),
]);

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(60).optional(),
  predictions: z.unknown().optional(),
});

async function loadOwned(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(brackets)
    .where(and(eq(brackets.id, id), eq(brackets.ownerId, userId)))
    .limit(1);
  return row ?? null;
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const body = parsed.data;

  if (body.action === 'create') {
    if (isLocked()) {
      // Late joiners can view and follow the leaderboard but not enter.
      return NextResponse.json({ error: 'did not lock' }, { status: 403 });
    }
    if (!(await isPoolMember(userId, body.poolId))) {
      return NextResponse.json({ error: 'not a pool member' }, { status: 403 });
    }
    const [existing] = await db
      .select()
      .from(brackets)
      .where(and(eq(brackets.ownerId, userId), eq(brackets.poolId, body.poolId)))
      .limit(1);
    if (existing) return NextResponse.json({ bracket: existing });

    // Optionally seed from one of the user's own brackets in another group.
    let predictions = emptyPredictions();
    if (body.copyFrom) {
      const src = await loadOwned(body.copyFrom, userId);
      if (src) {
        try {
          predictions = pruneDownstream(validatePredictions(src.predictions));
        } catch {
          predictions = emptyPredictions();
        }
      }
    }

    const [bracket] = await db
      .insert(brackets)
      .values({
        ownerId: userId,
        poolId: body.poolId,
        name: body.name,
        predictions,
      })
      .returning();
    return NextResponse.json({ bracket });
  }

  // submit
  if (isLocked()) return NextResponse.json({ error: 'locked' }, { status: 403 });
  const bracket = await loadOwned(body.id, userId);
  if (!bracket) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!isComplete(bracket.predictions)) {
    return NextResponse.json({ error: 'bracket is incomplete' }, { status: 400 });
  }
  const [updated] = await db
    .update(brackets)
    .set({ submitted: true, lockedAt: new Date(), updatedAt: new Date() })
    .where(eq(brackets.id, bracket.id))
    .returning();
  return NextResponse.json({ bracket: updated });
}

export async function PATCH(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const { id, name, predictions } = parsed.data;

  const bracket = await loadOwned(id, userId);
  if (!bracket) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const set: Record<string, unknown> = { updatedAt: new Date() };

  // Renaming is cosmetic and allowed any time; picks freeze at lock.
  if (name) set.name = name;

  if (predictions !== undefined) {
    if (isLocked()) return NextResponse.json({ error: 'locked' }, { status: 403 });
    let validated;
    try {
      validated = validatePredictions(predictions);
    } catch {
      return NextResponse.json({ error: 'invalid predictions' }, { status: 400 });
    }
    // Defense in depth: never persist a structurally stale chain.
    set.predictions = pruneDownstream(validated);
    // Changing picks after submitting requires a fresh submit; the
    // tiebreaker rewards the final submit time.
    if (bracket.submitted) {
      set.submitted = false;
      set.lockedAt = null;
    }
  }

  const [updated] = await db
    .update(brackets)
    .set(set)
    .where(eq(brackets.id, bracket.id))
    .returning();
  return NextResponse.json({ bracket: updated });
}

const deleteSchema = z.object({ id: z.string().uuid() });

// Delete a bracket entirely (owner only, before lock). Lets a player
// start over from scratch.
export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  if (isLocked()) return NextResponse.json({ error: 'locked' }, { status: 403 });

  const bracket = await loadOwned(parsed.data.id, userId);
  if (!bracket) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await db.delete(bracketScores).where(eq(bracketScores.bracketId, bracket.id));
  await db.delete(brackets).where(eq(brackets.id, bracket.id));
  return NextResponse.json({ ok: true });
}
