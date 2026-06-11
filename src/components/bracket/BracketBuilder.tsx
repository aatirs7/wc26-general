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

interface CopySource {
  id: string;
  poolName: string;
  predictions: Predictions;
}

interface Props {
  bracket: BracketDto;
  teams: Team[];
  copySources?: CopySource[];
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

export default function BracketBuilder({ bracket, teams, copySources = [] }: Props) {
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
  const [copyOpen, setCopyOpen] = useState(false);
  const [pendingCopy, setPendingCopy] = useState<CopySource | null>(null);

  // Replace the current picks with a copy of one of the user's other-group
  // brackets. The autosave effect persists the change like any other edit.
  function doCopy(src: CopySource) {
    dispatch({ type: 'load', predictions: src.predictions });
    setPendingCopy(null);
    setCopyOpen(false);
    setStep(isComplete(src.predictions) ? 'knockout' : 'groups');
  }

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

      {copySources.length > 0 ? (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => {
              setCopyOpen((o) => !o);
              setPendingCopy(null);
            }}
            className="text-xs font-semibold text-accent underline"
          >
            {copyOpen ? 'Hide copy options' : 'Copy picks from another group'}
          </button>
          {copyOpen ? (
            <div className="card mt-2 space-y-2 p-3">
              {pendingCopy ? (
                <div className="space-y-2 text-center">
                  <p className="text-sm">
                    Replace your current picks with{' '}
                    <span className="font-bold">{pendingCopy.poolName}</span>&apos;s bracket?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingCopy(null)}
                      className="min-h-10 flex-1 rounded-xl border border-edge text-sm font-semibold active:scale-95"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => doCopy(pendingCopy)}
                      className="min-h-10 flex-1 rounded-xl bg-accent text-sm font-bold text-[var(--accent-ink)] active:scale-95"
                    >
                      Replace
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted">
                    Copy a bracket from another of your groups over your current picks.
                  </p>
                  {copySources.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setPendingCopy(s)}
                      className="flex min-h-10 w-full items-center justify-between rounded-xl border border-edge bg-white/[0.03] px-3 text-sm font-semibold active:scale-95"
                    >
                      <span className="truncate">{s.poolName}</span>
                      <span className="shrink-0 text-accent">Copy &rarr;</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          ) : null}
        </div>
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

      {/* The bar stays visible at all times so the submit / re-submit action
          is always reachable. Editing a pick clears submitted (server-side),
          turning "Submitted" back into "Submit bracket". Once the bracket is
          complete the submit button shows on every step so a change made on
          the groups or thirds tab can still be re-submitted without hunting
          for the knockout view. */}
      <SaveSubmitBar
        saveStatus={saveStatus}
        canBack={stepIndex > 0}
        canNext={stepIndex < STEP_ORDER.length - 1}
        onBack={() => setStep(STEP_ORDER[stepIndex - 1])}
        onNext={() => setStep(STEP_ORDER[stepIndex + 1])}
        showSubmit={complete || step === 'knockout'}
        submitEnabled={complete}
        submitted={submitted}
        submitting={submitting}
        onSubmit={submit}
      />
    </div>
  );
}
