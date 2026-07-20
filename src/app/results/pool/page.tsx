import { redirect } from 'next/navigation';
import { finaleGate } from '@/lib/finale-access';
import { loadPoolWrapped } from '@/lib/wrapped';
import { loadResults } from '@/lib/results';
import { loadVotes } from '@/lib/votes';
import PoolWrappedDeck from '@/components/finale/PoolWrappedDeck';

export const dynamic = 'force-dynamic';

export default async function PoolWrappedPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const { pool: requested } = await searchParams;
  const gate = await finaleGate(requested);

  if (gate.state === 'anon') redirect('/');
  if (gate.state === 'no-pool') redirect('/bracket');
  if (gate.state === 'locked') redirect('/results');

  const [data, results, votes] = await Promise.all([
    loadPoolWrapped(gate.active.poolId),
    loadResults(gate.active.poolId, gate.userId),
    loadVotes(gate.active.poolId, gate.userId),
  ]);

  return <PoolWrappedDeck data={data} awards={results.awards} votes={votes} />;
}
