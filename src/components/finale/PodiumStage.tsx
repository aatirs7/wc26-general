'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { X, RotateCcw, FastForward } from 'lucide-react';
import type { ResultsData, ResultPlayer } from '@/lib/results';
import Confetti from '@/components/results/Confetti';
import ShareCardButton from './ShareCardButton';
import { congratsText } from '@/lib/share-text';
import { Avatar, CountUp, ordinal, useBodyScrollLock, useReducedMotion } from './kit';

// Reveal beats. Third place first, then second, then a deliberate pause, then
// the champion with a flare and confetti, then the rest of the table.
const PHASE = {
  DARK: 0,
  THIRD: 1,
  SECOND: 2,
  HOLD: 3,
  FIRST: 4,
  SETTLED: 5,
} as const;

const BEATS: [number, number][] = [
  [PHASE.THIRD, 700],
  [PHASE.SECOND, 2000],
  [PHASE.HOLD, 3300],
  [PHASE.FIRST, 4600],
  [PHASE.SETTLED, 6400],
];

// Deliberately short. Tall plinths pushed the champion card and the rest of
// the field below the fold on a phone, which is the one thing this screen
// cannot afford to hide.
const PLINTH = [
  { h: 'h-24', medal: '🥇', klass: 'podium-1', label: 'Champion', color: '#e8b53e' },
  { h: 'h-16', medal: '🥈', klass: 'podium-2', label: 'Runner-up', color: '#c4cdda' },
  { h: 'h-11', medal: '🥉', klass: 'podium-3', label: 'Third', color: '#d08a4d' },
];

