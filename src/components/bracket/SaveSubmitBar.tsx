'use client';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Props {
  saveStatus: SaveStatus;
  canBack: boolean;
  canNext: boolean;
  onBack: () => void;
  onNext: () => void;
  showSubmit: boolean;
  submitEnabled: boolean;
  submitted: boolean;
  submitting: boolean;
  onSubmit: () => void;
}

export default function SaveSubmitBar(props: Props) {
  const {
    saveStatus, canBack, canNext, onBack, onNext,
    showSubmit, submitEnabled, submitted, submitting, onSubmit,
  } = props;

  // Quiet by default: only speak up while saving or if a save failed.
  const note =
    saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : '';

  return (
    <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 px-4">
      <div className="glass mx-auto flex max-w-md items-center gap-2 rounded-2xl px-3 py-2.5 shadow-xl shadow-black/40">
        {note ? (
          <span
            className={`text-[0.7rem] font-medium ${saveStatus === 'error' ? 'text-live' : 'text-muted'}`}
          >
            {note}
          </span>
        ) : null}
        <div className="flex flex-1 justify-end gap-2">
          {canBack ? (
            <button
              type="button"
              onClick={onBack}
              className="min-h-11 rounded-xl border border-edge px-4 text-sm font-semibold text-foreground active:scale-95"
            >
              Back
            </button>
          ) : null}
          {showSubmit ? (
            <button
              type="button"
              onClick={onSubmit}
              disabled={!submitEnabled || submitting || submitted}
              className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-bold transition-all active:scale-95 ${
                submitted
                  ? 'bg-accent/15 text-accent'
                  : 'bg-accent text-[var(--accent-ink)] disabled:opacity-30'
              }`}
            >
              {submitted ? 'Submitted ✓' : submitting ? 'Submitting…' : 'Submit bracket'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              className="min-h-11 rounded-xl bg-accent px-7 text-sm font-bold text-[var(--accent-ink)] disabled:opacity-30 active:scale-95"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
