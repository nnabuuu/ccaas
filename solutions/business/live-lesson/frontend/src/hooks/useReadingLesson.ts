import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import type { ReadingManifest } from '../types/reading'

interface UseReadingLessonResult {
  manifest: ReadingManifest | null
  loading: boolean
  error: string | null
  embed: boolean
}

/**
 * Fetches the reading lesson manifest from /lessons/:lessonId/manifest.json.
 * Also reads ?embed=1 from the URL to support iframe embedding.
 */
export function useReadingLesson(): UseReadingLessonResult {
  const { lessonId } = useParams<{ lessonId: string }>()
  const [searchParams] = useSearchParams()
  const embed = searchParams.get('embed') === '1'

  const [manifest, setManifest] = useState<ReadingManifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!lessonId) {
      setError('Missing lessonId')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    fetch(`/lessons/${lessonId}/manifest.json`)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load manifest (${res.status})`)
        return res.json() as Promise<ReadingManifest>
      })
      .then(setManifest)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [lessonId])

  return { manifest, loading, error, embed }
}
