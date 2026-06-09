// Pulls provider results into Neon and rescores all brackets.
// Idempotent end to end: upserts only, and scoring replaces rows.
// Provider budget (football-data.org free: 10 req/min, no daily cap):
// matches every tick, standings at most every 30 minutes or right after
// a match finishes.

import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import {
  brackets,
  bracketScores,
  groupStandings,
  matchPredictions,
  matches,
  poolMembers,
  standingSnapshots,
  syncMeta,
} from './schema';
import { footballDataProvider, type ProviderFixture } from './scores-provider';
import { resolveProviderTeam } from './team-map';
import { deriveAdvancement } from './standings';
import { rescoreAll } from './scoring';
import { scorePrediction } from './predict';
import { matchDayKey } from './format-time';
import { FINAL_STATUSES } from './constants';

export interface SyncReport {
  dry: boolean;
  fixturesFetched: number;
  standingsFetched: number;
  matchesUpdated: number;
  standingsUpdated: number;
  notes: string[];
}

const STANDINGS_FLOOR_MS = 30 * 60 * 1000;

type MatchRow = typeof matches.$inferSelect;

const isFinal = (status: string) => (FINAL_STATUSES as readonly string[]).includes(status);

// Finds our row for a provider fixture: by stored provider id first,
// then by team codes, then by provider stage + closest kickoff.
function findOurMatch(f: ProviderFixture, ours: MatchRow[], notes: string[]): MatchRow | null {
  const byProvider = ours.find((m) => m.providerFixtureId === f.providerId);
  if (byProvider) return byProvider;

  const home = resolveProviderTeam(f.homeTla, f.homeName);
  const away = resolveProviderTeam(f.awayTla, f.awayName);
  if (home && away) {
    const byCodes = ours.find(
      (m) =>
        (m.homeCode === home && m.awayCode === away) ||
        (m.homeCode === away && m.awayCode === home),
    );
    if (byCodes) return byCodes;
  } else {
    for (const [name, code] of [[f.homeName, home], [f.awayName, away]] as const) {
      // Knockout placeholders have no real names yet; only flag real ones.
      if (!code && name && !/^winner|^loser|^group/i.test(name)) {
        notes.push(`Unresolved team name from provider: ${name}`);
      }
    }
  }

  if (!f.stage) {
    notes.push(`Unmapped provider stage for fixture ${f.providerId}`);
    return null;
  }
  const candidates = ours
    .filter((m) => m.stage === f.stage && m.providerFixtureId === null)
    .map((m) => ({ m, diff: Math.abs(m.kickoffUtc.getTime() - f.kickoffUtc.getTime()) }))
    .filter((c) => c.diff < 36 * 3600 * 1000)
    .sort((a, b) => a.diff - b.diff);
  return candidates[0]?.m ?? null;
}

async function setMeta(key: string, value: string) {
  await db
    .insert(syncMeta)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: syncMeta.key, set: { value, updatedAt: new Date() } });
}

async function getMetaMs(key: string): Promise<number> {
  const [row] = await db.select().from(syncMeta).where(eq(syncMeta.key, key)).limit(1);
  return row ? Number(row.value) : 0;
}

