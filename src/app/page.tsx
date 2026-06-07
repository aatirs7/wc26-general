import Link from 'next/link';
import { currentUserId, listPlayers } from '@/lib/auth';
import { isLocked, kickoffUtc } from '@/lib/lock';
import NamePicker from '@/components/auth/NamePicker';

export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  const userId = await currentUserId();
  const locked = isLocked();
  const kickoff = kickoffUtc();
  const players = userId ? [] : await listPlayers();

  return (
    <div className="flex min-h-[88vh] flex-col items-center justify-center gap-9 py-12 text-center">
      <div className="reveal space-y-4">
        <div className="text-6xl drop-shadow-[0_0_25px_var(--pitch-glow)]">🏆</div>
        <div>
          <p className="font-display text-xl tracking-[0.45em] text-accent">FIFA</p>
          <h1 className="font-display text-7xl leading-[0.82] tracking-tight">
            World Cup
            <span className="block shine text-8xl">2026</span>
          </h1>
          <p className="mt-1 font-display text-2xl tracking-[0.3em] text-muted">
            Bracket Pool
          </p>
        </div>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted">
          Rank every group, call the knockouts, and chase the family all the way
          to MetLife on July 19.
        </p>
      </div>

      <div
        className={`reveal rounded-full border px-4 py-2 text-sm font-semibold ${
          locked ? 'border-live/30 bg-live/10 text-live' : 'border-gold/30 bg-gold/10 text-gold'
        }`}
        style={{ animationDelay: '80ms' }}
      >
        {locked
          ? 'Brackets locked — the tournament is on'
          : `Locks at kickoff · ${kickoff.toUTCString().replace('GMT', 'UTC')}`}
      </div>

      <div className="reveal w-full max-w-xs" style={{ animationDelay: '160ms' }}>
        {!userId ? (
          <NamePicker players={players} />
        ) : (
          <Link
            href="/bracket"
            className="flex min-h-13 w-full items-center justify-center rounded-2xl bg-accent text-lg font-bold text-[var(--accent-ink)] shadow-lg shadow-accent/20 active:scale-95"
          >
            {locked ? 'View your bracket' : 'Build your bracket'}
          </Link>
        )}
      </div>
    </div>
  );
}
