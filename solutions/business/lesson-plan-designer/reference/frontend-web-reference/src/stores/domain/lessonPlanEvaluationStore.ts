/**
 * Lesson Plan Evaluation Store (教案评价)
 *
 * Manages lesson plan evaluation state. Maps to LessonPlanEvaluationController.
 *
 * Mutation Patterns:
 * - fetchXxx: pessimistic (wait for server)
 * - saveXxx: hybrid (pending state, then update)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { lessonPlanEvaluationApi } from '../../api'
import type { LessonPlanEvaluation } from '@/types'

interface LessonPlanEvaluationSaveData {
  id?: number
  scheduleId?: number
  lessonPlanId?: number
  score?: number
  content?: string
}

export const useLessonPlanEvaluationStore = defineStore('lessonPlanEvaluation', () => {
  // === State ===
  const evaluation = ref<LessonPlanEvaluation | null>(null)
  const evaluations = ref<LessonPlanEvaluation[]>([])
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
      const response = await lessonPlanEvaluationApi.getByScheduleId(scheduleId)
      evaluation.value = response.data
    } catch (err) {
      console.error('[LessonPlanEvaluationStore] fetchByScheduleId failed:', err)
      error.value = '加载教案评价失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create or update evaluation
   * @pattern hybrid
   */
  async function save(data: LessonPlanEvaluationSaveData): Promise<void> {
    saving.value = true
    error.value = null
    try {
      if (data.id) {
        await lessonPlanEvaluationApi.update(data as LessonPlanEvaluationSaveData & { id: number })
      } else {
        const response = await lessonPlanEvaluationApi.create(data)
        evaluation.value = response.data
      }
    } catch (err) {
      console.error('[LessonPlanEvaluationStore] save failed:', err)
      error.value = '保存教案评价失败'
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Trigger AI generation
   * @pattern hybrid
   */
  async function triggerAiGeneration(scheduleId: number, lessonPlanId: number): Promise<void> {
    saving.value = true
    error.value = null
    try {
      const response = await lessonPlanEvaluationApi.triggerAiGeneration(scheduleId, lessonPlanId)
      evaluation.value = response.data
    } catch (err) {
      console.error('[LessonPlanEvaluationStore] triggerAiGeneration failed:', err)
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
