import { useState, useEffect, useCallback, useRef, useContext } from 'react'
import { createPortal } from 'react-dom'
import { translateText, translateChat, type TranslateResponse } from '../../hooks/useClassroom'
import { SessionCtx } from './TaskPanel'

type Mode = 'idle' | 'selecting' | 'showing'

const MAX_CHARS = 500

/** Popover height budget (max-height 420 + gap) */
const POP_H = 430
/** Popover width budget (width 340 + margin) */
const POP_W = 356
/** Minimum edge padding */
const EDGE_PAD = 8

export interface Viewport { innerWidth: number; innerHeight: number }

/**
 * Calculate popover position so it stays within the viewport.
 * - Prefers below the selection; flips above if it won't fit.
 * - Clamps horizontally to keep the popover on-screen.
 */
export function calcPopoverPos(
  rect: { top: number; bottom: number; left: number },
  vp: Viewport,
): { top: number; left: number } {
  const below = rect.bottom + EDGE_PAD
  const top = below + POP_H > vp.innerHeight
    ? Math.max(EDGE_PAD, rect.top - POP_H)
    : below
  const left = Math.max(EDGE_PAD, Math.min(rect.left, vp.innerWidth - POP_W))
  return { top, left }
}

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
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chatLoadingRef = useRef(false)
  const cancelledRef = useRef(false)
  const fabRef = useRef<HTMLButtonElement>(null)

  const reset = useCallback(() => {
    cancelledRef.current = true
    chatLoadingRef.current = false
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
    if (cancelledRef.current) { chatLoadingRef.current = false; return }
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
        setPopoverPos(calcPopoverPos(rect, window))
      }

      const ctx = detectContext(sel?.anchorNode ?? null)
      setSelectedText(text)
      setSourceCtx(ctx)
      cancelledRef.current = false
      setResult(null)
      setMode('showing')
      document.body.style.cursor = ''

      if (sessionCode && studentId) {
        const res = await translateText(sessionCode, studentId, text, taskId, ctx, phase)
        if (cancelledRef.current) return
        setResult(res ?? { definition: '翻译失败，请重试', contextAnalysis: '', suggestedQuestions: [] })
      } else {
        setResult({ definition: '未连接课堂', contextAnalysis: '', suggestedQuestions: [] })
      }

      if (cancelledRef.current) return
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

  // Toggle .translate class on parent toolbar
  useEffect(() => {
    const toolbar = fabRef.current?.closest('.stu-toolbar-h')
    if (!toolbar) return
    if (mode !== 'idle') {
      toolbar.classList.add('translate')
    } else {
      toolbar.classList.remove('translate')
    }
    return () => { toolbar.classList.remove('translate') }
  }, [mode])

  const hasChatStarted = chatMsgs.length > 0

  return (
    <>
      {/* Overlay + Banner (selecting mode) — portaled to escape toolbar stacking context */}
      {mode === 'selecting' && createPortal(
        <>
          <div className="stu-tr-overlay" />
          <div className={`stu-tr-banner${warning ? ' warn' : ''}`}>
            {warning || '👆 选择页面上的文字即可翻译'}
          </div>
        </>,
        document.body,
      )}

      {/* Popover — portaled to escape toolbar stacking context */}
      {mode === 'showing' && popoverPos && createPortal(
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
            {result ? (
              <>
                <div className="stu-tr-def">{result.definition}</div>
                {result.contextAnalysis && (
                  <div className="stu-tr-ctx">{result.contextAnalysis}</div>
                )}
              </>
            ) : (
              <div className="stu-tr-loading">
                <div className="stu-tr-skel" />
                <div className="stu-tr-skel short" />
              </div>
            )}
          </div>

          {/* Suggested question chips — hide after chat starts */}
          {result && !hasChatStarted && result.suggestedQuestions.length > 0 && (
            <div className="stu-tr-chips">
              {result.suggestedQuestions.map((q, i) => (
                <button key={i} className="stu-tr-chip" onClick={() => sendChat(q)}>{q}</button>
              ))}
            </div>
          )}

          {/* Chat messages */}
          {result && hasChatStarted && (
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
          {result && hasChatStarted && (
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
        </div>,
        document.body,
      )}

      {/* Inline status text — visible when translate is active */}
      {mode !== 'idle' && (
        <span className="stu-tr-inline">
          <span className="stu-tr-inline-dot" />
          {mode === 'selecting' ? '选词中…' : '查看释义'}
        </span>
      )}

      {/* FAB */}
      <button
        ref={fabRef}
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
