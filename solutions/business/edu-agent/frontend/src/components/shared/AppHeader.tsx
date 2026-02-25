import { BookOpen, Question, Gear, Sparkle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useSessionContext, type ActiveTab } from '../../context/SessionContext'

const TABS: { id: ActiveTab; label: string; icon: typeof BookOpen; accent: string; accentBg: string }[] = [
  { id: 'lesson-plan', label: '教案', icon: BookOpen, accent: 'text-lesson', accentBg: 'bg-lesson/10' },
  { id: 'problem-explain', label: '题目', icon: Question, accent: 'text-problem', accentBg: 'bg-problem/10' },
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
          <Sparkle size={16} className="text-white" weight="fill" />
        </div>
        <span className="font-semibold text-[15px] tracking-tight">EduAgent</span>
      </button>

      {/* Tabs */}
      <nav className="flex items-center gap-1 ml-4 relative">
        {TABS.map(({ id, label, icon: Icon, accent, accentBg }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg cursor-pointer transition-colors duration-150 ${
                isActive
                  ? `${accent}`
                  : 'text-ink-secondary hover:text-ink hover:bg-surface-tertiary'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className={`absolute inset-0 ${accentBg} rounded-lg`}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon size={16} weight="regular" />
                {label}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Right: connection + settings */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${connection.connected ? 'bg-success' : 'bg-error'}`} />
        <button className="p-1.5 rounded-lg hover:bg-surface-tertiary transition-colors duration-150 text-ink-muted cursor-pointer">
          <Gear size={16} weight="regular" />
        </button>
      </div>
    </header>
  )
}
