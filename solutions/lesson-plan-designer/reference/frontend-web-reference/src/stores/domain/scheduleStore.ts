/**
 * Schedule Store
 *
 * Manages schedule (课程安排) state. Maps to ScheduleController.
 *
 * State:
 * - schedule: Current schedule object
 * - schedules: List of schedules
 * - loading/saving: Operation states
 * - error: Error message
 *
 * Mutation Patterns:
 * - fetchXxx: pessimistic (wait for server)
 * - updateField: optimistic (local first, then sync)
 * - saveXxx: hybrid (pending state, then update)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { scheduleApi } from '../../api'
import type { Schedule, ScheduleCreateRequest, ScheduleUpdateRequest, ScheduleQuery } from '@/types'

interface ApiError {
  response?: {
    status?: number
    data?: {
      msg?: string
    }
  }
  message?: string
}

interface SnapshotData {
  id: number
  lessonPlanSnapshot: string
}

export const useScheduleStore = defineStore('schedule', () => {
  // === State ===
  const schedule = ref<Schedule | null>(null)
  const schedules = ref<Schedule[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)

  // === Computed ===
  const isEmpty = computed(() => schedules.value.length === 0)

  // === Actions ===

  /**
   * Fetch schedule list with pagination
   * @pattern pessimistic - Waits for server response before updating state
   * @param params - Query parameters
   */
  async function fetchList(params: ScheduleQuery = {}): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await scheduleApi.getList(params)
      schedules.value = response.rows || []
      total.value = response.total || 0
    } catch (err) {
      console.error('[ScheduleStore] fetchList failed:', err)
      error.value = '加载课程列表失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch schedule by ID
   * @pattern pessimistic - Waits for server response before updating state
   * @param id - Schedule ID
   */
  async function fetchById(id: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await scheduleApi.getById(id)
      schedule.value = response.data
    } catch (err) {
      console.error('[ScheduleStore] fetchById failed:', err)
      error.value = (err as ApiError).response?.status === 404
        ? '课程不存在'
        : '加载课程失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch full schedule with related data
   * @pattern pessimistic - Waits for server response before updating state
   * @param id - Schedule ID
   */
  async function fetchFullById(id: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await scheduleApi.getFullById(id)
      schedule.value = response.data as Schedule
    } catch (err) {
      console.error('[ScheduleStore] fetchFullById failed:', err)
      error.value = '加载课程详情失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch schedules by student ID
   * @pattern pessimistic - Waits for server response before updating state
   * @param studentId - Student ID
   */
  async function fetchByStudent(studentId: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await scheduleApi.getByStudent(studentId)
      schedules.value = response.data || []
    } catch (err) {
      console.error('[ScheduleStore] fetchByStudent failed:', err)
      error.value = '加载学生课程失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch schedules by lesson plan ID
   * @pattern pessimistic - Waits for server response before updating state
   * @param lessonPlanId - Lesson Plan ID
   */
  async function fetchByLessonPlan(lessonPlanId: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await scheduleApi.getByLessonPlan(lessonPlanId)
      schedules.value = response.data || []
    } catch (err) {
      console.error('[ScheduleStore] fetchByLessonPlan failed:', err)
      error.value = '加载教案课程失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create a new schedule
   * @pattern hybrid - Shows saving state, updates on success
   * @param data - Schedule data
   * @returns Created schedule
   */
  async function create(data: ScheduleCreateRequest): Promise<Schedule> {
    saving.value = true
    error.value = null
    try {
      const response = await scheduleApi.create(data)
      const created = (response.data || response) as Schedule
      schedule.value = created
      return created
    } catch (err) {
      console.error('[ScheduleStore] create failed:', err)
      error.value = '创建课程失败'
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Update schedule
   * @pattern hybrid - Shows saving state, updates on success
   * @param data - Schedule data with id
   */
  async function update(data: ScheduleUpdateRequest): Promise<void> {
    saving.value = true
    error.value = null
    try {
      await scheduleApi.update(data)
      // Refresh if it's the current schedule
      if (schedule.value?.id === data.id) {
        await fetchById(data.id)
      }
    } catch (err) {
      console.error('[ScheduleStore] update failed:', err)
      error.value = '更新课程失败'
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Update a single field (Tier 1 inline edit)
   * @pattern optimistic - Updates local state immediately, syncs to server
   * @param field - Field name
   * @param value - New value
   */
  async function updateField(field: string, value: unknown): Promise<void> {
    if (!schedule.value?.id) {
      throw new Error('No schedule loaded')
    }
    const previous = (schedule.value as Record<string, unknown>)[field]
    ;(schedule.value as Record<string, unknown>)[field] = value // Optimistic update
    try {
      await scheduleApi.update({
        id: schedule.value.id,
        [field]: value
      } as ScheduleUpdateRequest)
    } catch (err) {
      ;(schedule.value as Record<string, unknown>)[field] = previous // Rollback
      console.error(`[ScheduleStore] updateField ${field} failed:`, err)
      throw err
    }
  }

  /**
   * Delete schedule(s)
   * @pattern hybrid - Shows loading, removes from list on success
   * @param ids - Schedule ID(s) to delete
   */
  async function remove(ids: number | number[]): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await scheduleApi.delete(ids)
      // Remove from local list
      const idsArray = Array.isArray(ids) ? ids : [ids]
      schedules.value = schedules.value.filter(s => !idsArray.includes(s.id!))
      // Clear current if deleted
      if (schedule.value && idsArray.includes(schedule.value.id!)) {
        schedule.value = null
      }
    } catch (err) {
      console.error('[ScheduleStore] remove failed:', err)
      error.value = '删除课程失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Save lesson plan snapshot
   * @pattern hybrid - Shows saving state, updates on success
   * @param data - Snapshot data
   */
  async function saveSnapshot(data: SnapshotData): Promise<void> {
    saving.value = true
    error.value = null
    try {
      await scheduleApi.saveSnapshot(data)
      // Refresh schedule to get updated snapshot
      if (schedule.value?.id === data.id) {
        await fetchFullById(data.id)
      }
    } catch (err) {
      console.error('[ScheduleStore] saveSnapshot failed:', err)
      error.value = '保存教案快照失败'
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Clear lesson plan snapshot
   * @pattern hybrid - Shows saving state, updates on success
   * @param scheduleId - Schedule ID
   */
  async function clearSnapshot(scheduleId: number): Promise<void> {
    saving.value = true
    error.value = null
    try {
      await scheduleApi.clearSnapshot(scheduleId)
      // Refresh schedule
      if (schedule.value?.id === scheduleId) {
        await fetchFullById(scheduleId)
      }
    } catch (err) {
      console.error('[ScheduleStore] clearSnapshot failed:', err)
      error.value = '清除教案快照失败'
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Reset store state
   */
  function reset(): void {
    schedule.value = null
    schedules.value = []
    loading.value = false
    saving.value = false
    error.value = null
    total.value = 0
  }

  return {
    // State
    schedule,
    schedules,
    loading,
    saving,
    error,
    total,
    // Computed
    isEmpty,
    // Actions
    fetchList,
    fetchById,
    fetchFullById,
    fetchByStudent,
    fetchByLessonPlan,
    create,
    update,
    updateField,
    remove,
    saveSnapshot,
    clearSnapshot,
    reset
  }
})
