export interface JsonRenderSpec {
  root: string
  elements: Record<string, JsonRenderElement>
  mcp_sources?: McpSourceDeclaration[]
}

export interface JsonRenderElement {
  type: string
  props: Record<string, unknown>
  children?: string[]
}

export interface McpSourceDeclaration {
  ref: string
  tool: string
  params: Record<string, unknown>
}

export interface WidgetComponentProps<T = Record<string, unknown>> {
  props: T
  children?: React.ReactNode
  widgetState: Record<string, unknown>
  onStateChange: (key: string, value: unknown) => void
  onSubmit?: (params: Record<string, unknown>) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WidgetComponent = React.ComponentType<WidgetComponentProps<any>>

export type WidgetRegistry = Record<string, WidgetComponent>

export type BlockRenderer = (block: { type: string; data: Record<string, unknown> }) => React.ReactNode | null

export type BlockRendererMap = Record<string, BlockRenderer>

export type ToolRenderer = (tool: import('./chat').ToolUseBlock) => React.ReactNode | null

export type ToolRendererMap = Record<string, ToolRenderer>
