import { ImageResponse } from 'next/og';
import { currentUserId } from '@/lib/auth';
import { loadResults } from '@/lib/results';
import type { ResultPlayer } from '@/lib/results';

export const dynamic = 'force-dynamic';

// Metallic plinths matching the podium stage, not flat tinted rectangles.
const METAL = [
  { top: '#e8cf7a', body: 'linear-gradient(150deg,#d8bb63 0%,#c19a36 45%,#9d7c20 80%,#c8ab51 100%)', ink: '#3d2800', h: 300 },
  { top: '#dbe2ec', body: 'linear-gradient(150deg,#cfd7e2 0%,#aab6c6 45%,#8e9bb0 80%,#bcc6d4 100%)', ink: '#1c2636', h: 216 },
  { top: '#dcab7e', body: 'linear-gradient(150deg,#ce9d6e 0%,#b27b46 45%,#8c5c2e 80%,#bd8b5b 100%)', ink: '#3a1d08', h: 158 },
];
const MEDALS = ['🥇', '🥈', '🥉'];

function Column({ player, place }: { player: ResultPlayer | undefined; place: number }) {
  if (!player) return <div style={{ display: 'flex', width: 280 }} />;
  const m = METAL[place];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: 280,
      }}
    >
      <div style={{ display: 'flex', fontSize: 60 }}>{MEDALS[place]}</div>
      <div
        style={{
          display: 'flex',
          fontSize: place === 0 ? 46 : 38,
          color: '#f8fafc',
          marginTop: 4,
          maxWidth: 270,
        }}
      >
        {player.name}
      </div>
      <div style={{ display: 'flex', fontSize: place === 0 ? 62 : 52, color: m.top, marginTop: 2 }}>
        {player.combined}
      </div>
      {player.accuracy != null ? (
        <div style={{ display: 'flex', fontSize: 20, color: '#8693ad', letterSpacing: 2 }}>
          {player.accuracy}% ACCURATE
        </div>
      ) : null}
      {/* Lit top face, then the block. */}
      <div style={{ display: 'flex', width: 230, height: 12, background: m.top, marginTop: 14 }} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 230,
          height: m.h,
          background: m.body,
          color: m.ink,
          fontSize: 92,
        }}
      >
        {place + 1}
      </div>
    </div>
  );
}

export async function GET(req: Request) {
  const userId = await currentUserId();
  const { searchParams } = new URL(req.url);
  const poolId = searchParams.get('pool');
  if (!userId || !poolId) return new Response('not found', { status: 404 });

  const data = await loadResults(poolId, null);
  const [first, second, third] = data.podium;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1080,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '56px 48px 44px',
          background:
            'radial-gradient(130% 80% at 50% 0%, #14304a 0%, #0a1220 45%, #04070e 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 24, letterSpacing: 12, color: '#ffc850' }}>
            FULL TIME
          </div>
          <div style={{ display: 'flex', fontSize: 78, color: '#f8fafc', marginTop: 10 }}>
            {data.poolName}
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: '#8693ad', letterSpacing: 6, marginTop: 2 }}>
            FINAL STANDINGS
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <Column player={second} place={1} />
          <Column player={first} place={0} />
          <Column player={third} place={2} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {data.championTeam ? (
            <div style={{ display: 'flex', fontSize: 28, color: '#c7cfdd' }}>
              {data.championTeam.flag} {data.championTeam.name} won the World Cup
            </div>
          ) : null}
          <div style={{ display: 'flex', fontSize: 20, color: '#5e6a85', letterSpacing: 5, marginTop: 8 }}>
            WC26 BRACKET POOL
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
