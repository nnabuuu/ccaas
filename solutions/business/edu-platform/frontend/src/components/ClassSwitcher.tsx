import { useState, useEffect, useRef } from 'react'
import type { ClassInfo } from '../data/mock-classes'

interface ClassSwitcherProps {
  classes: ClassInfo[]
  selected: ClassInfo
  onSelect: (cls: ClassInfo) => void
}

export function ClassSwitcher({ classes, selected, onSelect }: ClassSwitcherProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="text-[11px] px-2.5 py-[3px] rounded-xl border-[0.5px] border-ck-b1 bg-ck-bg2 text-ck-t2 hover:bg-ck-bg2/80 transition-colors ease-claude active:scale-[0.98]"
      >
        切换班级
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[140px] bg-ck-bg1 border-[0.5px] border-ck-b1 rounded-ck-lg py-1 z-50">
          {classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => {
                onSelect(cls)
                setOpen(false)
              }}
              className={`w-full text-left text-[12px] px-3 py-1.5 ${
                cls.id === selected.id
                  ? 'bg-ck-info-bg text-ck-info-t'
                  : 'text-ck-t1 hover:bg-ck-bg2'
              }`}
            >
              {cls.name} · {cls.subject}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
