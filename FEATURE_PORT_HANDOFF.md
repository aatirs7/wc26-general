# Feature Port Handoff — wc26-general → Siddiqui version

This is a concrete, code-level guide to port the features built on
`wc26-general` onto the original Siddiqui family build. The two share the
same stack and file structure (Next.js App Router, Drizzle + Neon, Tailwind
4 with the same CSS theme tokens), so paths map 1:1 unless noted.

**Excluded on purpose:** the `/home` dashboard. The family version keeps its
existing landing/nav. Where a feature was *surfaced* on the dashboard
(Predict, Smack talk), use the alternative entry points called out per
section (a nav tab or a link on an existing page).

Order matters: do **§1 (schema)** first, then everything else in any order.

Project rule reminder: **no em dashes** anywhere in code/copy/comments.

---

## 1. Schema migration (do this first)

Three additive tables. Nothing existing changes, so it is safe against live
data. Append to `src/lib/schema.ts`:

```ts
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
```

Then generate + apply:

```bash
npm run db:generate   # drizzle-kit generate -> new drizzle/XXXX_*.sql
npm run db:migrate    # applies to whatever DATABASE_URL points at
```

> If the family version uses one pool with `NEXT_PUBLIC_DEFAULT_POOL_ID`,
> everything below still works: `standingSnapshots`/`messages` are keyed by
> `poolId`, and the mini-game is per-user/global, so it spans pools fine.

---

## 2. Score-prediction mini-game

Per-user score predictions. **Exact scoreline = 3 bonus pts, else 0.**
Predictions open 24h before kickoff and lock at kickoff. Separate points
track from the bracket.

### 2a. Rules helper — `src/lib/predict.ts` (new)

```ts
export const PREDICT_OPEN_MS = 24 * 60 * 60 * 1000;
export const PREDICT_EXACT_POINTS = 3;
export const PREDICT_MAX_GOALS = 20;

export type PredictState = 'upcoming' | 'open' | 'closed';

export function predictState(kickoffUtc: Date, nowMs: number): PredictState {
  const t = kickoffUtc.getTime();
  if (nowMs >= t) return 'closed';
  if (nowMs >= t - PREDICT_OPEN_MS) return 'open';
  return 'upcoming';
}

export function scorePrediction(
  pred: { homeScore: number; awayScore: number },
  match: { homeScore: number | null; awayScore: number | null; isFinal: boolean },
): number {
  if (!match.isFinal || match.homeScore == null || match.awayScore == null) return 0;
  return pred.homeScore === match.homeScore && pred.awayScore === match.awayScore
    ? PREDICT_EXACT_POINTS
    : 0;
}
```

### 2b. Write API — `src/app/api/predict/route.ts` (new)

POST upserts a prediction but only while the window is open (server-enforced).
DELETE clears one. Full file:

```ts
import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { matchPredictions, matches } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { PREDICT_MAX_GOALS, predictState } from '@/lib/predict';

const bodySchema = z.object({
  matchId: z.number().int(),
  home: z.number().int().min(0).max(PREDICT_MAX_GOALS),
  away: z.number().int().min(0).max(PREDICT_MAX_GOALS),
});

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  const { matchId, home, away } = parsed.data;

  const [match] = await db
    .select({ kickoffUtc: matches.kickoffUtc })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) return NextResponse.json({ error: 'no such match' }, { status: 404 });

  if (predictState(match.kickoffUtc, Date.now()) !== 'open') {
    return NextResponse.json({ error: 'predictions are not open for this match' }, { status: 403 });
  }

  await db
    .insert(matchPredictions)
    .values({ userId, matchId, homeScore: home, awayScore: away })
    .onConflictDoUpdate({
      target: [matchPredictions.userId, matchPredictions.matchId],
      set: { homeScore: home, awayScore: away, updatedAt: new Date() },
    });
  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({ matchId: z.number().int() });

export async function DELETE(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const [match] = await db
    .select({ kickoffUtc: matches.kickoffUtc })
    .from(matches)
    .where(eq(matches.id, parsed.data.matchId))
    .limit(1);
  if (match && predictState(match.kickoffUtc, Date.now()) !== 'open') {
    return NextResponse.json({ error: 'locked' }, { status: 403 });
  }
  await db
    .delete(matchPredictions)
    .where(and(eq(matchPredictions.userId, userId), eq(matchPredictions.matchId, parsed.data.matchId)));
  return NextResponse.json({ ok: true });
}
```

