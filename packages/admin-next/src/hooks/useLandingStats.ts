import { useState, useEffect } from 'react'
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
    const apiKey = localStorage.getItem('admin_api_key')
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
