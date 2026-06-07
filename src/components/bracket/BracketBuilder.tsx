'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Team } from '@/types/team';
import type { Predictions } from '@/types/bracket';
import {
  GROUP_LETTERS,
  ROUND_SIZES,
  THIRD_PLACE_PICKS,
  type GroupLetter,
  type KnockoutRoundKey,
} from '@/lib/constants';
import { isComplete, isGroupComplete } from '@/lib/predictions';
import { bracketReducer } from '@/lib/bracket-reducer';
import GroupPicker from './GroupPicker';
import ThirdPlacePicker from './ThirdPlacePicker';
import KnockoutRound from './KnockoutRound';
import TeamChip from './TeamChip';
import StickyProgressBar, { type StepInfo } from './StickyProgressBar';
import SaveSubmitBar, { type SaveStatus } from './SaveSubmitBar';

interface BracketDto {
  id: string;
  name: string;
  predictions: Predictions;
  submitted: boolean;
}

interface Props {
  bracket: BracketDto;
  teams: Team[];
}

type StepKey = 'groups' | 'thirds' | KnockoutRoundKey | 'champion';

const STEP_ORDER: StepKey[] = ['groups', 'thirds', 'r16', 'qf', 'sf', 'final', 'champion'];

const STEP_TITLES: Record<StepKey, string> = {
  groups: 'Groups',
  thirds: 'Best 3rds',
  r16: 'Round of 16',
  qf: 'Quarters',
  sf: 'Semis',
  final: 'Final',
  champion: 'Champion',
};

const STEP_HEADINGS: Record<StepKey, string> = {
  groups: 'Group stage',
  thirds: 'Third-place race',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  final: 'The Final',
  champion: 'Champion',
};

const ROUND_DESCRIPTIONS: Record<KnockoutRoundKey, string> = {
  r16: 'From your 32 qualifiers, tap the 16 that win their opening knockout match and reach the Round of 16. 5 points each.',
  qf: 'Which 8 reach the quarter-finals? 8 points each.',
  sf: 'Which 4 reach the semi-finals? 12 points each.',
  final: 'Which 2 reach the Final at MetLife? 18 points each.',
};

export default function BracketBuilder({ bracket, teams }: Props) {
  const [predictions, dispatch] = useReducer(bracketReducer, bracket.predictions, (p) =>
    bracketReducer(p, { type: 'load', predictions: p }),
  );
  const [step, setStep] = useState<StepKey>('groups');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [submitted, setSubmitted] = useState(bracket.submitted);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced optimistic persistence. Local state is the source of truth;
  // the server write trails it by 800ms.
  const firstRender = useRef(true);
  const saveSeq = useRef(0);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveStatus('saving');
    const seq = ++saveSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/bracket', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: bracket.id, predictions }),
        });
        if (seq !== saveSeq.current) return;
        if (!res.ok) throw new Error('save failed');
        const data = await res.json();
        setSubmitted(data.bracket.submitted);
        setSaveStatus('saved');
      } catch {
        if (seq === saveSeq.current) setSaveStatus('error');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [predictions, bracket.id]);

  const stepInfos: StepInfo[] = useMemo(() => {
    const groupsDone = GROUP_LETTERS.filter((l) => isGroupComplete(predictions.groups[l])).length;
    return STEP_ORDER.map((key) => {
      if (key === 'groups') return { key, title: STEP_TITLES[key], done: groupsDone, total: 12 };
      if (key === 'thirds')
        return { key, title: STEP_TITLES[key], done: predictions.thirdPlace.length, total: THIRD_PLACE_PICKS };
      if (key === 'champion')
        return { key, title: STEP_TITLES[key], done: predictions.knockout.champion ? 1 : 0, total: 1 };
      return {
        key,
        title: STEP_TITLES[key],
        done: predictions.knockout[key].length,
        total: ROUND_SIZES[key],
      };
    });
  }, [predictions]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const complete = isComplete(predictions);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/bracket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', id: bracket.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'submit failed');
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  const finalTeams = teams.filter((t) => predictions.knockout.final.includes(t.code));

  return (
    <div className="pb-28">
      <StickyProgressBar steps={stepInfos} activeKey={step} onSelect={(k) => setStep(k as StepKey)} />

      <div className="mt-3 mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-3xl leading-none">{STEP_HEADINGS[step]}</h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          Step {stepIndex + 1}/{STEP_ORDER.length}
        </span>
      </div>

      {submitted ? (
        <p className="mb-3 rounded-xl border border-accent/40 bg-accent/[0.08] p-3 text-sm text-accent">
          Bracket submitted. You can still tweak picks until kickoff; changing
          anything means you need to submit again.
        </p>
      ) : null}
      {error ? (
        <p className="mb-3 rounded-xl border border-live/40 bg-live/[0.08] p-3 text-sm text-live">
          {error}
        </p>
      ) : null}

      <div key={step} className="reveal">
        {step === 'groups' ? (
          <GroupPicker
            teams={teams}
            predictions={predictions}
            onRank={(letter: GroupLetter, code: string) =>
              dispatch({ type: 'rankGroupTeam', letter, code })
            }
          />
        ) : step === 'thirds' ? (
          <ThirdPlacePicker
            teams={teams}
            predictions={predictions}
            onToggle={(code) => dispatch({ type: 'toggleThird', code })}
          />
        ) : step === 'champion' ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-muted">
              The big one. Who lifts the trophy on July 19? 30 points.
            </p>
            {finalTeams.length === 0 ? (
              <div className="card p-5 text-center text-sm text-muted">
                Pick your two finalists first.
              </div>
            ) : (
              <div className="space-y-2">
                {finalTeams.map((team) => (
                  <TeamChip
                    key={team.code}
                    team={team}
                    selected={predictions.knockout.champion === team.code}
                    badge={predictions.knockout.champion === team.code ? '🏆 CHAMP' : undefined}
                    onTap={() => dispatch({ type: 'toggleChampion', code: team.code })}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <KnockoutRound
            teams={teams}
            predictions={predictions}
            round={step}
            description={ROUND_DESCRIPTIONS[step]}
            onToggle={(code) => dispatch({ type: 'toggleRoundPick', round: step as KnockoutRoundKey, code })}
          />
        )}
      </div>

      <SaveSubmitBar
        saveStatus={saveStatus}
        canBack={stepIndex > 0}
        canNext={stepIndex < STEP_ORDER.length - 1}
        onBack={() => setStep(STEP_ORDER[stepIndex - 1])}
        onNext={() => setStep(STEP_ORDER[stepIndex + 1])}
        showSubmit={step === 'champion'}
        submitEnabled={complete}
        submitted={submitted}
        submitting={submitting}
        onSubmit={submit}
      />
    </div>
  );
}
