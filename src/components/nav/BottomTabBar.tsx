'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, CalendarDays, ListOrdered, BarChart3, User, type LucideIcon } from 'lucide-react';

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/bracket', label: 'Bracket', icon: Trophy },
  { href: '/matches', label: 'Matches', icon: CalendarDays },
  { href: '/leaderboard', label: 'Table', icon: ListOrdered },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/me', label: 'Me', icon: User },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  if (pathname === '/') return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md px-2 pt-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex min-h-13 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[0.7rem] font-semibold transition-colors ${
                active ? 'text-[var(--accent-ink)]' : 'text-muted hover:text-foreground'
              }`}
            >
              {active ? (
                <span className="absolute inset-0 -z-10 rounded-xl bg-accent" aria-hidden />
              ) : null}
              <Icon className="h-5 w-5" strokeWidth={2.4} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
