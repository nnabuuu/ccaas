import { ref, computed, onMounted } from 'vue'
import type { Skill } from '@kedge-agentic/common'
import type { UseSkillsOptions, UseSkillsReturn } from '../types'

/**
 * Skills management composable.
 *
 * Fetches skills from CCAAS API, provides search/filter,
 * and toggle enabled/disabled state (persisted to CCAAS).
 */
export function useSkills(options: UseSkillsOptions): UseSkillsReturn {
  const { serverUrl = '', solutionId } = options

  const skills = ref<Skill[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  const searchQuery = ref('')

  const fetchSkills = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(`${serverUrl}/api/v1/skills`, {
        headers: { 'X-Solution-Id': solutionId },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      skills.value = Array.isArray(data) ? data : (data.items || [])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch skills'
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    fetchSkills()
  })

  const filteredSkills = computed(() => {
    if (!searchQuery.value.trim()) return skills.value

    const query = searchQuery.value.toLowerCase()
    return skills.value.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        (skill.description?.toLowerCase().includes(query)) ||
        skill.slug.toLowerCase().includes(query),
    )
  })

  const enabledSkillIds = computed(() => {
    return new Set(
      skills.value
        .filter(s => (s as Skill & { enabled?: boolean }).enabled)
        .map(s => s.id),
    )
  })

  const toggleSkill = async (skillId: string) => {
    try {
      const response = await fetch(`${serverUrl}/api/v1/skills/${skillId}/toggle`, {
        method: 'PATCH',
        headers: { 'X-Solution-Id': solutionId },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const updatedSkill = await response.json()
      skills.value = skills.value.map(s => s.id === skillId ? updatedSkill : s)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to toggle skill'
    }
  }

  const isSkillEnabled = (skillId: string): boolean => {
    return enabledSkillIds.value.has(skillId)
  }

  const refresh = async () => {
    await fetchSkills()
  }

  return {
    skills,
    loading,
    error,
    searchQuery,
    filteredSkills,
    toggleSkill,
    enabledSkillIds,
    isSkillEnabled,
    refresh,
  }
}
