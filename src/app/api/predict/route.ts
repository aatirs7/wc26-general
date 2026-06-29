import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { matchPredictions, matches } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { KNOCKOUT_STAGES, PREDICT_MAX_GOALS, predictState } from '@/lib/predict';

const bodySchema = z.object({
  matchId: z.number().int(),
  home: z.number().int().min(0).max(PREDICT_MAX_GOALS),
  away: z.number().int().min(0).max(PREDICT_MAX_GOALS),
  // Optional knockout shootout pick: the team code predicted to win on pens,
  // or null/absent for none.
  pensWinner: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
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
    .select({
      kickoffUtc: matches.kickoffUtc,
      stage: matches.stage,
      homeCode: matches.homeCode,
      awayCode: matches.awayCode,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) return NextResponse.json({ error: 'no such match' }, { status: 404 });

  if (predictState(match.kickoffUtc, Date.now()) !== 'open') {
    return NextResponse.json({ error: 'predictions are not open for this match' }, { status: 403 });
  }

  // A shootout pick only makes sense on a knockout tie you called level, and it
  // must be one of the two sides. Anything else is stored as no pick.
  let pensWinner: string | null = null;
  if (
    parsed.data.pensWinner &&
    KNOCKOUT_STAGES.has(match.stage) &&
    home === away &&
    (parsed.data.pensWinner === match.homeCode || parsed.data.pensWinner === match.awayCode)
  ) {
    pensWinner = parsed.data.pensWinner;
  }

  await db
    .insert(matchPredictions)
    .values({ userId, matchId, homeScore: home, awayScore: away, pensWinner })
    .onConflictDoUpdate({
      target: [matchPredictions.userId, matchPredictions.matchId],
      set: { homeScore: home, awayScore: away, pensWinner, updatedAt: new Date() },
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
