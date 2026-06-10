'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Team } from '@/types/team';
import type { Predictions } from '@/types/bracket';
import {
  feedersOf,
  resolveById,
  ROOT_ID,
  type FillKey,
  type ResolvedMatchup,
} from '@/lib/knockout-bracket';
import { Trophy, ChevronRight, Minus, Plus, Maximize2, X, Scan } from 'lucide-react';

interface Props {
  predictions: Predictions;
  teamsByCode: Map<string, Team>;
  onPick?: (fills: FillKey, winner: string, loser: string | null) => void;
}

function Slot({
  code,
  label,
  isWinner,
  decided,
  teamsByCode,
  onTap,
}: {
  code: string | null;
  label: string;
  isWinner: boolean;
  decided: boolean;
  teamsByCode: Map<string, Team>;
  onTap?: () => void;
}) {
  const team = code ? teamsByCode.get(code) : undefined;
  const dim = decided && !isWinner;
  return (
    <button
      type="button"
      disabled={!onTap || !code}
      onClick={onTap}
      className={`flex h-10 w-full items-center gap-2 px-2.5 text-left transition-colors ${
        isWinner ? 'bg-accent/[0.12]' : ''
      } ${dim ? 'opacity-40' : ''} disabled:cursor-default`}
    >
      <span className="text-base leading-none">{team?.flag ?? ''}</span>
      <span className="min-w-0 flex-1">
        {team ? (
          <span className={`block truncate text-[0.8rem] font-bold leading-tight ${isWinner ? 'text-accent' : ''}`}>
            {team.name}
          </span>
        ) : (
          <span className="block truncate text-[0.7rem] font-medium leading-tight text-muted-2">
            {label}
          </span>
        )}
      </span>
      {isWinner ? (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={3} />
      ) : null}
    </button>
  );
}

function Tie({
  m,
  teamsByCode,
  onPick,
}: {
  m: ResolvedMatchup;
  teamsByCode: Map<string, Team>;
  onPick?: Props['onPick'];
}) {
  const decided = m.winner != null;
  return (
    <div className="w-44 shrink-0 overflow-hidden rounded-lg border border-edge bg-surface">
      <Slot
        code={m.aCode}
        label={m.aLabel}
        isWinner={decided && m.winner === m.aCode}
        decided={decided}
        teamsByCode={teamsByCode}
        onTap={onPick && m.aCode ? () => onPick(m.fills, m.aCode!, m.bCode) : undefined}
      />
      <div className="mx-2 border-t border-edge/50" />
      <Slot
        code={m.bCode}
        label={m.bLabel}
        isWinner={decided && m.winner === m.bCode}
        decided={decided}
        teamsByCode={teamsByCode}
        onTap={onPick && m.bCode ? () => onPick(m.fills, m.bCode!, m.aCode) : undefined}
      />
    </div>
  );
}

function Connector() {
  return (
    <div className="relative w-5 shrink-0 self-stretch">
      <span className="absolute left-1/2 top-1/4 bottom-1/4 w-px bg-edge-strong" />
      <span className="absolute left-0 top-1/4 h-px w-1/2 bg-edge-strong" />
      <span className="absolute left-0 top-3/4 h-px w-1/2 bg-edge-strong" />
      <span className="absolute left-1/2 right-0 top-1/2 h-px bg-edge-strong" />
    </div>
  );
}

