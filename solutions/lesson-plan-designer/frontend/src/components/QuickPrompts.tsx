interface QuickPromptsProps {
  onSelect: (prompt: string) => void
  disabled?: boolean
}

const QUICK_PROMPTS = [
  { icon: '🎯', label: '教学目标', prompt: '帮我设计本课的教学目标' },
  { icon: '📚', label: '教学活动', prompt: '帮我规划教学活动流程' },
  { icon: '📊', label: '评估方案', prompt: '帮我设计评估方案' },
  { icon: '🎨', label: '差异化', prompt: '帮我设计差异化教学策略' },
]

export function QuickPrompts({ onSelect, disabled }: QuickPromptsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_PROMPTS.map((item) => (
        <button
          key={item.label}
          onClick={() => onSelect(item.prompt)}
          disabled={disabled}
          className="quick-prompt disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="mr-1">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}

export default QuickPrompts
