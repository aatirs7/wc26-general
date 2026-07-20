import { redirect } from 'next/navigation';
import { finaleGate } from '@/lib/finale-access';
import { loadVotes } from '@/lib/votes';
import VoteBooth from '@/components/finale/VoteBooth';

export const dynamic = 'force-dynamic';

export default async function VotePage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const { pool: requested } = await searchParams;
  const gate = await finaleGate(requested);

  if (gate.state === 'anon') redirect('/');
  if (gate.state === 'no-pool') redirect('/bracket');
  if (gate.state === 'locked') redirect('/results');
  // A recap is meaningless without knowing which pool it is for, so anyone in
  // several pools gets sent to the chooser rather than a guessed one.
  if (gate.needsChoice) redirect('/results');

  const votes = await loadVotes(gate.active.poolId, gate.userId);

  return (
    <div className="py-4 lg:mx-auto lg:max-w-2xl">
      <VoteBooth data={votes} viewerId={gate.userId} />
    </div>
  );
}
