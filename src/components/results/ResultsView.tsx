'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResultsData, ResultPlayer, Award } from '@/lib/results';
import Confetti from './Confetti';

const PLACE = [
  { medal: '🥇', ring: '#fbbf24', label: 'Champion', h: 'h-40' },
  { medal: '🥈', ring: '#cbd5e1', label: 'Runner-up', h: 'h-28' },
  { medal: '🥉', ring: '#d97706', label: 'Third', h: 'h-20' },
];

function PodiumColumn({ player, place, show }: { player: ResultPlayer; place: number; show: boolean }) {
  const meta = PLACE[place];
  return (
    <div
      className="flex w-full flex-col items-center justify-end transition-all duration-700"
      style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(24px)' }}
    >
      <div className="text-4xl">{meta.medal}</div>
      <div className="mt-1 max-w-full truncate px-1 text-center font-display text-xl leading-none">{player.name}</div>
      <div className="max-w-full truncate px-1 text-center text-[0.65rem] text-muted-2">{player.bracketName}</div>
      <div className="mt-1 font-display text-2xl leading-none text-accent">{player.combined}</div>
      {player.accuracy != null ? (
        <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted">{player.accuracy}% acc</div>
      ) : null}
      <div
        className={`mt-2 flex ${meta.h} w-full items-start justify-center rounded-t-xl pt-2 font-display text-3xl`}
        style={{ backgroundColor: `${meta.ring}22`, borderTop: `3px solid ${meta.ring}` }}
      >
        <span style={{ color: meta.ring }}>{place + 1}</span>
      </div>
    </div>
  );
}

function AwardCard({ award }: { award: Award }) {
  return (
    <div className="card flex items-start gap-3 p-3">
      <div className="text-2xl leading-none">{award.emoji}</div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-lg leading-tight">{award.title}</div>
        <div className="truncate text-sm font-semibold text-foreground">{award.winnerName ?? 'Not decided'}</div>
        <div className="text-xs text-muted">{award.detail}</div>
        <div className="mt-0.5 text-[0.7rem] italic text-muted-2">{award.blurb}</div>
      </div>
    </div>
  );
}

