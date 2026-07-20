'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Reduced-motion as a subscribable external store, so components can read it
// during render instead of syncing it into state from an effect.
const MQ = '(prefers-reduced-motion: reduce)';
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(MQ);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(MQ).matches,
    // The server cannot know, and assuming motion is fine keeps the markup
    // identical to the common case.
    () => false,
  );
}

// Small shared building blocks for the story slides. Every one of them is
// purely presentational and takes its numbers already computed, so the slides
// stay dumb and the maths stays in src/lib/recap.ts.

// Client-safe copy of the ordinal helper. The server module that also exports
// one pulls in the database client, so it can never be imported from here.
export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export function Kicker({ children, tone = 'accent' }: { children: React.ReactNode; tone?: 'accent' | 'gold' | 'muted' | 'live' }) {
  const color =
    tone === 'gold' ? 'text-gold' : tone === 'live' ? 'text-live' : tone === 'muted' ? 'text-muted-2' : 'text-accent';
  return <p className={`finale-kicker ${color}`}>{children}</p>;
}

// Kinetic type: each line wipes up from behind its own mask, staggered.
export function MaskLines({
  lines,
  className = '',
  delay = 0,
  step = 130,
}: {
  lines: React.ReactNode[];
  className?: string;
  delay?: number;
  step?: number;
}) {
  return (
    <div className={className}>
      {lines.map((line, i) => (
        // Lines are positional and can repeat, so the index is the only key.
        <span key={i} className="mask-line">
          <span style={{ animationDelay: `${delay + i * step}ms` }}>{line}</span>
        </span>
      ))}
    </div>
  );
}

