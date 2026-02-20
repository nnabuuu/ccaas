import { useState, useEffect, useCallback } from 'react'
import type {
  TextbookSubject,
  TextbookGrade,
  TextbookPublisher,
  TextbookVolume,
  TextbookChapter,
} from '../types'

const API_BASE = '/api'  // Use relative path, proxied by Vite

interface UseTextbookState {
  // Data
  subjects: TextbookSubject[]
  grades: TextbookGrade[]
  publishers: TextbookPublisher[]
  volumes: TextbookVolume[]
  chapters: TextbookChapter[]

  // Loading states
  loadingSubjects: boolean
  loadingGrades: boolean
  loadingPublishers: boolean
  loadingVolumes: boolean
  loadingChapters: boolean

  // Error
  error: string | null

  // Selected values
  selectedSubject: string
  selectedGradeId: number | null
  selectedPublisher: string
  selectedVolume: string
  selectedChapterId: number | null
  selectedChapterTitle: string

  // Actions
  setSelectedSubject: (subject: string) => void
  setSelectedGradeId: (gradeId: number | null) => void
  setSelectedPublisher: (publisher: string) => void
  setSelectedVolume: (volume: string) => void
  setSelectedChapter: (chapterId: number | null, chapterTitle: string) => void
  reset: () => void
}

