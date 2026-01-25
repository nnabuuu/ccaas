/**
 * Entity Bridge Types
 *
 * Type definitions for the useEntityBridge composable.
 */

import type { Ref, ComputedRef } from 'vue'
import type { UseAgentChatReturn } from '../composables/useAgentChat'

/**
 * Section state for AI editing
 */
export type SectionStatus = 'idle' | 'pending' | 'streaming' | 'completed' | 'error'

/**
 * State of a single section during AI editing
 */
export interface SectionState {
  /** Current status of the section */
  status: SectionStatus
  /** Error message if status is 'error' */
  error?: string
  /** Timestamp when last updated */
  lastUpdatedAt?: Date
}

/**
 * Output update event from backend
 */
export interface EntityOutputUpdateEvent {
  /** Backend field name */
  field: string
  /** Content for the field */
  content?: unknown
  /** Full data object (alternative to content) */
  data?: unknown
  /** Whether this is the final update for this field */
  isFinal?: boolean
  /** Metadata about the update */
  metadata?: Record<string, unknown>
}

/**
 * Configuration for useEntityBridge composable
 */
export interface EntityBridgeConfig {
  /**
   * Optional: inject custom chat instance for testing.
   * If not provided, useAgentChat() is called internally.
   */
  chat?: UseAgentChatReturn

  /**
   * Section IDs for AI editing state tracking.
   * These match the sections in your entity (e.g., lesson plan sections).
   */
  sections: string[]

  /**
   * Map backend field names to frontend section IDs.
   * Key: backend field name (from output_update event)
   * Value: frontend section ID (from sections array)
   *
   * @example
   * ```ts
   * {
   *   textbook_analysis: 'textbookAnalysis',
   *   student_analysis: 'studentAnalysis',
   *   learning_objectives: 'learningObjectives',
   * }
   * ```
   *
   * NOTE: Flat mapping only. Nested paths (a.b.c) are NOT supported in v1.
   */
  fieldMapping: Record<string, string>

  /**
   * Called when AI updates a section.
   * @param sectionId - The frontend section ID
   * @param content - The new content
   */
  updateSection: (sectionId: string, content: unknown) => void

  /**
   * Called when user saves all changes.
   * Should persist to backend and throw on failure.
   */
  saveToBackend: () => Promise<void>

  /**
   * Optional: called when AI editing starts
   */
  onStart?: () => void

  /**
   * Optional: called when AI editing completes
   */
  onComplete?: () => void

  /**
   * Optional: called when an error occurs
   */
  onError?: (error: Error) => void

  /**
   * Enable debug logging (default: false)
   */
  debug?: boolean
}

/**
 * Return type for useEntityBridge composable
 */
export interface UseEntityBridgeReturn {
  /**
   * The underlying chat composable instance.
   * Exposed for advanced usage (sending messages, checking connection).
   */
  chat: UseAgentChatReturn

  /**
   * Whether AI editing mode is currently active
   */
  aiEditingMode: Readonly<Ref<boolean>>

  /**
   * Current section being edited by AI
   */
  currentSection: Readonly<Ref<string | null>>

  /**
   * State of each section (status, error, etc.)
   */
  sectionStates: Readonly<Ref<Record<string, SectionState>>>

  /**
   * Progress percentage (0-100)
   */
  progress: ComputedRef<number>

  /**
   * Whether there are unsaved changes
   */
  isDirty: Readonly<Ref<boolean>>

  /**
   * Whether save is in progress
   */
  isSaving: Readonly<Ref<boolean>>

  /**
   * Start AI editing mode
   */
  startAIEditing: () => void

  /**
   * Stop AI editing mode
   */
  stopAIEditing: () => void

  /**
   * Handle an output_update event (called automatically if auto-subscribed)
   */
  handleOutputUpdate: (event: EntityOutputUpdateEvent) => void

  /**
   * Save all changes to backend
   */
  saveAll: () => Promise<void>

  /**
   * Discard all changes and exit AI editing mode
   */
  discardAll: () => void

  /**
   * Check if a section is currently being edited
   */
  isSectionEditing: (sectionId: string) => boolean

  /**
   * Check if a section has been completed
   */
  isSectionCompleted: (sectionId: string) => boolean

  /**
   * Reset all state
   */
  reset: () => void
}
