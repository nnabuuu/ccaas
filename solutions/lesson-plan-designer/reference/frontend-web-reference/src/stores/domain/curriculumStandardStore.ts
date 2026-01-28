/**
 * Curriculum Standard Store
 * Maps to CurriculumStandardController - manages curriculum standard reference data
 *
 * Mutation Patterns:
 * - fetchList: pessimistic (wait for server)
 * - fetchTree: pessimistic (wait for server)
 *
 * Note: Curriculum standards are typically read-only reference data.
 * They are hierarchical (tree structure).
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { curriculumStandardApi } from '@/api'
import type {
  CurriculumStandard,
  CurriculumStandardQuery,
  CurriculumStandardTreeByStageQuery,
  CurriculumStandardTreeNode
} from '@/types'

interface ApiError {
  response?: {
    data?: {
      msg?: string
    }
  }
  message?: string
}

export const useCurriculumStandardStore = defineStore('curriculumStandard', () => {
  // State
  const items = ref<CurriculumStandard[]>([])
  const tree = ref<CurriculumStandardTreeNode[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)
  const hasTree = computed(() => tree.value.length > 0)

  /**
   * Fetch flat list of curriculum standards
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchList(params: CurriculumStandardQuery = {}): Promise<CurriculumStandard[]> {
    loading.value = true
    error.value = null
    try {
      const response = await curriculumStandardApi.getList(params)
      items.value = response.rows || []
      return items.value
    } catch (err) {
      console.error('[curriculumStandardStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load curriculum standards'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch hierarchical tree of curriculum standards by stage
   * @pattern pessimistic - Waits for server response before updating state
   *
   * @param params.subject - optional subject filter (数学, 物理, 化学)
   * @param params.stage - optional stage filter (义务教育阶段第一学段, etc.)
   * @param params.standardType - optional standard type filter (内容要求, 学业要求)
   */
  async function fetchTreeByStage(params: CurriculumStandardTreeByStageQuery = {}): Promise<CurriculumStandardTreeNode[]> {
    loading.value = true
    error.value = null
    try {
      const response = await curriculumStandardApi.getTreeByStage(params)
      tree.value = response.data || []
      return tree.value
    } catch (err) {
      console.error('[curriculumStandardStore] fetchTreeByStage failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load curriculum standard tree'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Find standards by subject (local search)
   */
  function findBySubject(subject: string): CurriculumStandard[] {
    return items.value.filter(item => item.subject === subject)
  }

  /**
   * Flatten tree to array (utility)
   */
  function flattenTree(nodes: CurriculumStandardTreeNode[] = tree.value, result: CurriculumStandardTreeNode[] = []): CurriculumStandardTreeNode[] {
    for (const node of nodes) {
      result.push(node)
      if (node.children?.length) {
        flattenTree(node.children, result)
      }
    }
    return result
  }

  /**
   * Find node in tree by ID
   */
  function findInTree(id: number, nodes: CurriculumStandardTreeNode[] = tree.value): CurriculumStandardTreeNode | null {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children?.length) {
        const found = findInTree(id, node.children)
        if (found) return found
      }
    }
    return null
  }

  /**
   * Reset store state
   */
  function reset(): void {
    items.value = []
    tree.value = []
    loading.value = false
    error.value = null
  }

  return {
    items,
    tree,
    loading,
    error,
    isEmpty,
    hasTree,
    fetchList,
    fetchTreeByStage,
    findBySubject,
    flattenTree,
    findInTree,
    reset
  }
})
