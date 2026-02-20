/**
 * Project Member Store
 * Maps to ProjectMemberController - manages project membership
 *
 * Mutation Patterns:
 * - fetchList: pessimistic (wait for server)
 * - fetchByProjectId: pessimistic (wait for server)
 * - addMember: hybrid (pending state, then update)
 * - removeMember: pessimistic (wait for server confirmation)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { projectMemberApi } from '@/api'
import type { ProjectMember } from '@/types'

interface ApiError {
  response?: {
    data?: {
      msg?: string
    }
  }
  message?: string
}

interface ProjectMemberQuery {
  projectId?: number
  pageNum?: number
  pageSize?: number
}

interface AddMemberRequest {
  projectId: number
  userId: number
  role?: 'leader' | 'member' | 'advisor'
}

export const useProjectMemberStore = defineStore('projectMember', () => {
  // State
  const items = ref<ProjectMember[]>([])
  const membersByProject = ref<Record<number, ProjectMember[]>>({}) // Cache members by project ID
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)

  /**
   * Fetch all project members
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchList(params: ProjectMemberQuery = {}): Promise<ProjectMember[]> {
    loading.value = true
    error.value = null
    try {
      const response = await projectMemberApi.getList(params)
      items.value = response.rows || []
      return items.value
    } catch (err) {
      console.error('[projectMemberStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load members'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch members for a specific project
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchByProjectId(projectId: number): Promise<ProjectMember[]> {
    loading.value = true
    error.value = null
    try {
      const response = await projectMemberApi.getByProjectId(projectId)
      const members = response.data || []
      membersByProject.value[projectId] = members
      return members
    } catch (err) {
      console.error('[projectMemberStore] fetchByProjectId failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load project members'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Get cached members for a project
   */
  function getMembersByProject(projectId: number): ProjectMember[] {
    return membersByProject.value[projectId] || []
  }

  /**
   * Add member to project
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function addMember(data: AddMemberRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await projectMemberApi.addMember(data)
      // Refresh project members
      if (data.projectId) {
        await fetchByProjectId(data.projectId)
      }
    } catch (err) {
      console.error('[projectMemberStore] addMember failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to add member'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Remove member from project
   * @pattern pessimistic - Waits for server confirmation before removing from state
   */
  async function removeMember(memberId: number, projectId?: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await projectMemberApi.removeMember(memberId)
      // Remove from local state
      items.value = items.value.filter(item => item.id !== memberId)
      // Remove from project cache if exists
      if (projectId && membersByProject.value[projectId]) {
        membersByProject.value[projectId] = membersByProject.value[projectId].filter(
          m => m.id !== memberId
        )
      }
    } catch (err) {
      console.error('[projectMemberStore] removeMember failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to remove member'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear cache for a specific project
   */
  function clearProjectCache(projectId: number): void {
    delete membersByProject.value[projectId]
  }

  /**
   * Reset store state
   */
  function reset(): void {
    items.value = []
    membersByProject.value = {}
    loading.value = false
    error.value = null
  }

  return {
    items,
    membersByProject,
    loading,
    error,
    isEmpty,
    fetchList,
    fetchByProjectId,
    getMembersByProject,
    addMember,
    removeMember,
    clearProjectCache,
    reset
  }
})
