import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { poolMembers, pools } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import Onboard from '@/components/auth/Onboard';

export const dynamic = 'force-dynamic';

// Invite link target. If the visitor is signed in, join the group and go
// straight to the bracket. Otherwise show the onboarding name step locked
// to this group's code, so a tap of the link plus a name joins them.
export default async function JoinByCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = decodeURIComponent(code).trim().toUpperCase();

  const [pool] = await db
    .select({ id: pools.id, name: pools.name })
    .from(pools)
    .where(eq(pools.joinCode, normalized))
    .limit(1);

  if (!pool) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-3xl">Invite not found</h1>
        <p className="max-w-xs text-sm text-muted">
          This invite link is invalid or the group no longer exists. Double-check the
          link, or ask your friend for a fresh one.
        </p>
        <Link
          href="/"
          className="rounded-xl border border-edge bg-white/[0.03] px-4 py-2.5 text-sm font-semibold"
        >
          Go home
        </Link>
      </div>
    );
  }

  const userId = await currentUserId();
  if (userId) {
    await db
      .insert(poolMembers)
      .values({ poolId: pool.id, userId })
      .onConflictDoNothing();
    redirect(`/bracket?pool=${pool.id}`);
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6 py-12 text-center">
      <div className="space-y-1">
        <p className="font-display text-lg tracking-[0.35em] text-accent">YOU&apos;RE INVITED</p>
        <h1 className="font-display text-4xl leading-tight">{pool.name}</h1>
        <p className="text-sm text-muted">Enter a name to join this World Cup 2026 group.</p>
      </div>
      <div className="w-full max-w-sm">
        <Onboard invite={{ code: normalized, groupName: pool.name }} />
      </div>
    </div>
  );
}
