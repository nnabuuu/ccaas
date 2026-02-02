import { BookOpen, HelpCircle, Settings, Sparkles } from 'lucide-react'
import { useSessionContext, type ActiveTab } from '../../context/SessionContext'

const TABS: { id: ActiveTab; label: string; icon: typeof BookOpen; accent: string; accentBg: string }[] = [
  { id: 'lesson-plan', label: '教案', icon: BookOpen, accent: 'text-lesson', accentBg: 'bg-lesson/10' },
  { id: 'problem-explain', label: '题目', icon: HelpCircle, accent: 'text-problem', accentBg: 'bg-problem/10' },
]

export function AppHeader() {
  const { connection, activeTab, setActiveTab } = useSessionContext()

  return (
    <header className="h-14 border-b border-border bg-surface flex items-center px-4 gap-4 shrink-0">
      {/* Logo */}
      <button
        onClick={() => setActiveTab('home')}
        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity duration-150"
      >
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
          <Sparkles size={16} className="text-white" strokeWidth={2} />
        </div>
        <span className="font-semibold text-[15px] tracking-tight">EduAgent</span>
      </button>

      {/* Tabs */}
      <nav className="flex items-center gap-1 ml-4">
        {TABS.map(({ id, label, icon: Icon, accent, accentBg }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg cursor-pointer transition-colors duration-150 ${
                isActive
                  ? `${accent} ${accentBg}`
                  : 'text-ink-secondary hover:text-ink hover:bg-surface-tertiary'
              }`}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Right: connection + settings */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connection.connected ? 'bg-success' : 'bg-error'}`} />
        <button className="p-1.5 rounded-lg hover:bg-surface-tertiary transition-colors duration-150 text-ink-muted cursor-pointer">
          <Settings size={16} strokeWidth={1.75} />
        </button>
      </div>
    </header>
  )
}
