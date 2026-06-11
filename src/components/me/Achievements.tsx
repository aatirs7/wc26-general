import {
  Award,
  Crown,
  LayoutGrid,
  Medal,
  Moon,
  ShieldCheck,
  Star,
  Swords,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import type { Badge } from '@/lib/achievements';

const ICONS: Record<string, LucideIcon> = {
  'on-the-board': Target,
  'front-runner': Crown,
  'lone-wolf': Moon,
  'group-guru': LayoutGrid,
  'thirds-oracle': Medal,
  'sweet-16': Swords,
  finalists: Star,
  champion: Trophy,
  undefeated: ShieldCheck,
};

export default function Achievements({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-center gap-2">
        <h2 className="font-display text-xl text-muted">Achievements</h2>
        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-xs font-bold text-muted">
          {earned}/{badges.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {badges.map((b) => {
          const Icon = ICONS[b.key] ?? Award;
          return (
            <div
              key={b.key}
              className={`card flex items-start gap-2.5 p-3 ${b.earned ? 'border-gold/40' : 'opacity-60'}`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  b.earned ? 'bg-gold/15 text-gold' : 'bg-white/[0.04] text-muted-2'
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <div className={`text-sm font-bold leading-tight ${b.earned ? '' : 'text-muted'}`}>
                  {b.title}
                </div>
                <div className="mt-0.5 text-[0.7rem] leading-snug text-muted-2">
                  {b.earned ? b.desc : b.hint ?? b.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