export function useTextbook(): UseTextbookState {
  // Data states
  const [subjects, setSubjects] = useState<TextbookSubject[]>([])
  const [grades, setGrades] = useState<TextbookGrade[]>([])
  const [publishers, setPublishers] = useState<TextbookPublisher[]>([])
  const [volumes, setVolumes] = useState<TextbookVolume[]>([])
  const [chapters, setChapters] = useState<TextbookChapter[]>([])

  // Loading states
  const [loadingSubjects, setLoadingSubjects] = useState(false)
  const [loadingGrades, setLoadingGrades] = useState(false)
  const [loadingPublishers, setLoadingPublishers] = useState(false)
  const [loadingVolumes, setLoadingVolumes] = useState(false)
  const [loadingChapters, setLoadingChapters] = useState(false)

  // Error state
  const [error, setError] = useState<string | null>(null)

  // Selected values
  const [selectedSubject, setSelectedSubjectState] = useState('')
  const [selectedGradeId, setSelectedGradeIdState] = useState<number | null>(null)
  const [selectedPublisher, setSelectedPublisherState] = useState('')
  const [selectedVolume, setSelectedVolumeState] = useState('')
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null)
  const [selectedChapterTitle, setSelectedChapterTitle] = useState('')

  // Fetch subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      setLoadingSubjects(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE}/textbook/subjects`)
        if (!response.ok) throw new Error('Failed to fetch subjects')
        const data = await response.json()
        setSubjects(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch subjects')
      } finally {
        setLoadingSubjects(false)
      }
    }
    fetchSubjects()
  }, [])

  // Fetch grades when subject changes
  useEffect(() => {
    if (!selectedSubject) {
      setGrades([])
      return
    }

    const fetchGrades = async () => {
      setLoadingGrades(true)
      setError(null)
      try {
        const response = await fetch(
          `${API_BASE}/textbook/grades?subject=${encodeURIComponent(selectedSubject)}`
        )
        if (!response.ok) throw new Error('Failed to fetch grades')
        const data = await response.json()
        setGrades(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch grades')
      } finally {
        setLoadingGrades(false)
      }
    }
    fetchGrades()
  }, [selectedSubject])

  // Fetch publishers when subject and grade change
  useEffect(() => {
    if (!selectedSubject || !selectedGradeId) {
      setPublishers([])
      return
    }

    const fetchPublishers = async () => {
      setLoadingPublishers(true)
      setError(null)
      try {
        const response = await fetch(
          `${API_BASE}/textbook/publishers?subject=${encodeURIComponent(selectedSubject)}&gradeId=${selectedGradeId}`
        )
        if (!response.ok) throw new Error('Failed to fetch publishers')
        const data = await response.json()
        setPublishers(data)
        // Auto-select first publisher (typically 人教版)
        if (data.length > 0) {
          setSelectedPublisherState(data[0].label)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch publishers')
      } finally {
        setLoadingPublishers(false)
      }
    }
    fetchPublishers()
  }, [selectedSubject, selectedGradeId])

  // Fetch volumes when subject, grade, and publisher change
  useEffect(() => {
    if (!selectedSubject || !selectedGradeId || !selectedPublisher) {
      setVolumes([])
      return
    }

    const fetchVolumes = async () => {
      setLoadingVolumes(true)
      setError(null)
      try {
        const response = await fetch(
          `${API_BASE}/textbook/volumes?subject=${encodeURIComponent(selectedSubject)}&gradeId=${selectedGradeId}&publisher=${encodeURIComponent(selectedPublisher)}`
        )
        if (!response.ok) throw new Error('Failed to fetch volumes')
        const data = await response.json()
        setVolumes(data)
        // Auto-select first volume (typically 上册)
        if (data.length > 0) {
          setSelectedVolumeState(data[0].label)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch volumes')
      } finally {
        setLoadingVolumes(false)
      }
    }
    fetchVolumes()
  }, [selectedSubject, selectedGradeId, selectedPublisher])

  // Fetch chapters when all selections are made
  useEffect(() => {
    if (!selectedSubject || !selectedGradeId || !selectedPublisher || !selectedVolume) {
      setChapters([])
      return
    }

    const fetchChapters = async () => {
      setLoadingChapters(true)
      setError(null)
      try {
        const response = await fetch(
          `${API_BASE}/textbook/chapters?subject=${encodeURIComponent(selectedSubject)}&gradeId=${selectedGradeId}&publisher=${encodeURIComponent(selectedPublisher)}&volume=${encodeURIComponent(selectedVolume)}`
        )
        if (!response.ok) throw new Error('Failed to fetch chapters')
        const data = await response.json()
        setChapters(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch chapters')
      } finally {
        setLoadingChapters(false)
      }
    }
    fetchChapters()
  }, [selectedSubject, selectedGradeId, selectedPublisher, selectedVolume])

  // Selection handlers with cascading reset
  const setSelectedSubject = useCallback((subject: string) => {
    setSelectedSubjectState(subject)
    setSelectedGradeIdState(null)
    setSelectedPublisherState('')
    setSelectedVolumeState('')
    setSelectedChapterId(null)
    setSelectedChapterTitle('')
    setGrades([])
    setPublishers([])
    setVolumes([])
    setChapters([])
  }, [])

  const setSelectedGradeId = useCallback((gradeId: number | null) => {
    setSelectedGradeIdState(gradeId)
    setSelectedPublisherState('')
    setSelectedVolumeState('')
    setSelectedChapterId(null)
    setSelectedChapterTitle('')
    setPublishers([])
    setVolumes([])
    setChapters([])
  }, [])

  const setSelectedPublisher = useCallback((publisher: string) => {
    setSelectedPublisherState(publisher)
    setSelectedVolumeState('')
    setSelectedChapterId(null)
    setSelectedChapterTitle('')
    setVolumes([])
    setChapters([])
  }, [])

  const setSelectedVolume = useCallback((volume: string) => {
    setSelectedVolumeState(volume)
    setSelectedChapterId(null)
    setSelectedChapterTitle('')
    setChapters([])
  }, [])

  const setSelectedChapter = useCallback((chapterId: number | null, chapterTitle: string) => {
    setSelectedChapterId(chapterId)
    setSelectedChapterTitle(chapterTitle)
  }, [])

  const reset = useCallback(() => {
    setSelectedSubjectState('')
    setSelectedGradeIdState(null)
    setSelectedPublisherState('')
    setSelectedVolumeState('')
    setSelectedChapterId(null)
    setSelectedChapterTitle('')
    setGrades([])
    setPublishers([])
    setVolumes([])
    setChapters([])
  }, [])

  return {
    // Data
    subjects,
    grades,
    publishers,
    volumes,
    chapters,

    // Loading states
    loadingSubjects,
    loadingGrades,
    loadingPublishers,
    loadingVolumes,
    loadingChapters,

    // Error
    error,

    // Selected values
    selectedSubject,
    selectedGradeId,
    selectedPublisher,
    selectedVolume,
    selectedChapterId,
    selectedChapterTitle,

    // Actions
    setSelectedSubject,
    setSelectedGradeId,
    setSelectedPublisher,
    setSelectedVolume,
    setSelectedChapter,
    reset,
  }
}
