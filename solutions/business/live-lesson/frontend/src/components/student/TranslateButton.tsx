import { useState, useEffect, useCallback, useRef, useContext } from 'react'
import { translateText } from '../../hooks/useClassroom'
import { SessionCtx } from './TaskPanel'

type Mode = 'idle' | 'selecting' | 'loading' | 'showing'

const MAX_CHARS = 500

interface Props {
  taskId: number
  phase?: string
}

export default function TranslateButton({ taskId, phase }: Props) {
  const { sessionCode, studentId } = useContext(SessionCtx)
  const [mode, setMode] = useState<Mode>('idle')
  const [translation, setTranslation] = useState('')
  const [warning, setWarning] = useState('')
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null)
  const [cooldown, setCooldown] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const cooldownTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const reset = useCallback(() => {
    setMode('idle')
    setTranslation('')
    setWarning('')
    setPopoverPos(null)
    document.body.style.cursor = ''
  }, [])

  const enterSelecting = useCallback(() => {
    if (cooldown) return
    setMode('selecting')
    setTranslation('')
    setWarning('')
    setPopoverPos(null)
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

  // Handle text selection (mouseup)
  useEffect(() => {
    if (mode !== 'selecting') return

    const onMouseUp = async () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim()
      if (!text) return // empty selection — stay in selecting mode

      if (text.length > MAX_CHARS) {
        setWarning(`已选择 ${text.length} 字符，超过上限 ${MAX_CHARS} 字`)
        return
      }

      setWarning('')

      // Get position from selection range
      const range = sel?.getRangeAt(0)
      if (range) {
        const rect = range.getBoundingClientRect()
        const top = rect.bottom + 8
        setPopoverPos({
          top: top + 220 > window.innerHeight ? rect.top - 228 : top,
          left: Math.min(rect.left, window.innerWidth - 336),
        })
      }

      const sourceContext = detectContext(sel?.anchorNode ?? null)

      setMode('loading')
      document.body.style.cursor = ''

      if (sessionCode && studentId) {
        const result = await translateText(sessionCode, studentId, text, taskId, sourceContext, phase)
        if (result) {
          setTranslation(result.translation)
          setMode('showing')
        } else {
          setTranslation('翻译失败，请重试')
          setMode('showing')
        }
      } else {
        setTranslation('未连接课堂')
        setMode('showing')
      }

      // Cooldown to prevent rapid requests
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
    // Delay to avoid catching the mouseup that triggered showing
    const t = setTimeout(() => document.addEventListener('mousedown', onClick), 100)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onClick) }
  }, [mode, reset])

  // Cleanup cursor + cooldown timer on unmount
  useEffect(() => () => {
    document.body.style.cursor = ''
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current)
  }, [])

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
      {mode === 'showing' && popoverPos && (
        <div
          ref={popoverRef}
          className="stu-tr-popover"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          <div className="stu-tr-popover-hd">
            <span className="stu-tr-popover-icon">译</span>
            <span className="stu-tr-popover-title">翻译</span>
            <button className="stu-tr-popover-close" onClick={reset}>×</button>
          </div>
          <div className="stu-tr-popover-body">{translation}</div>
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
