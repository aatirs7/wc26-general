import { ImageResponse } from 'next/og';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { brackets, pools, teams, users } from '@/lib/schema';
import type { Predictions } from '@/types/bracket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'World Cup 2026 bracket';

// Rich link preview for a shared bracket: owner, group, champion pick,
// and points. Generated on the fly via next/og.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [b] = await db.select().from(brackets).where(eq(brackets.id, id)).limit(1);

  const preds = (b?.predictions ?? null) as Predictions | null;
  const champ = preds?.knockout?.champion;
  const finals = (preds?.knockout?.final ?? []).filter((c) => c !== champ);
  const codes = [champ, ...finals].filter((c): c is string => !!c);

  const teamRows = codes.length
    ? await db
        .select({ code: teams.code, name: teams.name, flag: teams.flag })
        .from(teams)
        .where(inArray(teams.code, codes))
    : [];
  const byCode = new Map(teamRows.map((t) => [t.code, t]));
  const champTeam = champ ? byCode.get(champ) : null;

  const [owner] = b
    ? await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, b.ownerId)).limit(1)
    : [];
  const [pool] = b
    ? await db.select({ name: pools.name }).from(pools).where(eq(pools.id, b.poolId)).limit(1)
    : [];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          background: 'linear-gradient(135deg, #0c3a2b 0%, #06140f 60%, #04100b 100%)',
          color: '#f4f7f5',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 44 }}>🏆</div>
          <div
            style={{
              fontSize: 24,
              letterSpacing: 8,
              fontWeight: 700,
              color: '#34d399',
            }}
          >
            WORLD CUP 2026 BRACKET POOL
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 40, color: '#9fb3aa' }}>
            {owner?.displayName ?? 'A player'}
            {pool?.name ? ` · ${pool.name}` : ''}
          </div>
          {champTeam ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ fontSize: 120 }}>{champTeam.flag}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 30, color: '#9fb3aa', letterSpacing: 4 }}>CHAMPION PICK</div>
                <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1 }}>{champTeam.name}</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 64, fontWeight: 800 }}>{b?.name ?? 'World Cup 2026 bracket'}</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 30, color: '#9fb3aa' }}>
            {finals.length === 2 && byCode.get(finals[0]) && byCode.get(finals[1])
              ? `Final: ${byCode.get(finals[0])!.name} vs ${byCode.get(finals[1])!.name}`
              : 'Rank the groups · call the knockouts'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{ fontSize: 88, fontWeight: 800, color: '#34d399', lineHeight: 1 }}>
              {b?.totalPoints ?? 0}
            </div>
            <div style={{ fontSize: 30, color: '#9fb3aa', letterSpacing: 4 }}>PTS</div>
          </div>
        </div>
      </div>
    ),
    { ...size, emoji: 'twemoji' },
  );
}
