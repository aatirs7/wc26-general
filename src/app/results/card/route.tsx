import { ImageResponse } from 'next/og';
import { currentUserId } from '@/lib/auth';
import { loadResults } from '@/lib/results';
import type { ResultPlayer } from '@/lib/results';

export const dynamic = 'force-dynamic';

const MEDALS = ['🥇', '🥈', '🥉'];
const COLORS = ['#fbbf24', '#cbd5e1', '#d97706'];
const HEIGHTS = [360, 260, 200];

function Column({ player, place }: { player: ResultPlayer | undefined; place: number }) {
  if (!player) return <div style={{ display: 'flex', width: 260 }} />;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: 260,
      }}
    >
      <div style={{ fontSize: 72 }}>{MEDALS[place]}</div>
      <div style={{ display: 'flex', fontSize: 40, color: '#f8fafc', marginTop: 6 }}>{player.name}</div>
      <div style={{ display: 'flex', fontSize: 48, color: '#38bdf8', marginTop: 2 }}>{player.combined}</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          width: 220,
          height: HEIGHTS[place],
          marginTop: 12,
          borderTop: `8px solid ${COLORS[place]}`,
          backgroundColor: `${COLORS[place]}22`,
          color: COLORS[place],
          fontSize: 64,
          paddingTop: 10,
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
          padding: 64,
          background: 'radial-gradient(120% 90% at 50% 0%, #10233f 0%, #060a13 65%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 26, letterSpacing: 8, color: '#fbbf24' }}>
            FULL TIME
          </div>
          <div style={{ display: 'flex', fontSize: 72, color: '#f8fafc', marginTop: 8 }}>
            {data.poolName}
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: '#94a3b8', marginTop: 4 }}>
            World Cup 2026 final standings
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
          <Column player={second} place={1} />
          <Column player={first} place={0} />
          <Column player={third} place={2} />
        </div>

        <div style={{ display: 'flex', fontSize: 26, color: '#64748b' }}>
          {data.championTeam ? `Champions: ${data.championTeam.name}` : 'wc26 bracket pool'}
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
