/**
 * Widget catalog definition.
 * Phase 1: Simple component registry without @json-render.
 * Phase 2: Will migrate to @json-render/core defineCatalog.
 */
export interface WidgetCatalogEntry {
  type: string
  description: string
  propsSchema: Record<string, PropSchema>
  hasChildren?: boolean
}

export interface PropSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required?: boolean
  default?: unknown
}

export const builtinCatalog: WidgetCatalogEntry[] = [
  {
    type: 'StepWizard',
    description: 'Multi-step parameter collection wizard. Children are ordered step components.',
    hasChildren: true,
    propsSchema: {
      title: { type: 'string', description: 'Wizard title', required: true },
      submit_action: { type: 'string', description: 'Skill action on submit', required: true },
      submit_label: { type: 'string', description: 'Submit button text', default: 'Confirm' },
    },
  },
  {
    type: 'FormCollect',
    description: 'Dynamic form collector for basic inputs.',
    propsSchema: {
      label: { type: 'string', description: 'Step label', required: true },
      fields: { type: 'array', description: 'Form field definitions', required: true },
    },
  },
  {
    type: 'TreeSelector',
    description: 'Hierarchical tree selection component.',
    propsSchema: {
      label: { type: 'string', description: 'Step label', required: true },
      multi_select: { type: 'boolean', description: 'Allow multiple selection', default: true },
      items: { type: 'array', description: 'Tree data items' },
    },
  },
  {
    type: 'BarList',
    description: 'Bar chart list with optional toggle markers.',
    propsSchema: {
      label: { type: 'string', description: 'Step label', required: true },
      items: { type: 'array', description: 'Data items with label and value' },
      toggleable: { type: 'boolean', description: 'Allow marking items', default: false },
    },
  },
  {
    type: 'Summary',
    description: 'Summary confirmation step showing collected data.',
    propsSchema: {
      label: { type: 'string', description: 'Step label', default: 'Confirm' },
    },
  },
  {
    type: 'ReviewPanel',
    description: 'Item-by-item review panel with per-item actions.',
    propsSchema: {
      title: { type: 'string', description: 'Panel title', required: true },
      items: { type: 'array', description: 'Review items', required: true },
      actions: { type: 'array', description: 'Per-item actions', required: true },
    },
  },
  {
    type: 'MetricDashboard',
    description: 'Metrics dashboard with cards and optional chart.',
    propsSchema: {
      metrics: { type: 'array', description: 'Metric cards', required: true },
      chart: { type: 'object', description: 'Optional chart configuration' },
    },
  },
  {
    type: 'InfoCard',
    description: 'Generic info card container. Children are rendered vertically inside the card.',
    hasChildren: true,
    propsSchema: {
      title: { type: 'string', description: 'Card title', required: true },
      badge: { type: 'string', description: 'Optional badge text shown as info pill' },
    },
  },
  {
    type: 'MiniOutline',
    description: 'Read-only indented outline / tree display. No interaction.',
    propsSchema: {
      items: { type: 'array', description: 'Tree items with { id, label/name, children? }', required: true },
      selected_id: { type: 'string', description: 'ID of the highlighted item' },
    },
  },
  {
    type: 'ActionRow',
    description: 'Row of action buttons inside a widget. Click sends a chat message.',
    propsSchema: {
      actions: { type: 'array', description: 'Action items with { label, prompt, primary?, skill_hint? }', required: true },
    },
  },
  {
    type: 'TextSection',
    description: 'Simple read-only text block inside a card.',
    propsSchema: {
      content: { type: 'string', description: 'Text content to display', required: true },
    },
  },
]

/** @deprecated Use `builtinCatalog` directly */
export const widgetCatalog = builtinCatalog

export function getWidgetCatalogPrompt(catalog?: WidgetCatalogEntry[]): string {
  return (catalog ?? builtinCatalog)
    .map(w => {
      const props = Object.entries(w.propsSchema)
        .map(([k, v]) => `    - ${k}: ${v.type}${v.required ? ' (required)' : ''} — ${v.description}`)
        .join('\n')
      return `- **${w.type}**: ${w.description}\n  Props:\n${props}`
    })
    .join('\n\n')
}
