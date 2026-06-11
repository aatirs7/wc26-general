// Results provider abstraction. football-data.org today (free, no daily
// cap, 10 req/min); the contract stays generic so switching providers is
// a config flip, not a refactor. Server-side only: never call this from
// the client.

export interface ProviderFixture {
  providerId: number;
  stage: string | null; // our stage codes: group|r32|r16|qf|sf|third|final
  groupLetter: string | null;
  homeName: string;
  awayName: string;
  homeTla: string | null;
  awayTla: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string; // normalized: scheduled|live|ht|ft|et|pens
  kickoffUtc: Date;
  winnerName: string | null;
  winnerTla: string | null;
}

export interface ProviderStanding {
  groupName: string; // e.g. "GROUP_A"
  teamName: string;
  teamTla: string | null;
  played: number;
  points: number;
  gd: number;
  gf: number;
  rank: number;
}

export interface ScoresProvider {
  fetchFixtures(): Promise<ProviderFixture[]>;
  fetchStandings(): Promise<ProviderStanding[]>;
}

const BASE = 'https://api.football-data.org/v4';
const COMPETITION = 'WC';

// Explicit stage map. The 2026 format adds LAST_32; never assume the
// pre-2026 stage list.
const STAGE_MAP: Record<string, string> = {
  GROUP_STAGE: 'group',
  LAST_32: 'r32',
  LAST_16: 'r16',
  QUARTER_FINALS: 'qf',
  SEMI_FINALS: 'sf',
  THIRD_PLACE: 'third',
  FINAL: 'final',
};

function mapStatus(status: string, duration: string | null): string {
  switch (status) {
    case 'SCHEDULED':
    case 'TIMED':
    case 'SUSPENDED':
    case 'POSTPONED':
      return 'scheduled';
    case 'IN_PLAY':
      return 'live';
    case 'PAUSED':
      return 'ht';
    case 'FINISHED':
    case 'CANCELLED':
    case 'AWARDED':
      if (duration === 'PENALTY_SHOOTOUT') return 'pens';
      if (duration === 'EXTRA_TIME') return 'et';
      return 'ft';
    default:
      return 'scheduled';
  }
}

async function apiGet(path: string): Promise<Record<string, unknown>> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error('FOOTBALL_DATA_TOKEN is not set');
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': token },
    cache: 'no-store',
  });
  if (res.status === 429) {
    throw new Error('football-data.org rate limited (429); retry in ~60s');
  }
  if (!res.ok) throw new Error(`football-data.org ${path} failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// Winner with knockout safety: trust penalties over score.winner when a
// shootout happened (winner can read DRAW while penalties decide it).
function winnerSide(raw: any): 'home' | 'away' | null {
  if (raw.status !== 'FINISHED') return null;
  const pens = raw.score?.penalties;
  if (raw.score?.duration === 'PENALTY_SHOOTOUT' || (pens && pens.home !== pens.away)) {
    if (pens && pens.home !== null && pens.away !== null) {
      return pens.home > pens.away ? 'home' : 'away';
    }
  }
  if (raw.score?.winner === 'HOME_TEAM') return 'home';
  if (raw.score?.winner === 'AWAY_TEAM') return 'away';
  return null;
}

export const footballDataProvider: ScoresProvider = {
  async fetchFixtures() {
    const data = await apiGet(`/competitions/${COMPETITION}/matches`);
    const matches = (data.matches as any[]) ?? [];
    return matches.map((raw): ProviderFixture => {
      const side = winnerSide(raw);
      const winner = side ? raw.teams?.[side] ?? raw[`${side}Team`] : null;
      return {
        providerId: raw.id,
        stage: STAGE_MAP[raw.stage as string] ?? null,
        groupLetter: raw.group ? String(raw.group).replace(/^GROUP_/, '') : null,
        homeName: raw.homeTeam?.name ?? '',
        awayName: raw.awayTeam?.name ?? '',
        homeTla: raw.homeTeam?.tla ?? null,
        awayTla: raw.awayTeam?.tla ?? null,
        homeScore: raw.score?.fullTime?.home ?? null,
        awayScore: raw.score?.fullTime?.away ?? null,
        status: mapStatus(raw.status, raw.score?.duration ?? null),
        kickoffUtc: new Date(raw.utcDate),
        winnerName: side ? (raw[`${side}Team`]?.name ?? winner?.name ?? null) : null,
        winnerTla: side ? (raw[`${side}Team`]?.tla ?? winner?.tla ?? null) : null,
      };
    });
  },

  async fetchStandings() {
    const data = await apiGet(`/competitions/${COMPETITION}/standings`);
    const blocks = (data.standings as any[]) ?? [];
    const out: ProviderStanding[] = [];
    for (const block of blocks) {
      // Tournament standings come back one block per group; ignore
      // non-total tables if the API ever includes them.
      if (block.type && block.type !== 'TOTAL') continue;
      for (const row of block.table ?? []) {
        out.push({
          groupName: block.group ?? '',
          teamName: row.team?.name ?? '',
          teamTla: row.team?.tla ?? null,
          played: row.playedGames ?? 0,
          points: row.points ?? 0,
          gd: row.goalDifference ?? 0,
          gf: row.goalsFor ?? 0,
          rank: row.position ?? 0,
        });
      }
    }
    return out;
  },
};

// ESPN's unofficial public JSON feed (no API key). The scoreboard +
// standings for the FIFA World Cup (league slug fifa.world) actually serve
// live status, scores and group tables, unlike the free football-data tier.
const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const ESPN_WEB = 'https://site.web.api.espn.com/apis/v2/sports/soccer/fifa.world';

// ESPN season.type id -> our stage code (sampled across the 2026 schedule).
const ESPN_STAGE: Record<number, string> = {
  13802: 'group',
  13801: 'r32',
  13800: 'r16',
  13799: 'qf',
  13798: 'sf',
  13797: 'third',
  13803: 'final',
};

function espnStatus(state: string | undefined, name: string | undefined): string {
  const n = (name ?? '').toUpperCase();
  if (state === 'pre') return 'scheduled';
  if (state === 'in') return n.includes('HALFTIME') || n.includes('HALF_TIME') ? 'ht' : 'live';
  // 'post' / finished
  if (n.includes('PEN') || n.includes('SHOOTOUT')) return 'pens';
  if (n.includes('AET') || n.includes('EXTRA')) return 'et';
  if (n.includes('POSTPON') || n.includes('ABANDON') || n.includes('CANCEL')) return 'scheduled';
  return 'ft';
}

async function espnGet(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ESPN ${url} failed: ${res.status}`);
  return res.json();
}