### 2c. Scoring in the sync loop — `src/lib/sync.ts`

Add `matchPredictions` to the schema import and `scorePrediction` from
`./predict`. Call `await rescorePredictions()` right after `await rescoreAll()`,
and add the function (idempotent, only writes changed rows):

```ts
async function rescorePredictions() {
  const matchRows = await db
    .select({ id: matches.id, homeScore: matches.homeScore, awayScore: matches.awayScore, status: matches.status })
    .from(matches);
  const byId = new Map(matchRows.map((m) => [m.id, m]));

  const preds = await db.select().from(matchPredictions);
  for (const p of preds) {
    const m = byId.get(p.matchId);
    const pts = m
      ? scorePrediction(p, { homeScore: m.homeScore, awayScore: m.awayScore, isFinal: isFinal(m.status) })
      : 0;
    if (pts !== p.points) {
      await db
        .update(matchPredictions)
        .set({ points: pts })
        .where(and(eq(matchPredictions.userId, p.userId), eq(matchPredictions.matchId, p.matchId)));
    }
  }
}
```

(`isFinal` already exists in sync.ts as `(s) => FINAL_STATUSES.includes(s)`.)

### 2d. Stepper input — `src/components/predict/MatchPredict.tsx` (new)

Two +/- steppers (home/away) that debounce-save to `/api/predict`. Copy the
file verbatim from `wc26-general/src/components/predict/MatchPredict.tsx`. Key
points: `'use client'`, local `h`/`a` state, a 600ms debounce ref, and a
`status` of `idle|saving|saved|error`. Clamps 0..`PREDICT_MAX_GOALS`.

### 2e. Predict page — `src/app/predict/page.tsx` (new)

Server component (`force-dynamic`). Loads matches + teams + the user's
predictions, classifies each by `predictState`, and renders three sections:
**Open now** (editable `MatchPredict`), **Your results** (your settled picks
vs actual + points), **Opening soon**. Bonus total in the header. Copy the
file verbatim from `wc26-general/src/app/predict/page.tsx`.

> Note the lint guard for reading the clock in a server component:
> ```ts
> // eslint-disable-next-line react-hooks/purity
> const now = Date.now();
> ```

### 2f. Entry point (family version has no dashboard)

Add a nav tab or a link. The family `BottomTabBar` has 5 slots; either swap
one or add Predict. Minimal nav addition (`src/components/nav/BottomTabBar.tsx`):

```ts
import { Target } from 'lucide-react';
// in TABS:
{ href: '/predict', label: 'Predict', icon: Target },
```

Or add a link on the Matches page. Either works since `/predict` is global.

### 2g. Combined leaderboard with a per-player breakdown — `src/app/leaderboard/page.tsx`

**No toggle.** The leaderboard always ranks by the **combined** total
(bracket points + score-prediction bonus). Tapping a player expands an inline
breakdown of where their points come from (per-round bracket points + bonus).

Server page computes, per member:

```ts
// bonus per user (global), summed for the group's members:
const predRows = memberIds.length
  ? await db.select({ userId: matchPredictions.userId, points: matchPredictions.points })
      .from(matchPredictions).where(inArray(matchPredictions.userId, memberIds))
  : [];
const bonusByUser = new Map<string, number>();
for (const p of predRows) bonusByUser.set(p.userId, (bonusByUser.get(p.userId) ?? 0) + p.points);

// per-round bracket points for the breakdown (group bracketScores by bracketId):
//   roundsByBracket: Map<bracketId, Map<roundKey, points>>
// ROUND_ORDER = ['groups','thirdPlace','r16','qf','sf','final','champion']
// rounds = ROUND_ORDER.map(k => ({ label: ROUND_LABELS[k], pts: roundMap?.get(k) ?? 0 }))
//                     .filter(r => r.pts > 0)

const combined = bracketTotal + bonus;

// sort: combined desc, submitted desc, tiebreak (champion+final) desc, lockedAt asc
// rank EVERYONE 1..n (bonus accrues even without a submitted bracket)
```

Then render a **client** component so rows expand on tap. Full files to copy
verbatim: `wc26-general/src/app/leaderboard/page.tsx` (server: computes rows +
movement, passes a serializable `PlayerRow[]`) and
`wc26-general/src/components/leaderboard/Standings.tsx` (client: renders the
list, and on row click shows a `<dl>` of round points + a gold "Score-
prediction bonus" row + a Total, plus a "View full bracket" link when the
player has one). `PlayerRow`:

