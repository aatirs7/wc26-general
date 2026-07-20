import { redirect } from 'next/navigation';
import { finaleGate } from '@/lib/finale-access';
import { loadPersonalRecap } from '@/lib/recap';
import RecapDeck from '@/components/finale/RecapDeck';

export const dynamic = 'force-dynamic';

export default async function RecapPage({
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

  const data = await loadPersonalRecap(gate.active.poolId, gate.userId);
  // Being in the pool without a standings row should be impossible, but a
  // deck with no subject is worse than a redirect.
  if (!data) redirect(`/results?pool=${gate.active.poolId}`);

  return <RecapDeck data={data} />;
}
