/**
 * School Store
 *
 * Manages school selection and list for the current user session.
 *
 * State:
 * - schools: Array of available schools
 * - currentSchoolId: Selected school ID
 * - loading: Fetch in progress
 * - error: Error message if any
 *
 * Actions:
 * - fetchSchools(): Load schools from API
 * - selectSchool(id): Set current school
 * - clearSelection(): Reset selection
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { schoolApi } from '../../api/index'
import type { School } from '@/types'

export const useSchoolStore = defineStore('school', () => {
  // State
  const schools = ref<School[]>([])
  const currentSchoolId = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const currentSchool = computed((): School | null => {
    if (!currentSchoolId.value) return null
    return schools.value.find(s => s.id === currentSchoolId.value) || null
  })

  const currentSchoolName = computed(() => {
    return currentSchool.value?.schoolName || '未选择学校'
  })

  const hasSchools = computed(() => schools.value.length > 0)

  // Actions
  async function fetchSchools(): Promise<void> {
    if (loading.value) return

    loading.value = true
    error.value = null

    try {
      const response = await schoolApi.getList()
      schools.value = response.rows || []

      // Auto-select first school if none selected and schools available
      if (!currentSchoolId.value && schools.value.length > 0) {
        // Try to restore from localStorage first
        const savedSchoolId = localStorage.getItem('selectedSchoolId')
        if (savedSchoolId) {
          const savedId = parseInt(savedSchoolId, 10)
          if (schools.value.some(s => s.id === savedId)) {
            currentSchoolId.value = savedId
          } else {
            currentSchoolId.value = schools.value[0].id!
          }
        } else {
          currentSchoolId.value = schools.value[0].id!
        }
      }
    } catch (err) {
      console.error('Failed to fetch schools:', err)
      error.value = (err as Error).message || '获取学校列表失败'
    } finally {
      loading.value = false
    }
  }

  function selectSchool(schoolId: number): void {
    currentSchoolId.value = schoolId
    // Persist selection
    localStorage.setItem('selectedSchoolId', String(schoolId))
  }

  function clearSelection(): void {
    currentSchoolId.value = null
    localStorage.removeItem('selectedSchoolId')
  }

  // Initialize from localStorage on store creation
  const savedSchoolId = localStorage.getItem('selectedSchoolId')
  if (savedSchoolId) {
    currentSchoolId.value = parseInt(savedSchoolId, 10)
  }

  return {
    // State
    schools,
    currentSchoolId,
    loading,
    error,
    // Getters
    currentSchool,
    currentSchoolName,
    hasSchools,
    // Actions
    fetchSchools,
    selectSchool,
    clearSelection
  }
})
