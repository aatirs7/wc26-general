// Badge catalog derived purely from a bracket's per-round scores, the
// tournament facts, and a little pool context. Every badge is always
// listed; `earned` flips on as the tournament (or the pick itself) makes
// it true, so the trophy case is interesting even before kickoff.

import type { Predictions } from '@/types/bracket';
import type { Facts } from './scoring';
import type { RoundKey } from './constants';
import {
  GROUP_LETTERS,
  ROUND_SIZES,
  SCORING,
  SCORING_BY_ROUND,
  THIRD_PLACE_PICKS,
} from './constants';

export interface Badge {
  key: string;
  title: string;
  desc: string;
  earned: boolean;
  hint?: string;
}

export interface BadgeContext {
  predictions: Predictions;
  scores: Record<RoundKey, number>;
  facts: Facts;
  totalPoints: number;
  rank: number | null;
  fieldSize: number;
  loneWolfChampion: boolean;
}

export function computeBadges(ctx: BadgeContext): Badge[] {
  const { predictions, scores, facts, totalPoints, rank, fieldSize, loneWolfChampion } = ctx;

  const thirdsMax = THIRD_PLACE_PICKS * SCORING.thirdPlace; // 16

  // Group Stage Guru counts correct top-two teams directly rather than
  // inferring them from scores.groups. The old threshold (12 * groupTop2 * 2 =
  // 72) predated the exact-position bonus, so once that landed every decent
  // bracket scored well past it (90 to 98 in practice, against a real ceiling
  // of 120) and the badge became unearnable. Worse, the only way to hit exactly
  // 72 was to call every top two while getting no position right, so a better
  // bracket was disqualified for being better.
  let top2Hits = 0;
  for (const letter of GROUP_LETTERS) {
    const g = predictions.groups[letter];
    const actualTop2 = facts.top2ByGroup.get(letter);
    if (!g || !actualTop2) continue;
    // Any of the top three lanes counts, matching how the engine pays out.
    for (const pick of [g.first, g.second, g.third]) {
      if (pick && actualTop2.has(pick)) top2Hits += 1;
    }
  }
  const top2Target = GROUP_LETTERS.length * 2; // 24
  const r16Max = ROUND_SIZES.r16 * SCORING_BY_ROUND.r16; // 80
  const finalMax = ROUND_SIZES.final * SCORING_BY_ROUND.final; // 36
  const hasChampion = !!predictions.knockout.champion;

  return [
    {
      key: 'on-the-board',
      title: 'On the Board',
      desc: 'Banked your first points.',
      earned: totalPoints > 0,
      hint: 'Waiting for kickoff',
    },
    {
      key: 'front-runner',
      title: 'Front Runner',
      desc: 'Top of your group right now.',
      earned: rank === 1,
      hint: rank ? `Currently ${rank}${fieldSize ? ` of ${fieldSize}` : ''}` : 'Submit to rank',
    },
    {
      key: 'lone-wolf',
      title: 'Lone Wolf',
      desc: 'Backed a champion nobody else in your group picked.',
      earned: loneWolfChampion,
      hint: hasChampion ? 'Someone else shares your champion' : 'Pick a champion',
    },
    {
      key: 'group-guru',
      title: 'Group Stage Guru',
      desc: 'Nailed every group top two.',
      earned: facts.allGroupsDecided && top2Hits === top2Target,
      hint: facts.allGroupsDecided
        ? `${top2Hits}/${top2Target} top-two teams`
        : 'Groups still in play',
    },
    {
      key: 'thirds-oracle',
      title: 'Thirds Oracle',
      // The points are awarded for having a qualifying third anywhere in your
      // top three, not for slotting them third, so say that.
      desc: 'Every best third-place qualifier was in your top three.',
      earned: facts.allGroupsDecided && scores.thirdPlace === thirdsMax,
      hint: facts.allGroupsDecided ? `${scores.thirdPlace}/${thirdsMax}` : 'Resolves after the groups',
    },
    {
      key: 'sweet-16',
      title: 'Sweet 16 Seer',
      desc: 'Every Round of 16 pick made it.',
      earned: scores.r16 === r16Max,
      hint: `${scores.r16}/${r16Max} R16 pts`,
    },
    {
      key: 'finalists',
      title: 'Finalist Foreteller',
      desc: 'Both your finalists reached the final.',
      earned: scores.final === finalMax,
      hint: 'Call both finalists',
    },
    {
      key: 'champion',
      title: 'Champion Caller',
      desc: 'Called the tournament winner.',
      earned: scores.champion > 0,
      hint: 'Crown the right team',
    },
    {
      key: 'undefeated',
      title: 'Undefeated',
      desc: 'Scored in every knockout round.',
      earned: scores.r16 > 0 && scores.qf > 0 && scores.sf > 0 && scores.final > 0,
      hint: 'Points in R16, QF, SF and the final',
    },
  ];
}
