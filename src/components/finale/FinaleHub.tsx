import Link from 'next/link';
import { ArrowRight, Sparkles, Users, Medal, Vote } from 'lucide-react';

// The three doors (plus the voting booth) that the whole finale hangs off.
// Rendered on /results and inlined at the top of /home once the final ends.
export default function FinaleHub({
  poolId,
  poolName,
  points,
  rank,
  fieldSize,
  championName,
  votesDone,
  votesTotal,
  compact = false,
}: {
  poolId: string;
  poolName: string;
  points: number;
  rank: number | null;
  fieldSize: number;
  championName: string | null;
  votesDone: number;
  votesTotal: number;
  compact?: boolean;
}) {
  const q = `?pool=${poolId}`;
  const votesLeft = Math.max(0, votesTotal - votesDone);

  return (
    <div className="space-y-3">
      {!compact ? (
        <header className="pb-1 pt-2 text-center">
          <p className="finale-kicker text-gold">Full time</p>
          <h1 className="shine mt-1 font-display text-5xl leading-none">The finale</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
            It is over. Everything that happened in {poolName} over the last month, three ways.
          </p>
        </header>
      ) : null}

      {/* Your Wrapped */}
      <Link
        href={`/results/wrapped${q}`}
        className="door shine-sweep block p-5"
        style={{ '--door-glow': 'rgba(30,230,164,0.22)' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 ring-1 ring-accent/40">
            <Sparkles className="h-5 w-5 text-accent" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl leading-none text-accent">Your Wrapped</div>
            <div className="mt-0.5 text-xs text-muted">
              Your tournament, slide by slide. Not all of it is flattering.
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-accent" />
        </div>
        <div className="mt-3 flex items-end gap-4 border-t border-edge pt-3">
          <span>
            <span className="block font-display text-3xl leading-none text-foreground">{points}</span>
            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-muted">points</span>
          </span>
          {rank ? (
            <span>
              <span className="block font-display text-3xl leading-none text-foreground">
                {rank}
                <span className="text-muted">/{fieldSize}</span>
              </span>
              <span className="text-[0.6rem] font-bold uppercase tracking-wider text-muted">finish</span>
            </span>
          ) : null}
        </div>
      </Link>

      {/* Pool Wrapped */}
      <Link
        href={`/results/pool${q}`}
        className="door shine-sweep-2 block p-5"
        style={{ '--door-glow': 'rgba(255,200,80,0.2)' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/40">
            <Users className="h-5 w-5 text-gold" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-2xl leading-none text-gold">{poolName} Wrapped</div>
            <div className="mt-0.5 text-xs text-muted">
              What the {fieldSize} of you did to each other, in numbers.
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-gold" />
        </div>
      </Link>

      {/* The podium */}
      <Link
        href={`/results/podium${q}`}
        className="door block p-5"
        style={{ '--door-glow': 'rgba(255,255,255,0.14)' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3">
          <span className="medal-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <Medal className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl leading-none">The podium</div>
            <div className="mt-0.5 text-xs text-muted">
              {championName ? (
                <>
                  Gold, silver and bronze.{' '}
                  <span className="select-none blur-[3px]">{championName}</span> took it.
                </>
              ) : (
                'Gold, silver and bronze, revealed properly.'
              )}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
        </div>
      </Link>

      {/* Voting */}
      <Link
        href={`/results/vote${q}`}
        className="door relative block p-5"
        style={{ '--door-glow': 'rgba(255,93,115,0.16)' } as React.CSSProperties}
      >
        {votesLeft > 0 ? (
          <span className="absolute right-3 top-3 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-live px-1 text-[0.6rem] font-bold leading-none text-white">
            {votesLeft}
          </span>
        ) : null}
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-live/15 ring-1 ring-live/40">
            <Vote className="h-5 w-5 text-live" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl leading-none text-live">The people&apos;s awards</div>
            <div className="mt-0.5 text-xs text-muted">
              {votesLeft > 0
                ? `${votesLeft} ${votesLeft === 1 ? 'category' : 'categories'} still need your vote. Everyone sees who you picked.`
                : 'You have voted in every category. Go and check the damage.'}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-live" />
        </div>
      </Link>
    </div>
  );
}
