// Per-slide share cards.
//
// Every slide in both recap decks can be shared as its own image. Rather than
// screenshotting the DOM (which needs a heavy dependency and mangles
// gradients, custom fonts and backdrop filters), each slide declares a small
// payload describing the ONE fact it is about. A single next/og route renders
// that payload into a story-shaped card, so the shared images look like a
// consistent set and there is one layout to maintain instead of thirty.
//
// These builders are pure functions over the already-computed recap data, and
// both the client deck and the server route call them. That means the card is
// always regenerated from real data server-side: nothing is trusted from the
// query string except which pool and which slide.

import type { PersonalRecap, PoolRecap } from './recap';
import { ordinal } from './recap';

export type ShareTone =
  | 'night'
  | 'emerald'
  | 'gold'
  | 'indigo'
  | 'crimson'
  | 'violet'
  | 'slate'
  | 'magenta'
  | 'teal';

export interface SlideShare {
  kicker: string;
  // Big emoji or flag sitting above the headline.
  emoji?: string;
  headline: string;
  // The oversized number, if the slide is built around one.
  stat?: string;
  statLabel?: string;
  sub?: string;
  tone: ShareTone;
  footer: string;
  // Message that travels with the image.
  text: string;
}

const pluralise = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

// ---------------------------------------------------------------------------
// Personal recap
// ---------------------------------------------------------------------------

