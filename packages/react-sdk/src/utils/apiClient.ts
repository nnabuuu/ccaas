import type { ApiClientOptions, CompletionParams, SolutionConfig } from '../types'
import type { Skill } from '@ccaas/shared'

export interface ApiClient {
  sendCompletion: (sessionId: string, params: CompletionParams) => Promise<Response>
  getSolutionConfig: (endpoint?: string) => Promise<SolutionConfig>
  fetchSkills: () => Promise<Skill[]>
  toggleSkill: (skillId: string) => Promise<Skill>
}

/**
 * Create a REST API client for CCAAS backend.
 *
 * Handles common API patterns shared by all solutions:
 * - Session completion (send message + get streaming response via WebSocket)
 * - Solution config loading
 * - Skills CRUD
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const { baseUrl = '', tenantId } = options

  const sendCompletion = async (sessionId: string, params: CompletionParams): Promise<Response> => {
    const response = await fetch(`${baseUrl}/api/v1/sessions/${sessionId}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ApiError(
        response.status,
        (errorData as Record<string, string>).message || response.statusText,
      )
    }

    return response
  }

  const getSolutionConfig = async (endpoint = '/api/config'): Promise<SolutionConfig> => {
    const response = await fetch(`${baseUrl}${endpoint}`)
    if (!response.ok) {
      throw new ApiError(response.status, `Failed to load solution config`)
    }
    return response.json()
  }

  const fetchSkills = async (): Promise<Skill[]> => {
    const response = await fetch(`${baseUrl}/api/v1/skills`, {
      headers: { 'X-Tenant-Id': tenantId },
    })

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText)
    }

    const data = await response.json()
    return Array.isArray(data) ? data : (data.items || [])
  }

  const toggleSkill = async (skillId: string): Promise<Skill> => {
    const response = await fetch(`${baseUrl}/api/v1/skills/${skillId}/toggle`, {
      method: 'PATCH',
      headers: { 'X-Tenant-Id': tenantId },
    })

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText)
    }

    return response.json()
  }

  return { sendCompletion, getSolutionConfig, fetchSkills, toggleSkill }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(`HTTP ${status}: ${message}`)
    this.name = 'ApiError'
  }
}
