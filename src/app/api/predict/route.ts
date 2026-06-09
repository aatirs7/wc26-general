import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { matchPredictions, matches } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { PREDICT_MAX_GOALS, predictState } from '@/lib/predict';

const bodySchema = z.object({
  matchId: z.number().int(),
  home: z.number().int().min(0).max(PREDICT_MAX_GOALS),
  away: z.number().int().min(0).max(PREDICT_MAX_GOALS),
});

// Save (or update) a score prediction for a match. Only allowed while the
// match's prediction window is open (24h before kickoff until kickoff).
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const { matchId, home, away } = parsed.data;

  const [match] = await db
    .select({ kickoffUtc: matches.kickoffUtc })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) return NextResponse.json({ error: 'no such match' }, { status: 404 });

  if (predictState(match.kickoffUtc, Date.now()) !== 'open') {
    return NextResponse.json({ error: 'predictions are not open for this match' }, { status: 403 });
  }

  await db
    .insert(matchPredictions)
    .values({ userId, matchId, homeScore: home, awayScore: away })
    .onConflictDoUpdate({
      target: [matchPredictions.userId, matchPredictions.matchId],
      set: { homeScore: home, awayScore: away, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({ matchId: z.number().int() });

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const [match] = await db
    .select({ kickoffUtc: matches.kickoffUtc })
    .from(matches)
    .where(eq(matches.id, parsed.data.matchId))
    .limit(1);
  if (match && predictState(match.kickoffUtc, Date.now()) !== 'open') {
    return NextResponse.json({ error: 'locked' }, { status: 403 });
  }

  await db
    .delete(matchPredictions)
    .where(
      and(eq(matchPredictions.userId, userId), eq(matchPredictions.matchId, parsed.data.matchId)),
    );
  return NextResponse.json({ ok: true });
}
