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

  const groupMax = GROUP_LETTERS.length * SCORING.groupTop2 * 2; // 72
  const thirdsMax = THIRD_PLACE_PICKS * SCORING.thirdPlace; // 16
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
      earned: facts.allGroupsDecided && scores.groups === groupMax,
      hint: facts.allGroupsDecided ? `${scores.groups}/${groupMax} group pts` : 'Groups still in play',
    },
    {
      key: 'thirds-oracle',
      title: 'Thirds Oracle',
      desc: 'Called all eight best third-place teams.',
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
