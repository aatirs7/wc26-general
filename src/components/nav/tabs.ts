import { Home, Radio, Trophy, CalendarDays, ListOrdered, BarChart3, User, type LucideIcon } from 'lucide-react';

// Shared nav destinations, used by the mobile bottom bar and the desktop
// top bar so the two stay in sync.
export const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/bracket', label: 'Bracket', icon: Trophy },
  { href: '/matches', label: 'Matches', icon: CalendarDays },
  { href: '/leaderboard', label: 'Table', icon: ListOrdered },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/me', label: 'Me', icon: User },
];
