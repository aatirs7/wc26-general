import Link from 'next/link';
import { redirect } from 'next/navigation';
import { finaleGate } from '@/lib/finale-access';
import { loadResults } from '@/lib/results';
import { loadVotes } from '@/lib/votes';
import FinaleHub from '@/components/finale/FinaleHub';

export const dynamic = 'force-dynamic';

// The finale hub: the three doors plus voting. Every other /results/* route
// is one of the doors.
export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const { pool: requested } = await searchParams;
  const gate = await finaleGate(requested);

  if (gate.state === 'anon') redirect('/');
  if (gate.state === 'no-pool') redirect('/bracket');

  if (gate.state === 'locked') {
    return (
      <div className="py-4 lg:mx-auto lg:max-w-2xl">
        <header className="pt-10 text-center">
          <div className="anim-trophy text-6xl">🏆</div>
          <h1 className="mt-3 font-display text-4xl">The finale</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            The podium, your Recap, the pool Recap and the people&apos;s awards all unlock the moment
            the World Cup final ends. Come back once the trophy is lifted.
          </p>
        </header>
      </div>
    );
  }

  // In more than one pool and have not said which: choose first. A recap only
  // means anything against a specific group, so guessing from a cookie would
  // launch the wrong one.
  if (gate.needsChoice) {
    return (
      <div className="py-4 text-center lg:mx-auto lg:max-w-2xl">
        <header className="pt-6">
          <p className="finale-kicker text-gold">Full time</p>
          <h1 className="shine mt-1 font-display text-5xl leading-none">The finale</h1>
          <p className="mx-auto mt-2 max-w-[17rem] text-sm leading-relaxed text-muted">
            You are in {gate.memberships.length} pools. Pick the one you want the recap for.
          </p>
        </header>
        <div className="mt-6 space-y-2">
          {gate.memberships.map((m) => (
            <Link
              key={m.poolId}
              href={`/results?pool=${m.poolId}`}
              className="door block px-5 py-4 active:scale-[0.99]"
              style={{ '--door-glow': 'rgba(30,230,164,0.18)' } as React.CSSProperties}
            >
              <span className="block font-display text-2xl leading-none">{m.poolName}</span>
              <span className="mt-1 block text-xs text-muted">See this pool&apos;s finale</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const [data, votes] = await Promise.all([
    loadResults(gate.active.poolId, gate.userId),
    loadVotes(gate.active.poolId, gate.userId),
  ]);

  return (
    <div className="py-4 lg:mx-auto lg:max-w-2xl">
      {gate.memberships.length > 1 ? (
        <div className="mb-3 flex justify-center gap-2 overflow-x-auto pb-1">
          {gate.memberships.map((m) => (
            <Link
              key={m.poolId}
              href={`/results?pool=${m.poolId}`}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                m.poolId === gate.active.poolId
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-edge bg-white/[0.02] text-muted'
              }`}
            >
              {m.poolName}
            </Link>
          ))}
        </div>
      ) : null}

      {!gate.over ? (
        <p className="mb-3 rounded-xl border border-gold/40 bg-gold/[0.08] px-3 py-2 text-center text-[0.7rem] font-semibold text-gold">
          Preview, computed from the standings as they are right now. The real finale unlocks when the
          World Cup final ends.
        </p>
      ) : null}

      <FinaleHub
        poolId={gate.active.poolId}
        poolName={data.poolName}
        points={data.viewer?.player.combined ?? 0}
        rank={data.viewer?.player.rank ?? null}
        fieldSize={data.standings.length}
        championName={data.podium[0]?.name ?? null}
        votesDone={votes.myVoteCount}
        votesTotal={votes.categories.length}
      />
    </div>
  );
}
