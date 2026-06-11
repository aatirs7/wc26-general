'use client';

import type { Team } from '@/types/team';
import { fifaRank } from '@/lib/fifa-rank';

type Rank = 1 | 2 | 3 | 4;

interface Props {
  team: Team;
  rank?: Rank; // group finishing position -> medal
  badge?: string; // generic right-side badge (knockout "IN", champion, etc)
  selected?: boolean;
  disabled?: boolean;
  onTap?: () => void;
}

const RANK_LABEL: Record<Rank, string> = { 1: '1', 2: '2', 3: '3', 4: '4' };

export default function TeamChip({ team, rank, badge, selected, disabled, onTap }: Props) {
  const active = selected || !!rank || !!badge;
  const fr = fifaRank(team.code);
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={`group flex min-h-13 w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-all duration-150 active:scale-[0.99] ${
        active
          ? 'border-accent/50 bg-accent/[0.07]'
          : 'border-edge bg-white/[0.02] hover:border-edge-strong'
      } ${disabled ? 'opacity-35' : ''} ${rank ? `podium-${rank}` : ''}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/30 text-xl">
        {team.flag}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.95rem] font-semibold leading-tight">
          {team.name}
        </span>
        <span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">
          {team.code}
          {fr ? <span className="ml-1.5 normal-case tracking-normal text-muted-2">FIFA #{fr}</span> : null}
        </span>
      </span>
      {rank ? (
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold medal-${rank}`}
        >
          {RANK_LABEL[rank]}
        </span>
      ) : badge ? (
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-[var(--accent-ink)]">
          {badge}
        </span>
      ) : (
        <span className="h-7 w-7 shrink-0 rounded-full border border-edge" />
      )}
    </button>
  );
}
