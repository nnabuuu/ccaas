import { useState, useRef, useCallback, useContext } from 'react'
import { useAiAsk } from '../../../hooks/useClassroom'
import { SessionCtx } from '../TaskPanel'

interface ChatMsg {
  t: 'q' | 'a'
  x: string
}

interface Props {
  taskId: number
}

/* AI presets per task */
const AI_BANK: Record<number, Array<{ q: string; a: string }>> = {
  1: [
    { q: 'What does "conflict" mean?', a: 'Conflict = 冲突。Two opposite ideas of beauty: gaining weight (Nigeria) vs slim (media).' },
    { q: 'I don\'t understand ¶2', a: '¶2: media promotes "shallow beauty ideals" — too simple, only about appearance. The writer questions this.' },
  ],
  2: [
    { q: 'What is "Phenomenon"?', a: 'Phenomenon = 现象。¶1-2 describes a phenomenon: different cultures have different beauty standards.' },
    { q: 'What does "It appears that" mean?', a: '"It appears that" = 看起来。A signal word for conclusions.' },
  ],
  3: [
    { q: 'How to fill Myanmar?', a: '¶7: "women wearing metal rings around their necks." Practice = wearing metal neck rings.' },
    { q: 'Can\'t find the reason', a: 'Some reasons are implied. Borneo: tattoos like "a diary" → reason = recording life events.' },
  ],
  4: [
    { q: 'What does "shallow" mean?', a: 'Shallow = 肤浅。Media beauty is "shallow" because it only cares about looks, ignoring cultural meaning.' },
    { q: 'Can I add my own ideas?', a: 'Yes! Text evidence + your own observations both work.' },
  ],
  5: [
    { q: 'What are the 4 strategies?', a: '1. Predicting → 2. Skimming → 3. Scanning → 4. Evaluating' },
    { q: 'Works for other texts?', a: 'Absolutely! These 4 steps work for any argumentative or expository text.' },
  ],
}

export default function AIFloat({ taskId }: Props) {
  const { sessionCode, studentId } = useContext(SessionCtx)
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)
  const { ask, loading } = useAiAsk(sessionCode || '')

  const presets = AI_BANK[taskId] || []

  const addMsg = (q: string, a: string) => {
    setMsgs(m => [...m, { t: 'q', x: q }, { t: 'a', x: a }])
    setTimeout(() => chatRef.current && (chatRef.current.scrollTop = chatRef.current.scrollHeight), 50)
  }

  const sendQuestion = useCallback(async (question: string) => {
    if (!question.trim()) return

    // If we have a backend connection, use it
    if (sessionCode && studentId) {
      setMsgs(m => [...m, { t: 'q', x: question.trim() }])
      setInput('')
      const result = await ask(studentId, taskId, question.trim())
      setMsgs(m => [...m, { t: 'a', x: result?.answer || 'AI assistant is temporarily unavailable.' }])
      setTimeout(() => chatRef.current && (chatRef.current.scrollTop = chatRef.current.scrollHeight), 50)
    } else {
      // Offline mode: check if it matches a preset
      const preset = presets.find(p => p.q === question)
      if (preset) {
        addMsg(preset.q, preset.a)
      } else {
        addMsg(question, 'Think about how the evidence in the text connects to your idea. Try using the pattern: "Based on the text, I think... because..."')
      }
      setInput('')
    }
  }, [sessionCode, studentId, taskId, ask, presets])

  const handleSend = () => {
    if (!input.trim() || loading) return
    sendQuestion(input.trim())
  }

  return (
    <>
      {/* FAB button */}
      <button
        className="stu-ai-fab"
        style={open ? { transform: 'rotate(45deg)' } : undefined}
        onClick={() => setOpen(!open)}
      >
        {open ? '+' : '?'}
      </button>

      {/* Floating panel */}
      {open && (
        <div className="stu-ai-float-panel">
          {/* Header */}
          <div className="stu-ai-float-hd">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--purple)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--purple)', flex: 1 }}>AI Assistant</span>
          </div>

          {/* Preset chips */}
          {presets.length > 0 && (
            <div className="stu-ai-float-chips">
              {presets.map((pr, i) => (
                <button
                  key={i}
                  className="stu-ai-float-chip"
                  onClick={() => addMsg(pr.q, pr.a)}
                  disabled={loading}
                >{pr.q}</button>
              ))}
            </div>
          )}

          {/* Chat messages */}
          <div ref={chatRef} className="stu-ai-float-chat">
            {msgs.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', padding: 16 }}>Ask me anything!</div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.t === 'q' ? 'stu-ai-float-q' : 'stu-ai-float-a'}>{m.x}</div>
            ))}
            {loading && (
              <div className="stu-ai-float-a" style={{ opacity: 0.6 }}>Thinking...</div>
            )}
          </div>

          {/* Input */}
          <div className="stu-ai-float-input">
            <input
              style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)' }}
              placeholder="Type your question..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={loading}
            />
            <button
              style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'var(--t1)', color: 'var(--surface)', cursor: 'pointer', fontSize: 12 }}
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >→</button>
          </div>
        </div>
      )}
    </>
  )
}
