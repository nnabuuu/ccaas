import { describe, it, expect } from 'vitest'
import { mergeRegistries, mergeCatalogs } from '../merge'
import { builtinRegistry } from '../registry'
import { builtinCatalog } from '../catalog'
import type { WidgetComponentProps } from '@/types/widget'

// Minimal stub component for testing
const FakeWidget = ((_props: WidgetComponentProps) => null) as React.ComponentType<WidgetComponentProps>

describe('mergeRegistries', () => {
  it('returns builtin registry when no custom provided', () => {
    expect(mergeRegistries()).toBe(builtinRegistry)
    expect(mergeRegistries(undefined)).toBe(builtinRegistry)
    expect(mergeRegistries({})).toBe(builtinRegistry)
  })

  it('merges custom widgets into builtin registry', () => {
    const custom = { MyWidget: FakeWidget }
    const result = mergeRegistries(custom)
    expect(result.MyWidget).toBe(FakeWidget)
    expect(result.StepWizard).toBeDefined()
    expect(result.FormCollect).toBeDefined()
  })

  it('custom widgets override builtin with same name', () => {
    const custom = { StepWizard: FakeWidget }
    const result = mergeRegistries(custom)
    expect(result.StepWizard).toBe(FakeWidget)
  })

  it('does not mutate builtin registry', () => {
    const originalKeys = Object.keys(builtinRegistry)
    mergeRegistries({ Extra: FakeWidget })
    expect(Object.keys(builtinRegistry)).toEqual(originalKeys)
  })
})

describe('mergeCatalogs', () => {
  it('returns builtin catalog when no custom provided', () => {
    expect(mergeCatalogs()).toBe(builtinCatalog)
    expect(mergeCatalogs(undefined)).toBe(builtinCatalog)
    expect(mergeCatalogs([])).toBe(builtinCatalog)
  })

  it('appends custom catalog entries', () => {
    const custom = [
      { type: 'QuizCard', description: 'Quiz result', propsSchema: {} },
    ]
    const result = mergeCatalogs(custom)
    expect(result.length).toBe(builtinCatalog.length + 1)
    expect(result.find(e => e.type === 'QuizCard')).toBeDefined()
  })

  it('custom entries override builtin with same type', () => {
    const custom = [
      { type: 'Summary', description: 'Custom summary', propsSchema: {} },
    ]
    const result = mergeCatalogs(custom)
    const summary = result.find(e => e.type === 'Summary')
    expect(summary?.description).toBe('Custom summary')
    // Should not duplicate — count stays the same
    expect(result.filter(e => e.type === 'Summary').length).toBe(1)
  })

  it('preserves order: builtin first, then custom', () => {
    const custom = [
      { type: 'ZWidget', description: 'Z', propsSchema: {} },
    ]
    const result = mergeCatalogs(custom)
    const lastEntry = result[result.length - 1]
    expect(lastEntry.type).toBe('ZWidget')
  })
})