const MIN_SCALE = 0.3;
const MAX_SCALE = 1.8;
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export default function FullBracket({ predictions, teamsByCode, onPick }: Props) {
  const resolved = resolveById(predictions);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(0.6);
  const [fullscreen, setFullscreen] = useState(false);
  const didInit = useRef(false);

  // Natural (unscaled) content size; CSS transforms do not affect scrollWidth.
  useEffect(() => {
    const el = contentRef.current;
    if (el) setDims({ w: el.scrollWidth, h: el.scrollHeight });
  }, [predictions]);

  function fitNow() {
    const sc = scrollRef.current;
    if (!sc || !dims.w) return;
    const s = clampScale(Math.min((sc.clientWidth - 8) / dims.w, (sc.clientHeight - 8) / dims.h));
    setScale(s);
    requestAnimationFrame(() => sc.scrollTo({ left: 0, top: 0 }));
  }

  // Fit to the screen the first time we know the size.
  useEffect(() => {
    if (didInit.current || !dims.w) return;
    didInit.current = true;
    fitNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims]);

  // Re-fit whenever the viewport size changes (entering/leaving full screen).
  useEffect(() => {
    const t = setTimeout(fitNow, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  // Zoom around the centre of the current view.
  function zoomBy(factor: number) {
    const sc = scrollRef.current;
    if (!sc) return;
    const next = clampScale(scale * factor);
    if (next === scale) return;
    const ratio = next / scale;
    const cx = sc.scrollLeft + sc.clientWidth / 2;
    const cy = sc.scrollTop + sc.clientHeight / 2;
    setScale(next);
    requestAnimationFrame(() => {
      sc.scrollLeft = cx * ratio - sc.clientWidth / 2;
      sc.scrollTop = cy * ratio - sc.clientHeight / 2;
    });
  }

  // We fully own touch (touch-action: none): one finger pans by scrolling
  // the container (auto-clamped, so it can never get stuck), two fingers
  // pinch-zoom anchored on the pinch centre. Taps still fire clicks because
  // we only preventDefault once a real drag/pinch starts.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    let mode: 'none' | 'pan' | 'pinch' = 'none';
    let lastX = 0;
    let lastY = 0;
    let startDist = 0;
    let startScale = 1;
    let cx = 0;
    let cy = 0;
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const r = sc.getBoundingClientRect();
        mode = 'pinch';
        startDist = dist(e.touches);
        startScale = scaleRef.current;
        cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left + sc.scrollLeft;
        cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top + sc.scrollTop;
      } else if (e.touches.length === 1) {
        mode = 'pan';
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const r = sc.getBoundingClientRect();
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
        const next = clampScale(startScale * (dist(e.touches) / startDist));
        const ratio = next / startScale;
        setScale(next);
        requestAnimationFrame(() => {
          sc.scrollLeft = cx * ratio - mx;
          sc.scrollTop = cy * ratio - my;
        });
      } else if (mode === 'pan' && e.touches.length === 1) {
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        const dx = x - lastX;
        const dy = y - lastY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          e.preventDefault();
          sc.scrollLeft -= dx;
          sc.scrollTop -= dy;
          lastX = x;
          lastY = y;
        }
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) mode = 'none';
      else if (e.touches.length === 1) {
        mode = 'pan';
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    };
    sc.addEventListener('touchstart', onStart, { passive: false });
    sc.addEventListener('touchmove', onMove, { passive: false });
    sc.addEventListener('touchend', onEnd);
    sc.addEventListener('touchcancel', onEnd);
    return () => {
      sc.removeEventListener('touchstart', onStart);
      sc.removeEventListener('touchmove', onMove);
      sc.removeEventListener('touchend', onEnd);
      sc.removeEventListener('touchcancel', onEnd);
    };
  }, [fullscreen]);

  function Node({ id }: { id: number }) {
    const m = resolved.get(id);
    if (!m) return null;
    const feeders = feedersOf(id);
    if (!feeders) {
      return <Tie m={m} teamsByCode={teamsByCode} onPick={onPick} />;
    }
    return (
      <div className="flex items-center">
        <div className="flex flex-col justify-center gap-3">
          <Node id={feeders[0]} />
          <Node id={feeders[1]} />
        </div>
        <Connector />
        <Tie m={m} teamsByCode={teamsByCode} onPick={onPick} />
      </div>
    );
  }

  const champCode = resolved.get(ROOT_ID)?.winner ?? null;
  const champ = champCode ? teamsByCode.get(champCode) : undefined;

  const roundBtn =
    'flex h-9 w-9 items-center justify-center rounded-full text-foreground active:scale-90 disabled:opacity-30';
  const textBtn =
    'flex h-9 items-center gap-1 rounded-full px-3 text-xs font-bold text-foreground active:scale-90';

  const controls = (showFs: boolean) => (
    <div className="flex items-center gap-1 rounded-full border border-edge bg-surface-raised p-1">
      <button type="button" onClick={() => zoomBy(1 / 1.3)} className={roundBtn} aria-label="Zoom out">
        <Minus className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <button type="button" onClick={fitNow} className={textBtn}>
        <Scan className="h-4 w-4" strokeWidth={2.2} /> Fit
      </button>
      <button type="button" onClick={() => zoomBy(1.3)} className={roundBtn} aria-label="Zoom in">
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
      {showFs ? (
        <button type="button" onClick={() => setFullscreen(true)} className={textBtn}>
          <Maximize2 className="h-4 w-4" strokeWidth={2.2} /> Full
        </button>
      ) : null}
    </div>
  );

  // Rendered in exactly one place: inline, or in the full-screen portal.
  const scrollEl = (
    <div
      ref={scrollRef}
      className={
        fullscreen
          ? 'absolute inset-0 overflow-auto bg-black/10'
          : 'h-[54vh] overflow-auto rounded-xl border border-edge/60 bg-black/10'
      }
      style={{ touchAction: 'none' }}
    >
      {/* Sized to the scaled content (plus inline bottom clearance for the
          fixed save bar) so it scrolls natively. */}
      <div style={{ width: dims.w * scale, height: dims.h * scale + (fullscreen ? 0 : 120) }}>
        <div
          ref={contentRef}
          className="flex w-max items-center p-3"
          style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}
        >
          <Node id={ROOT_ID} />
          <Connector />
          <div
            className={`flex w-40 shrink-0 flex-col items-center gap-1 rounded-lg border p-3 text-center ${
              champ ? 'border-gold/50 bg-gold/[0.08] ring-1' : 'border-edge bg-surface'
            }`}
          >
            <Trophy className={`h-6 w-6 ${champ ? 'text-gold' : 'text-muted-2'}`} strokeWidth={2} />
            {champ ? (
              <>
                <span className="text-2xl leading-none">{champ.flag}</span>
                <span className="text-sm font-bold leading-tight">{champ.name}</span>
                <span className="text-[0.55rem] font-bold uppercase tracking-wider text-gold">
                  Champion
                </span>
              </>
            ) : (
              <span className="text-[0.65rem] font-medium leading-tight text-muted-2">Champion</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[0.7rem] text-muted-2">Swipe or pinch · tap a team to pick</p>
        {!fullscreen ? controls(true) : null}
      </div>
      {!fullscreen ? (
        scrollEl
      ) : (
        <div className="flex h-[54vh] items-center justify-center rounded-xl border border-edge/60 bg-black/10 text-sm text-muted">
          Open in full screen
        </div>
      )}
      {fullscreen
        ? createPortal(
            <div className="fixed inset-0 z-[100] flex flex-col bg-bg">
              <div className="flex items-center justify-between gap-2 border-b border-edge px-3 py-2.5">
                {controls(false)}
                <button
                  type="button"
                  onClick={() => setFullscreen(false)}
                  className="flex items-center gap-1 rounded-xl border border-edge bg-surface px-3 py-1.5 text-sm font-bold active:scale-95"
                >
                  <X className="h-4 w-4" /> Done
                </button>
              </div>
              <div className="relative flex-1">{scrollEl}</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