export function personalShareCards(d: PersonalRecap): Record<string, SlideShare> {
  const footer = `${d.name} · ${d.poolName}`;
  const cards: Record<string, SlideShare> = {};

  cards.total = {
    kicker: 'Final total',
    headline: 'My World Cup',
    stat: `${d.me.combined}`,
    statLabel: 'points',
    sub:
      d.beat > 0
        ? `Finished above ${d.beat} ${pluralise(d.beat, 'person', 'people')} in ${d.poolName}.`
        : 'Someone has to be at the bottom.',
    tone: 'emerald',
    footer,
    text: `${d.me.combined} points in ${d.poolName}.`,
  };

  if (d.journey.length >= 2 && d.peak) {
    cards.journey = {
      kicker: 'The long way round',
      headline: 'Where I stood',
      stat: ordinal(d.peak.rank),
      statLabel: 'at my peak',
      sub: `Finished ${ordinal(d.me.rank)} of ${d.fieldSize}.`,
      tone: 'indigo',
      footer,
      text: `Peaked at ${ordinal(d.peak.rank)} and finished ${ordinal(d.me.rank)} of ${d.fieldSize}.`,
    };
  }

  const move = (d.biggestClimb?.spots ?? 0) >= (d.biggestFall?.spots ?? 0) ? d.biggestClimb : d.biggestFall;
  const isClimb = move === d.biggestClimb;
  if (move && move.spots >= 2) {
    cards.move = {
      kicker: isClimb ? 'My best week' : 'My worst week',
      headline: `${ordinal(move.from.rank)} to ${ordinal(move.to.rank)}`,
      stat: `${move.spots}`,
      statLabel: isClimb ? 'places gained' : 'places lost',
      sub: `${move.to.label}.`,
      tone: isClimb ? 'emerald' : 'crimson',
      footer,
      text: `${isClimb ? 'Gained' : 'Lost'} ${move.spots} places ${move.to.label.toLowerCase()}.`,
    };
  }

  if (d.champion) {
    cards.champion = {
      kicker: 'I crowned',
      emoji: d.champion.pick.flag,
      headline: d.champion.pick.name,
      sub: d.champion.correct
        ? 'And they went and did it.'
        : d.champion.exitLabel
          ? `They went out at ${d.champion.exitLabel}.`
          : 'It did not work out.',
      tone: 'gold',
      footer,
      text: `I crowned ${d.champion.pick.name}. ${
        d.champion.correct ? 'Called it.' : 'It did not work out.'
      }`,
    };
  }

  if (d.rideOrDie) {
    cards.ride = {
      kicker: 'My ride or die',
      emoji: d.rideOrDie.team.flag,
      headline: d.rideOrDie.team.name,
      stat: `${d.rideOrDie.pts}`,
      statLabel: 'points from one team',
      sub: 'Nobody else came close to carrying me like that.',
      tone: 'emerald',
      footer,
      text: `${d.rideOrDie.team.name} put ${d.rideOrDie.pts} points on my total.`,
    };
  }

  if (d.betrayal) {
    cards.betrayal = {
      kicker: 'The betrayal',
      emoji: d.betrayal.team.flag,
      headline: d.betrayal.team.name,
      stat: `${d.betrayal.cost}`,
      statLabel: 'points they took with them',
      sub: `Backed them ${d.betrayal.promised}. Out at ${d.betrayal.exitLabel}.`,
      tone: 'crimson',
      footer,
      text: `${d.betrayal.team.name} cost me ${d.betrayal.cost} points.`,
    };
  }

  if (d.bestCall) {
    cards.bestcall = {
      kicker: 'My best call',
      emoji: d.bestCall.team.flag,
      headline: `${d.bestCall.team.name} ${d.bestCall.reason}`,
      stat: `+${d.bestCall.pts}`,
      statLabel: 'from one pick',
      tone: 'emerald',
      footer,
      text: `My best call: ${d.bestCall.team.name} ${d.bestCall.reason}, worth ${d.bestCall.pts}.`,
    };
  }

  if (d.leftOnTable > 0) {
    cards.left = {
      kicker: 'Left on the table',
      headline: 'The ones that got away',
      stat: `${d.leftOnTable}`,
      statLabel: 'points I did not take',
      sub: `A perfect bracket was worth ${d.leftOnTable + d.me.bracketTotal}. I took ${d.me.bracketTotal}.`,
      tone: 'slate',
      footer,
      text: `${d.leftOnTable} points were sitting right there.`,
    };
  }

  if (d.predictions && d.predictions.made > 0) {
    cards.predict = {
      kicker: 'Score predictions',
      headline: 'Calling the scores',
      stat: `${d.predictions.exact}`,
      statLabel: `exact from ${d.predictions.made} tries`,
      sub: `Predicted ${d.predictions.goalsPredicted} goals. There were ${d.predictions.goalsActual}.`,
      tone: 'violet',
      footer,
      text: `${d.predictions.exact} exact scorelines from ${d.predictions.made} attempts.`,
    };
  } else {
    cards.nopredict = {
      kicker: 'Score predictions',
      headline: 'Not a single one',
      stat: '0',
      statLabel: 'scorelines called',
      sub: 'The button was right there, for a month, every day.',
      tone: 'slate',
      footer,
      text: 'I did not call a single scoreline all tournament.',
    };
  }

  if (d.chat) {
    cards.chat = {
      kicker: 'Trash talk',
      headline: `${ordinal(d.chat.rank)} loudest`,
      stat: `${d.chat.sharePct}%`,
      statLabel: 'of the group chat',
      sub: `${d.chat.sent} of the ${d.chat.poolTotal} messages in ${d.poolName}.`,
      tone: 'magenta',
      footer,
      text: `I sent ${d.chat.sharePct}% of everything said in ${d.poolName}.`,
    };
  }

  if (d.nemesis) {
    cards.nemesis = {
      kicker: 'My nemesis',
      emoji: '⚔️',
      headline: d.nemesis.name,
      stat: `${d.nemesis.crossings}`,
      statLabel: 'times we swapped places',
      sub: `Ended with ${d.nemesis.aheadOfThem ? 'me' : 'them'} ahead by ${d.nemesis.gap} ${pluralise(
        d.nemesis.gap,
        'point',
      )}.`,
      tone: 'crimson',
      footer,
      text: `${d.nemesis.name} and I swapped places ${d.nemesis.crossings} times.`,
    };
  }

  if (d.twin) {
    cards.twin = {
      kicker: 'My bracket twin',
      emoji: '👯',
      headline: d.twin.name,
      stat: `${d.twin.pct}%`,
      statLabel: 'identical brackets',
      sub: 'One of us had an original thought.',
      tone: 'teal',
      footer,
      text: `My bracket was ${d.twin.pct}% identical to ${d.twin.name}.`,
    };
  }

  if (d.badges.length) {
    cards.badges = {
      kicker: 'Trophy case',
      emoji: '🏅',
      headline: d.badges.map((b) => b.title).slice(0, 3).join(' · '),
      stat: `${d.badges.length}`,
      statLabel: pluralise(d.badges.length, 'badge'),
      tone: 'gold',
      footer,
      text: `${d.badges.length} ${pluralise(d.badges.length, 'badge')} earned.`,
    };
  }

  // The deck's persona line is written in the second person ("You produced..."),
  // which reads as if it is addressing whoever receives the image. The card
  // carries the persona plus a plain factual line instead.
  cards.archetype = {
    kicker: 'My tournament persona',
    emoji: d.archetype.emoji,
    headline: d.archetype.title,
    stat: ordinal(d.me.rank),
    statLabel: `of ${d.fieldSize} · ${d.me.combined} points`,
    tone: 'night',
    footer,
    text: `My World Cup 2026 persona: ${d.archetype.title}.`,
  };

  cards.placement = {
    kicker: 'Full time',
    headline: `of ${d.fieldSize} in ${d.poolName}`,
    stat: ordinal(d.me.rank),
    statLabel: `${d.me.combined} points`,
    sub:
      d.me.rank === 1
        ? 'I won the whole thing.'
        : d.me.rank <= 3
          ? 'A podium finish.'
          : 'Mid-table respectability.',
    tone: d.me.rank <= 3 ? 'gold' : 'slate',
    footer,
    text: `Finished ${ordinal(d.me.rank)} of ${d.fieldSize} in ${d.poolName} on ${d.me.combined} points.`,
  };

  return cards;
}

