import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { SERVER_URL } from '../config'
import type { Block, RequirementLink, LessonPlanStatus } from '../types/lesson-plan'
import { BlockEditor } from '../components/editor/BlockEditor'
import { RequirementBanner } from '../components/editor/RequirementBanner'

const DEMO_BLOCKS: Block[] = [
  { id: 'b1', type: 'section', content: { title: '教学目标' }, sort_order: 0, is_required: true },
  { id: 'b2', type: 'list', content: { items: ['理解并掌握三角形全等的判定方法', '能够运用 SSS、SAS 判定方法解决实际问题'], ordered: false }, sort_order: 1 },
  { id: 'b3', type: 'section', content: { title: '教学过程' }, sort_order: 2, is_required: true },
  { id: 'b4', type: 'timeline', content: { entries: [{ time: "0-5'", duration: '5min', description: '复习三角形基本性质' }, { time: "5-20'", duration: '15min', description: '讲解 SSS 判定方法' }, { time: "20-35'", duration: '15min', description: '讲解 SAS 判定方法' }, { time: "35-45'", duration: '10min', description: '课堂练习与总结' }] }, sort_order: 3 },
  { id: 'b5', type: 'callout', content: { text: '注意：八(2)班学生对全等的理解较好，可适当增加证明题比例' }, sort_order: 4 },
  { id: 'b6', type: 'text', content: { text: '课后作业：教材 P52 练习 1-5 题' }, sort_order: 5 },
]

export function LessonPlanEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [title, setTitle] = useState('')
  const [className, setClassName] = useState('八(2)班')
  const [subject, setSubject] = useState('数学')
  const [lessonType, setLessonType] = useState('新授课')
  const [blocks, setBlocks] = useState<Block[]>(isNew ? [] : DEMO_BLOCKS)
  const [requirement, setRequirement] = useState<RequirementLink | undefined>(
    isNew ? undefined : {
      id: 'r1',
      code: '12.2',
      text: '理解并掌握三角形全等的 SSS、SAS 判定方法',
      interpretation: '能运用判定方法完成至少 2 种类型的证明题',
    },
  )
  const [status, setStatus] = useState<LessonPlanStatus>('draft')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  useEffect(() => {
    if (isNew) return
    fetch(`${SERVER_URL}/api/lesson-plans/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.title) setTitle(data.title)
        if (data.class_name) setClassName(data.class_name)
        if (data.subject) setSubject(data.subject)
        if (data.lesson_type) setLessonType(data.lesson_type)
        if (data.blocks) setBlocks(data.blocks)
        if (data.requirement) setRequirement(data.requirement)
        if (data.status) setStatus(data.status)
      })
      .catch(() => {})
  }, [id, isNew])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      if (isNew) {
        const res = await fetch(`${SERVER_URL}/api/lesson-plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, class_name: className, subject, lesson_type: lessonType }),
        })
        const data = await res.json()
        if (data.id) {
          await fetch(`${SERVER_URL}/api/lesson-plans/${data.id}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocks }),
          })
          navigate(`/lesson-plans/${data.id}`, { replace: true })
        }
      } else {
        await Promise.all([
          fetch(`${SERVER_URL}/api/lesson-plans/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, class_name: className, subject, lesson_type: lessonType }),
          }),
          fetch(`${SERVER_URL}/api/lesson-plans/${id}/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blocks }),
          }),
        ])
      }
      setLastSaved(new Date())
    } catch {
      // silently fail for now
    } finally {
      setSaving(false)
    }
  }, [isNew, id, title, className, subject, lessonType, blocks, navigate])

  const handlePublish = useCallback(async () => {
    if (isNew || !id) return
    setPublishing(true)
    try {
      await fetch(`${SERVER_URL}/api/lesson-plans/${id}/publish`, { method: 'POST' })
      setStatus('published')
    } catch {
      // silently fail
    } finally {
      setPublishing(false)
    }
  }, [isNew, id])

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '12px',
    background: 'var(--surface)',
    color: 'var(--t2)',
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div style={{ maxWidth: '920px', padding: '28px 0' }}>
      {/* Back link */}
      <button
        onClick={() => navigate('/lesson-plans')}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--t2)',
          fontSize: '12px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: '0',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        ← 教案列表
      </button>

      <div className="ed-layout" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 200px',
        gap: '24px',
      }}>
        {/* Main editing area */}
        <div>
          {/* Requirement Banner */}
          <div style={{ marginBottom: '16px' }}>
            <RequirementBanner
              requirement={requirement}
              onLink={() => {}}
              onChange={() => {}}
            />
          </div>

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入教案标题..."
            style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--t1)',
              border: 'none',
              background: 'transparent',
              outline: 'none',
              width: '100%',
              fontFamily: 'inherit',
              marginBottom: '10px',
            }}
          />

          {/* Meta selectors + auto-save */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}>
            <select value={className} onChange={(e) => setClassName(e.target.value)} style={selectStyle}>
              <option value="八(2)班">八(2)班</option>
              <option value="八(1)班">八(1)班</option>
              <option value="七(3)班">七(3)班</option>
            </select>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} style={selectStyle}>
              <option value="数学">数学</option>
              <option value="语文">语文</option>
              <option value="英语">英语</option>
            </select>
            <select value={lessonType} onChange={(e) => setLessonType(e.target.value)} style={selectStyle}>
              <option value="新授课">新授课</option>
              <option value="复习课">复习课</option>
              <option value="练习课">练习课</option>
            </select>
            <span style={{ fontSize: '11px', color: 'var(--t3)', marginLeft: 'auto' }}>
              {lastSaved ? `自动保存 · ${formatMinutesAgo(lastSaved)}` : '未保存'}
            </span>
          </div>

          {/* Block Editor */}
          <BlockEditor
            mode="lesson"
            blocks={blocks}
            onChange={setBlocks}
          />

          {/* Action bar */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '24px',
            justifyContent: 'flex-end',
          }}>
            {!isNew && status === 'draft' && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                style={{
                  padding: '8px 16px',
                  border: '1px solid var(--border)',
                  background: 'var(--green-bg)',
                  color: 'var(--green)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: publishing ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 500,
                  opacity: publishing ? 0.7 : 1,
                }}
              >
                {publishing ? '发布中...' : '发布'}
              </button>
            )}
            {!isNew && status === 'published' && (
              <span style={{
                padding: '8px 16px',
                fontSize: '11px',
                color: 'var(--green)',
                fontWeight: 500,
              }}>
                已发布
              </span>
            )}
            <button style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--t2)',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              导出 Word
            </button>
            <button style={{
              padding: '8px 16px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--t2)',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              导出 PDF
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: 'var(--t1)',
                color: 'var(--surface)',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: saving ? 'default' : 'pointer',
                fontFamily: 'inherit',
                fontWeight: 500,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Template section */}
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--t3)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}>
              模板
            </div>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '12px',
              color: 'var(--t2)',
            }}>
              新授课模板
            </div>
          </div>

          {/* Related data */}
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--t3)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}>
              关联数据
            </div>
            <div style={{ fontSize: '11px', color: 'var(--t2)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {requirement && <div>● 课标: {requirement.code}</div>}
              <div>● 学情: {className}</div>
            </div>
          </div>

          {/* Files */}
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--t3)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
            }}>
              文件
            </div>
            <button style={{
              width: '100%',
              padding: '8px',
              border: '1px dashed var(--border)',
              background: 'transparent',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'var(--t3)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}>
              上传文件
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 800px) {
          .ed-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

function formatMinutesAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '刚刚'
  return `${minutes} 分钟前`
}
