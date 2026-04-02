/**
 * WizardRenderer — Generic multi-step wizard component
 *
 * Renders a step indicator bar, current step panel, and navigation buttons.
 * Each step type maps to a step sub-component.
 */
import { useState, useCallback, useMemo } from 'react';
import type { WizardConfig, WizardAnswers, WizardStep } from './types';
import { FormStep } from './steps/FormStep';
import { TreeSelectStep } from './steps/TreeSelectStep';
import { DataReviewStep } from './steps/DataReviewStep';
import { SummaryStep } from './steps/SummaryStep';

interface WizardRendererProps {
  config: WizardConfig;
  onSubmit: (answers: Record<string, string>) => void;
  sessionContext?: Record<string, unknown>;
  apiBaseUrl?: string;
}

export function WizardRenderer({ config, onSubmit, sessionContext, apiBaseUrl }: WizardRendererProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepAnswers, setStepAnswers] = useState<WizardAnswers>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const steps = config.steps;
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  // Check if a step's dependencies are satisfied
  const isStepReady = useCallback(
    (step: WizardStep): boolean => {
      if (!step.dependsOn || step.dependsOn.length === 0) return true;
      return step.dependsOn.every((depId) => {
        const val = stepAnswers[depId];
        if (val == null) return false;
        const depStep = steps.find(s => s.id === depId);
        // data-review steps: empty selection is valid (emphasis is optional)
        if (depStep?.type === 'data-review') return true;
        // form steps: check all fields are filled
        if (depStep?.type === 'form' && depStep.fields) {
          const formVal = val as Record<string, string>;
          return depStep.fields.every(f => {
            const v = formVal[f.key];
            return v != null && v !== '';
          });
        }
        // Handle { ids: string[] } format from tree-select/data-review
        if (typeof val === 'object' && !Array.isArray(val)) {
          const obj = val as Record<string, unknown>;
          if (Array.isArray(obj.ids)) return (obj.ids as string[]).length > 0;
          return Object.keys(obj).length > 0;
        }
        if (Array.isArray(val)) return val.length > 0;
        return true;
      });
    },
    [stepAnswers, steps],
  );

  // Determine which steps are completed
  const completedSteps = useMemo(() => {
    const completed = new Set<string>();
    for (const step of steps) {
      const val = stepAnswers[step.id];
      if (val == null) continue;

      if (step.type === 'form' && step.fields) {
        // Form step: all fields must have a value
        const formVal = val as Record<string, string>;
        const allFilled = step.fields.every(f => {
          const v = formVal[f.key];
          return v != null && v !== '';
        });
        if (allFilled) completed.add(step.id);
      } else if (Array.isArray(val) && val.length > 0) {
        completed.add(step.id);
      } else if (typeof val === 'object' && !Array.isArray(val)) {
        const obj = val as Record<string, unknown>;
        // Handle { ids: string[], labels: ... } format from tree-select/data-review
        if (Array.isArray(obj.ids)) {
          if ((obj.ids as string[]).length > 0) completed.add(step.id);
        } else if (Object.keys(obj).length > 0) {
          completed.add(step.id);
        }
      } else if (typeof val === 'string' && val.length > 0) {
        completed.add(step.id);
      } else if (val) {
        completed.add(step.id);
      }
    }
    return completed;
  }, [steps, stepAnswers]);

  const handleStepChange = useCallback(
    (value: unknown) => {
      setStepAnswers((prev) => ({ ...prev, [currentStep.id]: value }));
    },
    [currentStep.id],
  );

  const handleNext = useCallback(() => {
    if (isLastStep) return;
    for (let i = currentStepIndex + 1; i < steps.length; i++) {
      if (isStepReady(steps[i])) {
        setCurrentStepIndex(i);
        return;
      }
    }
    setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [currentStepIndex, isLastStep, steps, isStepReady]);

  const handlePrev = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleJumpTo = useCallback((stepIndex: number) => {
    if (!submitted && stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStepIndex(stepIndex);
    }
  }, [submitted, steps.length]);

  const handleSubmit = useCallback(() => {
    if (submitted || submitting) return;
    setSubmitting(true);

    // Flatten answers to Record<string, string> for backend
    const flatAnswers: Record<string, string> = {};
    for (const [key, val] of Object.entries(stepAnswers)) {
      flatAnswers[key] = typeof val === 'string' ? val : JSON.stringify(val);
    }
    onSubmit(flatAnswers);

    // Show submitted state after a brief delay
    setTimeout(() => {
      setSubmitted(true);
      setSubmitting(false);
    }, 300);
  }, [submitted, submitting, stepAnswers, onSubmit]);

  // data-review steps are always navigable (emphasis is optional)
  const canProceed = currentStep.type === 'summary' || currentStep.type === 'data-review' || completedSteps.has(currentStep.id);

  return (
    <div style={S.container}>
      {/* Step indicator bar */}
      <div style={S.stepBar}>
        {steps.map((step, i) => {
          const isActive = i === currentStepIndex;
          const isDone = completedSteps.has(step.id);
          const isReady = isStepReady(step);
          // Build tooltip for disabled steps showing which dependencies are missing
          let disabledTitle: string | undefined;
          if (!isReady && !isActive && step.dependsOn) {
            const missing = step.dependsOn
              .filter(depId => !completedSteps.has(depId))
              .map(depId => steps.find(s => s.id === depId)?.title || depId);
            if (missing.length > 0) {
              disabledTitle = `请先完成「${missing.join('」「')}」`;
            }
          }
          return (
            <div
              key={step.id}
              title={disabledTitle}
              onClick={() => {
                if (!submitted && isReady) setCurrentStepIndex(i);
              }}
              style={{
                ...S.stepChip,
                ...(isActive ? S.stepChipActive : {}),
                ...(isDone && !isActive ? S.stepChipDone : {}),
                ...(!isReady && !isActive ? S.stepChipDisabled : {}),
                ...(submitted ? { pointerEvents: 'none' as const } : {}),
              }}
            >
              <span style={{
                ...S.stepNum,
                ...(isDone ? S.stepNumDone : {}),
                ...(isActive ? S.stepNumActive : {}),
              }}>
                {isDone && !isActive ? '✓' : String(i + 1)}
              </span>
              <span>{step.title}</span>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div style={S.body}>
        {!submitted && renderStep(currentStep, stepAnswers, handleStepChange, steps, handleJumpTo, sessionContext, apiBaseUrl)}
        {submitted && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--success-t)', fontWeight: 500 }}>
              ✓ 参数已提交，正在生成...
            </div>
          </div>
        )}
      </div>

      {/* Footer navigation */}
      <div style={S.footer}>
        {!submitted ? (
          <>
            <button
              onClick={handlePrev}
              disabled={isFirstStep}
              style={{
                ...S.navBtn,
                ...(isFirstStep ? S.navBtnDisabled : {}),
              }}
            >
              上一步
            </button>
            <div style={S.progressText}>
              {currentStepIndex + 1} / {steps.length}
            </div>
            {isLastStep ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  ...S.submitBtn,
                  ...(submitting ? { opacity: 0.6 } : {}),
                }}
              >
                {submitting ? '提交中...' : '确认生成'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canProceed}
                style={{
                  ...S.navBtn,
                  ...S.navBtnPrimary,
                  ...(!canProceed ? S.navBtnDisabled : {}),
                }}
              >
                下一步
              </button>
            )}
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--success-t)', fontWeight: 500, width: '100%', textAlign: 'center' }}>
            ✓ 向导已完成
          </div>
        )}
      </div>
    </div>
  );
}

