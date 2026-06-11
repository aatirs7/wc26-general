import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { messages, poolMembers, pools, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { matchTime } from '@/lib/format-time';
import ChatBox from '@/components/chat/ChatBox';
import RememberPool from '@/components/RememberPool';

export const dynamic = 'force-dynamic';

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ pool?: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect('/');

  const memberships = await db
    .select({ poolId: poolMembers.poolId, poolName: pools.name })
    .from(poolMembers)
    .innerJoin(pools, eq(pools.id, poolMembers.poolId))
    .where(eq(poolMembers.userId, userId));
  if (memberships.length === 0) redirect('/');

  const { pool: requested } = await searchParams;
  const activePoolCookie = (await cookies()).get('wc26_active_pool')?.value;
  const active =
    memberships.find((m) => m.poolId === requested) ??
    memberships.find((m) => m.poolId === activePoolCookie) ??
    memberships[0];

  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      userId: messages.userId,
      name: users.displayName,
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.userId))
    .where(eq(messages.poolId, active.poolId))
    .orderBy(desc(messages.createdAt))
    .limit(100);
  const feed = rows.reverse();

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-col pb-36 pt-4 lg:mx-auto lg:max-w-2xl">
      <RememberPool poolId={active.poolId} />
      <header className="pt-2 text-center">
        <h1 className="font-display text-4xl leading-none">Smack talk</h1>
        <p className="mt-1 text-xs text-muted">{active.poolName}</p>
      </header>

      {memberships.length > 1 ? (
        <div className="mt-3 flex justify-center gap-2 overflow-x-auto pb-1">
          {memberships.map((m) => (
            <Link
              key={m.poolId}
              href={`/chat?pool=${m.poolId}`}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                m.poolId === active.poolId
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-edge bg-white/[0.02] text-muted'
              }`}
            >
              {m.poolName}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex-1 space-y-2">
        {feed.length === 0 ? (
          <p className="card p-5 text-center text-sm text-muted">
            No smack talk yet. Be the one to start it.
          </p>
        ) : (
          feed.map((m) => {
            const mine = m.userId === userId;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 ${
                    mine ? 'bg-accent text-[var(--accent-ink)]' : 'card'
                  }`}
                >
                  {!mine ? (
                    <div className="text-[0.65rem] font-bold text-accent">{m.name}</div>
                  ) : null}
                  <div className="whitespace-pre-wrap break-words text-sm">{m.body}</div>
                  <div className={`mt-0.5 text-right text-[0.55rem] ${mine ? 'opacity-70' : 'text-muted-2'}`}>
                    {matchTime(m.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ChatBox poolId={active.poolId} />
    </div>
  );
}
