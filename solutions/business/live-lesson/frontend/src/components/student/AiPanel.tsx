import { useState, useCallback } from 'react'

interface Preset {
  q: string
  a: string
}

interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
}

interface Props {
  open: boolean
  onClose: () => void
  presets: Preset[]
}

export default function AiPanel({ open, onClose, presets }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState<Record<number, 'got' | 'not'>>({})

  const askPreset = useCallback((idx: number) => {
    const p = presets[idx]
    if (!p) return
    setMessages([
      { role: 'user', text: p.q },
      { role: 'assistant', text: p.a },
    ])
  }, [presets])

  const sendCustom = useCallback(() => {
    if (!input.trim()) return
    setMessages(prev => [...prev, { role: 'user', text: input.trim() }])
    setInput('')
  }, [input])

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
                  <div className="stu-ai-a" dangerouslySetInnerHTML={{ __html: m.text }} />
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