function renderStep(
  step: WizardStep,
  allAnswers: WizardAnswers,
  onChange: (value: unknown) => void,
  allSteps: WizardStep[],
  onJumpTo: (stepIndex: number) => void,
  sessionContext?: Record<string, unknown>,
  apiBaseUrl?: string,
) {
  const props = {
    step,
    value: allAnswers[step.id],
    onChange,
    allAnswers,
    sessionContext,
    apiBaseUrl,
  };

  switch (step.type) {
    case 'form':
      return <FormStep {...props} />;
    case 'tree-select':
      return <TreeSelectStep {...props} />;
    case 'data-review':
      return <DataReviewStep {...props} />;
    case 'summary':
      return <SummaryStep {...props} allSteps={allSteps} onJumpTo={onJumpTo} />;
    default:
      return <div style={{ padding: 16, color: 'var(--t3)', fontSize: 12 }}>Unknown step type: {step.type}</div>;
  }
}

const S = {
  container: {
    border: '0.5px solid var(--b1)',
    borderRadius: 'var(--rl, 12px)',
    background: 'var(--bg1)',
    margin: '10px 0',
    overflow: 'hidden' as const,
  },
  stepBar: {
    display: 'flex',
    gap: 4,
    padding: '10px 14px',
    borderBottom: '0.5px solid var(--b1)',
    background: 'var(--bg2)',
    flexWrap: 'wrap' as const,
  },
  stepChip: {
    padding: '5px 12px',
    fontSize: 12,
    color: 'var(--t3)',
    cursor: 'pointer',
    borderRadius: 20,
    border: '0.5px solid transparent',
    transition: 'all 0.15s',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap' as const,
    fontFamily: 'inherit',
    background: 'transparent',
  } as React.CSSProperties,
  stepChipActive: {
    color: 'var(--t1)',
    background: 'var(--bg1)',
    borderColor: 'var(--b1)',
  },
  stepChipDone: {
    color: 'var(--success-t)',
  },
  stepChipDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'var(--bg1)',
    border: '1px solid var(--b1)',
    fontSize: 11,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    color: 'var(--t3)',
    transition: 'all 0.15s',
  } as React.CSSProperties,
  stepNumDone: {
    background: 'var(--success-t)',
    borderColor: 'var(--success-t)',
    color: 'var(--bg1)',
    fontSize: 10,
  },
  stepNumActive: {
    background: 'var(--info-t)',
    borderColor: 'var(--info-t)',
    color: 'var(--bg1)',
  },
  body: {
    padding: 14,
    minHeight: 120,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderTop: '0.5px solid var(--b1)',
  },
  progressText: {
    fontSize: 11,
    color: 'var(--t3)',
  },
  navBtn: {
    fontSize: 12,
    padding: '7px 16px',
    borderRadius: 'var(--r, 8px)',
    cursor: 'pointer',
    border: '0.5px solid var(--b1)',
    background: 'var(--bg2)',
    color: 'var(--t2)',
    fontFamily: 'inherit',
    fontWeight: 500,
    transition: 'all 0.15s',
  } as React.CSSProperties,
  navBtnPrimary: {
    background: 'var(--t1)',
    color: 'var(--bg1)',
    borderColor: 'var(--t1)',
  },
  navBtnDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
  submitBtn: {
    fontSize: 12,
    padding: '7px 18px',
    borderRadius: 'var(--r, 8px)',
    cursor: 'pointer',
    border: 'none',
    background: 'var(--success-t)',
    color: 'var(--bg1)',
    fontFamily: 'inherit',
    fontWeight: 500,
    transition: 'all 0.15s',
  } as React.CSSProperties,
} as const;
