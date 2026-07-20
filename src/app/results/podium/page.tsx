import { redirect } from 'next/navigation';
import { finaleGate } from '@/lib/finale-access';
import { loadResults } from '@/lib/results';
import PodiumStage from '@/components/finale/PodiumStage';

export const dynamic = 'force-dynamic';

export default async function PodiumPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const { pool: requested } = await searchParams;
  const gate = await finaleGate(requested);

  if (gate.state === 'anon') redirect('/');
  if (gate.state === 'no-pool') redirect('/bracket');
  if (gate.state === 'locked') redirect('/results');

  const data = await loadResults(gate.active.poolId, gate.userId);

  return (
    <PodiumStage
      data={data}
      poolId={gate.active.poolId}
      viewerId={gate.userId}
      preview={!gate.over}
    />
  );
}
