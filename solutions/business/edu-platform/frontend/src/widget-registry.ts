import type { WidgetRegistry, WidgetCatalogEntry } from '@kedge-agentic/chat-interface'
import { EduMetricDashboard } from './widgets/EduMetricDashboard'
import { EduStepWizard } from './widgets/EduStepWizard'
import { EduReviewPanel } from './widgets/EduReviewPanel'

/**
 * Edu-platform custom widget registry.
 * These override the builtin widgets of the same name.
 */
export const customWidgets: WidgetRegistry = {
  MetricDashboard: EduMetricDashboard,
  StepWizard: EduStepWizard,
  ReviewPanel: EduReviewPanel,
}

/**
 * Extended catalog entries for edu-specific widget props.
 */
export const customCatalog: WidgetCatalogEntry[] = [
  {
    type: 'MetricDashboard',
    description: 'Edu metric dashboard with color-threshold bar list, delta trends, section titles, and action buttons.',
    propsSchema: {
      title: { type: 'string', description: 'Dashboard title' },
      badge: { type: 'string', description: 'Badge text' },
      metrics: { type: 'array', description: 'Metric cards with label, value, delta, trend', required: true },
      section_title: { type: 'string', description: 'Title above bar list' },
      bar_list: { type: 'array', description: 'Bar items with label, value, max_value, color_thresholds' },
      actions: { type: 'array', description: 'Action buttons with label, prompt, primary, skill_hint' },
    },
  },
  {
    type: 'StepWizard',
    description: 'Edu 4-step wizard: form → tree → gap analysis → summary confirmation.',
    propsSchema: {
      title: { type: 'string', description: 'Wizard title', required: true },
      submit_action: { type: 'string', description: 'Action name on submit', required: true },
      submit_label: { type: 'string', description: 'Submit button text' },
      steps: { type: 'array', description: 'Step names array' },
      fields: { type: 'array', description: 'Form fields for step 0' },
      tree: { type: 'array', description: 'Tree items for step 1' },
      gaps: { type: 'array', description: 'Gap analysis data for step 2' },
      summary_rows: { type: 'array', description: 'Summary key-value rows for step 3' },
    },
  },
  {
    type: 'ReviewPanel',
    description: 'Edu review panel: all items displayed, source tags, 4 actions (keep/replace/tweak/remove), batch ops, submit.',
    propsSchema: {
      title: { type: 'string', description: 'Panel title', required: true },
      items: { type: 'array', description: 'Review items with id, content, knowledge_point, difficulty, source', required: true },
      submit_action: { type: 'string', description: 'Action name on submit', required: true },
    },
  },
]
