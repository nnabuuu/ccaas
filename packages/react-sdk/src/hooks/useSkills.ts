import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Skill } from '@kedge-agentic/common'
import type { UseSkillsOptions, UseSkillsReturn } from '../types'
import { buildAuthHeaders } from '../utils/authHeaders'

/**
 * Skills management hook.
 *
 * Fetches skills from CCAAS API, provides search/filter,
 * and toggle enabled/disabled state (persisted to CCAAS).
 *
 * Extracted from both solutions' useSkills hooks (nearly identical).
 */
export function useSkills(options: UseSkillsOptions): UseSkillsReturn {
  const { serverUrl = '', tenantId, apiKey } = options

  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchSkills = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${serverUrl}/api/v1/skills`, {
        headers: { 'X-Tenant-Id': tenantId, ...buildAuthHeaders(apiKey) },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const skillItems = Array.isArray(data) ? data : (data.items || [])
      setSkills(skillItems)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch skills')
    } finally {
      setLoading(false)
    }
  }, [serverUrl, tenantId, apiKey])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills

    const query = searchQuery.toLowerCase()
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        (skill.description?.toLowerCase().includes(query)) ||
        skill.slug.toLowerCase().includes(query),
    )
  }, [skills, searchQuery])

  const enabledSkillIds = useMemo(() => {
    return new Set(
      skills
        .filter(s => (s as Skill & { enabled?: boolean }).enabled)
        .map(s => s.id),
    )
  }, [skills])

  const toggleSkill = useCallback(async (skillId: string) => {
    try {
      const response = await fetch(`${serverUrl}/api/v1/skills/${skillId}/toggle`, {
        method: 'PATCH',
        headers: { 'X-Tenant-Id': tenantId, ...buildAuthHeaders(apiKey) },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const updatedSkill = await response.json()
      setSkills(prev => prev.map(s => s.id === skillId ? updatedSkill : s))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle skill')
    }
  }, [serverUrl, tenantId, apiKey])

  const isSkillEnabled = useCallback(
    (skillId: string): boolean => enabledSkillIds.has(skillId),
    [enabledSkillIds],
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
