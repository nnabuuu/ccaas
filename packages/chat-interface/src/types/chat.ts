import type { JsonRenderSpec } from './widget'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  timestamp: string
  content: ContentBlock[]
  activeSkill?: string
  nextActions?: NextAction[]
}

/**
 * Custom block type for solution-specific content.
 * Solutions inject custom block renderers via ChatInterfaceProvider.
 * Use `data` for the payload instead of spreading on the block itself.
 */
export interface CustomBlock {
  type: string
  data: Record<string, unknown>
}

/**
 * Content block union (discriminated on `type`).
 * Custom blocks are routed via the `default` switch case at runtime.
 * Solutions cast custom blocks: `myBlock as unknown as ContentBlock`.
 */
export type ContentBlock =
  | TextBlock
  | WidgetBlock
  | FileBlock
  | McpResultBlock

export interface TextBlock {
  type: 'text'
  content: string
}

export interface WidgetBlock {
  type: 'widget'
  spec: JsonRenderSpec
}

export interface FileBlock {
  type: 'file'
  fileName: string
  fileType: string
  downloadUrl: string
  description?: string
}

export interface McpResultBlock {
  type: 'mcp_result'
  toolName: string
  result: unknown
  visible: boolean
}

export interface NextAction {
  label: string
  prompt: string
  skillHint?: string
}

export interface QuickSuggestion {
  label: string
  prompt: string
  category: string
  score: number
}

export interface EngineSubmission {
  sourceWidgetType: string
  targetSkill: string
  params: Record<string, unknown>
  context: Record<string, unknown>
}
