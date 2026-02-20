import { useState, useEffect } from 'react'
import { api, type SolutionConfig } from '../utils/api'

export interface UseSolutionConfigReturn {
  config: SolutionConfig | null
  loading: boolean
  error: string | null
}

/**
 * Hook for loading solution configuration from backend
 * Loads mcpServers and skillPath on mount
 */
export function useSolutionConfig(): UseSolutionConfigReturn {
  const [config, setConfig] = useState<SolutionConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await api.getSolutionConfig()
        setConfig(data)
        console.log('📋 Solution config loaded:', data)
      } catch (err) {
        const message = `加载配置失败: ${err instanceof Error ? err.message : String(err)}`
        setError(message)
        console.error('Failed to load solution config:', err)
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
  }, []) // Empty deps array - only load once on mount

  return { config, loading, error }
}