export async function runSync(opts: { dry?: boolean } = {}): Promise<SyncReport> {
  const dry = opts.dry ?? false;
  const notes: string[] = [];
  const provider = footballDataProvider;

  const fixtures = await provider.fetchFixtures();

  if (dry) {
    const standings = await provider
      .fetchStandings()
      .catch((e) => {
        notes.push(`standings fetch failed: ${e instanceof Error ? e.message : e}`);
        return [];
      });
    const unresolved = new Set<string>();
    for (const f of fixtures) {
      for (const [tla, name] of [
        [f.homeTla, f.homeName],
        [f.awayTla, f.awayName],
      ] as const) {
        if (name && !/^winner|^loser|^group/i.test(name) && !resolveProviderTeam(tla, name)) {
          unresolved.add(`${name} (${tla ?? 'no tla'})`);
        }
      }
    }
    notes.push(
      `unresolved provider teams: ${unresolved.size ? [...unresolved].join(', ') : 'none'}`,
      `dry run sample fixture: ${JSON.stringify(fixtures[0] ?? null)}`,
      `dry run sample standing: ${JSON.stringify(standings[0] ?? null)}`,
    );
    return {
      dry,
      fixturesFetched: fixtures.length,
      standingsFetched: standings.length,
      matchesUpdated: 0,
      standingsUpdated: 0,
      notes,
    };
  }

  // Capture today's baseline standings (before applying new results) so the
  // leaderboard can show movement since the start of the day. Writes at most
  // once per day.
  await snapshotStandings();

  const ours = await db.select().from(matches);
  let matchesUpdated = 0;
  let anyFinishedNow = false;

  for (const f of fixtures) {
    const target = findOurMatch(f, ours, notes);
    if (!target) {
      notes.push(`No local match for provider fixture ${f.providerId} (${f.homeName} vs ${f.awayName})`);
      continue;
    }
    const homeCode = target.homeCode ?? resolveProviderTeam(f.homeTla, f.homeName);
    const awayCode = target.awayCode ?? resolveProviderTeam(f.awayTla, f.awayName);
    const winnerCode = f.winnerTla || f.winnerName
      ? resolveProviderTeam(f.winnerTla, f.winnerName ?? '')
      : null;

    if (!isFinal(target.status) && isFinal(f.status)) anyFinishedNow = true;

    await db
      .update(matches)
      .set({
        providerFixtureId: f.providerId,
        homeCode,
        awayCode,
        homeScore: f.homeScore,
        awayScore: f.awayScore,
        status: f.status,
        winnerCode,
        // Trust the provider's kickoff time once known; openfootball
        // times are provisional.
        kickoffUtc: f.kickoffUtc,
      })
      .where(eq(matches.id, target.id));
    matchesUpdated += 1;
  }

  // Standings change only when matches end, so fetch them sparingly.
  let standingsFetched = 0;
  let standingsUpdated = 0;
  const standingsDue =
    anyFinishedNow || Date.now() - (await getMetaMs('lastStandingsSync')) > STANDINGS_FLOOR_MS;

  if (standingsDue) {
    const standings = await provider.fetchStandings().catch((e) => {
      notes.push(`standings fetch failed: ${e instanceof Error ? e.message : e}`);
      return [];
    });
    standingsFetched = standings.length;

    for (const s of standings) {
      const teamCode = resolveProviderTeam(s.teamTla, s.teamName);
      const groupLetter = s.groupName.replace(/^GROUP[_\s]+/i, '').trim().toUpperCase();
      if (!teamCode || groupLetter.length !== 1) {
        notes.push(`Unresolved standing row: ${s.groupName} / ${s.teamName}`);
        continue;
      }
      await db
        .insert(groupStandings)
        .values({
          groupLetter,
          teamCode,
          played: s.played,
          points: s.points,
          gd: s.gd,
          gf: s.gf,
          rank: s.rank,
        })
        .onConflictDoUpdate({
          target: [groupStandings.groupLetter, groupStandings.teamCode],
          set: { played: s.played, points: s.points, gd: s.gd, gf: s.gf, rank: s.rank },
        });
      standingsUpdated += 1;
    }

    if (standings.length > 0) {
      // Advancement flags from the freshest standings.
      const allStandings = await db.select().from(groupStandings);
      const { advanced, bestThirds } = deriveAdvancement(allStandings);
      for (const row of allStandings) {
        const adv = advanced.has(row.teamCode);
        const third = bestThirds.has(row.teamCode);
        if (row.advanced !== adv || row.isBestThird !== third) {
          await db
            .update(groupStandings)
            .set({ advanced: adv, isBestThird: third })
            .where(
              and(
                eq(groupStandings.groupLetter, row.groupLetter),
                eq(groupStandings.teamCode, row.teamCode),
              ),
            );
        }
      }
      await setMeta('lastStandingsSync', String(Date.now()));
    }
  }

  await rescoreAll();
  await rescorePredictions();
  await setMeta('lastFullSync', String(Date.now()));

  return {
    dry,
    fixturesFetched: fixtures.length,
    standingsFetched,
    matchesUpdated,
    standingsUpdated,
    notes,
  };
}

