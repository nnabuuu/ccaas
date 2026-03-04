import { QuickActions, type QuickAction } from '@kedge-agentic/react-sdk'

interface QuickPromptsProps {
  onSelect: (prompt: string) => void
  disabled?: boolean
}

const LESSON_PLAN_ACTIONS: QuickAction[] = [
  { id: 'full-auto', label: '全自动备课', prompt: '请一键帮我完成所有备课内容，包括：学习目标、学情分析、课前准备、学习过程、作业检测、教学方法。请依次为每个部分调用 write_output，不需要等待我的确认。' },
  { id: 'requirements', label: '课程要求', prompt: '帮我编写课程要求' },
  { id: 'objectives', label: '学习目标', prompt: '帮我设计本课的学习目标' },
  { id: 'analysis', label: '学情分析', prompt: '帮我编写学情分析' },
  { id: 'materials', label: '课前准备', prompt: '帮我列出课前准备内容' },
  { id: 'content', label: '学习过程', prompt: '帮我设计学习过程' },
  { id: 'assessment', label: '作业检测', prompt: '帮我设计作业检测方案' },
  { id: 'methods', label: '教学方法', prompt: '帮我设计教学方法' },
]

export function QuickPrompts({ onSelect, disabled }: QuickPromptsProps) {
  return (
    <QuickActions
      actions={LESSON_PLAN_ACTIONS.map(action => ({ ...action, disabled }))}
      onAction={onSelect}
      renderAction={(action, onClick) => (
        <button
          key={action.id}
          onClick={onClick}
          disabled={action.disabled}
          className={
            action.id === 'full-auto'
              ? 'quick-prompt-highlight disabled:opacity-50 disabled:cursor-not-allowed'
              : 'quick-prompt disabled:opacity-50 disabled:cursor-not-allowed'
          }
        >
          {action.id === 'full-auto' && (
            <svg className="w-3.5 h-3.5 mr-1 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
          {action.label}
        </button>
      )}
    />
  )
}

export default QuickPrompts
