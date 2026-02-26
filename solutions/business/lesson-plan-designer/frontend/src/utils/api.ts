import type { LessonPlan, CreateLessonPlanInput, UpdateLessonPlanInput, SyncField, Skill } from '../types'

const API_BASE = '/api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new ApiError(response.status, error.error || 'Request failed')
  }
  return response.json()
}

// Types for CCAAS messages
export interface CcaasToolEvent {
  id: string
  toolUseId: string
  toolName: string
  phase: string
  toolInput: Record<string, unknown> | null
  toolOutput: unknown
  success: boolean | null
  durationMs: number | null
  createdAt: string
}

export interface CcaasMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  toolEvents?: CcaasToolEvent[]
}

export const api = {
  // List all lesson plans
  async listLessonPlans(): Promise<LessonPlan[]> {
    const response = await fetch(`${API_BASE}/lesson-plans`)
    return handleResponse<LessonPlan[]>(response)
  },

  // Get a single lesson plan
  async getLessonPlan(id: string): Promise<LessonPlan> {
    const response = await fetch(`${API_BASE}/lesson-plans/${id}`)
    return handleResponse<LessonPlan>(response)
  },

  // Create a new lesson plan
  async createLessonPlan(input: CreateLessonPlanInput): Promise<LessonPlan> {
    const response = await fetch(`${API_BASE}/lesson-plans`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return handleResponse<LessonPlan>(response)
  },

  // Update a lesson plan
  async updateLessonPlan(id: string, input: UpdateLessonPlanInput): Promise<LessonPlan> {
    const response = await fetch(`${API_BASE}/lesson-plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return handleResponse<LessonPlan>(response)
  },

  // Patch a single field
  async patchField(id: string, field: SyncField, value: unknown): Promise<LessonPlan> {
    const response = await fetch(`${API_BASE}/lesson-plans/${id}/field`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value }),
    })
    return handleResponse<LessonPlan>(response)
  },

  // Delete a lesson plan
  async deleteLessonPlan(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/lesson-plans/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to delete lesson plan')
    }
  },

  // Get session messages from CCAAS (via solution backend proxy)
  async getSessionMessages(sessionId: string, includeToolEvents = true): Promise<{
    messages: CcaasMessage[]
  }> {
    const url = `${API_BASE}/sessions/${sessionId}/messages${includeToolEvents ? '?includeToolEvents=true' : ''}`
    const response = await fetch(url)
    return handleResponse(response)
  },

  // Update a skill (content)
  async updateSkill(id: string, updates: { content?: string }, tenantId = 'lesson-plan-designer'): Promise<Skill> {
    const response = await fetch(`${API_BASE}/v1/skills/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify(updates),
    })
    return handleResponse<Skill>(response)
  },

  // Add attachments to lesson plan
  async addAttachments(
    planId: string,
    attachments: Array<{
      fileId: string
      fileName: string
      fileType?: string
      mimeType?: string
      size?: number
      description?: string
      _originalPath?: string
    }>,
    sessionId: string,
  ): Promise<void> {
    for (const attachment of attachments) {
      const response = await fetch(`${API_BASE}/lesson-plans/${planId}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId,
        },
        body: JSON.stringify(attachment),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new ApiError(response.status, error.error || `Failed to add attachment: ${attachment.fileName}`)
      }
    }
  },

  // Remove an attachment from lesson plan
  async removeAttachment(planId: string, attachmentId: string): Promise<LessonPlan> {
    const response = await fetch(`${API_BASE}/lesson-plans/${planId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    })
    return handleResponse<LessonPlan>(response)
  },
}

export { ApiError }
export default api
