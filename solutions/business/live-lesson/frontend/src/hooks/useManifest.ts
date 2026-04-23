import type { ReadingManifest } from '../types/reading'

const API_BASE = '/api'

export async function fetchManifest(lessonId: string): Promise<ReadingManifest | null> {
  try {
    // Prefer backend API (has discuss metadata for AI generation)
    const res = await fetch(`${API_BASE}/lessons/${lessonId}/manifest`)
    if (!res.ok) {
      // Fallback to static file
      const fallback = await fetch(`/lessons/${lessonId}/manifest.json`)
      if (!fallback.ok) return null
      return await fallback.json()
    }
    return await res.json()
  } catch (e) {
    console.warn('[fetchManifest] failed:', e)
    return null
  }
}
