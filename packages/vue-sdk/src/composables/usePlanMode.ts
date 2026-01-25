/**
 * usePlanMode Composable
 *
 * Provides plan proposal handling for human-in-the-loop workflows.
 * Allows user to confirm or reject AI-generated plans before execution.
 */

import { inject, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import {
  PendingPlanProposalKey,
  ConfirmPlanProposalKey,
  RejectPlanProposalKey,
} from '../symbols'
import type { PlanProposal, PlanProposalSection } from '../types/plan-proposal'

/**
 * Return type for usePlanMode
 */
export interface UsePlanModeReturn {
  /** Currently pending proposal */
  pendingProposal: Readonly<Ref<PlanProposal | null>> | null
  /** Whether there's a pending proposal */
  hasPendingProposal: ComputedRef<boolean>
  /** Sections planned for generation */
  plannedSections: ComputedRef<PlanProposalSection[]>
  /** Confirm the pending proposal */
  confirm: () => void
  /** Reject the pending proposal */
  reject: () => void
}

/**
 * Plan mode composable
 *
 * @example
 * ```vue
 * <script setup>
 * import { usePlanMode } from '@ccaas/vue-sdk'
 *
 * const {
 *   pendingProposal,
 *   hasPendingProposal,
 *   plannedSections,
 *   confirm,
 *   reject
 * } = usePlanMode()
 * </script>
 *
 * <template>
 *   <div v-if="hasPendingProposal">
 *     <h3>Plan Proposal</h3>
 *     <ul>
 *       <li v-for="section in plannedSections" :key="section.id">
 *         {{ section.name }}
 *       </li>
 *     </ul>
 *     <button @click="confirm">Confirm</button>
 *     <button @click="reject">Reject</button>
 *   </div>
 * </template>
 * ```
 */
export function usePlanMode(): UsePlanModeReturn {
  // Inject values from AgentListener
  const pendingProposal = inject(PendingPlanProposalKey, null)
  const confirmPlanProposal = inject(ConfirmPlanProposalKey, null)
  const rejectPlanProposal = inject(RejectPlanProposalKey, null)

  // Computed values
  const hasPendingProposal = computed(() => {
    return pendingProposal?.value !== null && pendingProposal?.value !== undefined
  })

  const plannedSections = computed<PlanProposalSection[]>(() => {
    return pendingProposal?.value?.sections || []
  })

  /**
   * Confirm the pending proposal
   */
  function confirm(): void {
    if (!confirmPlanProposal) {
      console.warn(
        '[usePlanMode] confirmPlanProposal not provided. ' +
        'Make sure AgentListener is mounted as a parent component.'
      )
      return
    }

    if (!pendingProposal?.value) {
      console.warn('[usePlanMode] No pending proposal to confirm')
      return
    }

    confirmPlanProposal()
  }

  /**
   * Reject the pending proposal
   */
  function reject(): void {
    if (!rejectPlanProposal) {
      console.warn(
        '[usePlanMode] rejectPlanProposal not provided. ' +
        'Make sure AgentListener is mounted as a parent component.'
      )
      return
    }

    if (!pendingProposal?.value) {
      console.warn('[usePlanMode] No pending proposal to reject')
      return
    }

    rejectPlanProposal()
  }

  return {
    pendingProposal,
    hasPendingProposal,
    plannedSections,
    confirm,
    reject,
  }
}

export default usePlanMode
