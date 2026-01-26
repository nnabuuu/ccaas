/**
 * Lesson Plan Store
 *
 * Pinia store for lesson plan state management.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { LessonPlan } from '@ccaas/shared'
import * as api from '@/api/lessonPlans'

export const useLessonPlanStore = defineStore('lessonPlan', () => {
  // State
  const lessonPlans = ref<LessonPlan[]>([])
  const currentPlan = ref<LessonPlan | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const draftPlans = computed(() =>
    lessonPlans.value.filter((p) => p.status === 'draft')
  )

  const publishedPlans = computed(() =>
    lessonPlans.value.filter((p) => p.status === 'published')
  )

  const subjects = computed(() => {
    const set = new Set(lessonPlans.value.map((p) => p.subject).filter(Boolean))
    return Array.from(set).sort()
  })

  const gradeLevels = computed(() => {
    const set = new Set(
      lessonPlans.value.map((p) => p.gradeLevel).filter(Boolean)
    )
    return Array.from(set).sort()
  })

  // Actions
  async function fetchLessonPlans(params?: {
    status?: string
    subject?: string
    gradeLevel?: string
  }) {
    loading.value = true
    error.value = null
    try {
      lessonPlans.value = await api.getLessonPlans(params)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch plans'
    } finally {
      loading.value = false
    }
  }

  async function fetchLessonPlan(id: string) {
    loading.value = true
    error.value = null
    try {
      currentPlan.value = await api.getLessonPlan(id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch plan'
    } finally {
      loading.value = false
    }
  }

  async function createLessonPlan(data: Partial<LessonPlan>) {
    loading.value = true
    error.value = null
    try {
      const newPlan = await api.createLessonPlan(data)
      lessonPlans.value.unshift(newPlan)
      currentPlan.value = newPlan
      return newPlan
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create plan'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateLessonPlan(id: string, data: Partial<LessonPlan>) {
    loading.value = true
    error.value = null
    try {
      const updated = await api.updateLessonPlan(id, data)
      const index = lessonPlans.value.findIndex((p) => p.id === id)
      if (index !== -1) {
        lessonPlans.value[index] = updated
      }
      if (currentPlan.value?.id === id) {
        currentPlan.value = updated
      }
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update plan'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteLessonPlan(id: string) {
    loading.value = true
    error.value = null
    try {
      await api.deleteLessonPlan(id)
      lessonPlans.value = lessonPlans.value.filter((p) => p.id !== id)
      if (currentPlan.value?.id === id) {
        currentPlan.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete plan'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function duplicateLessonPlan(id: string) {
    loading.value = true
    error.value = null
    try {
      const duplicated = await api.duplicateLessonPlan(id)
      lessonPlans.value.unshift(duplicated)
      return duplicated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to duplicate plan'
      throw e
    } finally {
      loading.value = false
    }
  }

  function setCurrentPlan(plan: LessonPlan | null) {
    currentPlan.value = plan
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    lessonPlans,
    currentPlan,
    loading,
    error,

    // Getters
    draftPlans,
    publishedPlans,
    subjects,
    gradeLevels,

    // Actions
    fetchLessonPlans,
    fetchLessonPlan,
    createLessonPlan,
    updateLessonPlan,
    deleteLessonPlan,
    duplicateLessonPlan,
    setCurrentPlan,
    clearError,
  }
})
