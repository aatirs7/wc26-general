// Reading side of the voted superlatives. Tallies are always live and every
// vote carries a public receipt, so this returns who voted for whom by name.

import { eq } from 'drizzle-orm';
import { db } from './db';
import { poolMembers, superlativeVotes, users } from './schema';
import { SUPERLATIVES, type SuperlativeCategory } from './superlatives';

export interface VoteTally {
  subjectId: string;
  name: string;
  count: number;
  pct: number;
}

export interface VoteReceipt {
  voterId: string;
  voterName: string;
  subjectId: string;
  subjectName: string;
}

export interface CategoryResult {
  category: SuperlativeCategory;
  tallies: VoteTally[];
  receipts: VoteReceipt[];
  total: number;
  myVote: string | null;
  leader: VoteTally | null;
  // True when two or more people are level at the top.
  tied: boolean;
}

export interface VotesData {
  poolId: string;
  members: { userId: string; name: string }[];
  categories: CategoryResult[];
  myVoteCount: number;
}

export async function loadVotes(poolId: string, viewerId: string | null): Promise<VotesData> {
  const members = await db
    .select({ userId: poolMembers.userId, name: users.displayName })
    .from(poolMembers)
    .innerJoin(users, eq(users.id, poolMembers.userId))
    .where(eq(poolMembers.poolId, poolId));
  const nameOf = new Map(members.map((m) => [m.userId, m.name]));

  const rows = await db
    .select({
      voterId: superlativeVotes.voterId,
      subjectId: superlativeVotes.subjectId,
      categoryKey: superlativeVotes.categoryKey,
    })
    .from(superlativeVotes)
    .where(eq(superlativeVotes.poolId, poolId));

  let myVoteCount = 0;
  const categories: CategoryResult[] = SUPERLATIVES.map((category) => {
    // Votes for people who have since left the pool would have no name, so
    // drop them rather than rendering a blank chip.
    const mine = rows.filter((r) => r.categoryKey === category.key && nameOf.has(r.subjectId));
    const counts = new Map<string, number>();
    for (const r of mine) counts.set(r.subjectId, (counts.get(r.subjectId) ?? 0) + 1);

    const total = mine.length;
    const tallies = [...counts.entries()]
      .map(([subjectId, count]) => ({
        subjectId,
        name: nameOf.get(subjectId) ?? 'Someone',
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const myVote = viewerId ? mine.find((r) => r.voterId === viewerId)?.subjectId ?? null : null;
    if (myVote) myVoteCount += 1;

    const leader = tallies[0] ?? null;
    const tied = tallies.length > 1 && tallies[1].count === tallies[0].count;

    return {
      category,
      tallies,
      receipts: mine
        .filter((r) => nameOf.has(r.voterId))
        .map((r) => ({
          voterId: r.voterId,
          voterName: nameOf.get(r.voterId) ?? 'Someone',
          subjectId: r.subjectId,
          subjectName: nameOf.get(r.subjectId) ?? 'Someone',
        }))
        .sort((a, b) => a.voterName.localeCompare(b.voterName)),
      total,
      myVote,
      leader,
      tied,
    };
  });

  return { poolId, members, categories, myVoteCount };
}
