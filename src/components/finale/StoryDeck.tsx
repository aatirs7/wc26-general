'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Pause, RotateCcw } from 'lucide-react';
import { useBodyScrollLock, useReducedMotion } from './kit';

export interface Slide {
  key: string;
  // How long this slide holds before auto-advancing, in milliseconds.
  ms?: number;
  // Slide-specific backdrop, so no two consecutive slides look alike. Any CSS
  // background value; it sits above the deck's base gradient and drifts.
  bg?: string;
  node: React.ReactNode;
}

const DEFAULT_MS = 6200;

// A Spotify-Recap style story player. Full screen, segmented progress at the
// top, tap the sides to page, hold to pause, swipe or arrow keys to move.
// It is deliberately dependency-free: state plus CSS keyframes.
export default function StoryDeck({
  slides,
  exitHref,
  onExitLabel = 'Close',
}: {
  slides: Slide[];
  exitHref: string;
  onExitLabel?: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  // Bumped on replay so every slide's animations restart from scratch.
  const [run, setRun] = useState(0);
  const reduced = useReducedMotion();
  useBodyScrollLock();

  const current = slides[index];
  const duration = current?.ms ?? DEFAULT_MS;

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= slides.length - 1) {
        setDone(true);
        return i;
      }
      return i + 1;
    });
  }, [slides.length]);

  const prev = useCallback(() => {
    setDone(false);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const replay = useCallback(() => {
    setDone(false);
    setPaused(false);
    setIndex(0);
    setRun((r) => r + 1);
  }, []);

  const close = useCallback(() => router.push(exitHref), [router, exitHref]);

  // Auto-advance. Reduced motion turns the deck fully manual, since an
  // auto-playing story is itself the motion some people are avoiding.
  useEffect(() => {
    if (paused || done || reduced) return;
    const t = setTimeout(next, duration);
    return () => clearTimeout(t);
  }, [index, paused, done, reduced, duration, next, run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        prev();
      } else if (e.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, close]);

  // Touch: vertical swipe pages, a long press pauses.
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    holdTimer.current = setTimeout(() => setPaused(true), 260);
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    const start = touch.current;
    touch.current = null;
    const wasPaused = paused;
    setPaused(false);
    if (!start) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const elapsed = Date.now() - start.t;

    if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) next();
      else prev();
      return;
    }
    // A hold is not a tap.
    if (wasPaused || elapsed > 260) return;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next();
      else prev();
      return;
    }
    // Plain tap: left third goes back, the rest advances.
    if (t.clientX < window.innerWidth * 0.33) prev();
    else next();
  }

  if (!current) return null;

  return (
    <div
      className="finale-stage select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Progress segments */}
      <div className="absolute inset-x-0 top-0 z-30 flex gap-1 px-3 pt-[calc(env(safe-area-inset-top)+0.6rem)]">
        {slides.map((s, i) => (
          <span key={s.key} className="h-[3px] flex-1 overflow-hidden rounded-full f-fill-2">
            <span
              className={`block h-full rounded-full bg-white ${
                i === index && !paused && !done && !reduced ? 'seg-fill' : ''
              }`}
              style={{
                animationDuration: `${duration}ms`,
                transform: i < index || done ? 'scaleX(1)' : i === index && (paused || reduced) ? 'scaleX(0.35)' : undefined,
                transformOrigin: 'left center',
                ...(i > index && !done ? { transform: 'scaleX(0)' } : {}),
              }}
            />
          </span>
        ))}
      </div>

      {/* Controls */}
      <div className="absolute right-3 top-[calc(env(safe-area-inset-top)+1.4rem)] z-30 flex items-center gap-2">
        {paused ? (
          <span className="flex h-8 items-center gap-1 rounded-full f-fill-2 px-3 text-[0.65rem] font-bold uppercase tracking-wider text-foreground">
            <Pause className="h-3 w-3" /> Held
          </span>
        ) : null}
        <button
          type="button"
          onClick={close}
          aria-label={onExitLabel}
          className="flex h-9 w-9 items-center justify-center rounded-full f-fill-2 text-foreground active:scale-90"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Desktop paging affordances */}
      <button
        type="button"
        onClick={prev}
        aria-label="Previous"
        className="absolute left-0 top-0 z-20 hidden h-full w-1/4 cursor-w-resize lg:block"
      />
      <button
        type="button"
        onClick={next}
        aria-label="Next"
        className="absolute right-0 top-0 z-20 hidden h-full w-1/2 cursor-e-resize lg:block"
      />

      {/* Slide backdrop */}
      {current.bg ? (
        <div
          key={`bg-${current.key}-${run}`}
          className="anim-slide-bg pointer-events-none absolute inset-0 z-0"
          style={{ background: current.bg }}
          aria-hidden
        />
      ) : null}

      {/* Slide */}
      <div
        key={`${current.key}-${run}`}
        className="anim-in absolute inset-0 z-10 flex flex-col items-center justify-center px-7 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] pt-16"
      >
        {/* Story slides are centre-aligned throughout; anything that needs to
            break out of that opts in locally. */}
        <div className="w-full max-w-md text-center">{current.node}</div>
      </div>

      {/* Manual paging bar, always available and the only control under
          reduced motion. */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <button
          type="button"
          onClick={prev}
          disabled={index === 0}
          className="rounded-full border f-line f-track px-4 py-2 text-xs font-bold text-muted disabled:opacity-30 active:scale-95"
        >
          Back
        </button>
        {done ? (
          <button
            type="button"
            onClick={replay}
            className="flex items-center gap-1.5 rounded-full f-solid px-5 py-2 text-xs font-bold active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Run it back
          </button>
        ) : (
          <button
            type="button"
            onClick={next}
            className="rounded-full f-solid px-6 py-2 text-xs font-bold active:scale-95"
          >
            Next
          </button>
        )}
        <span className="w-14 text-right text-[0.65rem] font-bold tabular-nums text-muted-2">
          {index + 1}/{slides.length}
        </span>
      </div>
    </div>
  );
}
