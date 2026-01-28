/**
 * Project Store
 * Maps to ProjectController - manages project data
 *
 * Mutation Patterns:
 * - fetchList: pessimistic (wait for server)
 * - fetchById: pessimistic (wait for server)
 * - create: hybrid (pending state, then update)
 * - update: hybrid (pending state, then update)
 * - remove: pessimistic (wait for server confirmation)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { projectApi } from '@/api'
import type { Project, ProjectCreateRequest, ProjectUpdateRequest, ProjectQuery } from '@/types'

interface ApiError {
  response?: {
    data?: {
      msg?: string
    }
  }
  message?: string
}

export const useProjectStore = defineStore('project', () => {
  // State
  const items = ref<Project[]>([])
  const currentItem = ref<Project | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)

  /**
   * Fetch project list
   * @pattern pessimistic - Waits for server response before updating state
   * @param params - Query parameters
   */
  async function fetchList(params: ProjectQuery = {}): Promise<Project[]> {
    loading.value = true
    error.value = null
    try {
      const response = await projectApi.getList(params)
      items.value = response.rows || []
      return items.value
    } catch (err) {
      console.error('[projectStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load projects'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single project by ID
   * @pattern pessimistic - Waits for server response before updating state
   * @param id - Project ID
   */
  async function fetchById(id: number): Promise<Project> {
    loading.value = true
    error.value = null
    try {
      const response = await projectApi.getById(id)
      currentItem.value = response.data
      return currentItem.value
    } catch (err) {
      console.error('[projectStore] fetchById failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load project'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create new project
   * @pattern hybrid - Shows pending indicator, updates on success
   * @param data - Project data
   */
  async function create(data: ProjectCreateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await projectApi.create(data)
      await fetchList()
    } catch (err) {
      console.error('[projectStore] create failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to create project'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update existing project
   * @pattern hybrid - Shows pending indicator, updates on success
   * @param data - Project data with ID
   */
  async function update(data: ProjectUpdateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await projectApi.update(data)
      if (currentItem.value?.id === data.id) {
        currentItem.value = { ...currentItem.value, ...data } as Project
      }
      const index = items.value.findIndex(item => item.id === data.id)
      if (index !== -1) {
        items.value[index] = { ...items.value[index], ...data } as Project
      }
    } catch (err) {
      console.error('[projectStore] update failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to update project'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete project(s)
   * @pattern pessimistic - Waits for server confirmation before removing from state
   * @param ids - ID(s) to delete
   */
  async function remove(ids: number | number[]): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await projectApi.delete(ids)
      const idsArray = Array.isArray(ids) ? ids : [ids]
      items.value = items.value.filter(item => !idsArray.includes(item.id!))
      if (currentItem.value && idsArray.includes(currentItem.value.id!)) {
        currentItem.value = null
      }
    } catch (err) {
      console.error('[projectStore] remove failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to delete project'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Reset store state
   */
  function reset(): void {
    items.value = []
    currentItem.value = null
    loading.value = false
    error.value = null
  }

  return {
    items,
    currentItem,
    loading,
    error,
    isEmpty,
    fetchList,
    fetchById,
    create,
    update,
    remove,
    reset
  }
})
