'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, X } from 'lucide-react';
import type { VotesData, CategoryResult } from '@/lib/votes';
import { Avatar } from './kit';

// One category card. Centre-aligned throughout, and deliberately quiet: the
// only thing shown by default is the current leader and your own pick. The
// full member list and the public receipts each sit behind a tap, so the page
// is a column of results rather than a wall of everybody's names.
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
  const [picking, setPicking] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);
  const [pending, startTransition] = useTransition();

  const myVote = optimistic === undefined ? cat.myVote : optimistic;

  // Recompute the tally against the optimistic vote so the leader can change
  // the instant you tap.
  const counts = new Map(cat.tallies.map((t) => [t.subjectId, t.count]));
  if (optimistic !== undefined && optimistic !== cat.myVote) {
    if (cat.myVote) counts.set(cat.myVote, Math.max(0, (counts.get(cat.myVote) ?? 0) - 1));
    if (optimistic) counts.set(optimistic, (counts.get(optimistic) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, n]) => s + n, 0);
  const nameOf = new Map(members.map((m) => [m.userId, m.name]));
  const leader = ranked[0] ?? null;
  const tied = ranked.length > 1 && ranked[1][1] === ranked[0][1];
  const max = leader ? leader[1] : 1;

  async function vote(subjectId: string) {
    const previous = myVote;
    const clearing = previous === subjectId;
    setOptimistic(clearing ? null : subjectId);
    setError(null);
    setPicking(false);

    try {
      const res = await fetch('/api/superlative', {
        method: clearing ? 'DELETE' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          clearing
            ? { poolId, categoryKey: cat.category.key }
            : { poolId, categoryKey: cat.category.key, subjectId },
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

  return (
    <section className="card overflow-hidden p-5 text-center">
      <div className="text-4xl leading-none">{cat.category.emoji}</div>
      <h2 className="mt-2 font-display text-2xl leading-none">{cat.category.title}</h2>
      <p className="mx-auto mt-1.5 max-w-[19rem] text-sm leading-relaxed text-muted">
        {cat.category.prompt}
      </p>

      {/* The standing, at a glance. */}
      <div className="mt-4">
        {leader ? (
          <>
            <div className="flex items-center justify-center gap-2">
              <Avatar name={nameOf.get(leader[0]) ?? '?'} size="sm" medal={tied ? undefined : 1} />
              <span className="font-display text-2xl leading-none">
                {tied ? 'Too close to call' : nameOf.get(leader[0]) ?? 'Someone'}
              </span>
            </div>
            <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.18em] text-muted-2">
              {total} {total === 1 ? 'vote' : 'votes'} cast
            </p>
            {/* Only the top few, so this never becomes a member directory. */}
            <div className="mx-auto mt-3 max-w-[16rem] space-y-1.5">
              {ranked.slice(0, 3).map(([subjectId, count], i) => (
                <div key={subjectId} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 truncate text-right text-xs font-semibold">
                    {nameOf.get(subjectId) ?? 'Someone'}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full f-track">
                    <span
                      className={`block h-full rounded-full transition-all duration-500 ${
                        i === 0 && !tied ? 'bg-gold' : 'bg-accent'
                      }`}
                      style={{ width: `${Math.max(6, (count / max) * 100)}%` }}
                    />
                  </span>
                  <span className="w-4 shrink-0 text-left text-xs font-bold text-muted">{count}</span>
                </div>
              ))}
              {ranked.length > 3 ? (
                <p className="pt-0.5 text-[0.65rem] text-muted-2">
                  and {ranked.length - 3} other{ranked.length - 3 === 1 ? '' : 's'} with a vote
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-2">No votes yet. Somebody has to go first.</p>
        )}
      </div>

      {/* Your own vote. */}
      <div className="mt-4">
        {myVote && !picking ? (
          <div className="flex flex-col items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-[var(--accent-ink)]">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
              You picked {nameOf.get(myVote) ?? 'someone'}
            </span>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="text-[0.7rem] font-semibold text-muted underline"
            >
              Change or withdraw
            </button>
          </div>
        ) : !picking ? (
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="mx-auto block rounded-full border border-accent/50 bg-accent/10 px-5 py-2 text-xs font-bold text-accent active:scale-95"
          >
            Cast your vote
          </button>
        ) : (
          <div className="rounded-2xl border border-edge f-fill p-3">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-muted-2">
              {cat.category.allowSelf ? 'Pick anyone' : 'Pick someone else'}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {members.map((m) => {
                const selfBlocked = m.userId === viewerId && !cat.category.allowSelf;
                const picked = myVote === m.userId;
                return (
                  <button
                    key={m.userId}
                    type="button"
                    disabled={selfBlocked || pending}
                    onClick={() => vote(m.userId)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors active:scale-95 disabled:opacity-25 ${
                      picked
                        ? 'border-accent bg-accent text-[var(--accent-ink)]'
                        : 'border-edge f-fill text-muted'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="mt-3 text-[0.7rem] font-semibold text-muted-2 underline"
            >
              {myVote ? 'Keep my pick' : 'Not now'}
            </button>
          </div>
        )}
      </div>

      {error ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-live/10 px-3 py-1 text-xs font-semibold text-live">
          <X className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}

      {/* Receipts are public, but tucked away so the card stays calm. */}
      {cat.receipts.length ? (
        <div className="mt-4 border-t border-edge pt-3">
          <button
            type="button"
            onClick={() => setShowReceipts((v) => !v)}
            className="mx-auto flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-muted-2"
          >
            {showReceipts ? 'Hide' : 'Show'} who voted
            <ChevronDown
              className={`h-3 w-3 transition-transform ${showReceipts ? 'rotate-180' : ''}`}
            />
          </button>
          {showReceipts ? (
            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[0.7rem]">
              {cat.receipts.map((r) => (
                <span
                  key={r.voterId}
                  className={r.voterId === viewerId ? 'font-bold text-accent' : 'text-muted'}
                >
                  {r.voterId === viewerId ? 'You' : r.voterName} &rarr; {r.subjectName}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 text-[0.7rem] italic text-muted-2">{cat.category.blurb}</p>
    </section>
  );
}

export default function VoteBooth({ data, viewerId }: { data: VotesData; viewerId: string }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const done = data.myVoteCount;
  const of = data.categories.length;

  return (
    <div className="space-y-4 pb-6 text-center">
      <header className="pt-2">
        <p className="finale-kicker text-gold">The people&apos;s awards</p>
        <h1 className="mt-1 font-display text-4xl leading-none">Cast your votes</h1>
        <p className="mx-auto mt-2 max-w-[19rem] text-sm leading-relaxed text-muted">
          Every tally is live and every vote has your name on it. Choose accordingly.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/[0.1] px-3 py-1.5 text-xs font-bold text-accent">
          {done} of {of} voted
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
        className="block rounded-2xl border border-edge f-fill py-3 text-sm font-bold text-muted active:scale-95"
      >
        Back to the finale
      </Link>
    </div>
  );
}
