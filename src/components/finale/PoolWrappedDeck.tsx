'use client';

import Link from 'next/link';
import type { PoolWrapped } from '@/lib/wrapped';
import type { VotesData } from '@/lib/votes';
import type { Award } from '@/lib/results';
import { actualChampionBias, exitBias, poolChampionBias } from '@/lib/bias';
import StoryDeck, { type Slide } from './StoryDeck';
import { Avatar, Bar, BiasNote, BigStat, CountUp, FlagDisc, Kicker, Layered, Marquee, MaskLines } from './kit';

// Matches the personal deck: one wash per slide so the pool story has the same
// visual variety.
const BG = {
  emerald: 'radial-gradient(120% 80% at 50% 8%, rgba(30,230,164,0.30), transparent 60%), linear-gradient(180deg,#04120e,#04070e 70%)',
  gold: 'radial-gradient(120% 80% at 50% 10%, rgba(255,200,80,0.30), transparent 60%), linear-gradient(180deg,#170f02,#04070e 70%)',
  indigo: 'radial-gradient(120% 80% at 50% 5%, rgba(99,132,255,0.28), transparent 62%), linear-gradient(180deg,#080d20,#04070e 70%)',
  crimson: 'radial-gradient(120% 80% at 50% 10%, rgba(255,93,115,0.32), transparent 60%), linear-gradient(180deg,#1a060c,#04070e 70%)',
  violet: 'radial-gradient(120% 80% at 50% 8%, rgba(168,110,255,0.28), transparent 62%), linear-gradient(180deg,#120a20,#04070e 70%)',
  magenta: 'radial-gradient(120% 80% at 50% 8%, rgba(255,110,190,0.26), transparent 62%), linear-gradient(180deg,#180a16,#04070e 70%)',
  teal: 'radial-gradient(120% 80% at 50% 8%, rgba(60,200,220,0.26), transparent 62%), linear-gradient(180deg,#04161c,#04070e 70%)',
  night: 'radial-gradient(130% 90% at 50% 0%, rgba(255,200,80,0.16), transparent 55%), radial-gradient(90% 60% at 50% 108%, rgba(30,230,164,0.16), transparent 60%), linear-gradient(180deg,#0a0f1c,#03060c 70%)',
};

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export default function PoolWrappedDeck({
  data,
  awards,
  votes,
}: {
  data: PoolWrapped;
  awards: Award[];
  votes: VotesData;
}) {
  const d = data;
  const slides: Slide[] = [];
  const push = (key: string, node: React.ReactNode, ms?: number, bg?: string) =>
    slides.push({ key, node, ms, bg });

  // 1. Cold open
  push(
    'open',
    <Layered
      layers={
        <>
          <Marquee text="FULL TIME" className="top-4 -rotate-3" tone="rgba(255,255,255,0.05)" />
          <Marquee text={d.poolName.toUpperCase()} className="bottom-2 rotate-2" tone="rgba(255,200,80,0.07)" />
        </>
      }
    >
      <MaskLines
        className="font-display text-[2.4rem] leading-[0.95] text-white/70"
        lines={['One tournament.', `${d.fieldSize} of you.`, 'One table.']}
      />
      <MaskLines className="mt-6 finale-hero metal-gold" lines={[d.poolName]} delay={620} />
      <p className="anim-in mt-6 text-sm text-white/55" style={{ animationDelay: '1200ms' }}>
        This is what the group did to itself over a month.
      </p>
    </Layered>,
    7000,
    BG.night,
  );

  // 2. The field
  push(
    'field',
    <div>
      <Kicker>The damage, in total</Kicker>
      <div className="mt-6 space-y-5 text-center">
        <div>
          <div className="anim-count finale-hero text-accent" style={{ animationDelay: '150ms' }}>
            <CountUp to={d.totals.points} />
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-white/45">points scored between you</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="anim-in rounded-xl border border-white/12 bg-white/[0.04] p-3" style={{ animationDelay: '600ms' }}>
            <div className="font-display text-3xl leading-none text-gold">
              <CountUp to={d.totals.messages} delay={700} />
            </div>
            <div className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-white/45">messages sent</div>
          </div>
          <div className="anim-in rounded-xl border border-white/12 bg-white/[0.04] p-3" style={{ animationDelay: '750ms' }}>
            <div className="font-display text-3xl leading-none text-accent">
              <CountUp to={d.totals.predictions} delay={850} />
            </div>
            <div className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-white/45">scorelines called</div>
          </div>
        </div>
      </div>
    </div>,
    8000,
    BG.emerald,
  );

  // 3. Who the pool crowned
  if (d.championPicks.length) {
    const top = d.championPicks[0];
    const max = top.count;
    push(
      'crowns',
      <div>
        <Kicker tone="gold">Who you all crowned</Kicker>
        <h2 className="mt-2 font-display text-3xl leading-none">The champion vote</h2>
        <div className="mt-5 space-y-1.5">
          {d.championPicks.slice(0, 6).map((c, i) => (
            <Bar
              key={c.team.code}
              label={`${c.team.flag} ${c.team.name}`}
              right={`${c.count}`}
              pct={(c.count / max) * 100}
              tone={c.correct ? 'gold' : 'accent'}
              highlight={c.correct}
              delay={300 + i * 110}
            />
          ))}
        </div>
        <p className="anim-in mt-4 text-center text-sm leading-relaxed text-white/70" style={{ animationDelay: '1100ms' }}>
          {d.championTeam ? (
            d.championPicks.some((c) => c.correct) ? (
              <>
                {d.championPicks.find((c) => c.correct)?.count} of you had {d.championTeam.flag}{' '}
                {d.championTeam.name}. Everyone else was simply wrong.
              </>
            ) : (
              <>
                Not one of you picked {d.championTeam.flag} {d.championTeam.name}. A perfect, collective miss.
              </>
            )
          ) : (
            <>The votes are in. The trophy is not.</>
          )}
        </p>
        <BiasNote>{poolChampionBias(top.team.code, top.count)}</BiasNote>
      </div>,
      9500,
      BG.gold,
    );
  }

  // 4. The team the pool believed in
  if (d.believedIn) {
    push(
      'believed',
      <div className="text-center">
        <Kicker>The team you all believed in</Kicker>
        <div className="mt-4">
          <FlagDisc flag={d.believedIn.team.flag} />
        </div>
        <h2 className="mt-4 font-display text-4xl leading-none">{d.believedIn.team.name}</h2>
        <p className="anim-in mt-3 text-sm leading-relaxed text-white/70" style={{ animationDelay: '500ms' }}>
          <span className="font-bold text-white">{d.believedIn.count} of {d.fieldSize}</span> brackets had them
          going deep. They {d.believedIn.champion ? 'won the whole thing' : `went out at ${d.believedIn.exitLabel}`}.
        </p>
        <BiasNote>{exitBias(d.believedIn.team.code, d.believedIn.exitLabel, d.believedIn.champion)}</BiasNote>
      </div>,
      8000,
      BG.emerald,
    );
  }

  // 5. Nobody saw it coming
  if (d.nobodySaw) {
    push(
      'nobody',
      <div className="text-center">
        <Kicker tone="live">Nobody saw it coming</Kicker>
        <div className="mt-4">
          <FlagDisc flag={d.nobodySaw.team.flag} />
        </div>
        <h2 className="mt-4 font-display text-4xl leading-none">{d.nobodySaw.team.name}</h2>
        <p className="anim-in mt-3 text-sm leading-relaxed text-white/70" style={{ animationDelay: '500ms' }}>
          {d.nobodySaw.count === 0 ? (
            <>
              Reached {d.nobodySaw.exitLabel} with <span className="font-bold text-live">zero</span> brackets
              backing them. Not one person in {d.poolName} believed.
            </>
          ) : (
            <>
              Reached {d.nobodySaw.exitLabel} with only{' '}
              <span className="font-bold text-live">{d.nobodySaw.count}</span>{' '}
              {d.nobodySaw.count === 1 ? 'bracket' : 'brackets'} backing them.
            </>
          )}
        </p>
      </div>,
      7500,
      BG.crimson,
    );
  }

  // 6. Consensus, wrong
  if (d.consensusWrong) {
    push(
      'consensus',
      <div className="text-center">
        <Kicker tone="live">Agreed on, and wrong</Kicker>
        <div className="mt-5 text-7xl">{d.consensusWrong.team.flag}</div>
        <h2 className="mt-3 font-display text-4xl leading-none">{d.consensusWrong.team.name}</h2>
        <p className="anim-in mt-3 text-sm leading-relaxed text-white/70" style={{ animationDelay: '500ms' }}>
          <span className="font-bold text-white">{d.consensusWrong.count}</span> of you sent them to{' '}
          {d.consensusWrong.promised}. They got as far as {d.consensusWrong.exitLabel}. When this group
          agrees on something, be worried.
        </p>
      </div>,
      8000,
      BG.crimson,
    );
  }

  // 7. The biggest shakeup
  if (d.biggestSwing && d.biggestSwing.movement > 0) {
    push(
      'swing',
      <div>
        <Kicker tone="gold">The big shakeup</Kicker>
        <h2 className="mt-2 font-display text-3xl leading-tight">{d.biggestSwing.label}</h2>
        <div className="mt-5">
          <BigStat
            value={d.biggestSwing.movement}
            tone="gold"
            label={<>places changed hands in a single round. Nothing else came close.</>}
          />
        </div>
        {d.biggestSwing.risers.length ? (
          <div className="mt-6 space-y-2">
            {d.biggestSwing.risers.map((r, i) => (
              <div
                key={r.name}
                className="anim-in flex items-center gap-3 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2"
                style={{ animationDelay: `${800 + i * 140}ms` }}
              >
                <Avatar name={r.name} size="sm" />
                <span className="flex-1 truncate text-sm font-semibold">{r.name}</span>
                <span className="text-sm font-bold text-accent">up {r.spots}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>,
      9000,
      BG.indigo,
    );
  }

  // 8. Who held first
  if (d.reign.holders.length) {
    push(
      'reign',
      <div>
        <Kicker>Life at the top</Kicker>
        <div className="mt-4">
          <BigStat
            value={d.reign.changes}
            tone="white"
            label={
              d.reign.changes === 0
                ? 'lead changes. Somebody took first place and simply never gave it back.'
                : <>times first place changed hands.</>
            }
          />
        </div>
        <div className="mt-7 flex flex-wrap justify-center gap-1.5">
          {d.reign.holders.map((h, i) => (
            <span
              key={`${h.label}-${h.name}`}
              className="anim-stamp rounded-full border border-gold/35 bg-gold/[0.1] px-2.5 py-1 text-[0.7rem] font-bold text-gold"
              style={{ animationDelay: `${600 + i * 110}ms` }}
            >
              {h.label}: {h.name}
            </span>
          ))}
        </div>
        {d.reign.longest ? (
          <p className="anim-in mt-5 text-center text-sm text-white/65" style={{ animationDelay: '1400ms' }}>
            <span className="font-bold text-white">{d.reign.longest.name}</span> led at{' '}
            {d.reign.longest.spells} of the {d.reign.holders.length} checkpoints, more than anyone.
          </p>
        ) : null}
      </div>,
      9500,
      BG.gold,
    );
  }

  // 9. Loudest voices
  if (d.chat && d.chat.leaders.length) {
    const max = d.chat.leaders[0].count;
    push(
      'chat',
      <div>
        <Kicker tone="gold">Loudest voices</Kicker>
        <h2 className="mt-2 font-display text-3xl leading-none">{d.chat.total} messages</h2>
        <div className="mt-5 space-y-1.5">
          {d.chat.leaders.map((l, i) => (
            <Bar
              key={l.name}
              label={l.name}
              right={`${l.count}`}
              pct={(l.count / max) * 100}
              tone="gold"
              delay={300 + i * 110}
              highlight={i === 0}
            />
          ))}
        </div>
        {d.chat.busiestDay ? (
          <p className="anim-in mt-4 text-center text-xs text-white/45" style={{ animationDelay: '1000ms' }}>
            Peak noise: {dayLabel(d.chat.busiestDay.day)}, {d.chat.busiestDay.count} messages in one day.
          </p>
        ) : null}
        {d.chat.longest ? (
          <p
            className="anim-in mt-4 rounded-xl border border-white/12 bg-white/[0.04] p-3 text-sm italic text-white/70"
            style={{ animationDelay: '1200ms' }}
          >
            &ldquo;{d.chat.longest.body.slice(0, 160)}
            {d.chat.longest.body.length > 160 ? '...' : ''}&rdquo;
            <span className="mt-1 block text-right text-[0.7rem] not-italic text-white/40">
              {d.chat.longest.name}, longest message of the tournament
            </span>
          </p>
        ) : null}
      </div>,
      10000,
      BG.magenta,
    );
  }

  // 10. Prediction wall
  if (d.predictionWall && d.predictionWall.total > 0) {
    const p = d.predictionWall;
    push(
      'wall',
      <div>
        <Kicker>The prediction wall</Kicker>
        <div className="mt-4">
          <BigStat
            value={p.exact}
            label={
              <>
                exact scorelines called out of {p.total} attempts across the whole group.
              </>
            }
          />
        </div>
        <div className="mt-6 space-y-3">
          {p.easiest ? (
            <div className="anim-in rounded-xl border border-accent/30 bg-accent/[0.08] p-3 text-center" style={{ animationDelay: '700ms' }}>
              <div className="text-[0.6rem] font-bold uppercase tracking-wider text-accent">Everyone saw this one</div>
              <div className="mt-1 text-sm font-semibold">{p.easiest.label}</div>
              <div className="text-xs text-white/50">
                {p.easiest.hits} of {p.easiest.of} predictions nailed it
              </div>
            </div>
          ) : null}
          {p.hardest ? (
            <div className="anim-in rounded-xl border border-live/30 bg-live/[0.08] p-3 text-center" style={{ animationDelay: '900ms' }}>
              <div className="text-[0.6rem] font-bold uppercase tracking-wider text-live">Nobody saw this one</div>
              <div className="mt-1 text-sm font-semibold">{p.hardest.label}</div>
              <div className="text-xs text-white/50">{p.hardest.attempts} tried, none correct</div>
            </div>
          ) : null}
        </div>
      </div>,
      9500,
      BG.violet,
    );
  }

  // 11. The data awards
  if (awards.length) {
    push(
      'awards',
      <div>
        <Kicker tone="gold">The data awards</Kicker>
        <h2 className="mt-2 font-display text-3xl leading-none">Earned, not voted</h2>
        <div className="mt-5 space-y-2">
          {awards.slice(0, 5).map((a, i) => (
            <div
              key={a.key}
              className="anim-stamp flex items-start gap-3 rounded-xl border border-white/12 bg-white/[0.04] p-3"
              style={{ animationDelay: `${240 + i * 160}ms` }}
            >
              <span className="text-2xl leading-none">{a.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg leading-tight text-gold">{a.title}</span>
                <span className="block truncate text-sm font-bold">{a.winnerName ?? 'Not decided'}</span>
                <span className="block text-xs text-white/50">{a.detail}</span>
              </span>
            </div>
          ))}
        </div>
      </div>,
      Math.min(12000, 5000 + awards.length * 800),
      BG.gold,
    );
  }

  // 12. The people's awards
  const decided = votes.categories.filter((c) => c.total > 0);
  push(
    'peoples',
    <div>
      <Kicker tone="gold">The people&apos;s awards</Kicker>
      <h2 className="mt-2 font-display text-3xl leading-none">Voted by the group</h2>
      {decided.length ? (
        <div className="mt-5 space-y-2">
          {decided.slice(0, 5).map((c, i) => (
            <div
              key={c.category.key}
              className="anim-stamp flex items-center gap-3 rounded-xl border border-white/12 bg-white/[0.04] p-3"
              style={{ animationDelay: `${240 + i * 150}ms` }}
            >
              <span className="text-2xl leading-none">{c.category.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg leading-tight">{c.category.title}</span>
                <span className="block truncate text-sm font-bold text-gold">
                  {c.tied ? 'Too close to call' : c.leader?.name}
                </span>
              </span>
              <span className="shrink-0 text-xs font-bold text-white/45">
                {c.total} {c.total === 1 ? 'vote' : 'votes'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="anim-in mt-5 text-sm leading-relaxed text-white/60" style={{ animationDelay: '400ms' }}>
          Nobody has voted yet. There are {votes.categories.length} categories sitting there, completely
          empty, waiting for someone to start an argument.
        </p>
      )}
      <Link
        href={`/results/vote?pool=${d.poolId}`}
        className="anim-in mt-6 block w-full rounded-2xl bg-white py-3 text-center text-sm font-bold text-black active:scale-95"
        style={{ animationDelay: '1000ms' }}
      >
        {votes.myVoteCount > 0
          ? `Your votes (${votes.myVoteCount}/${votes.categories.length})`
          : 'Cast your votes'}
      </Link>
    </div>,
    11000,
    BG.teal,
  );

  // 13. The actual champion
  if (d.championTeam) {
    push(
      'realchamp',
      <div className="text-center">
        <Kicker tone="muted">World champions</Kicker>
        <div className="mt-5">
          <FlagDisc flag={d.championTeam.flag} />
        </div>
        <h2 className="mt-4 finale-hero metal-gold" style={{ fontSize: 'clamp(2.4rem, 13vw, 4.6rem)' }}>
          {d.championTeam.name}
        </h2>
        <BiasNote>{actualChampionBias(d.championTeam.code)}</BiasNote>
      </div>,
      7000,
      BG.night,
    );
  }

  // 14. Outro
  push(
    'outro',
    <div className="text-center">
      <div className="anim-trophy text-6xl">🏆</div>
      <h2 className="mt-4 font-display text-4xl leading-none">{d.poolName}, that is a wrap</h2>
      <p className="anim-in mt-3 text-sm leading-relaxed text-white/60" style={{ animationDelay: '400ms' }}>
        {d.standings[0]?.name ?? 'Someone'} won it. The rest of you have four years to think about what
        happened here.
      </p>
      <div className="mt-7 space-y-2">
        <Link
          href={`/results/podium?pool=${d.poolId}`}
          className="block w-full rounded-2xl bg-white py-3 text-sm font-bold text-black active:scale-95"
        >
          See the podium
        </Link>
        <a
          href={`/results/card?pool=${d.poolId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-2xl border border-white/20 bg-white/[0.06] py-3 text-sm font-bold text-white active:scale-95"
        >
          Share the final table
        </a>
      </div>
    </div>,
    20000,
    BG.night,
  );

  return <StoryDeck slides={slides} exitHref={`/results?pool=${d.poolId}`} />;
}
