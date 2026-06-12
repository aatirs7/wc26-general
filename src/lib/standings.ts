// Advancement flags from group standings: rank 1 and 2 of each group
// advance, plus the 8 best third-placed teams ranked across all groups
// by points, then goal difference, then goals for.

// Statuses that carry a usable score (a kicked-off match), so in-progress
// games feed the live table the moment a goal lands.
const COUNTED_STATUS = new Set(['live', 'ht', 'ft', 'et', 'pens']);

export interface LiveStandingRow {
  groupLetter: string;
  teamCode: string;
  played: number;
  points: number;
  gd: number;
  gf: number;
  rank: number;
  // Provisional qualifier flag: a top-two team that has actually played. A
  // side cannot hold a top-two spot before kickoff, so a not-yet-played team
  // sorted into the top two on zero stats is listed but not flagged (and so
  // earns no provisional points).
  advanced: boolean;
}

export interface LiveMatchInput {
  stage: string;
  status: string;
  groupLetter: string | null;
  homeCode?: string | null;
  awayCode?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
}

// Builds the current group tables straight from the match scores, counting
// live/half-time games at their score so far. This is what powers the live
// rankings: the provider's own standings table only updates once a match is
// final, but the match scores update on every goal. Every side in the group
// fixtures is included (teams yet to kick off show with zeros). Ranking is
// points, then goal difference, then goals for, then team code for a stable
// order (the official head-to-head tiebreakers only matter once a group is
// final). The top two that have played are flagged `advanced`.
export function computeLiveGroupTables(matchRows: LiveMatchInput[]): LiveStandingRow[] {
  type Acc = { points: number; gf: number; ga: number; played: number };
  const groups = new Map<string, Map<string, Acc>>();
  const ensure = (g: string, t: string): Acc => {
    if (!groups.has(g)) groups.set(g, new Map());
    const gm = groups.get(g)!;
    if (!gm.has(t)) gm.set(t, { points: 0, gf: 0, ga: 0, played: 0 });
    return gm.get(t)!;
  };

  // Seed every side that appears in a group fixture (any status) so teams
  // that have not yet kicked off still show in the table with zeros.
  for (const m of matchRows) {
    if (m.stage !== 'group' || !m.groupLetter) continue;
    if (m.homeCode) ensure(m.groupLetter, m.homeCode);
    if (m.awayCode) ensure(m.groupLetter, m.awayCode);
  }

  for (const m of matchRows) {
    if (m.stage !== 'group' || !m.groupLetter) continue;
    if (!COUNTED_STATUS.has(m.status)) continue;
    if (m.homeCode == null || m.awayCode == null) continue;
    if (m.homeScore == null || m.awayScore == null) continue;
    const h = ensure(m.groupLetter, m.homeCode);
    const a = ensure(m.groupLetter, m.awayCode);
    h.played += 1;
    a.played += 1;
    h.gf += m.homeScore;
    h.ga += m.awayScore;
    a.gf += m.awayScore;
    a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) h.points += 3;
    else if (m.homeScore < m.awayScore) a.points += 3;
    else {
      h.points += 1;
      a.points += 1;
    }
  }

  const out: LiveStandingRow[] = [];
  for (const [groupLetter, teams] of groups) {
    const rows = [...teams.entries()]
      .map(([teamCode, acc]) => ({
        groupLetter,
        teamCode,
        played: acc.played,
        points: acc.points,
        gd: acc.gf - acc.ga,
        gf: acc.gf,
      }))
      .sort(
        (x, y) =>
          y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.teamCode.localeCompare(y.teamCode),
      );
    rows.forEach((r, i) => out.push({ ...r, rank: i + 1, advanced: i < 2 && r.played > 0 }));
  }
  return out;
}

export interface StandingInput {
  groupLetter: string;
  teamCode: string;
  points: number;
  gd: number;
  gf: number;
  rank: number | null;
}

export interface AdvancementFlags {
  advanced: Set<string>;
  bestThirds: Set<string>;
}

export function deriveAdvancement(rows: StandingInput[]): AdvancementFlags {
  const advanced = new Set<string>();
  for (const row of rows) {
    if (row.rank === 1 || row.rank === 2) advanced.add(row.teamCode);
  }

  const thirds = rows
    .filter((r) => r.rank === 3)
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

  const bestThirds = new Set<string>();
  for (const row of thirds.slice(0, 8)) {
    bestThirds.add(row.teamCode);
    advanced.add(row.teamCode);
  }

  return { advanced, bestThirds };
}
