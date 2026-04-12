import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Block, LessonPlan, RequirementInfo } from '../types/lesson-plan'
import { BlockEditor } from '../components/editor/BlockEditor'
import { RequirementBanner } from '../components/editor/RequirementBanner'
import { EDU_API } from '../config'

export function LessonPlanEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [title, setTitle] = useState('')
  const [className, setClassName] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [lessonType, setLessonType] = useState('')
  const [duration, setDuration] = useState(45)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [requirement, setRequirement] = useState<RequirementInfo | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Load lesson plan data
  useEffect(() => {
    if (isNew) return
    setLoading(true)
    fetch(`${EDU_API}/lesson-plans/${id}`)
      .then((res) => res.json())
      .then((data: LessonPlan) => {
        setTitle(data.title ?? '')
        setClassName(data.class_name ?? '')
        setSubjectName(data.subject_name ?? '')
        setLessonType(data.lesson_type ?? '')
        setDuration(data.duration ?? 45)
        setBlocks(data.blocks ?? [])
        setRequirement(data.requirement ?? null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, isNew])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      if (isNew) {
        const res = await fetch(`${EDU_API}/lesson-plans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            class_name: className,
            subject_name: subjectName,
            lesson_type: lessonType,
            duration,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          navigate(`/lesson-plans/${data.id}`, { replace: true })
        }
      } else {
        // Update meta
        await fetch(`${EDU_API}/lesson-plans/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            class_name: className,
            subject_name: subjectName,
            lesson_type: lessonType,
            duration,
          }),
        })
        // Update blocks
        await fetch(`${EDU_API}/lesson-plans/${id}/blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocks }),
        })
        setLastSaved(new Date())
      }
    } catch {
      // Handle error silently
    } finally {
      setSaving(false)
    }
  }, [id, isNew, title, className, subjectName, lessonType, duration, blocks, navigate])

  const handleExport = useCallback(
    async (format: 'word' | 'pdf') => {
      if (isNew) return
      try {
        await fetch(`${EDU_API}/lesson-plans/${id}/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format }),
        })
      } catch {
        // Handle error silently
      }
    },
    [id, isNew]
  )

  const handleLinkRequirement = useCallback(() => {
    // Placeholder: in a real app, this would open a requirement selection panel
    const mockReq: RequirementInfo = {
      id: 'req-1',
      code: '12.2',
      text: '理解并掌握三角形全等的判定方法',
      interpretation: '能运用 SSS、SAS、ASA、AAS 判定三角形全等',
    }
    setRequirement(mockReq)
    if (!isNew) {
      fetch(`${EDU_API}/lesson-plans/${id}/link-requirement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement_id: mockReq.id }),
      }).catch(() => {})
    }
  }, [id, isNew])

  if (loading) {
    return (
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ color: 'var(--t3)', fontSize: '12px' }}>加载中...</div>
      </div>
    )
  }

  const timeSince = lastSaved
    ? `${Math.max(1, Math.round((Date.now() - lastSaved.getTime()) / 60000))} 分钟前`
    : null

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '28px 24px' }}>
      {/* Back link */}
      <button
        onClick={() => navigate('/lesson-plans')}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--t3)',
          cursor: 'pointer',
          fontSize: '12px',
          padding: 0,
          marginBottom: '16px',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span style={{ fontSize: '14px' }}>←</span> 教案列表
      </button>

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Main area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Requirement Banner */}
          <RequirementBanner
            requirement={requirement}
            onLink={handleLinkRequirement}
            onChange={handleLinkRequirement}
          />

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="输入教案标题..."
            style={{
              width: '100%',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--t1)',
              border: 'none',
              background: 'transparent',
              padding: 0,
              marginBottom: '12px',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />

          {/* Meta selectors */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              flexWrap: 'wrap',
            }}
          >
            <select
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              style={{
                padding: '4px 8px',
                border: '0.5px solid var(--b1)',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'inherit',
                background: 'var(--bg1)',
                color: 'var(--t2)',
              }}
            >
              <option value="">选择班级</option>
              <option value="八(1)班">八(1)班</option>
              <option value="八(2)班">八(2)班</option>
              <option value="八(3)班">八(3)班</option>
            </select>
            <select
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              style={{
                padding: '4px 8px',
                border: '0.5px solid var(--b1)',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'inherit',
                background: 'var(--bg1)',
                color: 'var(--t2)',
              }}
            >
              <option value="">选择学科</option>
              <option value="数学">数学</option>
              <option value="语文">语文</option>
              <option value="英语">英语</option>
            </select>
            <select
              value={lessonType}
              onChange={(e) => setLessonType(e.target.value)}
              style={{
                padding: '4px 8px',
                border: '0.5px solid var(--b1)',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'inherit',
                background: 'var(--bg1)',
                color: 'var(--t2)',
              }}
            >
              <option value="">选择课型</option>
              <option value="新授课">新授课</option>
              <option value="复习课">复习课</option>
              <option value="练习课">练习课</option>
            </select>
            <select
              value={String(duration)}
              onChange={(e) => setDuration(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                border: '0.5px solid var(--b1)',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'inherit',
                background: 'var(--bg1)',
                color: 'var(--t2)',
              }}
            >
              <option value="40">40 分钟</option>
              <option value="45">45 分钟</option>
              <option value="90">90 分钟</option>
            </select>

            <div style={{ flex: 1 }} />
            {timeSince && (
              <span style={{ fontSize: '10px', color: 'var(--t3)' }}>
                自动保存 · {timeSince}
              </span>
            )}
          </div>

          {/* Block Editor */}
          <BlockEditor mode="lesson" blocks={blocks} onChange={setBlocks} />

          {/* Related exercises */}
          <div style={{ marginTop: '24px' }}>
            <h4
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--t2)',
                marginBottom: '8px',
              }}
            >
              关联练习
            </h4>
            <button
              style={{
                padding: '8px 12px',
                border: '1px solid var(--b1)',
                borderRadius: '8px',
                background: 'var(--bg1)',
                color: 'var(--t3)',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + 关联练习
            </button>
          </div>

          {/* Action bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid var(--b1)',
            }}
          >
            <button
              onClick={() => handleExport('word')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                borderRadius: '8px',
                border: '0.5px solid var(--b1)',
                background: 'var(--bg1)',
                color: 'var(--t2)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              导出 Word
            </button>
            <button
              onClick={() => handleExport('pdf')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                borderRadius: '8px',
                border: '0.5px solid var(--b1)',
                background: 'var(--bg1)',
                color: 'var(--t2)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              导出 PDF
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                borderRadius: '8px',
                border: '0.5px solid var(--t1)',
                background: 'var(--t1)',
                color: 'var(--bg1)',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.5 : 1,
                fontFamily: 'inherit',
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div
          style={{
            width: '240px',
            flexShrink: 0,
          }}
        >
          {/* Template section */}
          <div style={{ marginBottom: '20px' }}>
            <h4
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--t3)',
                marginBottom: '8px',
                textTransform: 'uppercase',
              }}
            >
              模板
            </h4>
            <div
              style={{
                padding: '10px 12px',
                border: '1px solid var(--b1)',
                borderRadius: '8px',
                fontSize: '11px',
                color: 'var(--t2)',
                cursor: 'pointer',
              }}
            >
              新授课模板
            </div>
          </div>

          {/* Related data section */}
          <div style={{ marginBottom: '20px' }}>
            <h4
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--t3)',
                marginBottom: '8px',
                textTransform: 'uppercase',
              }}
            >
              关联数据
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px' }}>
              {requirement && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--teal-t)' }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--teal-t)',
                      flexShrink: 0,
                    }}
                  />
                  课标: {requirement.code}
                </div>
              )}
              {className && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--info-t)' }}>
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: 'var(--info-t)',
                      flexShrink: 0,
                    }}
                  />
                  学情: {className}
                </div>
              )}
            </div>
          </div>

          {/* Files section */}
          <div>
            <h4
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--t3)',
                marginBottom: '8px',
                textTransform: 'uppercase',
              }}
            >
              文件
            </h4>
            <button
              style={{
                padding: '6px 10px',
                border: '1px solid var(--b1)',
                borderRadius: '6px',
                background: 'var(--bg1)',
                color: 'var(--t3)',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                width: '100%',
              }}
            >
              上传文件
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