```ts
interface PlayerRow {
  ownerId: string; name: string; bracketName: string | null; bracketId: string | null;
  rank: number; combined: number; bracketTotal: number; bonus: number; submitted: boolean;
  rounds: { label: string; pts: number }[]; rankDelta: number; gained: number;
}
```

Also update **`src/app/scoring/page.tsx`** to document the bonus (import
`PREDICT_EXACT_POINTS`; add a "Bonus: score predictions" section: exact
scoreline = N bonus pts, opens 24h before kickoff, locks at kickoff, adds into
the combined total).

---

## 3. Leaderboard movement arrows (depends on §1 + §2g)

### 3a. Daily snapshot in `src/lib/sync.ts`

Import `brackets, bracketScores, poolMembers, standingSnapshots` from schema
and `matchDayKey` from `./format-time`. Call `await snapshotStandings();` near
the **top** of `runSync` (before applying new results), and add:

```ts
async function snapshotStandings() {
  const day = matchDayKey(new Date());
  const [existing] = await db
    .select({ capturedDay: standingSnapshots.capturedDay })
    .from(standingSnapshots).limit(1);
  if (existing?.capturedDay === day) return; // already have today's baseline

  const allBrackets = await db.select().from(brackets);
  const scores = await db.select().from(bracketScores);
  const tb = new Map<string, number>();
  for (const s of scores)
    if (s.roundKey === 'champion' || s.roundKey === 'final')
      tb.set(s.bracketId, (tb.get(s.bracketId) ?? 0) + s.points);
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
    // MUST match the leaderboard bracket-metric sort.
    rr.sort((a, b) => {
      if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
      if (b.points !== a.points) return b.points - a.points;
      if (b.tiebreak !== a.tiebreak) return b.tiebreak - a.tiebreak;
      return a.lockedAtMs - b.lockedAtMs;
    });
    let r = 0;
    for (const x of rr)
      toInsert.push({ poolId, userId: x.userId, points: x.points, rank: x.submitted ? ++r : null, capturedDay: day });
  }

  await db.delete(standingSnapshots);
  for (const row of toInsert) {
    await db.insert(standingSnapshots).values(row).onConflictDoUpdate({
      target: [standingSnapshots.poolId, standingSnapshots.userId],
      set: { points: row.points, rank: row.rank, capturedDay: row.capturedDay },
    });
  }
}
```

### 3b. Arrows on the leaderboard — `src/app/leaderboard/page.tsx`

Import `standingSnapshots`. After computing rows + ranks:

```ts
const snaps = await db.select().from(standingSnapshots).where(eq(standingSnapshots.poolId, active.poolId));
const snapByUser = new Map(snaps.map((s) => [s.userId, s]));
const movementOf = (row: Row): { rankDelta: number; gained: number } | null => {
  if (metric !== 'bracket') return null;       // movement is for the bracket view
  const s = snapByUser.get(row.ownerId);
  if (!s) return null;
  const rankDelta = s.rank != null && row.rank != null ? s.rank - row.rank : 0; // + = climbed
  return { rankDelta, gained: row.value - s.points };
};
```

In the row, before the points value:

```tsx
{mv && (mv.rankDelta !== 0 || mv.gained > 0) ? (
  <div className="flex shrink-0 flex-col items-end text-[0.6rem] font-bold leading-tight">
    {mv.rankDelta > 0 ? <span className="text-accent">▲{mv.rankDelta}</span>
     : mv.rankDelta < 0 ? <span className="text-live">▼{-mv.rankDelta}</span> : null}
    {mv.gained > 0 ? <span className="text-muted">+{mv.gained}</span> : null}
  </div>
) : null}
```

(Nothing shows until games are scored and a day boundary passes — expected.)

---

## 4. Group smack-talk chat

### 4a. Post API — `src/app/api/chat/route.ts` (new)

```ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { messages } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { isPoolMember } from '@/lib/access';

const postSchema = z.object({ poolId: z.string().uuid(), body: z.string().trim().min(1).max(280) });

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  if (!(await isPoolMember(userId, parsed.data.poolId)))
    return NextResponse.json({ error: 'not a member' }, { status: 403 });
  await db.insert(messages).values({ poolId: parsed.data.poolId, userId, body: parsed.data.body });
  return NextResponse.json({ ok: true });
}
```

### 4b. Composer — `src/components/chat/ChatBox.tsx` (new)

