import { TrendingUp, TrendingDown, Flame, ArrowUp, ArrowDown } from 'lucide-react';

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export interface RecapData {
  climber: { name: string; up: number } | null;
  faller: { name: string; down: number } | null;
  gainer: { name: string; pts: number } | null;
  you: { rankDelta: number; gained: number; rank: number } | null;
}

// Renders nothing until there's actually movement to talk about.
export default function DailyRecap({ data }: { data: RecapData }) {
  const { climber, faller, gainer, you } = data;
  if (!climber && !faller && !gainer && !(you && (you.rankDelta !== 0 || you.gained > 0))) {
    return null;
  }

  return (
    <section className="reveal card space-y-2.5 p-4" style={{ animationDelay: '90ms' }}>
      <div className="flex items-center justify-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-muted">
        <Flame className="h-3.5 w-3.5 text-gold" />
        Daily recap
      </div>
      <ul className="space-y-1.5 text-sm">
        {gainer ? (
          <li className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-bold">{gainer.name}</span> banked the most today
            </span>
            <span className="shrink-0 font-display text-lg text-accent">+{gainer.pts}</span>
          </li>
        ) : null}
        {climber ? (
          <li className="flex items-center gap-2">
            <ArrowUp className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-bold">{climber.name}</span> climbed the table
            </span>
            <span className="shrink-0 font-display text-lg text-accent">+{climber.up}</span>
          </li>
        ) : null}
        {faller ? (
          <li className="flex items-center gap-2">
            <ArrowDown className="h-4 w-4 shrink-0 text-live" />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-bold">{faller.name}</span> slipped back
            </span>
            <span className="shrink-0 font-display text-lg text-live">-{faller.down}</span>
          </li>
        ) : null}
        {you && (you.rankDelta !== 0 || you.gained > 0) ? (
          <li className="flex items-center gap-2 border-t border-edge/50 pt-1.5">
            {you.rankDelta >= 0 ? (
              <TrendingUp className="h-4 w-4 shrink-0 text-accent" />
            ) : (
              <TrendingDown className="h-4 w-4 shrink-0 text-live" />
            )}
            <span className="min-w-0 flex-1 truncate">
              You{' '}
              {you.rankDelta > 0
                ? `climbed to ${ordinal(you.rank)}`
                : you.rankDelta < 0
                  ? `slipped to ${ordinal(you.rank)}`
                  : `held ${ordinal(you.rank)}`}
              {you.gained > 0 ? `, +${you.gained} pts` : ''}
            </span>
            <span
              className={`shrink-0 font-display text-lg ${you.rankDelta < 0 ? 'text-live' : 'text-accent'}`}
            >
              {you.rankDelta > 0
                ? `+${you.rankDelta}`
                : you.rankDelta < 0
                  ? `${you.rankDelta}`
                  : `+${you.gained}`}
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
