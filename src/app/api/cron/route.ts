import { NextResponse } from 'next/server';
import { inLiveWindow, lastFullSyncMs, runSync, inScheduledMatchWindow } from '@/lib/sync';

export const maxDuration = 60;

const IDLE_FLOOR_MS = 30 * 60 * 1000; // off-window cadence: 30 minutes

// Cron entry (Vercel Cron or an external pinger), every 2 minutes.
// Self-gates to stay tidy within football-data.org's 10 req/min: full
// sync every tick only while a match is live or imminent, otherwise at
// most every 30 minutes.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // DB-free gate: outside every remaining fixture's live window, do nothing and
  // never open a Postgres connection, so Neon scales to zero between matches.
  // Update REMAINING_KICKOFFS_UTC in sync.ts when fixtures change.
  if (!inScheduledMatchWindow()) {
    return NextResponse.json({ skipped: true, reason: 'no scheduled match window' });
  }

  try {
    const live = await inLiveWindow();
    if (!live) {
      const last = await lastFullSyncMs();
      if (Date.now() - last < IDLE_FLOOR_MS) {
        return NextResponse.json({ skipped: true, reason: 'idle window' });
      }
    }
    const report = await runSync();
    return NextResponse.json({ skipped: false, live, ...report });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'cron sync failed' },
      { status: 500 },
    );
  }
}
