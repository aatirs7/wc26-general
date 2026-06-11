import Link from 'next/link';
import { Unlock, ArrowRight } from 'lucide-react';
import Countdown from '@/components/home/Countdown';

// Notifies a member that their pool's bracket has been re-opened past
// kickoff, with a live countdown to when it relocks.
export default function UnlockBanner({
  poolName,
  poolId,
  untilMs,
}: {
  poolName: string;
  poolId: string;
  untilMs: number;
}) {
  return (
    <section
      className="reveal rounded-[1.1rem] border border-gold/50 bg-gold/[0.12] p-4 text-center shadow-lg shadow-gold/10"
      style={{ animationDelay: '40ms' }}
    >
      <div className="inline-flex items-center justify-center gap-2 text-gold">
        <Unlock className="h-4 w-4" strokeWidth={2.4} />
        <span className="text-[0.7rem] font-bold uppercase tracking-[0.2em]">Bracket unlocked</span>
      </div>
      <p className="mt-1 text-sm text-foreground">
        Your <span className="font-bold">{poolName}</span> bracket is open to edit and resubmit. It
        relocks in:
      </p>
      <div className="mt-3">
        <Countdown kickoffMs={untilMs} />
      </div>
      <Link
        href={`/bracket?pool=${poolId}`}
        className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-gold active:scale-95"
      >
        Edit your bracket
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
