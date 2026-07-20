// The people's awards: superlatives the pool votes on, as opposed to the
// data-driven awards computed in results.ts. Pure catalog, no DB. Keys are
// persisted in superlative_votes.category_key, so never rename one in place;
// add a new key instead or old votes will orphan.

export interface SuperlativeCategory {
  key: string;
  title: string;
  emoji: string;
  // Shown as the question above the member picker.
  prompt: string;
  // Small print under the winner, for flavour.
  blurb: string;
  // Almost everything bans self-votes. One category exists purely so people
  // can nominate themselves.
  allowSelf: boolean;
}

export const SUPERLATIVES: SuperlativeCategory[] = [
  {
    key: 'most-delusional',
    title: 'Most Delusional',
    emoji: '🔮',
    prompt: 'Who backed a team with their whole chest and got absolutely nothing back?',
    blurb: 'Belief is free. Points are not.',
    allowSelf: false,
  },
  {
    key: 'quiet-assassin',
    title: 'Quiet Assassin',
    emoji: '🥷',
    prompt: 'Who said almost nothing all tournament and quietly finished near the top?',
    blurb: 'No noise. Just points.',
    allowSelf: false,
  },
  {
    key: 'loudest-for-least',
    title: 'Loudest For The Least',
    emoji: '📣',
    prompt: 'Who talked the most and had the least to show for it?',
    blurb: 'Volume is not a tiebreaker.',
    allowSelf: false,
  },
  {
    key: 'best-trash-talk',
    title: 'Best Trash Talk',
    emoji: '🎤',
    prompt: 'Who sent the one line that genuinely ended somebody?',
    blurb: 'Somewhere, a group chat still has not recovered.',
    allowSelf: false,
  },
  {
    key: 'blame-the-ref',
    title: 'Most Likely To Blame The Referee',
    emoji: '🟥',
    prompt: 'Whose bracket was never wrong, it was just badly officiated?',
    blurb: 'It was offside. It was always offside.',
    allowSelf: false,
  },
  {
    key: 'banned-2030',
    title: 'Banned From Brackets In 2030',
    emoji: '🚫',
    prompt: 'Who should not be allowed near a bracket four years from now?',
    blurb: 'For their own good, really.',
    allowSelf: false,
  },
  {
    key: 'clutch',
    title: 'Clutch Merchant',
    emoji: '🧊',
    prompt: 'Who peaked at exactly the right moment?',
    blurb: 'Timing is a skill.',
    allowSelf: false,
  },
  {
    key: 'bandwagon',
    title: 'The Bandwagon',
    emoji: '🚌',
    prompt: 'Who switched allegiance the second it got difficult?',
    blurb: 'Loyalty, but make it flexible.',
    allowSelf: false,
  },
  {
    key: 'trust-with-money',
    title: 'Would Trust With Your Money',
    emoji: '💸',
    prompt: 'Whose picks would you actually put money behind next time?',
    blurb: 'The highest honour available here.',
    allowSelf: false,
  },
  {
    key: 'ghost',
    title: 'Biggest Ghost',
    emoji: '👻',
    prompt: 'Who joined, disappeared for a month, and reappeared for the final?',
    blurb: 'Present in spirit. Mostly spirit.',
    allowSelf: false,
  },
  {
    key: 'most-improved-human',
    title: 'Most Improved Human Being',
    emoji: '🌱',
    prompt: 'Purely vibes. Who grew the most as a person this tournament?',
    blurb: 'No data was harmed in the making of this award.',
    allowSelf: false,
  },
  {
    key: 'goat-truther',
    title: 'The GOAT Truther',
    emoji: '🐐',
    prompt: 'Who argued hardest, and most correctly, that Ronaldo is the greatest of all time?',
    blurb: 'Some hills are worth it.',
    allowSelf: true,
  },
  {
    key: 'messi-apologist',
    title: 'The Messi Apologist',
    emoji: '🙃',
    prompt: 'Who spent the tournament defending Messi and Argentina to anyone who would listen?',
    blurb: 'Every group has one. This is them.',
    allowSelf: false,
  },
  {
    key: 'most-confident',
    title: 'Most Confident',
    emoji: '😤',
    prompt: 'Who was the most sure of themselves? You are allowed to pick yourself here.',
    blurb: 'The only category where nominating yourself is the point.',
    allowSelf: true,
  },
];

export const SUPERLATIVE_KEYS = new Set(SUPERLATIVES.map((s) => s.key));

export function superlativeByKey(key: string): SuperlativeCategory | null {
  return SUPERLATIVES.find((s) => s.key === key) ?? null;
}