const toScore = (s: any): number | null => {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export const espnProvider: ScoresProvider = {
  async fetchFixtures() {
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = Date.now();
    const out = new Map<number, ProviderFixture>();
    // ESPN's scoreboard is per-day; pull a window around now so we catch
    // just-finished, live, and imminent fixtures.
    for (let off = -2; off <= 2; off++) {
      const dt = new Date(now + off * 86400000);
      const ymd = `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`;
      let data: any;
      try {
        data = await espnGet(`${ESPN_SITE}/scoreboard?dates=${ymd}`);
      } catch {
        continue; // skip a bad day, keep the rest
      }
      for (const e of (data.events as any[]) ?? []) {
        const c = e.competitions?.[0];
        if (!c) continue;
        const competitors = (c.competitors ?? []) as any[];
        const home = competitors.find((x) => x.homeAway === 'home');
        const away = competitors.find((x) => x.homeAway === 'away');
        const status = espnStatus(e.status?.type?.state, e.status?.type?.name);
        const started = status !== 'scheduled';
        const winner = competitors.find((x) => x.winner === true) ?? null;
        const id = Number(e.id);
        if (!Number.isFinite(id)) continue;
        out.set(id, {
          providerId: id,
          stage: ESPN_STAGE[e.season?.type as number] ?? null,
          groupLetter: null,
          homeName: home?.team?.displayName ?? '',
          awayName: away?.team?.displayName ?? '',
          homeTla: home?.team?.abbreviation ?? null,
          awayTla: away?.team?.abbreviation ?? null,
          homeScore: started ? toScore(home?.score) : null,
          awayScore: started ? toScore(away?.score) : null,
          status,
          kickoffUtc: new Date(e.date),
          winnerName: winner?.team?.displayName ?? null,
          winnerTla: winner?.team?.abbreviation ?? null,
        });
      }
    }
    return [...out.values()];
  },

  async fetchStandings() {
    const data = await espnGet(`${ESPN_WEB}/standings?season=2026`);
    const out: ProviderStanding[] = [];
    for (const group of (data.children as any[]) ?? []) {
      const groupName = group.name ?? group.abbreviation ?? '';
      for (const e of (group.standings?.entries as any[]) ?? []) {
        const stat = (k: string) => (e.stats as any[])?.find((s) => s.name === k)?.value;
        out.push({
          groupName,
          teamName: e.team?.displayName ?? '',
          teamTla: e.team?.abbreviation ?? null,
          played: Number(stat('gamesPlayed')) || 0,
          points: Number(stat('points')) || 0,
          gd: Number(stat('pointDifferential')) || 0,
          gf: Number(stat('pointsFor')) || 0,
          rank: Number(stat('rank')) || 0,
        });
      }
    }
    return out;
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// Active results provider. Swap this one line to change data sources.
export const activeProvider: ScoresProvider = espnProvider;
