'use client';

import Link from 'next/link';
import type { PersonalRecap } from '@/lib/recap';
import { betrayalBias, championBias, rideBias } from '@/lib/bias';
import StoryDeck, { type Slide } from './StoryDeck';
import RankLine from './RankLine';
import { personalShareCards } from '@/lib/share-slides';
import ShareCardButton from './ShareCardButton';
import {
  Avatar,
  Bar,
  BiasNote,
  BigStat,
  CountUp,
  FlagDisc,
  Ghost,
  Halo,
  Kicker,
  Layered,
  Marquee,
  MaskLines,
  Ring,
  StampCard,
  Tilt,
  ordinal,
} from './kit';

// Each slide gets its own wash so the deck never feels like one long page.
// The values live in globals.css so both themes get their own palette.
const BG = {
  night: 'var(--f-bg-night)',
  emerald: 'var(--f-bg-emerald)',
  gold: 'var(--f-bg-gold)',
  indigo: 'var(--f-bg-indigo)',
  crimson: 'var(--f-bg-crimson)',
  violet: 'var(--f-bg-violet)',
  slate: 'var(--f-bg-slate)',
  magenta: 'var(--f-bg-magenta)',
  teal: 'var(--f-bg-teal)',
};

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

export default function RecapDeck({ data }: { data: PersonalRecap }) {
  const d = data;
  const slides: Slide[] = [];
  // Per-slide export cards. Attaching them here keeps every slide's markup
  // exactly as it was; the deck just gains a share control in its header.
  const shareCards = personalShareCards(d);
  const push = (key: string, node: React.ReactNode, ms?: number, bg?: string) => {
    const card = shareCards[key];
    slides.push({
      key,
      node,
      ms,
      bg,
      share: card
        ? {
            url: `/results/card/slide?pool=${d.poolId}&deck=me&slide=${key}`,
            filename: `recap-${key}.png`,
            title: `${d.name}, World Cup 2026`,
            text: card.text,
          }
        : undefined,
    });
  };

  // 1. Cold open
  push(
    'open',
    <Layered
      layers={
        <>
          <Marquee text="FULL TIME" className="top-4 -rotate-3" tone="var(--f-ghost)" />
          <Marquee text="WORLD CUP 2026" className="bottom-2 rotate-2" tone="var(--f-ghost)" />
        </>
      }
    >
      <MaskLines
        className="font-display text-[2.5rem] leading-[0.95] text-muted"
        lines={['Twenty six days.', '104 matches.', 'One bracket.']}
      />
      <MaskLines className="mt-6 finale-hero metal-gold" lines={[d.name]} delay={620} />
      <p className="anim-in mt-6 text-sm text-muted" style={{ animationDelay: '1200ms' }}>
        Here is how your World Cup actually went.
      </p>
    </Layered>,
    7000,
    BG.night,
  );

  // 2. The number
  push(
    'total',
    <Layered layers={<Ghost>{d.me.combined}</Ghost>}>
      <Kicker>Your final total</Kicker>
      <div className="mt-4">
        <BigStat
          value={d.me.combined}
          label={
            <>
              points in <span className="font-semibold text-foreground">{d.poolName}</span>.
              <br />
              {d.beat > 0
                ? `You finished above ${d.beat} ${d.beat === 1 ? 'person' : 'people'}.`
                : 'Someone has to be at the bottom. It was you.'}
            </>
          }
        />
      </div>
      {d.rounds.length ? (
        <div className="mt-7 space-y-1.5 text-left">
          {d.rounds.map((r, i) => (
            <Bar
              key={r.label}
              label={r.label}
              right={`${r.pts}`}
              pct={(r.pts / Math.max(...d.rounds.map((x) => x.pts))) * 100}
              delay={500 + i * 90}
            />
          ))}
        </div>
      ) : null}
    </Layered>,
    8000,
    BG.emerald,
  );

  // 3. Rank journey
  if (d.journey.length >= 2) {
    const first = d.journey[0];
    const last = d.journey[d.journey.length - 1];
    push(
      'journey',
      <div>
        <Kicker tone="gold">The long way round</Kicker>
        <h2 className="mt-2 font-display text-4xl leading-none">Where you stood</h2>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-2">all tournament</p>
        <div className="mt-5">
          <RankLine journey={d.journey} fieldSize={d.fieldSize} peak={d.peak} trough={d.trough} />
        </div>
        <p className="anim-in mt-4 text-sm leading-relaxed text-muted" style={{ animationDelay: '1500ms' }}>
          {d.peak && d.peak.rank < last.rank
            ? `You were ${ordinal(d.peak.rank)} ${d.peak.label.toLowerCase()}. You are not ${ordinal(d.peak.rank)} now.`
            : d.peak && d.peak.rank === last.rank && first.rank > last.rank
              ? `You started ${ordinal(first.rank)} and climbed to ${ordinal(last.rank)}. You finished at your peak.`
              : `You held around ${ordinal(last.rank)} for most of it. Consistency is a personality.`}
        </p>
      </div>,
      9000,
      BG.indigo,
    );
  }

  // 3b. The single biggest move
  const move = (d.biggestClimb?.spots ?? 0) >= (d.biggestFall?.spots ?? 0) ? d.biggestClimb : d.biggestFall;
  const isClimb = move === d.biggestClimb;
  if (move && move.spots >= 2) {
    push(
      'move',
      <Layered layers={<Ghost opacity={0.06}>{isClimb ? '▲' : '▼'}</Ghost>}>
        <Kicker tone={isClimb ? 'accent' : 'live'}>{isClimb ? 'Your best week' : 'Your worst week'}</Kicker>
        <div className="mt-5">
          <BigStat
            value={move.spots}
            tone={isClimb ? 'accent' : 'live'}
            label={
              <>
                {isClimb ? 'places gained' : 'places lost'} {move.to.label.toLowerCase()}.
                <br />
                {ordinal(move.from.rank)} to {ordinal(move.to.rank)}
                {isClimb ? '. That was the run.' : '. That was the damage.'}
              </>
            }
          />
        </div>
      </Layered>,
      7000,
      isClimb ? BG.emerald : BG.crimson,
    );
  }

  // 4. Champion pick
  if (d.champion) {
    push(
      'champion',
      <Layered layers={<Halo tone="rgba(255,200,80,0.35)" />}>
        <Kicker tone="gold">You crowned</Kicker>
        <div className="mt-4">
          <FlagDisc flag={d.champion.pick.flag} />
        </div>
        <h2 className="mt-4 font-display text-5xl leading-none">{d.champion.pick.name}</h2>
        <p className="anim-in mt-4 text-sm leading-relaxed text-muted" style={{ animationDelay: '600ms' }}>
          {d.champion.correct ? (
            <>
              And they went and did it. You called the World Cup winner months in advance and you have the
              points to prove it.
            </>
          ) : d.champion.exitLabel ? (
            <>
              They went out at {d.champion.exitLabel}.
              {d.champion.actual ? (
                <>
                  {' '}
                  The trophy went to {d.champion.actual.flag} {d.champion.actual.name}.
                </>
              ) : null}
            </>
          ) : (
            'It did not work out.'
          )}
        </p>
        <BiasNote>{championBias(d.champion.pick.code)}</BiasNote>
      </Layered>,
      8000,
      BG.gold,
    );
  }

  // 5. Ride or die
  if (d.rideOrDie) {
    push(
      'ride',
      <Layered layers={<Halo tone="rgba(30,230,164,0.32)" />}>
        <Kicker>Your ride or die</Kicker>
        <div className="mt-4">
          <FlagDisc flag={d.rideOrDie.team.flag} />
        </div>
        <h2 className="mt-4 font-display text-5xl leading-none">{d.rideOrDie.team.name}</h2>
        <p className="anim-in mt-3 text-sm leading-relaxed text-muted" style={{ animationDelay: '500ms' }}>
          They put <span className="font-bold text-accent">{d.rideOrDie.pts} points</span> on your total
          across {d.rideOrDie.picks} {d.rideOrDie.picks === 1 ? 'call' : 'separate calls'}. Nobody else came
          close to carrying you like that.
        </p>
        <BiasNote>{rideBias(d.rideOrDie.team.code, d.rideOrDie.team.name)}</BiasNote>
      </Layered>,
      8000,
      BG.emerald,
    );
  }

  // 6. The betrayal
  if (d.betrayal) {
    push(
      'betrayal',
      <Layered layers={<Marquee text="BETRAYAL" className="top-6 -rotate-2" tone="var(--f-ghost)" />}>
        <Kicker tone="live">The betrayal</Kicker>
        <div className="mt-4">
          <FlagDisc flag={d.betrayal.team.flag} />
        </div>
        <h2 className="mt-4 font-display text-5xl leading-none">{d.betrayal.team.name}</h2>
        <p className="anim-in mt-3 text-sm leading-relaxed text-muted" style={{ animationDelay: '500ms' }}>
          You backed them {d.betrayal.promised}. They went out at {d.betrayal.exitLabel} and took{' '}
          <span className="font-bold text-live">{d.betrayal.cost} points</span> with them.
        </p>
        <BiasNote>{betrayalBias(d.betrayal.team.code)}</BiasNote>
      </Layered>,
      8000,
      BG.crimson,
    );
  }

  // 7. Best call
  if (d.bestCall) {
    push(
      'bestcall',
      <Layered layers={<Ghost opacity={0.05}>+{d.bestCall.pts}</Ghost>}>
        <Kicker>Your best call</Kicker>
        <div className="mt-6 text-7xl">{d.bestCall.team.flag}</div>
        <div className="anim-count mt-4 finale-hero text-accent" style={{ animationDelay: '300ms' }}>
          +<CountUp to={d.bestCall.pts} delay={420} />
        </div>
        <div className="mt-4">
          <Tilt deg={-2}>
            <div className="font-display text-2xl leading-tight">
              {d.bestCall.team.name} {d.bestCall.reason}
            </div>
            <div className="mt-1 text-xs text-muted-2">
              Your single most valuable moment of foresight.
            </div>
          </Tilt>
        </div>
      </Layered>,
      7500,
      BG.emerald,
    );
  }

  // 8. Left on the table
  if (d.leftOnTable > 0) {
    push(
      'left',
      <Layered layers={<Ghost opacity={0.05}>{d.leftOnTable}</Ghost>}>
        <Kicker tone="muted">Points left on the table</Kicker>
        <div className="mt-4">
          <BigStat
            value={d.leftOnTable}
            tone="live"
            label={
              <>
                points that were available and did not end up yours.
                <br />A perfect bracket was worth{' '}
                <span className="font-semibold text-foreground">{d.leftOnTable + d.me.bracketTotal}</span>. You
                took {d.me.bracketTotal}.
              </>
            }
          />
        </div>
        <p className="anim-in mt-6 text-sm text-muted-2" style={{ animationDelay: '1100ms' }}>
          Nobody got all of them. That is not really the point.
        </p>
      </Layered>,
      7500,
      BG.slate,
    );
  }

  // 9. Score predictions
  if (d.predictions && d.predictions.made > 0) {
    const p = d.predictions;
    push(
      'predict',
      <div>
        <Kicker>The score predictions</Kicker>
        <div className="mt-4">
          <BigStat
            value={p.made}
            label={
              <>
                scorelines called. <span className="font-bold text-accent">{p.exact}</span> landed exactly,
                for {p.points} bonus {p.points === 1 ? 'point' : 'points'}.
              </>
            }
          />
        </div>
        <div className="mt-6 space-y-3 text-sm">
          {p.boldest ? (
            <Tilt deg={1.6}>
              <div className="text-[0.6rem] font-bold uppercase tracking-wider text-muted-2">
                Your boldest call
              </div>
              <div className="mt-1 font-display text-2xl leading-tight">{p.boldest.label}</div>
              <div className="text-xs text-muted-2">{p.boldest.total} goals. Ambitious.</div>
            </Tilt>
          ) : null}
          <p className="anim-in text-muted" style={{ animationDelay: '950ms' }}>
            You predicted {p.goalsPredicted} goals across those games. There were {p.goalsActual}.{' '}
            {p.goalsPredicted > p.goalsActual
              ? 'You wanted more football than football wanted to give.'
              : p.goalsPredicted < p.goalsActual
                ? 'You were braced for a lot less than you got.'
                : 'Somehow, exactly right in aggregate.'}
          </p>
          {p.pensCalled > 0 ? (
            <p className="anim-in text-accent" style={{ animationDelay: '1150ms' }}>
              You also called {p.pensCalled} penalty {p.pensCalled === 1 ? 'shootout' : 'shootouts'} correctly.
            </p>
          ) : null}
        </div>
      </div>,
      9000,
      BG.violet,
    );
  } else {
    push(
      'nopredict',
      <Layered layers={<Ghost opacity={0.05}>0</Ghost>}>
        <Kicker tone="muted">The score predictions</Kicker>
        <div className="anim-count mt-6 finale-hero text-muted-2" style={{ animationDelay: '200ms' }}>
          0
        </div>
        <p className="anim-in mt-4 text-sm leading-relaxed text-muted" style={{ animationDelay: '600ms' }}>
          You did not call a single scoreline all tournament. The button was right there, for a month,
          every day. We are not angry.
        </p>
      </Layered>,
      6500,
      BG.slate,
    );
  }

  // 10. Trash talk
  if (d.chat) {
    push(
      'chat',
      <div>
        <Kicker tone="gold">Trash talk</Kicker>
        <div className="mt-5">
          <Ring
            pct={d.chat.sharePct}
            center={
              <>
                <span className="font-display text-4xl leading-none text-accent">
                  <CountUp to={d.chat.sharePct} suffix="%" delay={400} />
                </span>
                <span className="mt-1 text-[0.6rem] font-bold uppercase tracking-wider text-muted-2">
                  of the chat
                </span>
              </>
            }
          />
        </div>
        <p className="anim-in mt-5 text-sm leading-relaxed text-muted" style={{ animationDelay: '800ms' }}>
          You sent <span className="font-bold text-foreground">{d.chat.sent}</span> of the {d.chat.poolTotal}{' '}
          messages in {d.poolName}, the {ordinal(d.chat.rank)} loudest person in the group.
        </p>
        {d.chat.busiestDay && d.chat.busiestDay.count > 1 ? (
          <p className="anim-in mt-2 text-xs text-muted-2" style={{ animationDelay: '1000ms' }}>
            Loudest day: {dayLabel(d.chat.busiestDay.day)}, {d.chat.busiestDay.count} messages.
          </p>
        ) : null}
        {d.chat.longest ? (
          <div className="mt-4">
            <Tilt deg={-1.8}>
              <p className="text-sm italic leading-relaxed text-muted">
                &ldquo;{d.chat.longest.slice(0, 180)}
                {d.chat.longest.length > 180 ? '...' : ''}&rdquo;
              </p>
              <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-muted-2">
                your longest message
              </p>
            </Tilt>
          </div>
        ) : null}
      </div>,
      9500,
      BG.magenta,
    );
  }

  // 11. Nemesis
  if (d.nemesis) {
    push(
      'nemesis',
      <Layered layers={<Marquee text="VS" className="top-1/3 -rotate-1" tone="var(--f-ghost)" />}>
        <Kicker tone="live">Your nemesis</Kicker>
        <div className="mt-6 flex items-center justify-center gap-4">
          <Avatar name={d.name} size="lg" />
          <span className="font-display text-3xl text-muted-2">vs</span>
          <Avatar name={d.nemesis.name} size="lg" />
        </div>
        <h2 className="mt-4 font-display text-5xl leading-none">{d.nemesis.name}</h2>
        <p className="anim-in mt-3 text-sm leading-relaxed text-muted" style={{ animationDelay: '600ms' }}>
          You two swapped places <span className="font-bold text-foreground">{d.nemesis.crossings}</span>{' '}
          {d.nemesis.crossings === 1 ? 'time' : 'times'} over the tournament. It ended with{' '}
          {d.nemesis.aheadOfThem ? 'you ahead' : 'them ahead'} by {d.nemesis.gap}{' '}
          {d.nemesis.gap === 1 ? 'point' : 'points'}.
        </p>
        <p className="anim-in mt-2 text-xs italic text-muted-2" style={{ animationDelay: '900ms' }}>
          {d.nemesis.aheadOfThem ? 'Do not let them forget it.' : 'There is always 2030.'}
        </p>
      </Layered>,
      8000,
      BG.crimson,
    );
  }

  // 12. Bracket twin
  if (d.twin) {
    push(
      'twin',
      <Layered layers={<Ghost opacity={0.05}>{d.twin.pct}%</Ghost>}>
        <Kicker>Your bracket twin</Kicker>
        <div className="mt-5">
          <BigStat value={d.twin.pct} suffix="%" tone="gold" label={<>identical to {d.twin.name}</>} />
        </div>
        <p className="anim-in mt-5 text-sm leading-relaxed text-muted" style={{ animationDelay: '900ms' }}>
          {d.twin.pct >= 60
            ? `You and ${d.twin.name} filled in almost the same bracket. One of you had an original thought and we are not sure which.`
            : `${d.twin.name} came closest to thinking like you, and even then only ${d.twin.pct}% of the way. You were on your own out there.`}
        </p>
      </Layered>,
      7500,
      BG.teal,
    );
  }

  // 13. Trophy case
  if (d.badges.length) {
    push(
      'badges',
      <div>
        <Kicker tone="gold">Your trophy case</Kicker>
        <h2 className="mt-2 font-display text-4xl leading-none">
          {d.badges.length} {d.badges.length === 1 ? 'badge' : 'badges'}
        </h2>
        <div className="mt-6 space-y-2">
          {d.badges.map((b, i) => (
            <div
              key={b.title}
              className="anim-stamp rounded-xl border border-gold/30 bg-gold/[0.07] px-3 py-2.5"
              style={{ animationDelay: `${240 + i * 150}ms` }}
            >
              <div className="font-display text-xl leading-none text-gold">{b.title}</div>
              <div className="mt-0.5 text-xs text-muted">{b.desc}</div>
            </div>
          ))}
        </div>
      </div>,
      Math.min(11000, 4500 + d.badges.length * 700),
      BG.gold,
    );
  }

  // 14. Archetype
  push(
    'archetype',
    <Layered layers={<Halo tone="rgba(255,200,80,0.3)" />}>
      <Kicker tone="muted">Your tournament persona</Kicker>
      <div className="anim-stamp mt-6 text-8xl" style={{ animationDelay: '200ms' }}>
        {d.archetype.emoji}
      </div>
      <h2
        className="anim-count mt-3 finale-hero metal-gold"
        style={{ animationDelay: '420ms', fontSize: 'clamp(2.4rem, 12vw, 4.4rem)' }}
      >
        {d.archetype.title}
      </h2>
      <p className="anim-in mt-4 text-sm leading-relaxed text-muted" style={{ animationDelay: '900ms' }}>
        {d.archetype.line}
      </p>
    </Layered>,
    8500,
    BG.night,
  );

  // 15. Final placement
  const podium = d.me.rank <= 3;
  push(
    'placement',
    <Layered layers={<Ghost opacity={0.06}>{ordinal(d.me.rank)}</Ghost>}>
      <Kicker tone="gold">Full time</Kicker>
      <div className="anim-count mt-5 finale-hero" style={{ animationDelay: '160ms' }}>
        <span className={podium ? 'metal-gold' : 'text-foreground'}>{ordinal(d.me.rank)}</span>
      </div>
      <p
        className="anim-in mt-1 text-xs font-bold uppercase tracking-[0.25em] text-muted-2"
        style={{ animationDelay: '500ms' }}
      >
        of {d.fieldSize} in {d.poolName}
      </p>
      <div className="anim-in mt-7" style={{ animationDelay: '800ms' }}>
        <StampCard
          emoji={d.me.rank === 1 ? '🏆' : d.me.rank === 2 ? '🥈' : d.me.rank === 3 ? '🥉' : undefined}
          title={`${d.me.combined} points`}
          body={
            d.me.rank === 1
              ? 'You won the whole thing. Enjoy it, it is four years until the next one.'
              : podium
                ? 'A podium finish. Close enough to taste it, far enough to still be annoyed.'
                : d.me.rank === d.fieldSize
                  ? 'Dead last. Somebody had to anchor the table and you volunteered.'
                  : 'Mid-table respectability. The most human outcome available.'
          }
          delay={900}
        />
      </div>
    </Layered>,
    8500,
    podium ? BG.gold : BG.slate,
  );

  // 16. Outro
  push(
    'outro',
    <Layered layers={<Marquee text="THAT IS A WRAP" className="top-8 -rotate-2" tone="var(--f-ghost)" />}>
      <div className="anim-trophy text-7xl">🏆</div>
      <h2 className="mt-4 font-display text-4xl leading-none">That was your World Cup</h2>
      <p className="anim-in mt-3 text-sm leading-relaxed text-muted" style={{ animationDelay: '400ms' }}>
        Thanks for playing. See you in 2030, when you will absolutely do this again and absolutely not
        learn from any of it.
      </p>
      <div className="mt-7 space-y-2">
        <ShareCardButton
          url={`/results/card/me?pool=${d.poolId}`}
          filename="my-recap.png"
          title={`${d.name}, World Cup 2026`}
          text={`My World Cup 2026 recap: ${ordinal(d.me.rank)} of ${d.fieldSize} in ${d.poolName} on ${d.me.combined} points. ${d.archetype.title}.`}
          label="Share your recap"
          className="w-full rounded-2xl f-solid py-3 text-sm font-bold active:scale-95"
        />
        <Link
          href={`/results/pool?pool=${d.poolId}`}
          className="block w-full rounded-2xl border f-line f-track py-3 text-sm font-bold text-foreground active:scale-95"
        >
          Watch the pool Recap
        </Link>
        <Link
          href={`/results/podium?pool=${d.poolId}`}
          className="block w-full rounded-2xl border border-gold/40 bg-gold/[0.1] py-3 text-sm font-bold text-gold active:scale-95"
        >
          See the podium
        </Link>
      </div>
    </Layered>,
    20000,
    BG.night,
  );

  return <StoryDeck slides={slides} exitHref={`/results?pool=${d.poolId}`} />;
}
