import { useState, useEffect } from 'react'
import { ADMIN_API_KEY_STORAGE } from '@kedge-agentic/common'
import { apiClient } from '@/lib/api-client'

interface LandingStats {
  activeSessions: number
  totalSessions: number
  totalSkills: number
  publishedSkills: number
}

export function useLandingStats() {
  const [stats, setStats] = useState<LandingStats | null>(null)

  useEffect(() => {
    const apiKey = localStorage.getItem(ADMIN_API_KEY_STORAGE)
    if (!apiKey) return

    apiClient
      .get('/admin/dashboard/summary')
      .then((res) => {
        const data = res.data
        setStats({
          activeSessions: data.activeSessions ?? 0,
          totalSessions: data.totalSessions ?? 0,
          totalSkills: data.totalSkills ?? 0,
          publishedSkills: data.publishedSkills ?? 0,
        })
      })
      .catch(() => {
        // Silently fail — show static marketing values instead
      })
  }, [])

  return stats
}
