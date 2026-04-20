import { useState, useCallback } from 'react'

/** Renders a restricted subset of HTML tags as React elements (strong, span.ex, br). */
function SafeHtml({ html }: { html: string }) {
  const nodes: React.ReactNode[] = []
  let key = 0
  const re = /<strong>(.*?)<\/strong>|<span class="ex">(.*?)<\/span>|<br\s*\/?>|([^<]+)/g
  let match
  while ((match = re.exec(html)) !== null) {
    if (match[1] !== undefined) {
      nodes.push(<strong key={key++}>{match[1]}</strong>)
    } else if (match[2] !== undefined) {
      nodes.push(<span key={key++} className="ex">{match[2]}</span>)
    } else if (match[0].startsWith('<br')) {
      nodes.push(<br key={key++} />)
    } else if (match[3] !== undefined) {
      nodes.push(match[3])
    }
  }
  return <>{nodes}</>
}

interface Preset {
  q: string
  a: string
}

interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
}

const API_BASE = 'http://localhost:3007/api/classroom'

interface Props {
  open: boolean
  onClose: () => void
  presets: Preset[]
  sessionCode?: string
  studentId?: string
  step?: number
}

export default function AiPanel({ open, onClose, presets, sessionCode, studentId, step }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<Record<number, 'got' | 'not'>>({})

  const askPreset = useCallback((idx: number) => {
    const p = presets[idx]
    if (!p) return
    setMessages([
      { role: 'user', text: p.q },
      { role: 'assistant', text: p.a },
    ])
  }, [presets])

  const sendCustom = useCallback(async () => {
    if (!input.trim()) return
    const question = input.trim()
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setInput('')

    if (sessionCode) {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/${sessionCode}/ai/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: studentId || 'anonymous', question, step: step ?? 0 }),
        })
        if (res.ok) {
          const data = await res.json()
          setMessages(prev => [...prev, { role: 'assistant', text: data.answer }])
        } else {
          setMessages(prev => [...prev, { role: 'assistant', text: '抱歉，暂时无法回答，请稍后再试。' }])
        }
      } catch {
        setMessages(prev => [...prev, { role: 'assistant', text: '网络错误，请稍后再试。' }])
      } finally {
        setLoading(false)
      }
    }
  }, [input, sessionCode, studentId, step])

  const handleFeedback = useCallback((msgIdx: number, kind: 'got' | 'not') => {
    setFeedback(prev => ({ ...prev, [msgIdx]: kind }))
    if (kind === 'not') {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: '换个说法 — 把它想象成给文章画思维导图：每段第一句是"分支标题"，转折词是"分支方向"。' },
      ])
    }
  }, [])

  return (
    <div className={`stu-ai-panel${open ? ' open' : ''}`}>
      <div className="stu-ai-inner">
        <div className="stu-ai-hd">
          <div className="stu-ai-hd-ic">💬</div>
          <div className="stu-ai-hd-title">AI 助教</div>
          <button className="stu-ai-hd-close" onClick={onClose}>收起 ▼</button>
        </div>
        <div className="stu-ai-chips">
          {presets.map((p, i) => (
            <button key={i} className="stu-ai-chip" onClick={() => askPreset(i)}>
              {p.q}
            </button>
          ))}
        </div>
        <div className="stu-ai-chat">
          {messages.map((m, i) => (
            <div key={i}>
              {m.role === 'user' ? (
                <div className="stu-ai-q">{m.text}</div>
              ) : (
                <>
                  <div className="stu-ai-a"><SafeHtml html={m.text} /></div>
                  {!feedback[i] && (
                    <div className="stu-ai-fb">
                      <div className="stu-ai-fb-q">这个解释清楚吗？</div>
                      <div className="stu-ai-fb-btns">
                        <button
                          className="stu-ai-fb-btn got"
                          onClick={() => handleFeedback(i, 'got')}
                        >
                          <span>✓</span>我明白了
                        </button>
                        <button
                          className="stu-ai-fb-btn not"
                          onClick={() => handleFeedback(i, 'not')}
                        >
                          <span>?</span>还不明白
                        </button>
                      </div>
                    </div>
                  )}
                  {feedback[i] === 'got' && (
                    <div className="stu-ai-fb done">
                      <div className="stu-ai-fb-ack">✓ 已记录 · <strong>明白了</strong>。继续学习吧 →</div>
                    </div>
                  )}
                  {feedback[i] === 'not' && (
                    <div className="stu-ai-fb escal">
                      <div className="stu-ai-fb-ack">已记录 · <strong>还不明白</strong>，再换种方式讲一遍</div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {loading && (
            <div className="stu-ai-a" style={{ opacity: 0.6, fontStyle: 'italic' }}>思考中...</div>
          )}
        </div>
        <div className="stu-ai-input-row">
          <div className="stu-ai-av">💬</div>
          <input
            className="stu-ai-in"
            placeholder="也可以直接问..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendCustom()}
          />
          <button className="stu-ai-send" onClick={sendCustom}>↗</button>
        </div>
      </div>
    </div>
  )
}
