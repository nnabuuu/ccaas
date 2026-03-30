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

/* Rotating suggestion icons matching Claude Web style: pencil, book, code, compass, sparkle */
const SUGGESTION_ICONS = [
  // Pencil (Write)
  <svg key="pencil" className="w-4 h-4 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>,
  // Book (Learn)
  <svg key="book" className="w-4 h-4 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>,
  // Code
  <svg key="code" className="w-4 h-4 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
  // Compass (Life stuff)
  <svg key="compass" className="w-4 h-4 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></svg>,
  // Sparkle
  <svg key="sparkle" className="w-4 h-4 shrink-0 opacity-50" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C8.5 5.5 10.5 7.5 16 8C10.5 8.5 8.5 10.5 8 16C7.5 10.5 5.5 8.5 0 8C5.5 7.5 7.5 5.5 8 0Z" /></svg>,
]

function SuggestionIcon({ index }: { index: number }) {
  return SUGGESTION_ICONS[index % SUGGESTION_ICONS.length]
}

export function ChatInterfaceComposer({
  placeholder = 'How can I help you today?',
  disclaimer,
  shortcutHint = 'Esc cancel · ⌘/ focus',
  className,
}: ChatInterfaceComposerProps) {
  const {
    input,
    setInput,
    inputRef,
    handleSend,
    isProcessing,
    cancelProcessing,
    messages,
    quickSuggestions,
    handleSuggestionSelect,
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
    <div className={className ?? `${messages.length === 0 ? 'bg-transparent' : 'bg-ck-bg2'} px-4 pb-4 pt-2`}>
      <div className="max-w-3xl mx-auto relative rounded-[20px] bg-ck-bg1 shadow-composer hover:shadow-composer-hover focus-within:shadow-composer-focus transition-shadow duration-200">
        <textarea
          ref={inputRef}
          rows={1}
          className="w-full resize-none bg-transparent text-base text-ck-t1 outline-none px-3.5 pt-3.5 pb-10 placeholder:text-ck-t3"
          aria-label="Message input"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {/* Bottom bar: attachment placeholder (left) + send/stop (right) */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <button
            className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 w-8 h-8 rounded-lg text-ck-t3 hover:text-ck-t2 hover:bg-ck-bg3 flex items-center justify-center transition-colors ease-claude active:scale-[0.98] pointer-events-auto focus-visible:ring-2 focus-visible:ring-ck-accent"
            aria-label="Attach"
            tabIndex={-1}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          {isProcessing ? (
            <button
              onClick={cancelProcessing}
              className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 w-8 h-8 rounded-lg bg-ck-bg3 text-ck-t2 cursor-pointer flex items-center justify-center shrink-0 hover:bg-ck-b1 transition-colors ease-claude active:scale-95 pointer-events-auto focus-visible:ring-2 focus-visible:ring-ck-accent"
              aria-label="Stop generating"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect width="14" height="14" rx="2" /></svg>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 w-8 h-8 rounded-lg bg-ck-accent text-white cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ck-accent-hover transition-colors ease-claude active:scale-95 pointer-events-auto focus-visible:ring-2 focus-visible:ring-ck-accent"
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
            </button>
          )}
        </div>
      </div>
      {messages.length === 0 && quickSuggestions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2.5 mt-5 max-w-3xl mx-auto">
          {quickSuggestions.slice(0, 5).map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestionSelect(s)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-ck-b1 text-[14px] text-ck-t2 hover:bg-ck-bg3 hover:text-ck-t1 transition-colors ease-claude cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent"
            >
              <SuggestionIcon index={i} />
              {s.label}
            </button>
          ))}
        </div>
      )}
      {showDisclaimer && (
        <p className="text-center text-xs text-ck-t3 mt-2">
          {disclaimer ?? (
            <>
              Claude is AI and can make mistakes. Please double-check responses.
              <span className="hidden md:inline ml-2 text-ck-t3/60">{shortcutHint}</span>
            </>
          )}
        </p>
      )}
    </div>
  )
}
