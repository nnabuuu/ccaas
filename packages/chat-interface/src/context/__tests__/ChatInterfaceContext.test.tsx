import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  ChatInterfaceProvider,
  useChatInterfaceContext,
} from '../ChatInterfaceContext'
import { builtinRegistry } from '@/widgets/registry'
import { builtinCatalog } from '@/widgets/catalog'
import type { WidgetComponentProps } from '@/types/widget'

const FakeWidget = ((_props: WidgetComponentProps) => null) as React.ComponentType<WidgetComponentProps>

function DefaultWrapper({ children }: { children: React.ReactNode }) {
  return <ChatInterfaceProvider>{children}</ChatInterfaceProvider>
}

describe('ChatInterfaceContext', () => {
  it('throws when used outside provider', () => {
    // Suppress React error boundary console noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      renderHook(() => useChatInterfaceContext())
    }).toThrow('useChatInterfaceContext must be used within a ChatInterfaceProvider')
    spy.mockRestore()
  })

  it('provides builtin registry and catalog by default', () => {
    const { result } = renderHook(() => useChatInterfaceContext(), { wrapper: DefaultWrapper })
    expect(result.current.widgetRegistry).toEqual(builtinRegistry)
    expect(result.current.widgetCatalog).toBe(builtinCatalog)
    expect(result.current.blockRenderers).toEqual({})
    expect(result.current.mcpBridge).toBeNull()
  })

  it('merges custom widgets into registry', () => {
    const W = ({ children }: { children: React.ReactNode }) => (
      <ChatInterfaceProvider customWidgets={{ TestWidget: FakeWidget }}>
        {children}
      </ChatInterfaceProvider>
    )
    const { result } = renderHook(() => useChatInterfaceContext(), { wrapper: W })
    expect(result.current.widgetRegistry.TestWidget).toBe(FakeWidget)
    expect(result.current.widgetRegistry.StepWizard).toBeDefined()
  })

  it('merges custom catalog entries', () => {
    const customCatalog = [
      { type: 'QuizCard', description: 'Quiz result', propsSchema: {} },
    ]
    const W = ({ children }: { children: React.ReactNode }) => (
      <ChatInterfaceProvider customCatalog={customCatalog}>
        {children}
      </ChatInterfaceProvider>
    )
    const { result } = renderHook(() => useChatInterfaceContext(), { wrapper: W })
    expect(result.current.widgetCatalog.find(e => e.type === 'QuizCard')).toBeDefined()
    expect(result.current.widgetCatalog.length).toBe(builtinCatalog.length + 1)
  })

  it('passes through custom block renderers', () => {
    const renderer = () => null
    const W = ({ children }: { children: React.ReactNode }) => (
      <ChatInterfaceProvider customBlockRenderers={{ quiz_result: renderer }}>
        {children}
      </ChatInterfaceProvider>
    )
    const { result } = renderHook(() => useChatInterfaceContext(), { wrapper: W })
    expect(result.current.blockRenderers.quiz_result).toBe(renderer)
  })

  it('passes through MCP bridge', () => {
    const bridge = { callMcp: async () => ({}) }
    const W = ({ children }: { children: React.ReactNode }) => (
      <ChatInterfaceProvider mcpBridge={bridge}>
        {children}
      </ChatInterfaceProvider>
    )
    const { result } = renderHook(() => useChatInterfaceContext(), { wrapper: W })
    expect(result.current.mcpBridge).toBe(bridge)
  })
})
