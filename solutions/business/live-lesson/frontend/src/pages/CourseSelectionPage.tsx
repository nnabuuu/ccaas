import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles/teacher.css'

const API_BASE = 'http://localhost:3007/api'

interface LessonMeta {
  id: string
  title: string
  subject: string
  gradeLevel: string
  description: string
  lessonType?: string
}

export default function CourseSelectionPage() {
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<LessonMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/lessons`)
      .then(res => {
        if (!res.ok) throw new Error(`加载课程失败 (${res.status})`)
        return res.json()
      })
      .then(data => setLessons(data.lessons))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(lesson: LessonMeta) {
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/classroom/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id }),
      })
      if (!res.ok) throw new Error(`创建失败 (${res.status})`)
      const data = await res.json()
      navigate(`/teacher/${lesson.id}?session=${data.code}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建课堂失败')
    } finally {
      setCreating(false)
    }
  }

  // For now, show the first reading-type lesson as the featured entry
  const readingLesson = lessons.find(l => l.lessonType === 'reading') ?? lessons[0]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f3ef',
        fontFamily: '"Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420, padding: '40px 24px' }}>
        {/* Logo mark */}
        <div
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: '#1c1c1a', color: '#fbfaf7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, marginBottom: 24,
          }}
        >
          K
        </div>

        {loading ? (
          <div style={{ color: '#9c9a92', fontSize: 14 }}>Loading...</div>
        ) : error ? (
          <div>
            <p style={{ color: '#942929', fontSize: 14, marginBottom: 12 }}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                fontSize: 12, color: '#1a5fa0', background: 'none', border: '1px solid rgba(26,95,160,.2)',
                padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
              }}
            >
              重试
            </button>
          </div>
        ) : readingLesson ? (
          <div>
            <h1
              style={{
                fontSize: 28, fontWeight: 700, color: '#1c1c1a',
                letterSpacing: '-.5px', lineHeight: 1.2, marginBottom: 8,
              }}
            >
              {readingLesson.title}
            </h1>
            <p
              style={{
                fontSize: 14, color: '#5c5b56', lineHeight: 1.6,
                marginBottom: 6,
              }}
            >
              {readingLesson.subject} · {readingLesson.gradeLevel}
            </p>
            <p
              style={{
                fontSize: 13, color: '#9c9a92', lineHeight: 1.7,
                marginBottom: 32,
              }}
            >
              {readingLesson.description}
            </p>

            <button
              onClick={() => handleCreate(readingLesson)}
              disabled={creating}
              style={{
                width: '100%',
                padding: '14px 0',
                fontSize: 15,
                fontWeight: 600,
                color: '#fbfaf7',
                background: '#1c1c1a',
                border: 'none',
                borderRadius: 10,
                cursor: creating ? 'wait' : 'pointer',
                opacity: creating ? 0.6 : 1,
                transition: 'opacity .15s',
                fontFamily: 'inherit',
              }}
            >
              {creating ? '创建中...' : '创建课堂'}
            </button>

            <p style={{ fontSize: 11, color: '#bcbab2', textAlign: 'center', marginTop: 14 }}>
              创建后会生成课堂码，学生可通过 /join 加入
            </p>
          </div>
        ) : (
          <p style={{ color: '#9c9a92', fontSize: 14 }}>暂无可用课程</p>
        )}
      </div>
    </div>
  )
}
