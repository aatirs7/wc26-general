'use client';

import { useRouter } from 'next/navigation';

// Switches the active group from the home page. Writes the active-pool
// cookie immediately (so every other page picks it up on its next render)
// and clears the client router cache so already-visited pages re-fetch for
// the newly selected pool instead of showing the old one.
export default function PoolSwitcher({
  pools,
  activeId,
}: {
  pools: { poolId: string; poolName: string }[];
  activeId: string;
}) {
  const router = useRouter();

  function select(id: string) {
    if (id === activeId) return;
    // Persist immediately so the other pages read the new pool on next view.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `wc26_active_pool=${id}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push(`/home?pool=${id}`);
    router.refresh();
  }

  return (
    <div className="reveal flex justify-center gap-2 overflow-x-auto pb-1">
      {pools.map((p) => (
        <button
          key={p.poolId}
          type="button"
          onClick={() => select(p.poolId)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold active:scale-95 ${
            p.poolId === activeId
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-edge bg-white/[0.02] text-muted'
          }`}
        >
          {p.poolName}
        </button>
      ))}
    </div>
  );
}
