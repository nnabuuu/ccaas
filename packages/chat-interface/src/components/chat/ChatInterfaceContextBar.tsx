import type { ReactNode } from 'react'
import type { SessionContextChip } from '@/types/session-context'
import { SessionContextBar } from '@/components/SessionContextBar'
import { useChatCore } from '@/context/ChatCoreContext'

export interface ChatInterfaceContextBarProps {
  chips?: SessionContextChip[]
  onChipClick?: (chip: SessionContextChip) => void
  onMenuClick?: () => void
  /** Extra trailing content inserted before the skill toggle button */
  trailing?: ReactNode
  /** Hide the built-in skill toggle button */
  hideSkillToggle?: boolean
  /** Full override — when provided, replaces the entire context bar */
  children?: ReactNode
}

export function ChatInterfaceContextBar({
  chips = [],
  onChipClick,
  onMenuClick,
  trailing,
  hideSkillToggle,
  children,
}: ChatInterfaceContextBarProps) {
  const { skillPanelOpen, setSkillPanelOpen } = useChatCore()

  if (children) return <>{children}</>

  return (
    <SessionContextBar
      chips={chips}
      onChipClick={onChipClick}
      leading={onMenuClick && (
        <button
          onClick={onMenuClick}
          className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-ck-t2 hover:text-ck-t1 hover:bg-ck-bg3 text-base transition-colors focus-visible:ring-2 focus-visible:ring-ck-accent"
          title="Chat list"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        </button>
      )}
      trailing={
        <>
          {trailing}
          {!hideSkillToggle && (
            <button
              onClick={() => setSkillPanelOpen((prev: boolean) => !prev)}
              className="text-[11px] px-2.5 py-[3px] rounded-full border bg-transparent text-ck-t2 border-ck-b1 hover:bg-ck-bg3 transition-colors ease-claude focus-visible:ring-2 focus-visible:ring-ck-accent"
            >
              Skills
            </button>
          )}
        </>
      }
    />
  )
}
