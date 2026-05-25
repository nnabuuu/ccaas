import { useState, type FormEvent } from 'react'

/**
 * Full-screen overlay shown when visiting /task-demo/:code without `?user=`.
 * Picks a display name, then re-routes via setName() which the parent reads
 * to drop `?user=...` onto the URL.
 */
export function NamePicker({ onPick }: { onPick: (name: string) => void }) {
  const [name, setName] = useState('')
  const trimmed = name.trim()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (trimmed.length === 0) return
    onPick(trimmed)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4f3ef',
        fontFamily: 'system-ui, -apple-system, "PingFang SC", sans-serif',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: '#fbfaf7',
          padding: '32px 36px',
          borderRadius: 12,
          border: '1px solid rgba(28,28,26,.07)',
          boxShadow: '0 12px 36px rgba(0,0,0,.08)',
          width: 380,
          maxWidth: 'calc(100vw - 40px)',
        }}
      >
        <h1
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 22,
            margin: '0 0 8px',
            color: '#1c1c1a',
          }}
        >
          欢迎试用
        </h1>
        <p style={{ fontSize: 13, color: '#5c5b56', margin: '0 0 18px', lineHeight: 1.5 }}>
          请输入一个名字，方便分辨你的答题记录。同一名字可以稍后回到此 URL 继续。
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：李同学"
          maxLength={40}
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 14,
            border: '1px solid rgba(28,28,26,.14)',
            borderRadius: 6,
            background: '#fff',
            color: '#1c1c1a',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button
            type="submit"
            disabled={trimmed.length === 0}
            style={{
              padding: '8px 18px',
              background: trimmed ? '#1c1c1a' : '#9c9a92',
              color: '#f0efe8',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: trimmed ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            开始
          </button>
        </div>
      </form>
    </div>
  )
}
