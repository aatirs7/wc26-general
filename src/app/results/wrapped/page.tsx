import { redirect } from 'next/navigation';
import { finaleGate } from '@/lib/finale-access';
import { loadPersonalWrapped } from '@/lib/wrapped';
import WrappedDeck from '@/components/finale/WrappedDeck';

export const dynamic = 'force-dynamic';

export default async function WrappedPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const { pool: requested } = await searchParams;
  const gate = await finaleGate(requested);

  if (gate.state === 'anon') redirect('/');
  if (gate.state === 'no-pool') redirect('/bracket');
  if (gate.state === 'locked') redirect('/results');

  const data = await loadPersonalWrapped(gate.active.poolId, gate.userId);
  // Being in the pool without a standings row should be impossible, but a
  // deck with no subject is worse than a redirect.
  if (!data) redirect(`/results?pool=${gate.active.poolId}`);

  return <WrappedDeck data={data} />;
}
