import type { Metadata, Viewport } from 'next';
import { Bebas_Neue, Hanken_Grotesk } from 'next/font/google';
import BottomTabBar from '@/components/nav/BottomTabBar';
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
  title: 'WC26 Bracket Pool',
  description: 'World Cup 2026 bracket pool with friends',
};

export const viewport: Viewport = {
  themeColor: '#060a13',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-tabbar">
        <div className="bg-atmosphere" aria-hidden />
        <div className="bg-pitch" aria-hidden />
        <div className="bg-grain" aria-hidden />
        <main className="mx-auto w-full max-w-md flex-1 px-4">{children}</main>
        <BottomTabBar />
      </body>
    </html>
  );
}
