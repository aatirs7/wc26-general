import Link from 'next/link';
import { cookies } from 'next/headers';
import { Trophy, Lock, Timer } from 'lucide-react';
import { currentUserId, LAST_NAME_COOKIE } from '@/lib/auth';
import { isLocked, kickoffUtc } from '@/lib/lock';
import { DISPLAY_TZ_LABEL, matchDayLabel, matchTime } from '@/lib/format-time';
import NameEntry from '@/components/auth/NameEntry';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const userId = await currentUserId();
  const locked = isLocked();
  const kickoff = kickoffUtc();
  const lastName = userId ? null : (await cookies()).get(LAST_NAME_COOKIE)?.value ?? null;

  return (
    <div className="flex min-h-[88vh] flex-col items-center justify-center gap-8 py-12 text-center">
      <div className="reveal space-y-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/30">
          <Trophy className="h-10 w-10 text-accent" strokeWidth={2} />
        </div>
        <div>
          <p className="font-display text-lg tracking-[0.45em] text-accent">FIFA</p>
          <h1 className="font-display text-7xl leading-[0.82] tracking-tight">
            World Cup
            <span className="block shine text-8xl">2026</span>
          </h1>
          <p className="mt-1 font-display text-2xl tracking-[0.3em] text-muted">Bracket Pool</p>
        </div>

        <div className="mx-auto max-w-xs space-y-1">
          <p className="font-display text-2xl tracking-wide text-foreground">
            World Cup 2026 Bracket Pool
          </p>
          <p className="text-sm leading-relaxed text-muted">
            Rank every group, call the knockouts, and see who has the best ball knowledge...
            May the best bracket win.
          </p>
        </div>
      </div>

      <div
        className={`reveal inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
          locked ? 'border-live/30 bg-live/10 text-live' : 'border-gold/30 bg-gold/10 text-gold'
        }`}
        style={{ animationDelay: '80ms' }}
      >
        {locked ? <Lock className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
        {locked
          ? 'Brackets locked — the tournament is on'
          : `Locks ${matchDayLabel(kickoff)}, ${matchTime(kickoff)} ${DISPLAY_TZ_LABEL}`}
      </div>

      <div className="reveal w-full max-w-xs" style={{ animationDelay: '160ms' }}>
        {!userId ? (
          <NameEntry lastName={lastName} />
        ) : (
          <Link
            href="/bracket"
            className="flex min-h-13 w-full items-center justify-center rounded-2xl bg-accent text-lg font-bold text-[var(--accent-ink)] shadow-lg shadow-accent/20 active:scale-95"
          >
            {locked ? 'View your bracket' : 'Build your bracket'}
          </Link>
        )}
      </div>

      <p
        className="reveal text-xs text-muted-2"
        style={{ animationDelay: '240ms' }}
      >
        World Cup 2026 Bracket Pool ·{' '}
        <span className="text-muted">2026</span>
      </p>
    </div>
  );
}
