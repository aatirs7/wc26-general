import Link from 'next/link';
import { redirect } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { feedback, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import FeedbackForm from '@/components/finale/FeedbackForm';

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
  const userId = await currentUserId();
  if (!userId) redirect('/');

  const [me] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const name = me?.displayName ?? 'you';

  const mine = await db
    .select({ id: feedback.id, body: feedback.body, createdAt: feedback.createdAt })
    .from(feedback)
    .where(eq(feedback.userId, userId))
    .orderBy(desc(feedback.createdAt));

  return (
    <div className="space-y-5 py-4 text-center lg:mx-auto lg:max-w-2xl">
      <header className="pt-2">
        <div className="text-5xl">🙏</div>
        <h1 className="mt-3 font-display text-4xl leading-none">Thank you for playing</h1>
        <div className="mx-auto mt-3 max-w-[21rem] space-y-3 text-sm leading-relaxed text-muted">
          <p>
            That is the whole World Cup done. Thank you for filling in a bracket, arguing in the group
            chat and sticking with it for a month. It was genuinely more fun because you were in it.
          </p>
          <p>
            I built this thing in my spare time and I would love to know what you thought. Anything you
            liked, anything that annoyed you, anything that should exist next time. Good or bad, it all
            helps.
          </p>
        </div>
        <p className="mt-4 font-display text-xl leading-none text-accent">Aatir Siddiqui</p>
      </header>

      <FeedbackForm name={name} />

      {mine.length ? (
        <section className="text-left">
          <h2 className="mb-2 text-center text-[0.65rem] font-bold uppercase tracking-[0.2em] text-muted-2">
            What you have sent
          </h2>
          <ul className="space-y-2">
            {mine.map((f) => (
              <li key={f.id} className="card p-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{f.body}</p>
                <p className="mt-1.5 text-[0.65rem] text-muted-2">
                  {f.createdAt.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Link
        href="/home"
        className="block rounded-2xl border border-edge bg-white/[0.03] py-3 text-sm font-bold text-muted active:scale-95"
      >
        Back to the app
      </Link>
    </div>
  );
}
