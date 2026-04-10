interface PipelineStepProps {
  currentStep: string | null;
  status: string;
}

const STEPS = ['write', 'analyze'] as const;

export default function PipelineStep({ currentStep, status }: PipelineStepProps) {
  const isRunning = status === 'running';

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const isCurrent = isRunning && currentStep === step;
        const isPast =
          isRunning &&
          currentStep != null &&
          STEPS.indexOf(currentStep as (typeof STEPS)[number]) > i;
        const isCompleted = status === 'completed';

        return (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && (
              <svg className="h-4 w-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isCurrent
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : isPast || isCompleted
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {isCurrent && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
                </span>
              )}
              {(isPast || isCompleted) && (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              {step.charAt(0).toUpperCase() + step.slice(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
