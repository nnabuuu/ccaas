/**
 * Course Reflection Store (教学反思)
 *
 * Manages course reflection state. Maps to CourseReflectionController.
 *
 * Mutation Patterns:
 * - fetchXxx: pessimistic (wait for server)
 * - updateField: optimistic (local first, then sync)
 * - saveXxx: hybrid (pending state, then update)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { courseReflectionApi } from '../../api'
import type { CourseReflection } from '@/types'

interface CourseReflectionSaveData {
  id?: number
  scheduleId?: number
  content?: string
  strengths?: string
  weaknesses?: string
  improvements?: string
}

export const useCourseReflectionStore = defineStore('courseReflection', () => {
  // === State ===
  const reflection = ref<CourseReflection | null>(null)
  const reflections = ref<CourseReflection[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // === Computed ===
  const isEmpty = computed(() => reflections.value.length === 0)

  // === Actions ===

  /**
   * Fetch reflection by schedule ID
   * @pattern pessimistic
   */
  async function fetchByScheduleId(scheduleId: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await courseReflectionApi.getByScheduleId(scheduleId)
      reflection.value = response.data
    } catch (err) {
      console.error('[CourseReflectionStore] fetchByScheduleId failed:', err)
      error.value = '加载教学反思失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create or update reflection
   * @pattern hybrid
   */
  async function save(data: CourseReflectionSaveData): Promise<void> {
    saving.value = true
    error.value = null
    try {
      if (data.id) {
        await courseReflectionApi.update(data as CourseReflectionSaveData & { id: number })
      } else {
        const response = await courseReflectionApi.create(data)
        reflection.value = response.data
      }
    } catch (err) {
      console.error('[CourseReflectionStore] save failed:', err)
      error.value = '保存教学反思失败'
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Trigger AI generation for reflection
   * @pattern hybrid
   */
  async function triggerAiGeneration(scheduleId: number): Promise<void> {
    saving.value = true
    error.value = null
    try {
      const response = await courseReflectionApi.triggerAiGeneration(scheduleId)
      reflection.value = response.data
    } catch (err) {
      console.error('[CourseReflectionStore] triggerAiGeneration failed:', err)
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
    reflection.value = null
    reflections.value = []
    loading.value = false
    saving.value = false
    error.value = null
  }

  return {
    // State
    reflection,
    reflections,
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
