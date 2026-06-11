import Link from 'next/link';
import { redirect } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { Target } from 'lucide-react';
import { db } from '@/lib/db';
import { matchPredictions, matches, teams } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { FINAL_STATUSES } from '@/lib/constants';
import { PREDICT_EXACT_POINTS, predictState } from '@/lib/predict';
import { DISPLAY_TZ_LABEL, matchDayLabel, matchTime } from '@/lib/format-time';
import MatchPredict from '@/components/predict/MatchPredict';

export const dynamic = 'force-dynamic';

export default async function PredictPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect('/');

  // Optional group filter (?group=A), so you can set a whole group's
  // predictions on one focused screen instead of scrolling everything.
  const { group } = await searchParams;
  const activeGroup = group && /^[A-L]$/i.test(group) ? group.toUpperCase() : null;

  const allMatches = await db
    .select()
    .from(matches)
    .orderBy(asc(matches.kickoffUtc), asc(matches.id));
  const allTeams = await db.select().from(teams);
  const byCode = new Map(allTeams.map((t) => [t.code, t]));
  const preds = await db
    .select()
    .from(matchPredictions)
    .where(eq(matchPredictions.userId, userId));
  const predByMatch = new Map(preds.map((p) => [p.matchId, p]));
  const bonus = preds.reduce((s, p) => s + p.points, 0);

  // Rendered per request (force-dynamic), so reading the clock is fine.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const isFinal = (s: string) => (FINAL_STATUSES as readonly string[]).includes(s);
  const label = (code: string | null, ph: string | null) => {
    const t = code ? byCode.get(code) : null;
    return { name: t?.name ?? ph ?? 'TBD', flag: t?.flag ?? '⚽' };
  };

  const open: typeof allMatches = [];
  const upcoming: typeof allMatches = [];
  for (const m of allMatches) {
    const st = predictState(m.kickoffUtc, now);
    if (st === 'open') open.push(m);
    else if (st === 'upcoming') upcoming.push(m);
  }
  // Only matches whose window opens within the next 48 hours.
  const upcomingShow = upcoming.filter((m) => m.kickoffUtc.getTime() <= now + 48 * 3600 * 1000);
  // Your settled predictions, most recent kickoff first.
  const results = allMatches
    .filter((m) => predByMatch.has(m.id) && m.kickoffUtc.getTime() <= now)
    .reverse();

  // Group switcher: offer a pill per group that has any match on this page.
  const groupsAvailable = [
    ...new Set(
      [...open, ...upcomingShow, ...results]
        .map((m) => m.groupLetter)
        .filter((g): g is string => !!g),
    ),
  ].sort();
  const inGroup = (m: (typeof allMatches)[number]) => !activeGroup || m.groupLetter === activeGroup;
  const openShown = open.filter(inGroup);
  const upcomingFiltered = upcomingShow.filter(inGroup);
  const resultsFiltered = results.filter(inGroup);
  const pill = (on: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
      on ? 'border-accent bg-accent/10 text-accent' : 'border-edge bg-white/[0.02] text-muted'
    }`;

  return (
    <div className="space-y-5 py-4 lg:mx-auto lg:max-w-2xl">
      <header className="pt-2 text-center">
        <h1 className="font-display text-4xl leading-none">Predict</h1>
        <p className="mt-1 text-sm text-muted">
          Call the exact scoreline for bonus points
        </p>
      </header>

      <div className="card flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-accent/30">
          <Target className="h-6 w-6 text-accent" strokeWidth={2} />
        </div>
        <div className="flex-1 text-sm text-muted">
          Nail the exact score and earn{' '}
          <span className="font-bold text-accent">{PREDICT_EXACT_POINTS} bonus points</span>. Predictions
          open 24h before kickoff and lock when the match starts.
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-3xl leading-none text-accent">{bonus}</div>
          <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted">bonus</div>
        </div>
      </div>

      {groupsAvailable.length >= 2 ? (
        <div className="flex justify-center gap-2 overflow-x-auto pb-1">
          <Link href="/predict" className={pill(!activeGroup)}>
            All
          </Link>
          {groupsAvailable.map((g) => (
            <Link key={g} href={`/predict?group=${g}`} className={pill(activeGroup === g)}>
              Group {g}
            </Link>
          ))}
        </div>
      ) : null}

      <section>
        <h2 className="mb-2 text-center font-display text-2xl">Open now</h2>
        {openShown.length === 0 ? (
          <p className="card p-4 text-sm text-muted">
            {activeGroup
              ? `Nothing open to predict in Group ${activeGroup} right now.`
              : 'Nothing open to predict yet. Matches open 24h before kickoff, so check back soon.'}
          </p>
        ) : (
          <div className="space-y-3">
            {openShown.map((m) => {
              const h = label(m.homeCode, m.homePlaceholder);
              const a = label(m.awayCode, m.awayPlaceholder);
              const p = predByMatch.get(m.id);
              return (
                <div key={m.id} className="space-y-1">
                  <p className="px-1 text-xs text-muted-2">
                    {matchDayLabel(m.kickoffUtc).split(',')[0]} · locks {matchTime(m.kickoffUtc)}{' '}
                    {DISPLAY_TZ_LABEL}
                  </p>
                  <MatchPredict
                    matchId={m.id}
                    home={h.name}
                    away={a.name}
                    homeFlag={h.flag}
                    awayFlag={a.flag}
                    initial={p ? { home: p.homeScore, away: p.awayScore } : null}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {resultsFiltered.length > 0 ? (
        <section>
          <h2 className="mb-2 text-center font-display text-2xl">Your results</h2>
          <ul className="space-y-2">
            {resultsFiltered.map((m) => {
              const h = label(m.homeCode, m.homePlaceholder);
              const a = label(m.awayCode, m.awayPlaceholder);
              const p = predByMatch.get(m.id)!;
              const settled = isFinal(m.status) && m.homeScore != null && m.awayScore != null;
              const hit = settled && p.points > 0;
              return (
                <li key={m.id} className={`card flex items-center gap-3 p-3 ${hit ? 'border-accent/50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {h.flag} {h.name} <span className="text-muted-2">v</span> {a.flag} {a.name}
                    </div>
                    <div className="text-xs text-muted">
                      You: {p.homeScore}–{p.awayScore}
                      {settled ? ` · Actual: ${m.homeScore}–${m.awayScore}` : ' · awaiting result'}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`font-display text-xl leading-none ${hit ? 'text-accent' : 'text-muted'}`}>
                      +{p.points}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {upcomingFiltered.length > 0 ? (
        <section>
          <h2 className="mb-2 text-center font-display text-2xl text-muted">Opening soon</h2>
          <ul className="space-y-2">
            {upcomingFiltered.map((m) => {
              const h = label(m.homeCode, m.homePlaceholder);
              const a = label(m.awayCode, m.awayPlaceholder);
              return (
                <li key={m.id} className="card flex items-center justify-between gap-2 p-3 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {h.flag} {h.name} <span className="text-muted-2">v</span> {a.flag} {a.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {matchDayLabel(m.kickoffUtc).split(',')[0]} {matchTime(m.kickoffUtc)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
