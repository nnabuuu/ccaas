import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import '../styles/teacher.css'

const API_BASE = '/api'

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

  async function handleCreate(lesson: LessonMeta, mode: 'watch' | 'demo' = 'watch') {
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/classroom/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId: lesson.id }),
      })
      if (!res.ok) throw new Error(`创建失败 (${res.status})`)
      const data = await res.json()
      navigate(`/session/${data.sessionId}/${mode}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建课堂失败')
    } finally {
      setCreating(false)
    }
  }

  const readingLessons = lessons

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
      <div style={{ width: '100%', maxWidth: 480, padding: '40px 24px' }}>
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
        ) : readingLessons.length > 0 ? (
          <div>
            <h1
              style={{
                fontSize: 24, fontWeight: 700, color: '#1c1c1a',
                letterSpacing: '-.4px', lineHeight: 1.2, marginBottom: 20,
              }}
            >
              选择课程
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {readingLessons.map(lesson => (
                <div
                  key={lesson.id}
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    padding: '20px 20px 16px',
                    border: '1px solid #e8e6e0',
                  }}
                >
                  <h2
                    style={{
                      fontSize: 20, fontWeight: 700, color: '#1c1c1a',
                      letterSpacing: '-.3px', lineHeight: 1.3, marginBottom: 6,
                    }}
                  >
                    {lesson.title}
                  </h2>
                  <p style={{ fontSize: 13, color: '#5c5b56', lineHeight: 1.5, marginBottom: 4 }}>
                    {lesson.subject} · {lesson.gradeLevel}
                  </p>
                  <p style={{ fontSize: 12, color: '#9c9a92', lineHeight: 1.6, marginBottom: 16 }}>
                    {lesson.description}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleCreate(lesson)}
                      disabled={creating}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#fbfaf7',
                        background: '#1c1c1a',
                        border: 'none',
                        borderRadius: 8,
                        cursor: creating ? 'wait' : 'pointer',
                        opacity: creating ? 0.6 : 1,
                        transition: 'opacity .15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      {creating ? '创建中...' : '创建课堂'}
                    </button>
                    <button
                      onClick={() => handleCreate(lesson, 'demo')}
                      disabled={creating}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#5c5b56',
                        background: 'transparent',
                        border: '1px solid #d5d3cc',
                        borderRadius: 8,
                        cursor: creating ? 'wait' : 'pointer',
                        opacity: creating ? 0.6 : 1,
                        transition: 'opacity .15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      三端联动 Demo
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#bcbab2', textAlign: 'center', marginTop: 16 }}>
              创建后会生成课堂码，学生可通过{' '}
              <a href="/join" target="_blank" rel="noopener" style={{ color: '#1a5fa0', textDecoration: 'underline' }}>/join</a>
              {' '}加入
              <span style={{ margin: '0 6px', color: '#d5d3cc' }}>|</span>
              <Link to="/sessions" style={{ color: '#1a5fa0', textDecoration: 'underline' }}>查看历史课堂</Link>
            </p>
          </div>
        ) : (
          <p style={{ color: '#9c9a92', fontSize: 14 }}>暂无可用课程</p>
        )}
      </div>
    </div>
  )
}
