import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, Hanken_Grotesk } from 'next/font/google';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { matches, poolMembers, syncMeta, users } from '@/lib/schema';
import { currentUserId } from '@/lib/auth';
import { isTournamentOver, isFinalePreview } from '@/lib/finale';
import { ROOT_ID } from '@/lib/knockout-bracket';
import BottomTabBar from '@/components/nav/BottomTabBar';
import DesktopNav from '@/components/nav/DesktopNav';
import ThemeButton from '@/components/theme/ThemeButton';
import WhatsNew from '@/components/WhatsNew';
import InstallPrompt from '@/components/InstallPrompt';
import AutoRefresh from '@/components/AutoRefresh';
import FinaleTakeover from '@/components/results/FinaleTakeover';
import './globals.css';

const display = Bebas_Neue({
  variable: '--font-bebas',
  subsets: ['latin'],
  weight: '400',
});

const body = Hanken_Grotesk({
  variable: '--font-hanken',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'World Cup 2026 Bracket Pool',
  description: 'Rank the groups, call the knockouts, and see who knows ball.',
  manifest: '/manifest.webmanifest',
  // iOS "Add to Home Screen": launch standalone with the WC26 name.
  // The icon itself comes from src/app/apple-icon.png.
  appleWebApp: {
    capable: true,
    title: 'WC26 Bracket',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#060a13',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Gray (day) is the default; only an explicit cookie switches to night.
  const jar = await cookies();
  const theme = jar.get('wc26_theme')?.value === 'dark' ? 'dark' : 'gray';
  const signedIn = !!jar.get('wc26_uid')?.value;

  // Personalised points-gained figure for the scoring-update announcement.
  // Stored as a userId -> gain map under a single sync_meta row, written once
  // when the new scoring went live; absent (or 0) just hides the badge.
  let updateGain: number | null = null;
  // The end-of-tournament finale splash, live once the final ends or for
  // preview players testing it early.
  let finaleActive = false;
  let poolCount = 1;
  if (signedIn) {
    try {
      const uid = await currentUserId();
      if (uid) {
        const [me] = await db
          .select({ displayName: users.displayName })
          .from(users)
          .where(eq(users.id, uid))
          .limit(1);
        const [finalMatch] = await db
          .select({ status: matches.status })
          .from(matches)
          .where(eq(matches.id, ROOT_ID))
          .limit(1);
        finaleActive = isTournamentOver(finalMatch?.status) || isFinalePreview(me?.displayName);
        if (finaleActive) {
          const mine = await db
            .select({ poolId: poolMembers.poolId })
            .from(poolMembers)
            .where(eq(poolMembers.userId, uid));
          poolCount = mine.length;
        }
        const [row] = await db
          .select({ value: syncMeta.value })
          .from(syncMeta)
          .where(eq(syncMeta.key, 'scoreUpdateV1'))
          .limit(1);
        if (row) {
          const map = JSON.parse(row.value) as Record<string, number>;
          updateGain = map[uid] ?? null;
        }
      }
    } catch {
      // best-effort: the announcement still shows without the badge
    }
  }
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-tabbar">
        <div className="bg-atmosphere" aria-hidden />
        <div className="bg-pitch" aria-hidden />
        <div className="bg-grain" aria-hidden />
        <AutoRefresh />
        <ThemeButton initial={theme} />
        <DesktopNav />
        {signedIn ? <WhatsNew gain={updateGain} /> : null}
        {signedIn ? <InstallPrompt /> : null}
        <main className="mx-auto w-full max-w-md flex-1 px-4 pt-14 lg:max-w-6xl lg:px-8 lg:pt-24">
          {children}
        </main>
        <BottomTabBar />
        {signedIn && finaleActive ? <FinaleTakeover poolCount={poolCount} /> : null}
      </body>
    </html>
  );
}
