import { BookOpen, HelpCircle, Sparkles } from 'lucide-react'
import { useSessionContext } from '../../context/SessionContext'
import { QuickActionCard } from './QuickActionCard'

export function WelcomeSection() {
  const { setActiveTab } = useSessionContext()

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles size={24} className="text-accent" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">EduAgent</h1>
          <p className="text-ink-secondary text-[15px]">AI 教育助手 &mdash; 备课设计 &middot; 讲题解析</p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          <QuickActionCard
            icon={BookOpen}
            title="备课"
            description="智能教案设计助手"
            accentColor="text-lesson"
            bgColor="bg-lesson-light"
            onClick={() => setActiveTab('lesson-plan')}
          />
          <QuickActionCard
            icon={HelpCircle}
            title="讲题"
            description="题目讲解分析助手"
            accentColor="text-problem"
            bgColor="bg-problem-light"
            onClick={() => setActiveTab('problem-explain')}
          />
        </div>

        <p className="text-xs text-ink-muted text-center">
          选择功能或在右侧 Chat 中描述需求，AI 将自动导航
        </p>
      </div>
    </div>
  )
}
