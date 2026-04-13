import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { SERVER_URL } from '../config'
import type { Block } from '../types/lesson-plan'
import type { TemplateScope } from '../types/template'
import { BlockEditor } from '../components/editor/BlockEditor'

const DEMO_BLOCKS: Block[] = [
  { id: 't1', type: 'section', content: { title: '教学目标' }, sort_order: 0, is_required: true },
  { id: 't2', type: 'text', content: { text: '' }, sort_order: 1, placeholder: '在此填写本节课的教学目标...', is_required: true },
  { id: 't3', type: 'section', content: { title: '重难点' }, sort_order: 2, is_required: true },
  { id: 't4', type: 'list', content: { items: [''], ordered: false }, sort_order: 3, placeholder: '列出重点和难点...' },
  { id: 't5', type: 'section', content: { title: '教学过程' }, sort_order: 4, is_required: true },
  { id: 't6', type: 'timeline', content: { entries: [{ time: "0-5'", duration: '5min', description: '' }] }, sort_order: 5, placeholder: '描述导入环节...' },
  { id: 't7', type: 'callout', content: { text: '' }, sort_order: 6, placeholder: '学情备注提示...' },
]

export function TemplateEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [lessonType, setLessonType] = useState('新授课')
  const [subject, setSubject] = useState('通用')
  const [scope, setScope] = useState<TemplateScope>('teacher')
  const [version, setVersion] = useState('v1.0')
  const [blocks, setBlocks] = useState<Block[]>(isNew ? [] : DEMO_BLOCKS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isNew) return
    fetch(`${SERVER_URL}/api/templates/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setName(data.name)
        if (data.description) setDescription(data.description)
        if (data.lesson_type) setLessonType(data.lesson_type)
        if (data.subject) setSubject(data.subject)
        if (data.scope) setScope(data.scope)
        if (data.version) setVersion(data.version)
        if (data.blocks) setBlocks(data.blocks)
      })
      .catch(() => {})
  }, [id, isNew])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const payload = {
        name,
        description,
        lesson_type: lessonType,
        subject,
        scope,
        blocks,
      }
      if (isNew) {
        const res = await fetch(`${SERVER_URL}/api/templates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.id) {
          navigate(`/templates/${data.id}`, { replace: true })
        }
      } else {
        await fetch(`${SERVER_URL}/api/templates/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }, [isNew, id, name, description, lessonType, subject, scope, blocks, navigate])

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

  const scopeLabel = scope === 'district' ? '区级' : scope === 'school' ? '校本' : '个人'

  return (
    <div style={{ maxWidth: '640px', padding: '28px 0' }}>
      {/* Back link */}
      <button
        onClick={() => navigate('/templates')}
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
        ← 返回模板列表
      </button>

      {/* Title */}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="输入模板名称..."
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: 'var(--t1)',
          border: 'none',
          background: 'transparent',
          outline: 'none',
          width: '100%',
          fontFamily: 'inherit',
          marginBottom: '8px',
        }}
      />

      {/* Description */}
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="输入模板描述..."
        style={{
          fontSize: '13px',
          color: 'var(--t2)',
          border: 'none',
          background: 'transparent',
          outline: 'none',
          width: '100%',
          fontFamily: 'inherit',
          marginBottom: '12px',
        }}
      />

      {/* Meta */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}>
        <select value={lessonType} onChange={(e) => setLessonType(e.target.value)} style={selectStyle}>
          <option value="新授课">新授课</option>
          <option value="复习课">复习课</option>
          <option value="练习课">练习课</option>
        </select>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} style={selectStyle}>
          <option value="通用">通用（全学科）</option>
          <option value="数学">数学</option>
          <option value="语文">语文</option>
          <option value="英语">英语</option>
        </select>
        <span style={{
          fontSize: '10px',
          padding: '2px 8px',
          borderRadius: '4px',
          fontWeight: 500,
          background: 'var(--surface2)',
          color: 'var(--t3)',
        }}>
          {scopeLabel}
        </span>
        <span style={{
          fontSize: '10px',
          color: 'var(--t3)',
        }}>
          {version}
        </span>
      </div>

      {/* Info banner */}
      <div style={{
        padding: '10px 14px',
        background: 'var(--surface2)',
        borderRadius: '6px',
        fontSize: '11px',
        color: 'var(--t2)',
        marginBottom: '16px',
        lineHeight: 1.5,
      }}>
        模板定义教案的结构框架。每个内容块的文字是提示语，教师使用模板创建教案时会看到这些提示。
      </div>

      {/* Block Editor */}
      <BlockEditor
        mode="template"
        blocks={blocks}
        onChange={setBlocks}
      />

      {/* Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        marginTop: '24px',
      }}>
        <button
          onClick={() => navigate('/templates')}
          style={{
            padding: '8px 16px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--t2)',
            borderRadius: '6px',
            fontSize: '12px',
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
          {saving ? '保存中...' : '保存模板'}
        </button>
      </div>
    </div>
  )
}