`'use client'` fixed-bottom input + send button. Posts to `/api/chat`, clears,
`router.refresh()`. Includes a 12s `setInterval(() => router.refresh())` poller
(guarded by an `inFlight` ref so it does not clobber the input mid-send). Copy
verbatim from `wc26-general`. The fixed bar sits above the tab bar via
`bottom-[calc(4.75rem+env(safe-area-inset-bottom))]`.

### 4c. Chat page — `src/app/chat/page.tsx` (new)

Server component. Resolves the active pool (`?pool=`), loads the last 100
messages joined to `users`, renders bubbles (mine right-aligned in accent,
others left in `card`) and `<ChatBox poolId=...>`. Copy verbatim. Family
single-pool version: drop the `?pool=` switcher and use the default pool id.

### 4d. Entry point

Family version: add a link to `/chat` from an existing page (or a nav tab).
On `wc26-general` it is a card on the dashboard — skip that here.

---

## 5. What's-new modal (theme-safe stepper)

`src/components/WhatsNew.tsx` (new) — a small click-through stepper, one
feature per card, Back/Next, progress dots. Auto-opens once per `VERSION`
(localStorage key `wc26_whatsnew_seen`), and a fixed top-left `?` button
reopens it. Uses theme tokens (`card`, `bg-surface`, `border-edge`,
`text-foreground`, `text-muted`, `bg-accent`) so it works in light + dark.
Copy verbatim from `wc26-general`, then **edit `CHANGELOG`** to the family
version's own feature list and bump `VERSION`.

Auto-open without tripping `react-hooks/set-state-in-effect`:

```ts
useEffect(() => {
  let seen: string | null = null;
  try { seen = localStorage.getItem(KEY); } catch {}
  if (seen !== VERSION) {
    const t = setTimeout(() => setOpen(true), 500); // deferred, not a sync setState
    return () => clearTimeout(t);
  }
}, []);
```

Wire into `src/app/layout.tsx` (render only when signed in so it does not pop
on the public landing):

```tsx
import WhatsNew from '@/components/WhatsNew';
// ...
const jar = await cookies();
const theme = jar.get('wc26_theme')?.value === 'dark' ? 'dark' : 'gray';
const signedIn = !!jar.get('wc26_uid')?.value;
// in JSX, next to <ThemeButton/>:
{signedIn ? <WhatsNew /> : null}
```

---

## 6. Reuse a bracket across groups

Only relevant if the family build supports multiple pools. If it is
single-pool, skip.

### 6a. API — `src/app/api/bracket/route.ts`

Add `copyFrom` to the create action and seed predictions from an owned
bracket:

```ts
// in the create branch of the discriminated union:
copyFrom: z.string().uuid().optional(),

// after the "already exists" check, before insert:
let predictions = emptyPredictions();
if (body.copyFrom) {
  const src = await loadOwned(body.copyFrom, userId); // existing helper
  if (src) {
    try { predictions = pruneDownstream(validatePredictions(src.predictions)); }
    catch { predictions = emptyPredictions(); }
  }
}
// insert with `predictions` instead of emptyPredictions()
```

### 6b. UI — `src/components/bracket/StartBracket.tsx`

Accept `sources?: { id: string; poolName: string; submitted: boolean }[]` and
render "use these picks" buttons that call create with `copyFrom: s.id`. Copy
the ported component.

### 6c. Page — `src/app/bracket/page.tsx`

When the active pool has no bracket, pass the user's other-group brackets:

```ts
import { and, asc, eq, ne } from 'drizzle-orm';
const otherBrackets = !bracket
  ? await db.select({ id: brackets.id, poolName: pools.name, submitted: brackets.submitted })
      .from(brackets).innerJoin(pools, eq(pools.id, brackets.poolId))
      .where(and(eq(brackets.ownerId, userId), ne(brackets.poolId, activePoolId)))
  : [];
// <StartBracket poolId={activePoolId} sources={otherBrackets} />
```

---

## 7. Rename your display name

### 7a. API — `src/app/api/auth/route.ts`

Add a `PATCH` (imports: `db`, `users`, `eq`, `currentUserId`):

```ts
const renameSchema = z.object({ name: z.string().trim().min(1).max(40) });

export async function PATCH(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const parsed = renameSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid name' }, { status: 400 });
  const name = parsed.data.name;

  const all = await db.select({ id: users.id, displayName: users.displayName }).from(users);
  if (all.find((u) => u.id !== userId && u.displayName.toLowerCase() === name.toLowerCase()))
    return NextResponse.json({ error: 'name taken' }, { status: 409 });

  const [updated] = await db.update(users).set({ displayName: name }).where(eq(users.id, userId)).returning();
  const res = NextResponse.json({ user: { id: updated.id, displayName: updated.displayName } });
  res.cookies.set(LAST_NAME_COOKIE, updated.displayName, {
    httpOnly: true, sameSite: 'lax', maxAge: AUTH_COOKIE_MAX_AGE, path: '/',
  });
  return res;
}
```

