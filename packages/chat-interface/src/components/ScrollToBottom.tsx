import { useState, useEffect, type RefObject } from 'react'
import { ChevronDown } from 'lucide-react'

interface ScrollToBottomProps {
  scrollRef: RefObject<HTMLElement>
  threshold?: number
}

export function ScrollToBottom({ scrollRef, threshold = 100 }: ScrollToBottomProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      const shouldBeVisible = distanceFromBottom > threshold
      setVisible(prev => prev === shouldBeVisible ? prev : shouldBeVisible)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [scrollRef, threshold])

  if (!visible) return null

  const handleClick = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  return (
    <button
      onClick={handleClick}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-ck-bg1/80 border border-ck-b1 text-ck-t2 hover:text-ck-t1 hover:bg-ck-bg1 flex items-center justify-center shadow-sm transition-all z-10"
      aria-label="滚动到底部"
    >
      <ChevronDown size={18} />
    </button>
  )
}
