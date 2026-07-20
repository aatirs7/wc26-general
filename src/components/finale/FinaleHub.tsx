import Link from 'next/link';
import { Sparkles, Users, Medal, Vote, MessageSquareHeart } from 'lucide-react';

// The three doors (plus the voting booth) the whole finale hangs off.
// Rendered on /results and inlined at the top of /home once the final ends.
//
// Everything here is centre-aligned on purpose: one hero, one feature tile,
// a two-up row, then the voting strip. No left-aligned icon-and-text rows.

function Disc({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'accent' | 'gold' | 'live' | 'medal';
}) {
  const cls =
    tone === 'medal'
      ? 'medal-1'
      : tone === 'gold'
        ? 'bg-gold/15 text-gold ring-1 ring-gold/40'
        : tone === 'live'
          ? 'bg-live/15 text-live ring-1 ring-live/40'
          : 'bg-accent/15 text-accent ring-1 ring-accent/40';
  return (
    <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${cls}`}>
      {children}
    </span>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex-1 text-center">
      <div className="font-display text-3xl leading-none">{value}</div>
      <div className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
    </div>
  );
}

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
    <div className="space-y-3 text-center">
      {!compact ? (
        <header className="pb-2 pt-2">
          <p className="finale-kicker text-gold">Full time</p>
          <h1 className="shine mt-1 font-display text-5xl leading-none">The finale</h1>
          <p className="mx-auto mt-2 max-w-[17rem] text-sm leading-relaxed text-muted">
            It is over. Everything that happened in {poolName}, three ways.
          </p>
        </header>
      ) : (
        <p className="finale-kicker pt-1 text-gold">Full time</p>
      )}

      {/* Feature tile: your own recap, with your headline numbers. */}
      <Link
        href={`/results/recap${q}`}
        className="door shine-sweep block px-5 pb-5 pt-6 active:scale-[0.99]"
        style={{ '--door-glow': 'rgba(30,230,164,0.24)' } as React.CSSProperties}
      >
        <Disc tone="accent">
          <Sparkles className="h-6 w-6" strokeWidth={2.2} />
        </Disc>
        <h2 className="mt-3 font-display text-3xl leading-none text-accent">Your recap</h2>
        <p className="mx-auto mt-1 max-w-[16rem] text-xs leading-relaxed text-muted">
          Your tournament, slide by slide. Not all of it is flattering.
        </p>
        <div className="mt-4 flex items-start border-t border-edge pt-3">
          <Stat value={points} label="points" />
          {rank ? (
            <>
              <span className="w-px self-stretch bg-[var(--line)]" aria-hidden />
              <Stat
                value={
                  <>
                    {rank}
                    <span className="text-muted">/{fieldSize}</span>
                  </>
                }
                label="finish"
              />
            </>
          ) : null}
        </div>
      </Link>

      {/* Two-up: the group's story and the podium. */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/results/pool${q}`}
          className="door shine-sweep-2 flex flex-col items-center justify-start px-3 pb-4 pt-5 active:scale-[0.98]"
          style={{ '--door-glow': 'rgba(255,200,80,0.22)' } as React.CSSProperties}
        >
          <Disc tone="gold">
            <Users className="h-6 w-6" strokeWidth={2.2} />
          </Disc>
          <h2 className="mt-3 font-display text-2xl leading-none text-gold">Pool recap</h2>
          <p className="mt-1 text-[0.7rem] leading-snug text-muted">
            What the {fieldSize} of you did to each other
          </p>
        </Link>

        <Link
          href={`/results/podium${q}`}
          className="door flex flex-col items-center justify-start px-3 pb-4 pt-5 active:scale-[0.98]"
          style={{ '--door-glow': 'rgba(255,200,80,0.16)' } as React.CSSProperties}
        >
          <Disc tone="medal">
            <Medal className="h-6 w-6" strokeWidth={2.2} />
          </Disc>
          <h2 className="mt-3 font-display text-2xl leading-none">The podium</h2>
          <p className="mt-1 text-[0.7rem] leading-snug text-muted">
            {championName ? (
              <>
                <span className="select-none blur-[4px]">{championName}</span> took it
              </>
            ) : (
              'Gold, silver and bronze'
            )}
          </p>
        </Link>
      </div>

      {/* Voting strip. */}
      <Link
        href={`/results/vote${q}`}
        className="door relative block px-5 pb-4 pt-5 active:scale-[0.99]"
        style={{ '--door-glow': 'rgba(255,93,115,0.18)' } as React.CSSProperties}
      >
        {votesLeft > 0 ? (
          <span className="absolute right-3 top-3 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-live px-1 text-[0.6rem] font-bold leading-none text-white">
            {votesLeft}
          </span>
        ) : null}
        <Disc tone="live">
          <Vote className="h-6 w-6" strokeWidth={2.2} />
        </Disc>
        <h2 className="mt-3 font-display text-2xl leading-none text-live">
          The people&apos;s awards
        </h2>
        <p className="mx-auto mt-1 max-w-[17rem] text-xs leading-relaxed text-muted">
          {votesLeft > 0
            ? `${votesLeft} ${votesLeft === 1 ? 'category' : 'categories'} still need your vote.`
            : 'You have voted in every category. Go and check the damage.'}
        </p>
        <p className="mt-2 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-2">
          {votesDone} of {votesTotal} voted
        </p>
      </Link>

      {/* Suggestions and reviews. */}
      <Link
        href="/feedback"
        className="door block px-5 pb-4 pt-5 active:scale-[0.99]"
        style={{ '--door-glow': 'rgba(30,230,164,0.12)' } as React.CSSProperties}
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/40">
          <MessageSquareHeart className="h-6 w-6" strokeWidth={2.2} />
        </span>
        <h2 className="mt-3 font-display text-2xl leading-none">Thanks for playing</h2>
        <p className="mx-auto mt-1 max-w-[17rem] text-xs leading-relaxed text-muted">
          Tell me what you thought. Suggestions, reviews, complaints, all welcome.
        </p>
      </Link>
    </div>
  );
}
