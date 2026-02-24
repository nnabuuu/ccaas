import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSavedSession, clearSession, restoreSessionToSDK } from '../utils/sessionStore'

interface LessonMeta {
  id: string
  title: string
  subject: string
  gradeLevel: string
  description: string
  emoji: string
}

interface LessonsIndex {
  lessons: LessonMeta[]
}

export default function CourseSelectionPage() {
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<LessonMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Track which lessons have a saved session (re-check after mount)
  const [savedSessions, setSavedSessions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/lessons/index.json')
      .then(res => {
        if (!res.ok) throw new Error(`加载课程列表失败 (${res.status})`)
        return res.json() as Promise<LessonsIndex>
      })
      .then(data => {
        setLessons(data.lessons)
        // Build saved-session map
        const map: Record<string, boolean> = {}
        for (const lesson of data.lessons) {
          map[lesson.id] = !!getSavedSession(lesson.id)
        }
        setSavedSessions(map)
      })
      .catch((err: Error) => {
        console.error('Failed to load lessons index:', err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  function handleContinue(lesson: LessonMeta) {
    restoreSessionToSDK(lesson.id)
    navigate(`/lesson/${lesson.id}`, {
      state: { forceNew: false, lessonTitle: lesson.title },
    })
  }

  function handleNew(lesson: LessonMeta) {
    clearSession(lesson.id)
    navigate(`/lesson/${lesson.id}`, {
      state: { forceNew: true, lessonTitle: lesson.title },
    })
  }

  return (
    <div
      className="min-h-screen bg-background-dark font-lexend"
      style={{ fontFamily: "'Lexend', sans-serif" }}
    >
      {/* Header */}
      <header className="px-8 py-5 border-b border-white/10">
        <div className="text-primary text-2xl font-bold tracking-tight">即见·动态教学</div>
        <p className="text-gray-400 text-sm mt-1">选择一门课程，开始 AI 互动教学</p>
      </header>

      {/* Course grid */}
      <main className="px-8 py-8">
        {loading ? (
          <div className="text-gray-500 text-sm">加载中...</div>
        ) : error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : lessons.length === 0 ? (
          <div className="text-gray-500 text-sm">暂无可用课程</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {lessons.map(lesson => {
              const hasPrev = savedSessions[lesson.id]
              return (
                <div
                  key={lesson.id}
                  className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 hover:border-primary/30 transition-colors"
                >
                  {/* Emoji + title */}
                  <div className="flex items-start gap-3">
                    <span className="text-4xl leading-none">{lesson.emoji}</span>
                    <div>
                      <div className="text-white font-semibold text-base leading-snug">{lesson.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {lesson.subject} · {lesson.gradeLevel}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-300 leading-relaxed flex-1">{lesson.description}</p>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    {hasPrev ? (
                      <>
                        <button
                          onClick={() => handleContinue(lesson)}
                          className="w-full py-2 rounded-lg bg-primary text-black text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          继续上次课堂
                        </button>
                        <button
                          onClick={() => handleNew(lesson)}
                          className="w-full py-2 rounded-lg border border-white/20 text-gray-300 text-sm hover:border-white/40 hover:text-white transition-colors"
                        >
                          全新课堂
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleNew(lesson)}
                        className="w-full py-2 rounded-lg bg-primary text-black text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        开始学习
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
