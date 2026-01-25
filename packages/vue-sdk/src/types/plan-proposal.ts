/**
 * Plan Proposal Types
 *
 * Type definitions for plan mode proposal handling.
 */

/**
 * Plan proposal section
 */
export interface PlanProposalSection {
  /** Section identifier */
  id: string
  /** Human-readable section name */
  name: string
  /** Description of what will be generated */
  description?: string
  /** Whether section is currently empty */
  isEmpty?: boolean
  /** Estimated time/tokens for this section */
  estimate?: {
    tokensEstimate?: number
    timeEstimate?: string
  }
}

/**
 * Plan proposal context
 */
export interface PlanProposalContext {
  /** Current page route */
  route?: string
  /** Entity being edited */
  entityId?: string
  /** Entity type */
  entityType?: string
  /** Additional context data */
  data?: Record<string, unknown>
}

/**
 * Plan proposal from agent
 */
export interface PlanProposal {
  /** Unique trace ID for this proposal */
  traceId: string
  /** Sections planned for generation */
  sections: PlanProposalSection[]
  /** Context information */
  context?: PlanProposalContext
  /** Timestamp when proposal was created */
  timestamp?: string
  /** Optional summary message */
  summary?: string
  /** Estimated total cost */
  estimate?: {
    tokensEstimate?: number
    costEstimate?: number
    timeEstimate?: string
  }
}

/**
 * Plan confirmation event sent to backend
 */
export interface PlanConfirmation {
  traceId: string
  sections: string[]
}

/**
 * Plan rejection event sent to backend
 */
export interface PlanRejection {
  traceId: string
  reason?: string
}

/**
 * Plan mode state
 */
export interface PlanModeState {
  /** Currently pending proposal */
  pendingProposal: PlanProposal | null
  /** Whether there's a pending proposal */
  hasPendingProposal: boolean
  /** Sections that have been confirmed */
  confirmedSections: string[]
  /** Whether plan has been confirmed */
  isConfirmed: boolean
}
