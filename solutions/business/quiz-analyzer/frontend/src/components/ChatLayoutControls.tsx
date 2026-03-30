import type { ChatLayoutMode } from '../hooks/useChatLayout'

interface ChatLayoutControlsProps {
  mode: ChatLayoutMode
  isCollapsed: boolean
  onModeChange: (mode: ChatLayoutMode) => void
  onToggleCollapse: () => void
}

const modes: { value: ChatLayoutMode; label: string; icon: JSX.Element }[] = [
  {
    value: 'default',
    label: '固定侧栏',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="2" width="14" height="12" rx="1" />
        <line x1="10" y1="2" x2="10" y2="14" />
      </svg>
    ),
  },
  {
    value: 'overlay',
    label: '浮层',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="2" width="14" height="12" rx="1" />
        <rect x="7" y="3" width="8" height="10" rx="0.5" fill="currentColor" fillOpacity="0.15" />
      </svg>
    ),
  },
  {
    value: 'side-by-side',
    label: '并排',
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="2" width="14" height="12" rx="1" />
        <line x1="8" y1="2" x2="8" y2="14" strokeDasharray="2 1" />
      </svg>
    ),
  },
]

export default function ChatLayoutControls({
  mode,
  isCollapsed: _isCollapsed,
  onModeChange,
  onToggleCollapse,
}: ChatLayoutControlsProps) {
  return (
    <div className="px-3 py-1.5 bg-ck-bg1 border-b border-ck-b1 flex items-center justify-between text-xs flex-shrink-0">
      {/* Mode switcher */}
      <div className="flex items-center gap-0.5 bg-ck-bg2 rounded-md p-0.5">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => onModeChange(m.value)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors duration-200 ease-claude ${
              mode === m.value
                ? 'bg-ck-bg1 text-ck-accent shadow-composer'
                : 'text-ck-t3 hover:text-ck-t2'
            }`}
            title={m.label}
          >
            {m.icon}
            <span className="hidden sm:inline">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Collapse toggle - only for overlay/side-by-side */}
      {mode !== 'default' && (
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-1 px-2 py-1 text-ck-t3 hover:text-ck-t2 rounded hover:bg-ck-bg2 transition-colors duration-200 ease-claude"
          title="收起聊天"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="10,3 14,8 10,13" />
          </svg>
        </button>
      )}
    </div>
  )
}