function Plinth({
  player,
  place,
  show,
  isMe,
}: {
  player: ResultPlayer | undefined;
  place: 0 | 1 | 2;
  show: boolean;
  isMe: boolean;
}) {
  const meta = PLINTH[place];
  if (!player) return <div className="w-full" />;

  return (
    <div className="flex w-full flex-col items-center justify-end">
      {/* Name block sits on the plinth and arrives with it. Kept short on
          purpose: accuracy and the champion pick live in the card below, so
          the three columns cannot push the rest of the page off screen. */}
      <div
        className="flex flex-col items-center transition-all duration-700"
        style={{ opacity: show ? 1 : 0, transform: show ? 'none' : 'translateY(20px)' }}
      >
        <div className={`relative ${show ? 'anim-stamp' : ''}`} style={{ animationDelay: '220ms' }}>
          <Avatar name={player.name} size={place === 0 ? 'lg' : 'md'} medal={(place + 1) as 1 | 2 | 3} />
          <span className="absolute -bottom-1 -right-1 text-base leading-none">{meta.medal}</span>
        </div>
        <div
          className={`mt-2 max-w-[6.5rem] truncate px-1 text-center font-display leading-none ${
            place === 0 ? 'text-2xl' : 'text-lg'
          } ${isMe ? 'text-accent' : ''}`}
        >
          {player.name}
        </div>
        <div
          className={`font-display leading-none ${place === 0 ? 'text-3xl' : 'text-2xl'}`}
          style={{ color: meta.color }}
        >
          {show ? <CountUp to={player.combined} delay={300} ms={1100} /> : 0}
        </div>
      </div>

      {/* The block itself, with a lit top face so it reads as solid.
          The numeral is a div, not a span: globals.css gives the first span
          child of a .podium-* element an inset ring for the leaderboard rows,
          which drew a stray outlined box around the number here. */}
      <div
        className={`mt-2 w-full ${show ? 'anim-plinth' : ''}`}
        style={{ opacity: show ? 1 : 0, transformStyle: 'preserve-3d' }}
      >
        <div
          className="h-2.5 w-full rounded-t-[3px]"
          style={{
            background: `linear-gradient(180deg, color-mix(in srgb, ${meta.color} 85%, white), ${meta.color})`,
            transform: 'perspective(340px) rotateX(52deg)',
            transformOrigin: 'bottom center',
            boxShadow: `0 -14px 40px color-mix(in srgb, ${meta.color} 40%, transparent)`,
          }}
        />
        <div
          className={`${meta.klass} relative flex ${meta.h} w-full items-center justify-center`}
          style={{ borderRadius: '2px 2px 0 0' }}
        >
          <div className="font-display text-3xl leading-none" style={{ color: 'var(--medal-ink)' }}>
            {place + 1}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PodiumStage({
  data,
  poolId,
  viewerId,
  preview,
}: {
  data: ResultsData;
  poolId: string;
  viewerId: string | null;
  preview: boolean;
}) {
  const reduced = useReducedMotion();
  useBodyScrollLock();
  const [rawPhase, setPhase] = useState<number>(PHASE.DARK);
  const [run, setRun] = useState(0);
  const [first, second, third] = data.podium;

  // Reduced motion means the scene is simply already finished; that is a
  // render-time decision rather than a state update from an effect.
  const phase = reduced ? PHASE.SETTLED : rawPhase;

  const play = useCallback(() => {
    setPhase(PHASE.DARK);
    setRun((r) => r + 1);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const timers = BEATS.map(([p, ms]) => setTimeout(() => setPhase(p), ms));
    return () => timers.forEach(clearTimeout);
  }, [run, reduced]);

  const skip = () => setPhase(PHASE.SETTLED);
  const settled = phase >= PHASE.SETTLED;
  const rest = data.standings.slice(3);

  return (
    <div key={run} className="finale-stage finale-scroll">
      <Confetti fire={phase >= PHASE.FIRST} />

      {/* Spotlights and dust, purely atmosphere. */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        <div
          className="spotlight absolute -top-40 left-[8%] h-[130vh] w-[42vw] opacity-60"
          style={{
            background: 'linear-gradient(180deg, var(--f-beam), transparent 62%)',
            clipPath: 'polygon(42% 0%, 58% 0%, 100% 100%, 0% 100%)',
            filter: 'blur(22px)',
          }}
        />
        <div
          className="spotlight absolute -top-40 right-[8%] h-[130vh] w-[42vw] opacity-50"
          style={{
            background: 'linear-gradient(180deg, var(--f-beam-2), transparent 62%)',
            clipPath: 'polygon(42% 0%, 58% 0%, 100% 100%, 0% 100%)',
            filter: 'blur(22px)',
            animationDelay: '2.5s',
          }}
        />
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className="dust absolute bottom-0 h-1 w-1 rounded-full"
            style={{
              left: `${6 + i * 6.5}%`,
              animationDuration: `${9 + (i % 5) * 3}s`,
              animationDelay: `${i * 0.9}s`,
            }}
          />
        ))}
      </div>

      {/* Champion flare */}
      {phase >= PHASE.FIRST ? (
        <div
          className="anim-flare pointer-events-none absolute left-1/2 top-[38%] z-10 h-64 w-64 -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,220,140,0.75), transparent 62%)' }}
          aria-hidden
        />
      ) : null}

      {/* Close */}
      <Link
        href={`/results?pool=${poolId}`}
        aria-label="Close"
        className="absolute right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-30 flex h-9 w-9 items-center justify-center rounded-full f-fill-2 text-foreground active:scale-90"
      >
        <X className="h-4 w-4" />
      </Link>

      <div className="relative z-20 mx-auto w-full max-w-lg px-5 pb-[calc(env(safe-area-inset-bottom)+4rem)] pt-[calc(env(safe-area-inset-top)+3.5rem)]">
        {preview ? (
          <p className="mb-4 rounded-xl border border-gold/40 bg-gold/[0.08] px-3 py-2 text-center text-[0.7rem] font-semibold text-gold">
            Preview. Computed from the standings exactly as they are right now.
          </p>
        ) : null}

        <header className="text-center">
          <p className="finale-kicker text-gold">Full time</p>
          <h1 className="mt-1 finale-hero metal-gold" style={{ fontSize: 'clamp(2.6rem, 13vw, 4.6rem)' }}>
            {data.poolName}
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-2">
            Final standings
          </p>
        </header>

        {/* The stage */}
        <div className="mt-10 flex items-end gap-2" style={{ perspective: '900px' }}>
          <Plinth player={second} place={1} show={phase >= PHASE.SECOND} isMe={second?.ownerId === viewerId} />
          <Plinth player={first} place={0} show={phase >= PHASE.FIRST} isMe={first?.ownerId === viewerId} />
          <Plinth player={third} place={2} show={phase >= PHASE.THIRD} isMe={third?.ownerId === viewerId} />
        </div>
        {/* Stage floor */}
        <div
          className="h-px w-full"
          style={{ background: 'linear-gradient(90deg, transparent, var(--f-floor), transparent)' }}
        />
        <div
          className="h-16 w-full"
          style={{ background: 'linear-gradient(180deg, var(--f-panel), transparent)' }}
        />

        {/* Controls */}
        <div className="-mt-10 flex justify-center gap-2">
          {settled ? (
            <button
              type="button"
              onClick={play}
              className="flex items-center gap-1.5 rounded-full border f-line f-fill px-4 py-2 text-xs font-bold text-foreground active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Run it back
            </button>
          ) : (
            <button
              type="button"
              onClick={skip}
              className="flex items-center gap-1.5 rounded-full border f-line f-fill px-4 py-2 text-xs font-bold text-foreground active:scale-95"
            >
              <FastForward className="h-3.5 w-3.5" /> Skip
            </button>
          )}
        </div>

        {/* Champion spotlight card */}
        {first ? (
          <div
            className="mt-10 rounded-2xl border border-gold/40 bg-gold/[0.07] p-5 text-center transition-all duration-700"
            style={{ opacity: settled ? 1 : 0, transform: settled ? 'none' : 'translateY(16px)' }}
          >
            <p className="finale-kicker text-gold">Pool champion</p>
            <div className="mt-1 font-display text-4xl leading-none">{first.name}</div>
            <div className="text-sm text-muted-2">{first.bracketName}</div>
            {first.championPick ? (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Backed{' '}
                <span className="font-bold text-foreground">
                  {first.championPick.flag} {first.championPick.name}
                </span>{' '}
                to lift it
                {data.championTeam
                  ? first.championPick.code === data.championTeam.code
                    ? ', and called it exactly right.'
                    : `. The trophy actually went to ${data.championTeam.flag} ${data.championTeam.name}.`
                  : '.'}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* The rest of the field */}
        {rest.length ? (
          <section className="mt-8" style={{ opacity: settled ? 1 : 0, transition: 'opacity 700ms' }}>
            <h2 className="mb-3 text-center finale-kicker text-muted-2">The rest of the field</h2>
            <ol className="space-y-1.5">
              {rest.map((r, i) => (
                <li
                  key={r.ownerId}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                    r.ownerId === viewerId
                      ? 'me-pulse border-accent/50 bg-accent/[0.07]'
                      : 'f-line f-fill'
                  } ${settled ? 'anim-in' : ''}`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="w-6 shrink-0 text-center font-display text-lg text-muted-2">{r.rank}</span>
                  <Avatar name={r.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{r.name}</span>
                    <span className="block truncate text-[0.7rem] text-muted-2">{r.bracketName}</span>
                  </span>
                  <span className="shrink-0 font-display text-lg text-accent">{r.combined}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* Where the viewer landed */}
        {data.viewer ? (
          <p
            className="mt-6 text-center text-sm text-muted"
            style={{ opacity: settled ? 1 : 0, transition: 'opacity 700ms 300ms' }}
          >
            You finished {ordinal(data.viewer.player.rank)} of {data.standings.length} on{' '}
            {data.viewer.player.combined} points.
          </p>
        ) : null}

        <div className="mt-8 space-y-2" style={{ opacity: settled ? 1 : 0, transition: 'opacity 700ms 400ms' }}>
          <Link
            href={`/results/recap?pool=${poolId}`}
            className="block w-full rounded-2xl f-solid py-3 text-center text-sm font-bold active:scale-95"
          >
            Watch your Recap
          </Link>
          <ShareCardButton
            url={`/results/card?pool=${poolId}`}
            filename="podium.png"
            title={`${data.poolName} final standings`}
            text={congratsText(
              data.poolName,
              data.podium,
              data.championTeam ? `${data.championTeam.flag} ${data.championTeam.name}` : null,
            )}
            label="Share this podium"
            className="w-full rounded-2xl border py-3 text-sm font-bold active:scale-95 f-panel"
          />
        </div>
      </div>
    </div>
  );
}
