import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, Hanken_Grotesk } from 'next/font/google';
import { cookies } from 'next/headers';
import BottomTabBar from '@/components/nav/BottomTabBar';
import DesktopNav from '@/components/nav/DesktopNav';
import ThemeButton from '@/components/theme/ThemeButton';
import WhatsNew from '@/components/WhatsNew';
import InstallPrompt from '@/components/InstallPrompt';
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
        <ThemeButton initial={theme} />
        <DesktopNav />
        {signedIn ? <WhatsNew /> : null}
        {signedIn ? <InstallPrompt /> : null}
        <main className="mx-auto w-full max-w-md flex-1 px-4 pt-14 lg:max-w-6xl lg:px-8 lg:pt-24">
          {children}
        </main>
        <BottomTabBar />
      </body>
    </html>
  );
}
