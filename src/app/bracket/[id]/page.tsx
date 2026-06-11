import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { bracketScores, teams, users } from '@/lib/schema';
import { bracketAccess, loadBracket } from '@/lib/access';
import { currentUserId } from '@/lib/auth';
import BracketSummary from '@/components/brackets/BracketSummary';
import ShareBracket from '@/components/brackets/ShareBracket';

export const dynamic = 'force-dynamic';

export default async function BracketViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await currentUserId();

  const bracket = await loadBracket(id);
  if (!bracket) notFound();

  // Pool members can view each other's brackets read-only at any time;
  // everyone else gets a 404 that does not reveal existence.
  const access = await bracketAccess(userId, bracket);
  if (!access.canView) notFound();

  const [owner] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, bracket.ownerId))
    .limit(1);

  const scores = await db
    .select({ roundKey: bracketScores.roundKey, points: bracketScores.points })
    .from(bracketScores)
    .where(eq(bracketScores.bracketId, bracket.id));

  const allTeams = await db
    .select()
    .from(teams)
    .orderBy(asc(teams.groupLetter), asc(teams.name));

  const scored = scores.filter((s) => s.points > 0);

  return (
    <div className="space-y-5 py-4 lg:mx-auto lg:max-w-3xl">
      <header className="card flex items-center justify-between p-4 pt-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl leading-none">{bracket.name}</h1>
          <p className="mt-1 text-sm text-muted">
            by {owner?.displayName ?? 'Unknown'}
            {bracket.submitted ? '' : ' · not submitted'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <div className="font-display text-4xl leading-none text-accent">{bracket.totalPoints}</div>
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-muted">pts</div>
          </div>
          <ShareBracket title={`${owner?.displayName ?? ''}'s World Cup 2026 bracket`} />
        </div>
      </header>

      {scored.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {scored.map((s) => (
            <span
              key={s.roundKey}
              className="rounded-full border border-edge bg-white/[0.03] px-2.5 py-1 text-xs font-semibold"
            >
              {s.roundKey} <span className="font-bold text-accent">+{s.points}</span>
            </span>
          ))}
        </div>
      ) : null}

      <BracketSummary predictions={bracket.predictions} teams={allTeams} />
    </div>
  );
}
