import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Skill } from '../types'

const CCAAS_URL = import.meta.env.VITE_CCAAS_URL || 'http://localhost:3001'

export interface UseSkillsReturn {
  /**
   * List of all skills fetched from the CCAAS API
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
   * Toggle skill enabled/disabled state (calls CCAAS API)
   */
  toggleSkill: (skillId: string) => Promise<void>

  /**
   * Set of enabled skill IDs (derived from skill.enabled)
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
 * Fetches skills from CCAAS API, provides search/filter functionality,
 * and manages enabled/disabled state (persisted to CCAAS).
 *
 * @param tenantId - Tenant ID to fetch skills for
 */
export function useSkills(tenantId: string): UseSkillsReturn {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchSkills = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch from CCAAS skills API (via vite proxy)
      const response = await fetch(`${CCAAS_URL}/api/v1/skills`, {
        headers: {
          'X-Tenant-Id': tenantId,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      // CCAAS returns { items: Skill[], total, page, limit, totalPages }
      const skillItems = Array.isArray(data) ? data : (data.items || [])
      setSkills(skillItems)
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

  // Derive enabled skill IDs from skill.enabled property
  const enabledSkillIds = useMemo(() => {
    return new Set(skills.filter(s => s.enabled).map(s => s.id))
  }, [skills])

  // Toggle skill enabled state via CCAAS API
  const toggleSkill = useCallback(async (skillId: string) => {
    try {
      const response = await fetch(`${CCAAS_URL}/api/v1/skills/${skillId}/toggle`, {
        method: 'PATCH',
        headers: {
          'X-Tenant-Id': tenantId,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const updatedSkill = await response.json()

      // Update local state with the toggled skill
      setSkills((prev) =>
        prev.map((s) => (s.id === skillId ? updatedSkill : s))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle skill')
    }
  }, [tenantId])

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
