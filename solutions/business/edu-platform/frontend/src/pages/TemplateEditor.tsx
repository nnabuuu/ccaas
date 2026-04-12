import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Block } from '../types/lesson-plan'
import type { Template, TemplateScope } from '../types/template'
import { BlockEditor } from '../components/editor/BlockEditor'
import { EDU_API } from '../config'

const SCOPE_LABELS: Record<TemplateScope, string> = {
  district: '区级',
  school: '校本',
  teacher: '个人',
}

export function TemplateEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [lessonType, setLessonType] = useState('')
  const [subject, setSubject] = useState('')
  const [scope, setScope] = useState<TemplateScope>('teacher')
  const [version, setVersion] = useState('')
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  // Load template data
  useEffect(() => {
    if (isNew) return
    setLoading(true)
    fetch(`${EDU_API}/templates/${id}`)
      .then((res) => res.json())
      .then((data: Template) => {
        setName(data.name ?? '')
        setDescription(data.description ?? '')
        setLessonType(data.lesson_type ?? '')
        setSubject(data.subject ?? '')
        setScope(data.scope ?? 'teacher')
        setVersion(data.version ?? '')
        setBlocks(data.blocks ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, isNew])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      if (isNew) {
        const res = await fetch(`${EDU_API}/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            lesson_type: lessonType,
            subject,
            blocks,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          navigate(`/templates/${data.id}`, { replace: true })
        }
      } else {
        await fetch(`${EDU_API}/templates/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            lesson_type: lessonType,
            subject,
            blocks,
          }),
        })
      }
    } catch {
      // Handle error silently
    } finally {
      setSaving(false)
    }
  }, [id, isNew, name, description, lessonType, subject, blocks, navigate])

  if (loading) {
    return (
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ color: 'var(--t3)', fontSize: '12px' }}>加载中...</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '28px 24px' }}>
      {/* Back link */}
      <button
        onClick={() => navigate('/templates')}
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
        <span style={{ fontSize: '14px' }}>←</span> 返回模板列表
      </button>

      {/* Title */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="输入模板名称..."
        style={{
          width: '100%',
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--t1)',
          border: 'none',
          background: 'transparent',
          padding: 0,
          marginBottom: '8px',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />

      {/* Description */}
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="输入模板描述..."
        style={{
          width: '100%',
          fontSize: '12px',
          color: 'var(--t2)',
          border: 'none',
          background: 'transparent',
          padding: 0,
          marginBottom: '12px',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />

      {/* Meta */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
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
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
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
          <option value="">通用（全学科）</option>
          <option value="数学">数学</option>
          <option value="语文">语文</option>
          <option value="英语">英语</option>
        </select>
        <span
          style={{
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: '4px',
            background: 'var(--bg2)',
            color: 'var(--t3)',
            fontWeight: 500,
          }}
        >
          {SCOPE_LABELS[scope]}
        </span>
        {version && (
          <span style={{ fontSize: '10px', color: 'var(--t3)' }}>v{version}</span>
        )}
      </div>

      {/* Info banner */}
      <div
        style={{
          padding: '10px 14px',
          background: 'var(--bg2)',
          borderRadius: '6px',
          fontSize: '11px',
          color: 'var(--t2)',
          marginBottom: '16px',
        }}
      >
        模板定义教案的结构框架。每个内容块的文字是提示语，教师使用模板新建教案时会看到这些提示。
      </div>

      {/* Block Editor */}
      <BlockEditor mode="template" blocks={blocks} onChange={setBlocks} />

      {/* Action bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '24px',
          paddingTop: '16px',
        }}
      >
        <button
          onClick={() => navigate('/templates')}
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
          取消
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
          {saving ? '保存中...' : '保存模板'}
        </button>
      </div>
    </div>
  )
}