export default function ResultsView({
  data,
  over,
  poolId,
}: {
  data: ResultsData;
  over: boolean;
  poolId: string;
}) {
  const [phase, setPhase] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setTimeout(() => setPhase(4), 0);
      return () => clearTimeout(t);
    }
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2700),
      setTimeout(() => setPhase(4), 3900),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const [first, second, third] = data.podium;
  const maxRound = useMemo(
    () => Math.max(1, ...(data.viewer?.rounds.map((r) => r.pts) ?? [1])),
    [data.viewer],
  );

  return (
    <div className="space-y-8 pb-4">
      <Confetti fire={phase >= 3} />

      {!over ? (
        <p className="rounded-xl border border-gold/40 bg-gold/[0.08] px-3 py-2 text-center text-[0.7rem] font-semibold text-gold">
          Preview, computed from the standings as they are right now. The real finale unlocks when the
          World Cup final ends.
        </p>
      ) : null}

      <header className="pt-2 text-center">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.3em] text-muted-2">Full time</p>
        <h1 className="shine font-display text-5xl leading-none">{data.poolName}</h1>
        <p className="mt-1 text-sm text-muted">The final table is in. Here is how it shook out.</p>
      </header>

      {/* Podium */}
      <section>
        <div className="mx-auto flex max-w-md items-end gap-2">
          {second ? <PodiumColumn player={second} place={1} show={phase >= 2} /> : <div className="w-full" />}
          {first ? <PodiumColumn player={first} place={0} show={phase >= 3} /> : <div className="w-full" />}
          {third ? <PodiumColumn player={third} place={2} show={phase >= 1} /> : <div className="w-full" />}
        </div>
        {phase < 4 ? (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setPhase(4)}
              className="rounded-full border border-edge bg-white/[0.03] px-4 py-1.5 text-xs font-semibold text-muted active:scale-95"
            >
              Skip to results
            </button>
          </div>
        ) : null}
      </section>

      {/* Everything after the podium reveals together. */}
      <div
        className="space-y-8 transition-opacity duration-700"
        style={{ opacity: phase >= 4 ? 1 : 0, pointerEvents: phase >= 4 ? 'auto' : 'none' }}
      >
        {/* Champion spotlight */}
        {first ? (
          <section className="card relative overflow-hidden p-5 text-center ring-1 ring-gold/40">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-gold">Pool champion</p>
            <div className="mt-1 font-display text-4xl leading-none">{first.name}</div>
            <div className="text-sm text-muted-2">{first.bracketName}</div>
            <div className="mt-3 flex items-center justify-center gap-5">
              <div>
                <div className="font-display text-3xl leading-none text-accent">{first.combined}</div>
                <div className="text-[0.6rem] uppercase tracking-wider text-muted">points</div>
              </div>
              {first.accuracy != null ? (
                <div>
                  <div className="font-display text-3xl leading-none text-accent">{first.accuracy}%</div>
                  <div className="text-[0.6rem] uppercase tracking-wider text-muted">accuracy</div>
                </div>
              ) : null}
            </div>
            {first.championPick ? (
              <p className="mt-3 text-sm text-muted">
                Backed <span className="font-semibold text-foreground">{first.championPick.flag} {first.championPick.name}</span> to lift the trophy
                {data.championTeam
                  ? first.championPick.code === data.championTeam.code
                    ? ' — and called it right.'
                    : `. The cup actually went to ${data.championTeam.flag} ${data.championTeam.name}.`
                  : '.'}
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Real World Cup champion */}
        {data.championTeam ? (
          <section className="text-center">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.25em] text-muted-2">Actual World Cup champion</p>
            <div className="mt-1 text-4xl">{data.championTeam.flag}</div>
            <div className="font-display text-2xl">{data.championTeam.name}</div>
          </section>
        ) : null}

        {/* Awards */}
        {data.awards.length ? (
          <section>
            <h2 className="mb-3 text-center font-display text-2xl">Superlatives</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.awards.map((a) => (
                <AwardCard key={a.key} award={a} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Personal recap */}
        {data.viewer ? (
          <section className="card space-y-3 p-4">
            <h2 className="text-center font-display text-2xl">Your tournament</h2>
            <div className="flex items-center justify-around text-center">
              <div>
                <div className="font-display text-3xl leading-none">{ordinal(data.viewer.player.rank)}</div>
                <div className="text-[0.6rem] uppercase tracking-wider text-muted">of {data.standings.length}</div>
              </div>
              <div>
                <div className="font-display text-3xl leading-none text-accent">{data.viewer.player.combined}</div>
                <div className="text-[0.6rem] uppercase tracking-wider text-muted">points</div>
              </div>
              {data.viewer.player.accuracy != null ? (
                <div>
                  <div className="font-display text-3xl leading-none text-accent">{data.viewer.player.accuracy}%</div>
                  <div className="text-[0.6rem] uppercase tracking-wider text-muted">accuracy</div>
                </div>
              ) : null}
            </div>

            {data.viewer.bestPick ? (
              <div className="rounded-xl border border-edge bg-white/[0.02] p-3 text-center">
                <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-2">Your best call</div>
                <div className="mt-0.5 text-sm font-semibold">{data.viewer.bestPick.label}</div>
                <div className="text-xs text-accent">+{data.viewer.bestPick.pts}</div>
              </div>
            ) : null}

            {data.viewer.rounds.length ? (
              <div className="space-y-1.5">
                {data.viewer.rounds.map((r) => (
                  <div key={r.label} className="flex items-center gap-2 text-xs">
                    <span className="w-24 shrink-0 text-muted">{r.label}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${Math.round((r.pts / maxRound) * 100)}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right font-semibold">{r.pts}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {data.viewer.badges.length ? (
              <div className="flex flex-wrap justify-center gap-1.5">
                {data.viewer.badges.map((b) => (
                  <span
                    key={b.title}
                    title={b.desc}
                    className="rounded-full border border-accent/40 bg-accent/[0.08] px-2.5 py-1 text-[0.7rem] font-semibold text-accent"
                  >
                    {b.title}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Full standings */}
        <section>
          <button
            type="button"
            onClick={() => setShowAll((s) => !s)}
            className="mx-auto block rounded-full border border-edge bg-white/[0.03] px-4 py-1.5 text-xs font-semibold text-muted active:scale-95"
          >
            {showAll ? 'Hide' : 'Show'} the full table
          </button>
          {showAll ? (
            <ol className="mt-3 space-y-1">
              {data.standings.map((r) => (
                <li
                  key={r.ownerId}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                    r.ownerId === data.viewer?.player.ownerId ? 'border-accent/50 bg-accent/[0.05]' : 'border-edge bg-white/[0.02]'
                  }`}
                >
                  <span className="w-6 shrink-0 font-display text-lg text-muted">{r.rank}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    <span className="block truncate text-[0.7rem] text-muted-2">{r.bracketName}</span>
                  </span>
                  <span className="shrink-0 font-display text-lg text-accent">{r.combined}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </section>

        {/* Share */}
        <section className="text-center">
          <a
            href={`/results/card?pool=${poolId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-accent underline"
          >
            Open a shareable card
          </a>
        </section>
      </div>
    </div>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
