/**
 * Teaching Evaluation Store (授课评价)
 *
 * Manages teaching evaluation state. Maps to TeachingEvaluationController.
 *
 * Mutation Patterns:
 * - fetchXxx: pessimistic (wait for server)
 * - saveXxx: hybrid (pending state, then update)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { teachingEvaluationApi } from '../../api'
import type { TeachingEvaluation } from '@/types'

interface TeachingEvaluationSaveData {
  id?: number
  scheduleId?: number
  score?: number
  content?: string
}

export const useTeachingEvaluationStore = defineStore('teachingEvaluation', () => {
  // === State ===
  const evaluation = ref<TeachingEvaluation | null>(null)
  const evaluations = ref<TeachingEvaluation[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // === Computed ===
  const isEmpty = computed(() => evaluations.value.length === 0)

  // === Actions ===

  /**
   * Fetch evaluation by schedule ID
   * @pattern pessimistic
   */
  async function fetchByScheduleId(scheduleId: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await teachingEvaluationApi.getByScheduleId(scheduleId)
      evaluation.value = response.data
    } catch (err) {
      console.error('[TeachingEvaluationStore] fetchByScheduleId failed:', err)
      error.value = '加载授课评价失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create or update evaluation
   * @pattern hybrid
   */
  async function save(data: TeachingEvaluationSaveData): Promise<void> {
    saving.value = true
    error.value = null
    try {
      if (data.id) {
        await teachingEvaluationApi.update(data as TeachingEvaluationSaveData & { id: number })
      } else {
        const response = await teachingEvaluationApi.create(data)
        evaluation.value = response.data
      }
    } catch (err) {
      console.error('[TeachingEvaluationStore] save failed:', err)
      error.value = '保存授课评价失败'
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Trigger AI generation
   * @pattern hybrid
   */
  async function triggerAiGeneration(scheduleId: number): Promise<void> {
    saving.value = true
    error.value = null
    try {
      const response = await teachingEvaluationApi.triggerAiGeneration(scheduleId)
      evaluation.value = response.data
    } catch (err) {
      console.error('[TeachingEvaluationStore] triggerAiGeneration failed:', err)
      error.value = 'AI生成失败'
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Reset store state
   */
  function reset(): void {
    evaluation.value = null
    evaluations.value = []
    loading.value = false
    saving.value = false
    error.value = null
  }

  return {
    // State
    evaluation,
    evaluations,
    loading,
    saving,
    error,
    // Computed
    isEmpty,
    // Actions
    fetchByScheduleId,
    save,
    triggerAiGeneration,
    reset
  }
})
