/**
 * Lesson Plans API Client
 *
 * API client for lesson plan CRUD operations.
 */

import type { LessonPlan, LessonPlanSyncField } from '@ccaas/shared'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001'

/**
 * Get auth headers
 */
function getHeaders(): HeadersInit {
  const token = localStorage.getItem('apiKey')
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'X-API-Key': token } : {}),
  }
}

/**
 * Create a new lesson plan
 */
export async function createLessonPlan(
  data: Partial<LessonPlan>
): Promise<LessonPlan> {
  const response = await fetch(`${API_BASE}/api/v1/lesson-plans`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`Failed to create lesson plan: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get all lesson plans
 */
export async function getLessonPlans(params?: {
  status?: string
  subject?: string
  gradeLevel?: string
}): Promise<LessonPlan[]> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.subject) searchParams.set('subject', params.subject)
  if (params?.gradeLevel) searchParams.set('gradeLevel', params.gradeLevel)

  const url = `${API_BASE}/api/v1/lesson-plans${
    searchParams.toString() ? `?${searchParams}` : ''
  }`

  const response = await fetch(url, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch lesson plans: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get a single lesson plan
 */
export async function getLessonPlan(id: string): Promise<LessonPlan> {
  const response = await fetch(`${API_BASE}/api/v1/lesson-plans/${id}`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch lesson plan: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Update a lesson plan
 */
export async function updateLessonPlan(
  id: string,
  data: Partial<LessonPlan>
): Promise<LessonPlan> {
  const response = await fetch(`${API_BASE}/api/v1/lesson-plans/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`Failed to update lesson plan: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Delete a lesson plan
 */
export async function deleteLessonPlan(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/v1/lesson-plans/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to delete lesson plan: ${response.statusText}`)
  }
}

/**
 * Duplicate a lesson plan
 */
export async function duplicateLessonPlan(id: string): Promise<LessonPlan> {
  const response = await fetch(
    `${API_BASE}/api/v1/lesson-plans/${id}/duplicate`,
    {
      method: 'POST',
      headers: getHeaders(),
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to duplicate lesson plan: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Update a single field (for AI sync)
 */
export async function updateLessonPlanField(
  id: string,
  field: LessonPlanSyncField,
  value: unknown
): Promise<LessonPlan> {
  const response = await fetch(`${API_BASE}/api/v1/lesson-plans/${id}/field`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ field, value }),
  })

  if (!response.ok) {
    throw new Error(`Failed to update field: ${response.statusText}`)
  }

  return response.json()
}

export default {
  createLessonPlan,
  getLessonPlans,
  getLessonPlan,
  updateLessonPlan,
  deleteLessonPlan,
  duplicateLessonPlan,
  updateLessonPlanField,
}