// A number that counts up to its value on mount. Falls straight to the final
// value when the viewer prefers reduced motion.
export function CountUp({
  to,
  ms = 1400,
  delay = 260,
  suffix = '',
  className = '',
}: {
  to: number;
  ms?: number;
  delay?: number;
  suffix?: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (reduced || to <= 0) return;
    let start = 0;
    const begin = setTimeout(() => {
      const tick = (t: number) => {
        if (!start) start = t;
        const p = Math.min(1, (t - start) / ms);
        // Ease out cubic, so it decelerates into the final number.
        setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(begin);
      cancelAnimationFrame(raf.current);
    };
  }, [to, ms, delay, reduced]);

  // Skipping the animation is a render-time decision, not a state update.
  const shown = reduced || to <= 0 ? to : value;

  return (
    <span className={`tabular-nums ${className}`}>
      {shown}
      {suffix}
    </span>
  );
}

// The oversized hero number every "here is your stat" slide is built around.
export function BigStat({
  value,
  suffix,
  label,
  tone = 'accent',
  count = true,
}: {
  value: number;
  suffix?: string;
  label: React.ReactNode;
  tone?: 'accent' | 'gold' | 'live' | 'white';
  count?: boolean;
}) {
  const color =
    tone === 'gold' ? 'text-gold' : tone === 'live' ? 'text-live' : tone === 'white' ? 'text-foreground' : 'text-accent';
  return (
    <div className="text-center">
      <div className={`anim-count finale-hero ${color}`} style={{ animationDelay: '180ms' }}>
        {count ? <CountUp to={value} suffix={suffix} /> : `${value}${suffix ?? ''}`}
      </div>
      <div className="mt-3 text-sm leading-relaxed text-muted">{label}</div>
    </div>
  );
}

// A labelled horizontal bar, used for round breakdowns, vote tallies and
// champion-pick distributions.
export function Bar({
  label,
  right,
  pct,
  delay = 0,
  tone = 'accent',
  highlight = false,
}: {
  label: React.ReactNode;
  right?: React.ReactNode;
  pct: number;
  delay?: number;
  tone?: 'accent' | 'gold' | 'live' | 'white';
  highlight?: boolean;
}) {
  const bg =
    tone === 'gold' ? 'bg-gold' : tone === 'live' ? 'bg-live' : tone === 'white' ? 'bg-white' : 'bg-accent';
  return (
    <div className={`rounded-lg px-1.5 py-1 ${highlight ? 'f-fill' : ''}`}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-semibold text-white/90">{label}</span>
        {right ? <span className="shrink-0 text-xs font-bold text-muted">{right}</span> : null}
      </div>
      <span className="mt-1 block h-2 overflow-hidden rounded-full f-track">
        <span
          className={`anim-bar block h-full rounded-full ${bg}`}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%`, animationDelay: `${delay}ms` }}
        />
      </span>
    </div>
  );
}

// A flag on a soft glowing disc, for team-centric slides.
export function FlagDisc({ flag, size = 'lg' }: { flag: string; size?: 'lg' | 'md' }) {
  const dim = size === 'lg' ? 'h-32 w-32 text-6xl' : 'h-20 w-20 text-4xl';
  return (
    <div
      className={`anim-stamp mx-auto flex ${dim} items-center justify-center rounded-full`}
      style={{
        background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.16), rgba(255,255,255,0.03))',
        boxShadow: '0 0 60px rgba(255,255,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.14)',
        animationDelay: '140ms',
      }}
    >
      {flag}
    </div>
  );
}

// Initials disc used wherever a person is named.
export function Avatar({ name, size = 'md', medal }: { name: string; size?: 'sm' | 'md' | 'lg'; medal?: 1 | 2 | 3 }) {
  const dim = size === 'lg' ? 'h-16 w-16 text-2xl' : size === 'sm' ? 'h-7 w-7 text-[0.7rem]' : 'h-10 w-10 text-base';
  const medalClass = medal ? `medal-${medal}` : 'f-fill-2 text-foreground';
  return (
    <span
      className={`flex ${dim} shrink-0 items-center justify-center rounded-full font-display ${medalClass}`}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

// A card that stamps onto the slide, used for awards and verdicts.
export function StampCard({
  emoji,
  title,
  body,
  footnote,
  delay = 240,
}: {
  emoji?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  footnote?: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="anim-stamp rounded-2xl border f-line f-fill p-5 text-center backdrop-blur-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      {emoji ? <div className="text-4xl">{emoji}</div> : null}
      <div className="mt-1 font-display text-3xl leading-none">{title}</div>
      {body ? <div className="mt-2 text-sm leading-relaxed text-muted">{body}</div> : null}
      {footnote ? <div className="mt-2 text-xs italic text-muted-2">{footnote}</div> : null}
    </div>
  );
}

// The house-bias one-liners get their own visual treatment so it is obvious
// they are editorial rather than a computed stat.
export function BiasNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      className="anim-in mt-4 rounded-xl border border-gold/30 bg-gold/[0.08] px-3 py-2 text-center text-xs font-semibold italic leading-relaxed text-gold"
      style={{ animationDelay: '900ms' }}
    >
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Composition layers. These give each slide its own visual identity while the
// content itself stays centred.
// ---------------------------------------------------------------------------

// An enormous translucent numeral or word sitting behind the content.
export function Ghost({ children, opacity = 0.07 }: { children: React.ReactNode; opacity?: number }) {
  return (
    <div
      className="anim-ghost pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      aria-hidden
    >
      <span
        className="font-display whitespace-nowrap leading-none text-foreground"
        style={{ fontSize: 'clamp(11rem, 62vw, 26rem)', opacity }}
      >
        {children}
      </span>
    </div>
  );
}

// Concentric rings radiating out from the middle of the slide.
export function Halo({ tone = 'rgba(30,230,164,0.28)' }: { tone?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden>
      <div className="halo-spin relative h-[130vw] w-[130vw] max-w-[42rem]" style={{ maxHeight: '42rem' }}>
        {[0.42, 0.62, 0.82, 1].map((s) => (
          <span
            key={s}
            className="absolute left-1/2 top-1/2 rounded-full border"
            style={{
              width: `${s * 100}%`,
              height: `${s * 100}%`,
              transform: 'translate(-50%, -50%)',
              borderColor: tone,
              opacity: 0.35 - s * 0.16,
              borderStyle: s > 0.7 ? 'dashed' : 'solid',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// A repeating strip of text that slides across, used as texture behind or
// above the content. Centre-safe: it is purely decorative.
export function Marquee({ text, className = '', tone = 'rgba(255,255,255,0.06)' }: { text: string; className?: string; tone?: string }) {
  const run = Array.from({ length: 8 }, () => text).join('  •  ');
  return (
    <div className={`pointer-events-none absolute inset-x-0 overflow-hidden ${className}`} aria-hidden>
      <div className="marquee-track flex w-max">
        <span className="font-display whitespace-nowrap text-6xl leading-none" style={{ color: tone }}>
          {run}
        </span>
        <span className="font-display whitespace-nowrap text-6xl leading-none" style={{ color: tone }}>
          {run}
        </span>
      </div>
    </div>
  );
}

// Wraps slide content so decorative layers can sit behind it.
export function Layered({ children, layers }: { children: React.ReactNode; layers?: React.ReactNode }) {
  return (
    <div className="relative">
      {layers}
      <div className="relative">{children}</div>
    </div>
  );
}

// A tilted, framed panel. Breaks up long runs of flat centred text without
// moving the content off centre.
export function Tilt({ children, deg = -2.2 }: { children: React.ReactNode; deg?: number }) {
  return (
    <div
      className="anim-stamp rounded-2xl border f-line f-fill p-4 backdrop-blur-sm"
      style={{ transform: `rotate(${deg}deg)`, animationDelay: '300ms' }}
    >
      <div style={{ transform: `rotate(${-deg}deg)` }}>{children}</div>
    </div>
  );
}

// Conic ring for share-of-total stats.
export function Ring({ pct, center }: { pct: number; center: React.ReactNode }) {
  return (
    <div
      className="ring-stat relative mx-auto flex h-40 w-40 items-center justify-center rounded-full"
      style={
        {
          '--ring-target': `${Math.round((pct / 100) * 360)}deg`,
          background:
            'conic-gradient(var(--accent) var(--ring-deg), rgba(255,255,255,0.08) var(--ring-deg))',
          animationDelay: '260ms',
        } as React.CSSProperties
      }
    >
      <span className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-[#0a1220] text-center">
        {center}
      </span>
    </div>
  );
}
