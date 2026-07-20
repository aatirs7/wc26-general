import { redirect } from 'next/navigation';
import { finaleGate } from '@/lib/finale-access';
import { loadPoolRecap } from '@/lib/recap';
import { loadResults } from '@/lib/results';
import { loadVotes } from '@/lib/votes';
import PoolRecapDeck from '@/components/finale/PoolRecapDeck';

export const dynamic = 'force-dynamic';

export default async function PoolRecapPage({
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

  const [data, results, votes] = await Promise.all([
    loadPoolRecap(gate.active.poolId),
    loadResults(gate.active.poolId, gate.userId),
    loadVotes(gate.active.poolId, gate.userId),
  ]);

  return <PoolRecapDeck data={data} awards={results.awards} votes={votes} />;
}
