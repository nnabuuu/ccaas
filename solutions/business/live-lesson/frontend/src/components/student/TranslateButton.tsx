import { useState, useEffect, useCallback, useRef, useContext } from 'react'
import { translateText, translateChat, type TranslateResponse } from '../../hooks/useClassroom'
import { SessionCtx } from './TaskPanel'

type Mode = 'idle' | 'selecting' | 'loading' | 'showing'

const MAX_CHARS = 500

interface ChatMsg { t: 'q' | 'a'; x: string }

interface Props {
  taskId: number
  phase?: string
}

export default function TranslateButton({ taskId, phase }: Props) {
  const { sessionCode, studentId } = useContext(SessionCtx)
  const [mode, setMode] = useState<Mode>('idle')
  const [result, setResult] = useState<TranslateResponse | null>(null)
  const [warning, setWarning] = useState('')
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [cooldown, setCooldown] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [sourceCtx, setSourceCtx] = useState('')
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const chatLoadingRef = useRef(false)

  const reset = useCallback(() => {
    setMode('idle')
    setResult(null)
    setWarning('')
    setPopoverPos(null)
    setSelectedText('')
    setSourceCtx('')
    setChatMsgs([])
    setChatInput('')
    setChatLoading(false)
    document.body.style.cursor = ''
  }, [])

  const enterSelecting = useCallback(() => {
    if (cooldown) return
    setMode('selecting')
    setResult(null)
    setWarning('')
    setPopoverPos(null)
    setSelectedText('')
    setSourceCtx('')
    setChatMsgs([])
    setChatInput('')
    document.body.style.cursor = 'text'
  }, [cooldown])

  const toggleMode = useCallback(() => {
    if (mode === 'idle') {
      enterSelecting()
    } else {
      reset()
    }
  }, [mode, enterSelecting, reset])

  // Detect source context from DOM
  const detectContext = useCallback((node: Node | null): string => {
    let el = node instanceof Element ? node : node?.parentElement
    while (el) {
      const ctx = el.getAttribute('data-translate-ctx')
      if (ctx) return ctx
      el = el.parentElement
    }
    return 'unknown'
  }, [])

  // Send a follow-up chat question
  const sendChat = useCallback(async (question: string) => {
    if (!sessionCode || !studentId || !selectedText || chatLoadingRef.current) return
    chatLoadingRef.current = true
    setChatMsgs(prev => [...prev, { t: 'q', x: question }])
    setChatLoading(true)
    setChatInput('')
    const reply = await translateChat(sessionCode, studentId, taskId, selectedText, question, sourceCtx)
    if (reply) {
      setChatMsgs(prev => [...prev, { t: 'a', x: reply.reply }])
    } else {
      setChatMsgs(prev => [...prev, { t: 'a', x: 'AI 助教暂时无法回答，请稍后再试。' }])
    }
    chatLoadingRef.current = false
    setChatLoading(false)
  }, [sessionCode, studentId, selectedText, sourceCtx, taskId])

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMsgs, chatLoading])

  // Handle text selection (mouseup)
  useEffect(() => {
    if (mode !== 'selecting') return

    const onMouseUp = async () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim()
      if (!text) return

      if (text.length > MAX_CHARS) {
        setWarning(`已选择 ${text.length} 字符，超过上限 ${MAX_CHARS} 字`)
        return
      }

      setWarning('')

      const range = sel?.getRangeAt(0)
      if (range) {
        const rect = range.getBoundingClientRect()
        const top = rect.bottom + 8
        setPopoverPos({
          top: top + 430 > window.innerHeight ? rect.top - 430 : top,
          left: Math.min(rect.left, window.innerWidth - 356),
        })
      }

      const ctx = detectContext(sel?.anchorNode ?? null)
      setSelectedText(text)
      setSourceCtx(ctx)
      setMode('loading')
      document.body.style.cursor = ''

      if (sessionCode && studentId) {
        const res = await translateText(sessionCode, studentId, text, taskId, ctx, phase)
        if (res) {
          setResult(res)
          setMode('showing')
        } else {
          setResult({ definition: '翻译失败，请重试', contextAnalysis: '', suggestedQuestions: [] })
          setMode('showing')
        }
      } else {
        setResult({ definition: '未连接课堂', contextAnalysis: '', suggestedQuestions: [] })
        setMode('showing')
      }

      setCooldown(true)
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current)
      cooldownTimer.current = setTimeout(() => setCooldown(false), 2000)
    }

    document.addEventListener('mouseup', onMouseUp)
    return () => document.removeEventListener('mouseup', onMouseUp)
  }, [mode, sessionCode, studentId, taskId, phase, detectContext])

  // Escape key to exit
  useEffect(() => {
    if (mode === 'idle') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') reset()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mode, reset])

  // Click outside popover to close
  useEffect(() => {
    if (mode !== 'showing') return
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        reset()
      }
    }
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 100)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onClick) }
  }, [mode, reset])

  // Cleanup cursor + cooldown timer on unmount
  useEffect(() => () => {
    document.body.style.cursor = ''
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current)
  }, [])

  const hasChatStarted = chatMsgs.length > 0

  return (
    <>
      {/* Banner (selecting mode) */}
      {mode === 'selecting' && (
        <div className={`stu-tr-banner${warning ? ' warn' : ''}`}>
          {warning || '请选择需要翻译的文字（最多500字）'}
        </div>
      )}

      {/* Loading banner */}
      {mode === 'loading' && (
        <div className="stu-tr-banner">翻译中...</div>
      )}

      {/* Popover */}
      {mode === 'showing' && popoverPos && result && (
        <div
          ref={popoverRef}
          className="stu-tr-popover"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <div className="stu-tr-popover-hd">
            <span className="stu-tr-popover-icon">译</span>
            <span className="stu-tr-popover-title">释义</span>
            <button className="stu-tr-popover-close" onClick={reset}>×</button>
          </div>

          {/* Definition + context analysis */}
          <div className="stu-tr-popover-body">
            <div className="stu-tr-def">{result.definition}</div>
            {result.contextAnalysis && (
              <div className="stu-tr-ctx">{result.contextAnalysis}</div>
            )}
          </div>

          {/* Suggested question chips — hide after chat starts */}
          {!hasChatStarted && result.suggestedQuestions.length > 0 && (
            <div className="stu-tr-chips">
              {result.suggestedQuestions.map((q, i) => (
                <button key={i} className="stu-tr-chip" onClick={() => sendChat(q)}>{q}</button>
              ))}
            </div>
          )}

          {/* Chat messages */}
          {hasChatStarted && (
            <div className="stu-tr-chat">
              {chatMsgs.map((m, i) => (
                <div key={i} className={`stu-tr-msg ${m.t === 'q' ? 'student' : ''}`}>
                  <div className={`stu-tr-bubble ${m.t === 'q' ? 'student' : 'ai'}`}>{m.x}</div>
                </div>
              ))}
              {chatLoading && (
                <div className="stu-tr-msg">
                  <div className="stu-tr-typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Chat input — show after first interaction */}
          {hasChatStarted && (
            <div className="stu-tr-input">
              <input
                type="text"
                placeholder="输入追问..."
                maxLength={2000}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && chatInput.trim() && !chatLoading) {
                    e.stopPropagation()
                    sendChat(chatInput.trim())
                  }
                }}
                disabled={chatLoading}
              />
              <button
                className="stu-tr-send"
                aria-label="发送"
                disabled={!chatInput.trim() || chatLoading}
                onClick={() => chatInput.trim() && sendChat(chatInput.trim())}
              >→</button>
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        className={`stu-tr-fab${mode !== 'idle' ? ' active' : ''}`}
        onClick={toggleMode}
        disabled={cooldown}
        aria-label={mode === 'idle' ? '翻译' : '取消翻译'}
      >
        译
      </button>
    </>
  )
}