// ---------------------------------------------------------------------------
// Pool recap
// ---------------------------------------------------------------------------

export function poolShareCards(d: PoolRecap): Record<string, SlideShare> {
  const footer = `${d.poolName} · World Cup 2026`;
  const cards: Record<string, SlideShare> = {};

  cards.field = {
    kicker: 'The damage, in total',
    headline: d.poolName,
    stat: `${d.totals.points}`,
    statLabel: 'points scored between us',
    sub: `${d.totals.messages} messages and ${d.totals.predictions} scorelines called.`,
    tone: 'emerald',
    footer,
    text: `${d.fieldSize} of us scored ${d.totals.points} points between us.`,
  };

  if (d.championPicks.length) {
    const top = d.championPicks[0];
    cards.crowns = {
      kicker: 'Who we all crowned',
      emoji: top.team.flag,
      headline: top.team.name,
      stat: `${top.count}`,
      statLabel: `of ${d.fieldSize} brackets`,
      sub: d.championTeam
        ? `The trophy went to ${d.championTeam.flag} ${d.championTeam.name}.`
        : undefined,
      tone: 'gold',
      footer,
      text: `${top.count} of ${d.fieldSize} of us crowned ${top.team.name}.`,
    };
  }

  if (d.believedIn) {
    cards.believed = {
      kicker: 'The team we believed in',
      emoji: d.believedIn.team.flag,
      headline: d.believedIn.team.name,
      stat: `${d.believedIn.count}`,
      statLabel: `of ${d.fieldSize} brackets`,
      sub: d.believedIn.champion
        ? 'They won the whole thing.'
        : `They went out at ${d.believedIn.exitLabel}.`,
      tone: 'emerald',
      footer,
      text: `${d.believedIn.count} of ${d.fieldSize} of us backed ${d.believedIn.team.name} to go deep.`,
    };
  }

  if (d.nobodySaw) {
    cards.nobody = {
      kicker: 'Nobody saw it coming',
      emoji: d.nobodySaw.team.flag,
      headline: d.nobodySaw.team.name,
      stat: `${d.nobodySaw.count} of ${d.fieldSize}`,
      statLabel: 'brackets backed them',
      sub: `And they reached ${d.nobodySaw.exitLabel}.`,
      tone: 'crimson',
      footer,
      text: `${d.nobodySaw.team.name} reached ${d.nobodySaw.exitLabel} with ${d.nobodySaw.count} of ${d.fieldSize} brackets backing them.`,
    };
  }

  if (d.consensusWrong) {
    cards.consensus = {
      kicker: 'Agreed on, and wrong',
      emoji: d.consensusWrong.team.flag,
      headline: d.consensusWrong.team.name,
      stat: `${d.consensusWrong.count} of ${d.fieldSize}`,
      statLabel: `sent them to ${d.consensusWrong.promised}`,
      sub: `They got as far as ${d.consensusWrong.exitLabel}.`,
      tone: 'crimson',
      footer,
      text: `${d.consensusWrong.count} of ${d.fieldSize} of us sent ${d.consensusWrong.team.name} to the final. They managed ${d.consensusWrong.exitLabel}.`,
    };
  }

  if (d.biggestSwing && d.biggestSwing.movement > 0) {
    cards.swing = {
      kicker: 'The big shakeup',
      headline: d.biggestSwing.label,
      stat: `${d.biggestSwing.movement}`,
      statLabel: 'places changed hands',
      sub: d.biggestSwing.risers.length
        ? `Biggest riser: ${d.biggestSwing.risers[0].name}, up ${d.biggestSwing.risers[0].spots}.`
        : undefined,
      tone: 'indigo',
      footer,
      text: `${d.biggestSwing.movement} places changed hands ${d.biggestSwing.label.toLowerCase()}.`,
    };
  }

  if (d.reign.holders.length) {
    cards.reign = {
      kicker: 'Life at the top',
      emoji: '👑',
      headline: d.reign.longest ? d.reign.longest.name : 'First place',
      stat: `${d.reign.changes}`,
      statLabel: 'lead changes',
      sub: d.reign.longest
        ? `${d.reign.longest.name} led at ${d.reign.longest.spells} of the ${d.reign.holders.length} checkpoints.`
        : undefined,
      tone: 'gold',
      footer,
      text: `First place changed hands ${d.reign.changes} times in ${d.poolName}.`,
    };
  }

  if (d.chat && d.chat.leaders.length) {
    cards.chat = {
      kicker: 'Loudest voices',
      emoji: '📣',
      headline: d.chat.leaders[0].name,
      stat: `${d.chat.total}`,
      statLabel: 'messages sent',
      sub: `${d.chat.leaders[0].name} sent ${d.chat.leaders[0].count} of them.`,
      tone: 'magenta',
      footer,
      text: `${d.chat.total} messages in ${d.poolName}. ${d.chat.leaders[0].name} sent the most.`,
    };
  }

  if (d.predictionWall && d.predictionWall.total > 0) {
    cards.wall = {
      kicker: 'The prediction wall',
      headline: 'Calling the scores',
      stat: `${d.predictionWall.exact}`,
      statLabel: `exact from ${d.predictionWall.total} attempts`,
      sub: d.predictionWall.hardest
        ? `Nobody called ${d.predictionWall.hardest.label}.`
        : undefined,
      tone: 'violet',
      footer,
      text: `${d.predictionWall.exact} exact scorelines called across ${d.poolName}.`,
    };
  }

  if (d.championTeam) {
    cards.realchamp = {
      kicker: 'World champions',
      emoji: d.championTeam.flag,
      headline: d.championTeam.name,
      tone: 'gold',
      footer,
      text: `${d.championTeam.name} won the World Cup.`,
    };
  }

  return cards;
}
