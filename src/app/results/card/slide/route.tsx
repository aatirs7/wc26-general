import { ImageResponse } from 'next/og';
import { currentUserId } from '@/lib/auth';
import { isPoolMember } from '@/lib/access';
import { loadPersonalRecap, loadPoolRecap } from '@/lib/recap';
import { personalShareCards, poolShareCards, type ShareTone, type SlideShare } from '@/lib/share-slides';

export const dynamic = 'force-dynamic';

// Story-shaped so it fills an Instagram or WhatsApp status without cropping.
const W = 1080;
const H = 1920;

// The same washes the decks use, flattened to the dark palette: a shared image
// has no theme to follow, and light cards look washed out in a chat thread.
const TONES: Record<ShareTone, { bg: string; accent: string }> = {
  night: {
    bg: 'radial-gradient(130% 60% at 50% 0%, #3a2f10 0%, #0a0f1c 55%, #03060c 100%)',
    accent: '#ffc850',
  },
  emerald: {
    bg: 'radial-gradient(130% 60% at 50% 0%, #0d5741 0%, #04120e 55%, #04070e 100%)',
    accent: '#1ee6a4',
  },
  gold: {
    bg: 'radial-gradient(130% 60% at 50% 0%, #5c4413 0%, #170f02 55%, #04070e 100%)',
    accent: '#ffc850',
  },
  indigo: {
    bg: 'radial-gradient(130% 60% at 50% 0%, #23306b 0%, #080d20 55%, #04070e 100%)',
    accent: '#8ba4ff',
  },
  crimson: {
    bg: 'radial-gradient(130% 60% at 50% 0%, #5e1626 0%, #1a060c 55%, #04070e 100%)',
    accent: '#ff5d73',
  },
  violet: {
    bg: 'radial-gradient(130% 60% at 50% 0%, #3c2263 0%, #120a20 55%, #04070e 100%)',
    accent: '#c39bff',
  },
  slate: {
    bg: 'radial-gradient(130% 60% at 50% 0%, #2b3648 0%, #0b111c 55%, #04070e 100%)',
    accent: '#b9c2d4',
  },
  magenta: {
    bg: 'radial-gradient(130% 60% at 50% 0%, #5c1d47 0%, #180a16 55%, #04070e 100%)',
    accent: '#ff6ebe',
  },
  teal: {
    bg: 'radial-gradient(130% 60% at 50% 0%, #0d4a55 0%, #04161c 55%, #04070e 100%)',
    accent: '#3cc8dc',
  },
};

function Card({ share }: { share: SlideShare }) {
  const tone = TONES[share.tone] ?? TONES.night;
  // Long headlines need to step down or they wrap into the stat.
  const headlineSize = share.headline.length > 34 ? 62 : share.headline.length > 20 ? 82 : 104;

  return (
    <div
      style={{
        width: W,
        height: H,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // Centre the whole composition and pin the footer, rather than
        // space-between, which left a large dead gap on sparser cards.
        justifyContent: 'center',
        position: 'relative',
        padding: '110px 72px 84px',
        background: tone.bg,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            letterSpacing: 12,
            color: tone.accent,
            marginBottom: 54,
          }}
        >
          {share.kicker.toUpperCase()}
        </div>
        {share.emoji ? (
          <div style={{ display: 'flex', fontSize: 150, marginBottom: 18 }}>{share.emoji}</div>
        ) : null}

        <div
          style={{
            display: 'flex',
            fontSize: headlineSize,
            color: '#f8fafc',
            lineHeight: 1.06,
            maxWidth: 900,
            textAlign: 'center',
          }}
        >
          {share.headline}
        </div>

        {share.stat ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 34 }}>
            <div
              style={{
                display: 'flex',
                fontSize: share.stat.length > 8 ? 96 : 176,
                color: tone.accent,
                lineHeight: 1,
              }}
            >
              {share.stat}
            </div>
            {share.statLabel ? (
              <div style={{ display: 'flex', fontSize: 30, color: '#97a3ba', marginTop: 10, letterSpacing: 3 }}>
                {share.statLabel.toUpperCase()}
              </div>
            ) : null}
          </div>
        ) : null}

        {share.sub ? (
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              color: '#b9c2d4',
              marginTop: 34,
              maxWidth: 860,
              lineHeight: 1.45,
              textAlign: 'center',
            }}
          >
            {share.sub}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'absolute',
          bottom: 84,
          left: 0,
          right: 0,
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, color: '#e6ebf5' }}>{share.footer}</div>
        <div style={{ display: 'flex', fontSize: 22, color: '#5e6a85', letterSpacing: 6, marginTop: 12 }}>
          WC26 BRACKET POOL
        </div>
      </div>
    </div>
  );
}

// Renders one slide of either recap deck as a shareable story card. Only the
// pool and the slide key come from the query string; the numbers are always
// recomputed server-side, so a card cannot be forged by editing the URL.
export async function GET(req: Request) {
  const userId = await currentUserId();
  const { searchParams } = new URL(req.url);
  const poolId = searchParams.get('pool');
  const deck = searchParams.get('deck');
  const slide = searchParams.get('slide');

  if (!userId || !poolId || !slide || (deck !== 'me' && deck !== 'pool')) {
    return new Response('not found', { status: 404 });
  }
  if (!(await isPoolMember(userId, poolId))) {
    return new Response('not found', { status: 404 });
  }

  let cards: Record<string, SlideShare>;
  if (deck === 'me') {
    const data = await loadPersonalRecap(poolId, userId);
    if (!data) return new Response('not found', { status: 404 });
    cards = personalShareCards(data);
  } else {
    cards = poolShareCards(await loadPoolRecap(poolId));
  }

  const share = cards[slide];
  if (!share) return new Response('not found', { status: 404 });

  return new ImageResponse(<Card share={share} />, { width: W, height: H });
}
