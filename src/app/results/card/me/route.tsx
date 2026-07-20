import { ImageResponse } from 'next/og';
import { currentUserId } from '@/lib/auth';
import { loadPersonalWrapped } from '@/lib/wrapped';

export const dynamic = 'force-dynamic';

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

// A personal, shareable summary card: placement, points, persona and the one
// stat worth bragging (or complaining) about.
export async function GET(req: Request) {
  const userId = await currentUserId();
  const { searchParams } = new URL(req.url);
  const poolId = searchParams.get('pool');
  if (!userId || !poolId) return new Response('not found', { status: 404 });

  const d = await loadPersonalWrapped(poolId, userId);
  if (!d) return new Response('not found', { status: 404 });

  const Stat = ({ value, label }: { value: string; label: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 300 }}>
      <div style={{ display: 'flex', fontSize: 72, color: '#1ee6a4' }}>{value}</div>
      <div style={{ display: 'flex', fontSize: 22, color: '#8693ad', letterSpacing: 3, marginTop: 4 }}>
        {label.toUpperCase()}
      </div>
    </div>
  );

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
          padding: 72,
          background: 'radial-gradient(120% 90% at 50% 0%, #10233f 0%, #04070e 66%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 24, letterSpacing: 10, color: '#ffc850' }}>
            WORLD CUP 2026 WRAPPED
          </div>
          <div style={{ display: 'flex', fontSize: 92, color: '#f8fafc', marginTop: 14 }}>{d.name}</div>
          <div style={{ display: 'flex', fontSize: 28, color: '#8693ad', marginTop: 2 }}>{d.poolName}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 110 }}>{d.archetype.emoji}</div>
          <div style={{ display: 'flex', fontSize: 82, color: '#ffc850', marginTop: 6 }}>
            {d.archetype.title}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              color: '#b9c2d4',
              marginTop: 14,
              maxWidth: 860,
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            {d.archetype.line}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
          <Stat value={ordinal(d.me.rank)} label={`of ${d.fieldSize}`} />
          <Stat value={`${d.me.combined}`} label="points" />
          <Stat
            value={d.champion ? d.champion.pick.flag : `${d.me.accuracy ?? 0}%`}
            label={d.champion ? 'their pick' : 'accuracy'}
          />
        </div>

        <div style={{ display: 'flex', fontSize: 24, color: '#5e6a85', letterSpacing: 4 }}>
          WC26 BRACKET POOL
        </div>
      </div>
    ),
    { width: 1080, height: 1080 },
  );
}
