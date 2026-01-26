import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Skill } from '../types'

export interface UseSkillsReturn {
  /**
   * List of all skills fetched from the API
   */
  skills: Skill[]

  /**
   * Loading state
   */
  loading: boolean

  /**
   * Error message if fetch failed
   */
  error: string | null

  /**
   * Current search query
   */
  searchQuery: string

  /**
   * Update search query
   */
  setSearchQuery: (query: string) => void

  /**
   * Skills filtered by search query
   */
  filteredSkills: Skill[]

  /**
   * Toggle skill enabled/disabled state
   */
  toggleSkill: (skillId: string) => void

  /**
   * Set of enabled skill IDs
   */
  enabledSkillIds: Set<string>

  /**
   * Check if a skill is enabled
   */
  isSkillEnabled: (skillId: string) => boolean

  /**
   * Refresh skills from API
   */
  refresh: () => Promise<void>
}

/**
 * Hook for managing skills data and state.
 * Fetches skills from API, provides search/filter functionality,
 * and manages enabled/disabled state for skills.
 *
 * @param tenantId - Tenant ID to fetch skills for
 */
export function useSkills(tenantId: string): UseSkillsReturn {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [enabledSkillIds, setEnabledSkillIds] = useState<Set<string>>(new Set())

  const fetchSkills = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/skills?tenantId=${tenantId}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setSkills(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch skills')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  // Fetch skills on mount
  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  // Filter skills by search query
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) {
      return skills
    }

    const query = searchQuery.toLowerCase()
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.slug.toLowerCase().includes(query)
    )
  }, [skills, searchQuery])

  const toggleSkill = useCallback((skillId: string) => {
    setEnabledSkillIds((prev) => {
      const next = new Set(prev)
      if (next.has(skillId)) {
        next.delete(skillId)
      } else {
        next.add(skillId)
      }
      return next
    })
  }, [])

  const isSkillEnabled = useCallback(
    (skillId: string): boolean => {
      return enabledSkillIds.has(skillId)
    },
    [enabledSkillIds]
  )

  const refresh = useCallback(async () => {
    await fetchSkills()
  }, [fetchSkills])

  return {
    skills,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    filteredSkills,
    toggleSkill,
    enabledSkillIds,
    isSkillEnabled,
    refresh,
  }
}
