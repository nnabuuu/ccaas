/**
 * Wizard Framework Types
 *
 * Generic multi-step wizard configuration for AskUserQuestion.
 * Each Skill can register a WizardConfig to provide custom
 * step-by-step data collection UX.
 */

export interface WizardConfig {
  id: string;
  title: string;
  steps: WizardStep[];
}

export interface WizardStep {
  id: string;
  title: string;
  type: 'form' | 'tree-select' | 'data-review' | 'summary';
  fields?: FormFieldConfig[];
  /** API endpoint for dynamic data (e.g. chapter tree, class analysis) */
  dataEndpoint?: string;
  /** Step IDs that must be completed before this step */
  dependsOn?: string[];
}

export type FormFieldConfig = {
  key: string;
  label: string;
  type: 'select' | 'text' | 'number';
  options?: { label: string; value: string }[];
  defaultValue?: string;
  /** Auto-fill from sessionContext[contextKey] */
  contextKey?: string;
};

/** Collected answers from all wizard steps */
export type WizardAnswers = Record<string, unknown>;

/** Props for individual step components */
export interface StepProps {
  step: WizardStep;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Answers from previous steps (for dependent steps) */
  allAnswers: WizardAnswers;
  /** Session context for auto-fill */
  sessionContext?: Record<string, unknown>;
  /** Base URL for data endpoints */
  apiBaseUrl?: string;
}
