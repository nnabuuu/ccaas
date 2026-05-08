import { useState } from 'react'

const themes = {
  dark: { bg: '#0a0a0a', text: '#f5f5f5', card: '#181818', border: '#282828', sub: '#999', badgeBg: '#f5f5f5', badgeText: '#0a0a0a', toggle: '#333' },
  light: { bg: '#f5f5f5', text: '#111', card: '#fff', border: '#e0e0e0', sub: '#666', badgeBg: '#111', badgeText: '#fff', toggle: '#ddd' },
} as const

export default function HowToJoinPage() {
  const [mode, setMode] = useState<'dark' | 'light'>('dark')
  const t = themes[mode]
  const joinUrl = `${window.location.origin}/join`

  const steps = [
    { num: 1, title: '打开加入页面', desc: joinUrl },
    { num: 2, title: '输入课堂代码', desc: '输入老师提供的 6 位课堂代码' },
    { num: 3, title: '输入你的名字', desc: '填写真实姓名，方便老师识别' },
    { num: 4, title: '等待老师开始', desc: '进入等候室，老师开始后自动进入课堂' },
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background: t.bg,
        color: t.text,
        fontFamily: '"Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif',
        transition: 'background .2s, color .2s',
      }}
    >
      <button
        onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 'none',
          background: t.toggle,
          color: t.text,
          fontSize: 18,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {mode === 'dark' ? '\u2600' : '\u263E'}
      </button>

      <h1 style={{ fontSize: 40, fontWeight: 800, marginBottom: 48, letterSpacing: -1 }}>
        如何加入课堂
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 560, width: '100%' }}>
        {steps.map((s) => (
          <div
            key={s.num}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 20,
              padding: '24px 28px',
              borderRadius: 16,
              background: t.card,
              border: `1px solid ${t.border}`,
              transition: 'background .2s, border-color .2s',
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: t.badgeBg,
                color: t.badgeText,
                fontSize: 20,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {s.num}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>{s.title}</div>
              <div style={{ fontSize: 18, color: t.sub, wordBreak: 'break-all' }}>
                {s.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
