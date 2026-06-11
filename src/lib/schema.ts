import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { Predictions } from '@/types/bracket';

// Lightweight identity: a user is just a display name plus a generated
// id kept in a long-lived cookie. No passwords.
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const pools = pgTable('pools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id'), // null for the system-created default pool
  joinCode: text('join_code').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const poolMembers = pgTable(
  'pool_members',
  {
    poolId: uuid('pool_id').notNull(),
    userId: uuid('user_id').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.poolId, t.userId] })],
);

export const teams = pgTable('teams', {
  code: text('code').primaryKey(), // FIFA 3-letter code
  name: text('name').notNull(),
  groupLetter: text('group_letter').notNull(),
  flag: text('flag').notNull(), // emoji
});

export const matches = pgTable('matches', {
  // 1-72 group matches in source file order, 73-102 openfootball num,
  // 103 third-place playoff, 104 final
  id: integer('id').primaryKey(),
  stage: text('stage').notNull(), // group|r32|r16|qf|sf|third|final
  groupLetter: text('group_letter'),
  homeCode: text('home_code'),
  awayCode: text('away_code'),
  // raw slot strings like '2A', '3A/B/C/D/F', 'W73' until teams are known
  homePlaceholder: text('home_placeholder'),
  awayPlaceholder: text('away_placeholder'),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  status: text('status').notNull().default('scheduled'), // scheduled|live|ht|ft|et|pens
  winnerCode: text('winner_code'),
  kickoffUtc: timestamp('kickoff_utc', { withTimezone: true }).notNull(),
  roundLabel: text('round_label').notNull(),
  providerFixtureId: integer('provider_fixture_id'),
});

export const groupStandings = pgTable(
  'group_standings',
  {
    groupLetter: text('group_letter').notNull(),
    teamCode: text('team_code').notNull(),
    played: integer('played').notNull().default(0),
    points: integer('points').notNull().default(0),
    gd: integer('gd').notNull().default(0),
    gf: integer('gf').notNull().default(0),
    rank: integer('rank'),
    advanced: boolean('advanced').notNull().default(false),
    isBestThird: boolean('is_best_third').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.groupLetter, t.teamCode] })],
);

export const brackets = pgTable(
  'brackets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull(),
    poolId: uuid('pool_id').notNull(),
    name: text('name').notNull(),
    predictions: jsonb('predictions').$type<Predictions>().notNull(),
    totalPoints: integer('total_points').notNull().default(0),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    submitted: boolean('submitted').notNull().default(false),
    // Set when the bracket was randomly completed at lock because the owner
    // never finished it; drives a one-time "your bracket was auto-filled" note.
    autofilled: boolean('autofilled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('brackets_owner_pool_unique').on(t.ownerId, t.poolId)],
);

export const bracketScores = pgTable(
  'bracket_scores',
  {
    bracketId: uuid('bracket_id').notNull(),
    roundKey: text('round_key').notNull(),
    points: integer('points').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.bracketId, t.roundKey] })],
);

// Score-prediction mini-game: one prediction per user per match (global,
// reused across all their groups). Exact scoreline scores bonus points.
export const matchPredictions = pgTable(
  'match_predictions',
  {
    userId: uuid('user_id').notNull(),
    matchId: integer('match_id').notNull(),
    homeScore: integer('home_score').notNull(),
    awayScore: integer('away_score').notNull(),
    points: integer('points').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.matchId] })],
);

// Per-group standing captured at the start of each day, so the leaderboard
// can show movement (rank change and points gained) since then.
export const standingSnapshots = pgTable(
  'standing_snapshots',
  {
    poolId: uuid('pool_id').notNull(),
    userId: uuid('user_id').notNull(),
    points: integer('points').notNull().default(0),
    rank: integer('rank'),
    capturedDay: text('captured_day').notNull(),
  },
  (t) => [primaryKey({ columns: [t.poolId, t.userId] })],
);

// Group smack-talk: a lightweight per-group message feed.
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id').notNull(),
  userId: uuid('user_id').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tiny key-value row for sync bookkeeping (last full sync time, etc).
export const syncMeta = pgTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
