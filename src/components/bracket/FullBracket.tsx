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
import { Trophy, ChevronRight, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react';

interface Props {
  predictions: Predictions;
  teamsByCode: Map<string, Team>;
  onPick?: (fills: FillKey, winner: string, loser: string | null) => void;
  // Pre-resolved ties to render instead of deriving from `predictions` (used by
  // the live "actual results" bracket). Read-only: onPick is ignored when set.
  resolved?: Map<number, ResolvedMatchup>;
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

const MIN_SCALE = 0.25;
const MAX_SCALE = 1.6;
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
const DRAG_THRESHOLD = 8;

interface View {
  s: number;
  x: number;
  y: number;
}

export default function FullBracket({ predictions, teamsByCode, onPick, resolved: resolvedProp }: Props) {
  const resolved = resolvedProp ?? resolveById(predictions);
  const interactive = !resolvedProp ? onPick : undefined;

  const [fs, setFs] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Pan/zoom state is only used inside the fullscreen overlay.
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const dimsRef = useRef({ w: 0, h: 0 });

  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const startPt = useRef<{ x: number; y: number } | null>(null);
  const panId = useRef<number | null>(null);
  const lastPan = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);

  // Lock the page behind the overlay so only the bracket moves.
  useEffect(() => {
    if (!fs) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fs]);

  // Measure and fit-to-width once the overlay's content is on screen.
  useEffect(() => {
    if (!fs) return;
    const el = contentRef.current;
    const vp = viewportRef.current;
    if (!el || !vp) return;
    const w = el.scrollWidth;
    const h = el.scrollHeight;
    dimsRef.current = { w, h };
    const s = clampScale(Math.min(1, vp.clientWidth / w));
    setView(clamp({ s, x: 0, y: 0 }));
  }, [fs, predictions]);

  // Keep the tree pinned inside the viewport: centre on an axis when smaller
  // than the viewport, otherwise block dragging past the edge.
  function clamp(v: View): View {
    const vp = viewportRef.current;
    const d = dimsRef.current;
    if (!vp || !d.w) return v;
    const m = 16;
    const cw = d.w * v.s;
    const ch = d.h * v.s;
    let { x, y } = v;
    if (cw + 2 * m <= vp.clientWidth) x = (vp.clientWidth - cw) / 2;
    else x = Math.min(m, Math.max(vp.clientWidth - cw - m, x));
    if (ch + 2 * m <= vp.clientHeight) y = (vp.clientHeight - ch) / 2;
    else y = Math.min(m, Math.max(vp.clientHeight - ch - m, y));
    return { s: v.s, x, y };
  }

  function vpPoint(e: React.PointerEvent): { x: number; y: number } {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function zoomAround(targetScale: number, cx: number, cy: number) {
    setView((p) => {
      const s = clampScale(targetScale);
      const k = s / p.s;
      return clamp({ s, x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k });
    });
  }

  function zoomByCenter(factor: number) {
    const vp = viewportRef.current;
    if (!vp) return;
    zoomAround(view.s * factor, vp.clientWidth / 2, vp.clientHeight / 2);
  }

  function fit() {
    const vp = viewportRef.current;
    const d = dimsRef.current;
    if (!vp || !d.w) return;
    const s = clampScale(Math.min(vp.clientWidth / d.w, vp.clientHeight / d.h));
    setView(clamp({ s, x: 0, y: 0 }));
  }

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  function onPointerDown(e: React.PointerEvent) {
    const p = vpPoint(e);
    ptrs.current.set(e.pointerId, p);
    if (ptrs.current.size === 1) {
      startPt.current = p;
      lastPan.current = p;
      panId.current = null;
    } else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { dist: dist(a, b), mid: mid(a, b) };
      panId.current = null;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!ptrs.current.has(e.pointerId)) return;
    const p = vpPoint(e);
    ptrs.current.set(e.pointerId, p);

    if (ptrs.current.size >= 2 && pinch.current) {
      const [a, b] = [...ptrs.current.values()];
      const nd = dist(a, b);
      const nm = mid(a, b);
      const k = nd / (pinch.current.dist || nd);
      const m0 = pinch.current.mid;
      setView((prev) => {
        const s = clampScale(prev.s * k);
        const ratio = s / prev.s;
        return clamp({ s, x: nm.x - (m0.x - prev.x) * ratio, y: nm.y - (m0.y - prev.y) * ratio });
      });
      pinch.current = { dist: nd, mid: nm };
      return;
    }

    if (ptrs.current.size === 1) {
      if (panId.current === null) {
        if (startPt.current && dist(p, startPt.current) > DRAG_THRESHOLD) {
          panId.current = e.pointerId;
          lastPan.current = p;
          try {
            viewportRef.current?.setPointerCapture(e.pointerId);
          } catch {}
        } else {
          return;
        }
      }
      if (panId.current === e.pointerId && lastPan.current) {
        const dx = p.x - lastPan.current.x;
        const dy = p.y - lastPan.current.y;
        lastPan.current = p;
        setView((prev) => clamp({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    ptrs.current.delete(e.pointerId);
    if (panId.current === e.pointerId) {
      try {
        viewportRef.current?.releasePointerCapture(e.pointerId);
      } catch {}
      panId.current = null;
    }
    pinch.current = null;
    const remaining = [...ptrs.current.values()];
    if (remaining.length === 1) {
      startPt.current = remaining[0];
      lastPan.current = remaining[0];
      panId.current = null;
    }
  }

  // Renders a tie with its feeder subtrees to the left, connected.
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
        <Tie m={m} teamsByCode={teamsByCode} onPick={interactive} />
      </div>
    );
  }

  const champCode = resolved.get(ROOT_ID)?.winner ?? null;
  const champ = champCode ? teamsByCode.get(champCode) : undefined;

  const champBox = (
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
          <span className="text-[0.55rem] font-bold uppercase tracking-wider text-gold">Champion</span>
        </>
      ) : (
        <span className="text-[0.65rem] font-medium leading-tight text-muted-2">Champion</span>
      )}
    </div>
  );

  const zoomBtn =
    'flex h-9 w-9 items-center justify-center rounded-lg border border-edge bg-white/[0.03] text-muted active:scale-90';

  return (
    <div>
      {/* Inline: the tree scrolls horizontally on its own, the page scrolls
          vertically, and tapping a team still picks a winner. */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[0.65rem] text-muted-2">Swipe sideways to follow it</span>
        <button
          type="button"
          onClick={() => setFs(true)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 text-xs font-bold text-accent active:scale-95"
        >
          <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.4} />
          Fullscreen
        </button>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex w-max items-center py-1">
          <Node id={ROOT_ID} />
          <Connector />
          {champBox}
        </div>
      </div>

      {/* Fullscreen: an immersive pinch/zoom/drag canvas. */}
      {fs && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[90] flex flex-col bg-bg">
              <div className="flex items-center justify-between gap-1.5 px-3 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
                <span className="text-[0.65rem] text-muted-2">Pinch to zoom · drag to move</span>
                <div className="flex items-center gap-1.5">
                  <button type="button" aria-label="Zoom out" onClick={() => zoomByCenter(1 / 1.25)} className={zoomBtn}>
                    <ZoomOut className="h-4 w-4" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={fit}
                    className="flex h-9 items-center gap-1 rounded-lg border border-edge bg-white/[0.03] px-2.5 text-xs font-semibold text-muted active:scale-90"
                  >
                    <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                    Fit
                  </button>
                  <button type="button" aria-label="Zoom in" onClick={() => zoomByCenter(1.25)} className={zoomBtn}>
                    <ZoomIn className="h-4 w-4" strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFs(false)}
                    className="flex h-9 items-center gap-1 rounded-lg bg-accent px-3 text-xs font-bold text-[var(--accent-ink)] active:scale-90"
                  >
                    <X className="h-4 w-4" strokeWidth={2.4} />
                    Exit
                  </button>
                </div>
              </div>

              <div
                ref={viewportRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="relative flex-1 touch-none select-none overflow-hidden"
              >
                <div
                  ref={contentRef}
                  data-fullbracket
                  className="flex w-max items-center p-3"
                  style={{
                    transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`,
                    transformOrigin: '0 0',
                  }}
                >
                  <Node id={ROOT_ID} />
                  <Connector />
                  {champBox}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
