'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import type { VotesData, CategoryResult } from '@/lib/votes';
import { Avatar } from './kit';

// One category card: pick a person, see the tally move, see who voted for whom.
// Tallies are live and receipts are public, which is the entire point.
function CategoryCard({
  cat,
  poolId,
  members,
  viewerId,
  onChanged,
}: {
  cat: CategoryResult;
  poolId: string;
  members: { userId: string; name: string }[];
  viewerId: string;
  onChanged: () => void;
}) {
  // Optimistic local vote so the tap feels instant; the server refresh
  // reconciles it a moment later.
  const [optimistic, setOptimistic] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const myVote = optimistic === undefined ? cat.myVote : optimistic;

  // Recompute the tally against the optimistic vote so the bars move on tap.
  const counts = new Map(cat.tallies.map((t) => [t.subjectId, t.count]));
  if (optimistic !== undefined && optimistic !== cat.myVote) {
    if (cat.myVote) counts.set(cat.myVote, Math.max(0, (counts.get(cat.myVote) ?? 0) - 1));
    if (optimistic) counts.set(optimistic, (counts.get(optimistic) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  const max = Math.max(1, ...counts.values());

  async function vote(subjectId: string) {
    const previous = myVote;
    const clearing = previous === subjectId;
    setOptimistic(clearing ? null : subjectId);
    setError(null);

    try {
      const res = await fetch('/api/superlative', {
        method: clearing ? 'DELETE' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          clearing ? { poolId, categoryKey: cat.category.key } : { poolId, categoryKey: cat.category.key, subjectId },
        ),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'That did not go through');
      }
      startTransition(onChanged);
    } catch (e) {
      setOptimistic(previous);
      setError(e instanceof Error ? e.message : 'That did not go through');
    }
  }

  const ranked = [...counts.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const nameOf = new Map(members.map((m) => [m.userId, m.name]));

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-edge p-4">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none">{cat.category.emoji}</span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl leading-none">{cat.category.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{cat.category.prompt}</p>
          </div>
          {myVote ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[var(--accent-ink)]">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          ) : null}
        </div>
      </div>

      {/* Member picker */}
      <div className="flex flex-wrap gap-1.5 p-3">
        {members.map((m) => {
          const selfBlocked = m.userId === viewerId && !cat.category.allowSelf;
          const picked = myVote === m.userId;
          return (
            <button
              key={m.userId}
              type="button"
              disabled={selfBlocked || pending}
              onClick={() => vote(m.userId)}
              className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs font-bold transition-colors active:scale-95 disabled:opacity-25 ${
                picked
                  ? 'border-accent bg-accent text-[var(--accent-ink)]'
                  : 'border-edge bg-white/[0.03] text-muted'
              }`}
            >
              <Avatar name={m.name} size="sm" />
              <span className="max-w-[7rem] truncate">{m.name}</span>
            </button>
          );
        })}
      </div>

      {/* Live tally */}
      {ranked.length ? (
        <div className="space-y-1.5 border-t border-edge p-3">
          {ranked.map(([subjectId, count], i) => (
            <div key={subjectId}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className={`min-w-0 truncate font-semibold ${i === 0 ? 'text-gold' : ''}`}>
                  {i === 0 ? '👑 ' : ''}
                  {nameOf.get(subjectId) ?? 'Someone'}
                </span>
                <span className="shrink-0 text-xs font-bold text-muted">
                  {count} {count === 1 ? 'vote' : 'votes'}
                </span>
              </div>
              <span className="mt-1 block h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className={`block h-full rounded-full transition-all duration-500 ${i === 0 ? 'bg-gold' : 'bg-accent'}`}
                  style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="border-t border-edge px-4 py-3 text-xs text-muted-2">
          No votes yet. Somebody has to go first.
        </p>
      )}

      {/* Public receipts */}
      {cat.receipts.length ? (
        <div className="border-t border-edge px-4 py-3">
          <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-2">
            Who voted for whom
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem]">
            {cat.receipts.map((r) => (
              <span
                key={r.voterId}
                className={r.voterId === viewerId ? 'font-bold text-accent' : 'text-muted'}
              >
                {r.voterId === viewerId ? 'You' : r.voterName} &rarr; {r.subjectName}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="flex items-center gap-1.5 border-t border-live/30 bg-live/[0.08] px-4 py-2 text-xs font-semibold text-live">
          <X className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}

      <p className="border-t border-edge px-4 py-2 text-[0.7rem] italic text-muted-2">
        {cat.category.blurb}
        {total > 0 ? ` ${total} ${total === 1 ? 'vote' : 'votes'} cast.` : ''}
      </p>
    </section>
  );
}

export default function VoteBooth({ data, viewerId }: { data: VotesData; viewerId: string }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const done = data.myVoteCount;
  const of = data.categories.length;

  return (
    <div className="space-y-4 pb-6">
      <header className="pt-2 text-center">
        <p className="finale-kicker text-gold">The people&apos;s awards</p>
        <h1 className="mt-1 font-display text-4xl leading-none">Cast your votes</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Every tally is live and every vote shows your name next to it. Choose accordingly. You can
          change your mind, and tapping your own pick again withdraws it.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/[0.1] px-3 py-1.5 text-xs font-bold text-accent">
          {done} of {of} categories voted
        </div>
      </header>

      {data.categories.map((cat) => (
        <CategoryCard
          key={cat.category.key}
          cat={cat}
          poolId={data.poolId}
          members={data.members}
          viewerId={viewerId}
          onChanged={refresh}
        />
      ))}

      <Link
        href={`/results?pool=${data.poolId}`}
        className="block rounded-2xl border border-edge bg-white/[0.03] py-3 text-center text-sm font-bold text-muted active:scale-95"
      >
        Back to the finale
      </Link>
    </div>
  );
}
