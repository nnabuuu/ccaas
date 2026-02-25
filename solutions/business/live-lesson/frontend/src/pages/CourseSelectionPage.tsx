import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretRight, ArrowCounterClockwise } from '@phosphor-icons/react'
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

// Extract last 2 chars of subject for the monogram badge
// e.g. "初中数学" → "数学", "高中物理" → "物理"
function subjectBadge(subject: string): string {
  return subject.length <= 2 ? subject : subject.slice(-2)
}

function SkeletonCard({ featured = false }: { featured?: boolean }) {
  return (
    <div className={`border border-white/8 rounded-2xl ${featured ? 'p-7' : 'p-5'}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className={`rounded-xl skeleton-shimmer flex-shrink-0 ${featured ? 'w-12 h-12' : 'w-10 h-10'}`} />
        <div className="flex-1 space-y-2 pt-1">
          <div className={`h-4 skeleton-shimmer rounded ${featured ? 'w-2/3' : 'w-1/2'}`} />
          <div className="h-3 skeleton-shimmer rounded w-1/3" />
        </div>
      </div>
      <div className="space-y-2 mb-5">
        <div className="h-3 skeleton-shimmer rounded w-full" />
        <div className="h-3 skeleton-shimmer rounded w-4/5" />
        {featured && <div className="h-3 skeleton-shimmer rounded w-3/5" />}
      </div>
      <div className={`skeleton-shimmer rounded-xl ${featured ? 'h-11' : 'h-9'}`} />
    </div>
  )
}

interface LessonCardProps {
  lesson: LessonMeta
  hasPrev: boolean
  onContinue: (lesson: LessonMeta) => void
  onNew: (lesson: LessonMeta) => void
  featured?: boolean
}

function LessonCard({ lesson, hasPrev, onContinue, onNew, featured = false }: LessonCardProps) {
  const badge = subjectBadge(lesson.subject)

  return (
    <div
      className={[
        'group border rounded-2xl flex flex-col',
        'border-white/10 bg-white/[0.025] hover:bg-white/[0.045] hover:border-primary/20',
        'transition-all duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
        featured ? 'p-7 gap-5' : 'p-5 gap-4',
      ].join(' ')}
    >
      {/* Subject badge + title */}
      <div className="flex items-start gap-3">
        <div
          className={[
            'flex-shrink-0 rounded-xl flex items-center justify-center font-bold font-mono',
            'bg-primary/[0.08] border border-primary/15 text-primary',
            featured ? 'w-12 h-12 text-xs' : 'w-10 h-10 text-[10px]',
          ].join(' ')}
        >
          {badge}
        </div>
        <div className="min-w-0">
          <h2
            className={[
              'font-semibold text-white leading-snug',
              featured ? 'text-lg' : 'text-sm',
            ].join(' ')}
          >
            {lesson.title}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">{lesson.subject}</span>
            <span className="w-px h-3 bg-white/15" />
            <span className="text-xs text-gray-600">{lesson.gradeLevel}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p
        className={[
          'text-gray-500 leading-relaxed flex-1',
          featured ? 'text-sm max-w-[68ch]' : 'text-xs',
        ].join(' ')}
      >
        {lesson.description}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        {hasPrev ? (
          <>
            <button
              onClick={() => onContinue(lesson)}
              className={[
                'flex-1 rounded-xl font-medium text-background-dark',
                'bg-primary hover:bg-primary/90',
                'active:scale-[0.98] transition-all duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                featured ? 'py-3 text-sm' : 'py-2.5 text-xs',
              ].join(' ')}
            >
              继续上次课堂
            </button>
            <button
              onClick={() => onNew(lesson)}
              title="全新课堂"
              className={[
                'flex-shrink-0 rounded-xl border border-white/15 text-gray-500',
                'hover:border-white/30 hover:text-gray-300',
                'active:scale-[0.98] transition-all duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                featured ? 'p-3' : 'p-2.5',
              ].join(' ')}
            >
              <ArrowCounterClockwise size={featured ? 14 : 12} weight="regular" />
            </button>
          </>
        ) : (
          <button
            onClick={() => onNew(lesson)}
            className={[
              'flex items-center justify-between w-full rounded-xl font-medium',
              'text-background-dark bg-primary hover:bg-primary/90',
              'active:scale-[0.98] transition-all duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
              featured ? 'py-3 px-5 text-sm' : 'py-2.5 px-4 text-xs',
            ].join(' ')}
          >
            <span>开始学习</span>
            <CaretRight
              size={featured ? 16 : 14}
              weight="regular"
              className="opacity-50 group-hover:opacity-90 group-hover:translate-x-0.5 transition-all duration-[200ms]"
            />
          </button>
        )}
      </div>
    </div>
  )
}

export default function CourseSelectionPage() {
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<LessonMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedSessions, setSavedSessions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/lessons/index.json')
      .then(res => {
        if (!res.ok) throw new Error(`加载课程列表失败 (${res.status})`)
        return res.json() as Promise<LessonsIndex>
      })
      .then(data => {
        setLessons(data.lessons)
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

  const [featuredLesson, ...restLessons] = lessons

  return (
    <div className="h-screen flex flex-col bg-background-dark font-lexend">
      {/* Header */}
      <header className="px-8 pt-8 pb-6 flex-shrink-0">
        <div className="text-[10px] font-semibold text-primary/50 uppercase tracking-[0.22em] mb-2.5">
          即见 · Kedge Agentic
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">动态教学</h1>
        <p className="text-xs text-gray-600 mt-1.5">AI 互动课堂 — 选择一门课程开始学习</p>
      </header>

      <main className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          /* Skeleton: asymmetric layout matching real content */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <SkeletonCard featured />
            </div>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          /* Error state */
          <div className="flex flex-col gap-3 pt-8">
            <div className="w-8 h-8 rounded-xl border border-warning-red/25 bg-warning-red/[0.07] flex items-center justify-center">
              <span className="text-warning-red text-xs font-bold">!</span>
            </div>
            <p className="text-gray-500 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-primary/70 border border-primary/20 px-3 py-1.5 rounded-lg hover:bg-primary/[0.07] transition-colors w-fit"
            >
              重试
            </button>
          </div>
        ) : lessons.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col gap-3 pt-8">
            <div className="w-8 h-8 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center">
              <span className="text-gray-600 text-sm font-mono">∅</span>
            </div>
            <p className="text-gray-600 text-sm">暂无可用课程</p>
          </div>
        ) : (
          /* Asymmetric grid: featured card full-width, rest 2-col */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {featuredLesson && (
              <div className="md:col-span-2">
                <LessonCard
                  lesson={featuredLesson}
                  hasPrev={!!savedSessions[featuredLesson.id]}
                  onContinue={handleContinue}
                  onNew={handleNew}
                  featured
                />
              </div>
            )}
            {restLessons.map(lesson => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                hasPrev={!!savedSessions[lesson.id]}
                onContinue={handleContinue}
                onNew={handleNew}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
