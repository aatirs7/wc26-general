'use client';

import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { Team } from '@/types/team';
import type { Predictions } from '@/types/bracket';
import {
  GROUP_LETTERS,
  THIRD_PLACE_PICKS,
  type GroupLetter,
} from '@/lib/constants';
import { isComplete, isGroupComplete } from '@/lib/predictions';
import { bracketReducer } from '@/lib/bracket-reducer';
import GroupPicker from './GroupPicker';
import ThirdPlacePicker from './ThirdPlacePicker';
import FullBracket from './FullBracket';
import StickyProgressBar, { type StepInfo } from './StickyProgressBar';
import SaveSubmitBar, { type SaveStatus } from './SaveSubmitBar';
import ClearStepButton from './ClearStepButton';

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

type StepKey = 'groups' | 'thirds' | 'knockout';

const STEP_ORDER: StepKey[] = ['groups', 'thirds', 'knockout'];

const STEP_TITLES: Record<StepKey, string> = {
  groups: 'Groups',
  thirds: 'Best 3rds',
  knockout: 'Bracket',
};

const STEP_HEADINGS: Record<StepKey, string> = {
  groups: 'Group stage',
  thirds: 'Third-place race',
  knockout: 'Knockout bracket',
};

// 16 + 8 + 4 + 2 + 1 ties decide the whole knockout.
const KO_TOTAL = 31;

export default function BracketBuilder({ bracket, teams }: Props) {
  const [predictions, dispatch] = useReducer(bracketReducer, bracket.predictions, (p) =>
    bracketReducer(p, { type: 'load', predictions: p }),
  );
  // A finished bracket opens on the full knockout view; an unfinished one
  // starts at the group stage so there is somewhere to begin.
  const [step, setStep] = useState<StepKey>(() =>
    isComplete(bracket.predictions) ? 'knockout' : 'groups',
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [submitted, setSubmitted] = useState(bracket.submitted);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamsByCode = useMemo(() => new Map(teams.map((t) => [t.code, t])), [teams]);

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

  const koDecided =
    predictions.knockout.r16.length +
    predictions.knockout.qf.length +
    predictions.knockout.sf.length +
    predictions.knockout.final.length +
    (predictions.knockout.champion ? 1 : 0);

  const stepInfos: StepInfo[] = useMemo(() => {
    const groupsDone = GROUP_LETTERS.filter((l) => isGroupComplete(predictions.groups[l])).length;
    return [
      { key: 'groups', title: STEP_TITLES.groups, done: groupsDone, total: 12 },
      { key: 'thirds', title: STEP_TITLES.thirds, done: predictions.thirdPlace.length, total: THIRD_PLACE_PICKS },
      { key: 'knockout', title: STEP_TITLES.knockout, done: koDecided, total: KO_TOTAL },
    ];
  }, [predictions, koDecided]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const complete = isComplete(predictions);
  const incompleteGroups = GROUP_LETTERS.filter((l) => !isGroupComplete(predictions.groups[l]));
  const thirdsCount = predictions.thirdPlace.length;
  const thirdsReady = incompleteGroups.length === 0 && thirdsCount === THIRD_PLACE_PICKS;

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

  return (
    <div className="pb-28">
      <StickyProgressBar steps={stepInfos} activeKey={step} onSelect={(k) => setStep(k as StepKey)} />

      <div className="mt-3 mb-1 flex items-center justify-between gap-2">
        <h2 className="font-display text-3xl leading-none">{STEP_HEADINGS[step]}</h2>
        <ClearStepButton key={step} onClear={() => dispatch({ type: 'clearStep', step })} />
      </div>
      <Link href="/scoring" className="mb-3 inline-block text-xs font-semibold text-accent underline">
        How it&apos;s scored
      </Link>

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
        ) : (
          <div className="space-y-3">
            {!thirdsReady ? (
              <div className="rounded-xl border-2 border-live/60 bg-live/[0.12] p-3.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-live" strokeWidth={2.4} />
                  <p className="text-sm font-bold text-live">
                    Your bracket has empty slots
                  </p>
                </div>
                <p className="mt-1.5 text-sm text-foreground">
                  Teams only appear here once you finish seeding all 32. You
                  still need to:
                </p>
                <ul className="mt-2 space-y-2">
                  {incompleteGroups.length > 0 ? (
                    <li className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted">
                        Rank all 4 in{' '}
                        <span className="font-semibold text-foreground">
                          {incompleteGroups.length === 1 ? 'Group' : 'Groups'}{' '}
                          {incompleteGroups.join(', ')}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep('groups')}
                        className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-[var(--accent-ink)] active:scale-95"
                      >
                        Fix
                      </button>
                    </li>
                  ) : null}
                  {thirdsCount < THIRD_PLACE_PICKS ? (
                    <li className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted">
                        Pick best thirds{' '}
                        <span className="font-semibold text-foreground">
                          ({thirdsCount}/{THIRD_PLACE_PICKS})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setStep('thirds')}
                        className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-[var(--accent-ink)] active:scale-95"
                      >
                        Fix
                      </button>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-muted">
                Tap the winner of each tie and they slide into the next round to
                face the neighbouring winner. Drag sideways to follow it all the
                way to the trophy.
              </p>
            )}
            <FullBracket
              predictions={predictions}
              teamsByCode={teamsByCode}
              onPick={(fills, winner, loser) => dispatch({ type: 'pickWinner', fills, winner, loser })}
            />
          </div>
        )}
      </div>

      <SaveSubmitBar
        saveStatus={saveStatus}
        canBack={stepIndex > 0}
        canNext={stepIndex < STEP_ORDER.length - 1}
        onBack={() => setStep(STEP_ORDER[stepIndex - 1])}
        onNext={() => setStep(STEP_ORDER[stepIndex + 1])}
        showSubmit={step === 'knockout'}
        submitEnabled={complete}
        submitted={submitted}
        submitting={submitting}
        onSubmit={submit}
      />
    </div>
  );
}
