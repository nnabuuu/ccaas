import { useCallback, useEffect, type ReactNode } from 'react'
import { useChatCore } from '@/context/ChatCoreContext'

export interface ChatInterfaceComposerProps {
  placeholder?: string
  /** Disclaimer text below the input. Pass `null` to hide entirely. */
  disclaimer?: ReactNode | null
  /** Keyboard shortcut hint shown in the disclaimer area */
  shortcutHint?: string
  className?: string
}

export function ChatInterfaceComposer({
  placeholder = '输入消息...',
  disclaimer,
  shortcutHint = 'Esc 取消 · ⌘/ 聚焦',
  className,
}: ChatInterfaceComposerProps) {
  const {
    input,
    setInput,
    inputRef,
    handleSend,
    isProcessing,
    cancelProcessing,
    sessionReady,
  } = useChatCore()

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxH = 6 * 24 // ~6 lines
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px'
  }, [inputRef])

  useEffect(() => {
    resizeTextarea()
  }, [input, resizeTextarea])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const showDisclaimer = disclaimer !== null

  return (
    <div className={className ?? 'bg-ck-bg2 px-4 pb-4 pt-2'}>
      <div className="max-w-3xl mx-auto relative rounded-[20px] bg-ck-bg1 shadow-composer hover:shadow-composer-hover focus-within:shadow-composer-focus transition-shadow duration-200">
        <textarea
          ref={inputRef}
          rows={1}
          className="w-full resize-none bg-transparent text-base text-ck-t1 outline-none px-3.5 pt-3.5 pb-14 md:pb-8 placeholder:text-ck-t3"
          aria-label="输入消息"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!sessionReady}
        />
        {isProcessing ? (
          <button
            onClick={cancelProcessing}
            className="absolute bottom-2.5 right-2.5 w-11 h-11 md:w-8 md:h-8 rounded-lg bg-ck-bg3 text-ck-t2 cursor-pointer flex items-center justify-center shrink-0 hover:bg-ck-b1 transition-colors active:scale-95 focus-visible:ring-2 focus-visible:ring-ck-accent"
            aria-label="停止生成"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect width="14" height="14" rx="2" /></svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="absolute bottom-2.5 right-2.5 w-11 h-11 md:w-8 md:h-8 rounded-lg bg-ck-accent text-white cursor-pointer flex items-center justify-center text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ck-accent-hover transition-colors active:scale-95 focus-visible:ring-2 focus-visible:ring-ck-accent"
          >
            &#8593;
          </button>
        )}
      </div>
      {showDisclaimer && (
        <p className="text-center text-xs text-ck-t3 mt-2">
          {disclaimer ?? (
            <>
              AI 可能会犯错，请核实重要信息。
              <span className="hidden md:inline ml-2 text-ck-t3/60">{shortcutHint}</span>
            </>
          )}
        </p>
      )}
    </div>
  )
}