// Snapshot each group's standings once per day as the baseline for the
// leaderboard's movement indicators. The ranking here MUST match the
// leaderboard's bracket-metric sort (submitted first, points, champion+final
// tiebreak, then earliest lock).
async function snapshotStandings() {
  const day = matchDayKey(new Date());
  const [existing] = await db
    .select({ capturedDay: standingSnapshots.capturedDay })
    .from(standingSnapshots)
    .limit(1);
  if (existing?.capturedDay === day) return;

  const allBrackets = await db.select().from(brackets);
  const scores = await db.select().from(bracketScores);
  const tb = new Map<string, number>();
  for (const s of scores) {
    if (s.roundKey === 'champion' || s.roundKey === 'final') {
      tb.set(s.bracketId, (tb.get(s.bracketId) ?? 0) + s.points);
    }
  }
  const bracketByKey = new Map(allBrackets.map((b) => [`${b.poolId}:${b.ownerId}`, b]));

  const members = await db.select().from(poolMembers);
  const byPool = new Map<string, string[]>();
  for (const m of members) {
    const arr = byPool.get(m.poolId) ?? [];
    arr.push(m.userId);
    byPool.set(m.poolId, arr);
  }

  const toInsert: { poolId: string; userId: string; points: number; rank: number | null; capturedDay: string }[] = [];
  for (const [poolId, userIds] of byPool) {
    const rr = userIds.map((userId) => {
      const b = bracketByKey.get(`${poolId}:${userId}`);
      return {
        userId,
        points: b?.totalPoints ?? 0,
        submitted: b?.submitted ?? false,
        tiebreak: b ? tb.get(b.id) ?? 0 : 0,
        lockedAtMs: b?.lockedAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
      };
    });
    rr.sort((a, b) => {
      if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
      if (b.points !== a.points) return b.points - a.points;
      if (b.tiebreak !== a.tiebreak) return b.tiebreak - a.tiebreak;
      return a.lockedAtMs - b.lockedAtMs;
    });
    let r = 0;
    for (const x of rr) {
      toInsert.push({ poolId, userId: x.userId, points: x.points, rank: x.submitted ? ++r : null, capturedDay: day });
    }
  }

  await db.delete(standingSnapshots);
  for (const row of toInsert) {
    await db
      .insert(standingSnapshots)
      .values(row)
      .onConflictDoUpdate({
        target: [standingSnapshots.poolId, standingSnapshots.userId],
        set: { points: row.points, rank: row.rank, capturedDay: row.capturedDay },
      });
  }
}

// Recompute score-prediction bonus points from finished matches. Like
// rescoreAll, this is idempotent: it only writes rows whose points changed.
async function rescorePredictions() {
  const matchRows = await db
    .select({
      id: matches.id,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      status: matches.status,
    })
    .from(matches);
  const byId = new Map(matchRows.map((m) => [m.id, m]));

  const preds = await db.select().from(matchPredictions);
  for (const p of preds) {
    const m = byId.get(p.matchId);
    const pts = m
      ? scorePrediction(p, {
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          isFinal: isFinal(m.status),
        })
      : 0;
    if (pts !== p.points) {
      await db
        .update(matchPredictions)
        .set({ points: pts })
        .where(
          and(
            eq(matchPredictions.userId, p.userId),
            eq(matchPredictions.matchId, p.matchId),
          ),
        );
    }
  }
}

// True when something is happening or about to: any live match, or a
// scheduled match that kicks off within the next hour (a wide back
// window catches matches we have not yet marked live).
export async function inLiveWindow(): Promise<boolean> {
  const now = Date.now();
  const rows = await db
    .select({ status: matches.status, kickoffUtc: matches.kickoffUtc })
    .from(matches)
    .where(sql`${matches.status} in ('live', 'ht') or (${matches.status} = 'scheduled' and ${matches.kickoffUtc} between ${new Date(now - 3 * 3600 * 1000)} and ${new Date(now + 3600 * 1000)})`);
  return rows.length > 0;
}

export async function lastFullSyncMs(): Promise<number> {
  return getMetaMs('lastFullSync');
}