### 7b. UI — `src/components/me/RenameSelf.tsx` (new) + Me page

`'use client'` expand-to-edit control that PATCHes `/api/auth` and
`router.refresh()` (handles 409 "name taken"). Copy verbatim. Place under the
avatar in `src/app/me/page.tsx`:

```tsx
import RenameSelf from '@/components/me/RenameSelf';
// <RenameSelf currentName={me?.displayName ?? ''} />
```

---

## 8. Shareable bracket image

### 8a. OG image — `src/app/bracket/[id]/opengraph-image.tsx` (new)

`next/og` `ImageResponse` (1200x630) showing owner, group, champion pick flag,
finalists, and points. Copy verbatim. **Two gotchas:**

- `export const runtime = 'nodejs';` (queries the DB).
- Every `<div>` with multiple children needs `display: flex` (Satori rule).
  Collapse multi-expression text into one string, e.g.
  `{`${owner?.displayName ?? 'A player'}${pool?.name ? ` · ${pool.name}` : ''}`}`.

### 8b. Share button — `src/components/brackets/ShareBracket.tsx` (new)

`'use client'` button using `navigator.share` (copy-link fallback). Add to the
header of `src/app/bracket/[id]/page.tsx`:

```tsx
import ShareBracket from '@/components/brackets/ShareBracket';
// <ShareBracket title={`${owner?.displayName ?? ''}'s World Cup 2026 bracket`} />
```

---

## 9. Bracket pan/zoom dead-space fix

`src/components/bracket/FullBracket.tsx`. Three changes to stop the tree being
stranded with empty grey space and to fill the viewport:

1. Add a `clampView` that pins the tree inside the viewport (centres when
   smaller than the viewport on an axis, blocks dragging past the edges):

```ts
function clampView(v: View): View {
  const vp = viewportRef.current;
  if (!vp || !dims.w) return v;
  const m = 16;
  const cw = dims.w * v.s, ch = dims.h * v.s;
  let { x, y } = v;
  if (cw + 2 * m <= vp.clientWidth) x = (vp.clientWidth - cw) / 2;
  else x = Math.min(m, Math.max(vp.clientWidth - cw - m, x));
  if (ch + 2 * m <= vp.clientHeight) y = (vp.clientHeight - ch) / 2;
  else y = Math.min(m, Math.max(vp.clientHeight - ch - m, y));
  return { s: v.s, x, y };
}
```

2. Wrap every `setView(...)` payload in pan/pinch/zoom/fit/reset with
   `clampView({...})`.

3. Auto-fit to width once on open, and bump the viewport height:

```ts
const didInit = useRef(false);
useEffect(() => {
  if (didInit.current || !dims.w) return;
  const vp = viewportRef.current;
  if (!vp) return;
  didInit.current = true;
  const s = clampScale(Math.min(1, vp.clientWidth / dims.w));
  setView(clampView({ s, x: 0, y: 0 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [dims]);
```

Viewport className: change `h-[68vh]` to `h-[78vh]`.

---

## 10. Hardening freebie: guard the auth cookie

`src/lib/auth.ts` `currentUserId`: a tampered/garbage `wc26_uid` cookie throws
a Postgres uuid error and 500s the page. Guard the shape:

```ts
if (!uid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid))
  return null;
```

---

## 11. Verify checklist

```bash
npx tsc --noEmit         # or: node node_modules/typescript/lib/tsc.js --noEmit
npm run lint
npm test
```

Smoke (signed-in cookie = a real user id):

- `POST /api/predict` for a match >24h out → **403** (window guard works).
- `/predict` renders Open now / Opening soon.
- `/leaderboard?metric=bonus` and `?metric=combined` → 200.
- `POST /api/chat` as a member → 200; as a non-member → 403; `/chat` shows it.
- `PATCH /api/auth {name}` renames; a duplicate name → 409.
- `/bracket/<id>/opengraph-image` → `image/png`, 1200x630.

Live scoring path stays the same: the cron hits `/api/cron`, which runs
`runSync()`, now also calling `snapshotStandings()` and `rescorePredictions()`.
