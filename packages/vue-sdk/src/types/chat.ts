/**
 * Chat Types
 *
 * Content blocks, messages, message splitting, and display segment types.
 * Mirrors react-sdk/src/types.ts chat section for feature parity.
 */

import type { TokenUsage as CommonTokenUsage } from '@kedge-agentic/common'
import type { OutputUpdate } from './output-sync'

// Re-export OutputUpdate/UndoEntry from output-sync for convenience
export type { OutputUpdate, UndoEntry } from './output-sync'

// Re-export common TokenUsage under a distinct alias to avoid conflict with legacy agent-state TokenUsage.
// The legacy agent-state.TokenUsage has { input, output, total } while common has { inputTokens, outputTokens }.
// New composables should use CommonTokenUsage (from @kedge-agentic/common).
export type { TokenUsage as CommonTokenUsage } from '@kedge-agentic/common'

// ============================================================================
// Content Block Types
// ============================================================================

/**
 * Tool activity info for SSE-first composables.
 * Named ChatToolActivity to avoid conflict with legacy agent-state ToolActivity.
 */
export interface ChatToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'progress' | 'end'
  timestamp: Date
  duration?: number
  success?: boolean
  description?: string
  toolInput?: unknown
  toolOutput?: unknown
  toolError?: string
  agentType?: string
  nestingLevel?: number
  endTime?: number
  turnId?: string
}

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ToolBlock {
  type: 'tool'
  tool: ChatToolActivity
}

export type ContentBlock = TextBlock | ToolBlock

// ============================================================================
// Message Types
// ============================================================================

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  contentBlocks?: ContentBlock[]
  outputUpdates?: OutputUpdate[]
  tokenUsage?: CommonTokenUsage
  timestamp?: Date
  createdAt?: string
  isStreaming?: boolean
}

// ============================================================================
// Message Splitting Types
// ============================================================================

export type SegmentType = 'text' | 'tool' | 'tool-group'

export interface DisplaySegment {
  /** Unique ID: ${messageId}-seg-${index} */
  id: string
  type: SegmentType
  blocks: ContentBlock[]
  isStreaming: boolean
}

export interface SplitMessage {
  messageId: string
  role: 'user' | 'assistant' | 'system'
  segments: DisplaySegment[]
  tokenUsage?: CommonTokenUsage
  timestamp?: Date
  original: Message
}

// ============================================================================
// Color Scheme Types (for Chat UI components)
// ============================================================================

export type ColorScheme = 'blue' | 'primary' | 'indigo' | 'emerald' | 'violet'

export interface ColorClasses {
  bg: string
  text: string
  ring: string
  hover: string
  lightBg: string
}

export const COLOR_MAP: Record<ColorScheme, ColorClasses> = {
  blue:    { bg: 'bg-blue-500',    text: 'text-blue-600',    ring: 'ring-blue-500',    hover: 'hover:bg-blue-600',    lightBg: 'bg-blue-100' },
  primary: { bg: 'bg-primary-500', text: 'text-primary-600', ring: 'ring-primary-500', hover: 'hover:bg-primary-600', lightBg: 'bg-primary-100' },
  indigo:  { bg: 'bg-indigo-500',  text: 'text-indigo-600',  ring: 'ring-indigo-500',  hover: 'hover:bg-indigo-600',  lightBg: 'bg-indigo-100' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-500', hover: 'hover:bg-emerald-600', lightBg: 'bg-emerald-100' },
  violet:  { bg: 'bg-violet-500',  text: 'text-violet-600',  ring: 'ring-violet-500',  hover: 'hover:bg-violet-600',  lightBg: 'bg-violet-100' },
}
