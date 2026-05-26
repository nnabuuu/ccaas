/**
 * Output Sync Types
 *
 * Types for generic output synchronization, skills management, and API client.
 */

import type { Ref, ComputedRef } from 'vue'
import type { Skill } from '@kedge-agentic/common'

// ============================================================================
// Output Update Types
// ============================================================================

export interface OutputUpdate {
  field: string
  value: unknown
  preview: string
  /** Optional page routing key. When set, useOutputSync groups this update under the given page. */
  page?: string
  synced?: boolean
  syncedAt?: Date
  timestamp?: number
}

export interface UndoEntry {
  field: string
  previousValue: unknown
  timestamp: number
}

// ============================================================================
// useOutputSync Types
// ============================================================================

export interface UseOutputSyncOptions {
  /** 'manual': user clicks sync button. 'auto': sync on receive. */
  mode: 'manual' | 'auto'
  /** Solution-provided field normalization function */
  normalizeField?: (field: string, value: unknown) => unknown
  /** Undo timeout in milliseconds. Defaults to 30000. */
  undoTimeout?: number
}

export interface UseOutputSyncReturn<T extends Record<string, unknown>> {
  pendingUpdates: Ref<Map<string, OutputUpdate>>
  /** Updates grouped by page key. Updates without a page are under '__default__'. */
  pendingUpdatesByPage: Ref<Map<string, Map<string, OutputUpdate>>>
  /** Returns pending updates for a specific page (or '__default__' when page is undefined). */
  getPendingUpdatesForPage: (page?: string) => Map<string, OutputUpdate>
  modifiedFields: Ref<Set<string>>
  handleOutputUpdate: (update: OutputUpdate) => void
  syncToForm: (field: string, formData: Ref<T>) => void
  syncAllToForm: (formData: Ref<T>) => void
  discardUpdate: (field: string) => void
  undoSync: (field: string, formData: Ref<T>) => void
  canUndo: (field: string) => boolean
  reset: () => void
}

// ============================================================================
// useSkills Types
// ============================================================================

export interface UseSkillsOptions {
  serverUrl?: string
  solutionId: string
}

export interface UseSkillsReturn {
  skills: Ref<Skill[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  searchQuery: Ref<string>
  filteredSkills: ComputedRef<Skill[]>
  toggleSkill: (skillId: string) => Promise<void>
  enabledSkillIds: ComputedRef<Set<string>>
  isSkillEnabled: (skillId: string) => boolean
  refresh: () => Promise<void>
}

// ============================================================================
// API Client Types
// ============================================================================

export interface ApiClientOptions {
  baseUrl?: string
  solutionId: string
}

export interface CompletionParams {
  clientId: string
  message: string
  solutionId: string
  mcpServers?: Record<string, McpServerConfig>
  skillPath?: string | null
  enabledSkills?: string[]
  attachments?: { type: string; path: string }[]
}

export interface McpServerConfig {
  command: string
  args: string[]
  description?: string
}

export interface SolutionConfig {
  mcpServers?: Record<string, McpServerConfig>
  skillPath?: string | null
  skillSlug?: string | null
}
