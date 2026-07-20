import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { feedback, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { isFeedbackAdmin } from '@/lib/feedback-access';

export const dynamic = 'force-dynamic';

// Everything anybody has sent through the review box. Owner only: auth here is
// a name cookie, so this is a convenience screen rather than a security
// boundary, but it stays off the nav and 404s for everyone else.
export default async function AllFeedbackPage() {
  const userId = await currentUserId();
  if (!userId) redirect('/');

  const [me] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!isFeedbackAdmin(me?.displayName)) notFound();

  const rows = await db
    .select({
      id: feedback.id,
      body: feedback.body,
      createdAt: feedback.createdAt,
      name: users.displayName,
    })
    .from(feedback)
    .innerJoin(users, eq(users.id, feedback.userId))
    .orderBy(desc(feedback.createdAt));

  const people = new Set(rows.map((r) => r.name)).size;

  return (
    <div className="space-y-5 py-4 lg:mx-auto lg:max-w-2xl">
      <header className="pt-2 text-center">
        <p className="finale-kicker text-gold">Owner only</p>
        <h1 className="mt-1 font-display text-4xl leading-none">The feedback</h1>
        <p className="mt-2 text-sm text-muted">
          {rows.length} {rows.length === 1 ? 'note' : 'notes'} from {people}{' '}
          {people === 1 ? 'person' : 'people'}.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="card p-6 text-center text-sm text-muted">
          Nothing yet. The box is on the finale hub.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-xl leading-none">{r.name}</span>
                <span className="shrink-0 text-[0.65rem] text-muted-2">
                  {r.createdAt.toLocaleString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.body}</p>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/feedback"
        className="block rounded-2xl border border-edge bg-white/[0.03] py-3 text-center text-sm font-bold text-muted active:scale-95"
      >
        Back
      </Link>
    </div>
  );
}
