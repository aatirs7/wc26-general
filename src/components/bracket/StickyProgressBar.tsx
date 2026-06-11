'use client';

export interface StepInfo {
  key: string;
  title: string;
  done: number;
  total: number;
}

interface Props {
  steps: StepInfo[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export default function StickyProgressBar({ steps, activeKey, onSelect }: Props) {
  return (
    <div className="-mx-4 mb-1 px-4 pt-3 pb-2 glass">
      <div className="flex justify-center gap-1.5 overflow-x-auto pb-0.5">
        {steps.map((step) => {
          const active = step.key === activeKey;
          const complete = step.done >= step.total;
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onSelect(step.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                active
                  ? 'border-accent bg-accent/15 text-accent'
                  : complete
                    ? 'border-edge bg-white/[0.04] text-foreground'
                    : 'border-edge bg-transparent text-muted'
              }`}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] ${
                  complete ? 'bg-accent text-[var(--accent-ink)]' : 'bg-white/10 text-muted'
                }`}
              >
                {complete ? '✓' : step.done}
              </span>
              {step.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
