import type { WidgetComponent, WidgetRegistry } from '@/types/widget'
import { StepWizard } from './components/StepWizard'
import { FormCollect } from './components/FormCollect'
import { TreeSelector } from './components/TreeSelector'
import { BarList } from './components/BarList'
import { ReviewPanel } from './components/ReviewPanel'
import { MetricDashboard } from './components/MetricDashboard'
import { Summary } from './components/Summary'

export const builtinRegistry: WidgetRegistry = {
  StepWizard,
  FormCollect,
  TreeSelector,
  BarList,
  ReviewPanel,
  MetricDashboard,
  Summary,
}

/** @deprecated Use `builtinRegistry` directly or get from ChatInterfaceContext */
export function getWidgetComponent(type: string): WidgetComponent | undefined {
  return builtinRegistry[type]
}

export function getRegisteredWidgetTypes(): string[] {
  return Object.keys(builtinRegistry)
}
