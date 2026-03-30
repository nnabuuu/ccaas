import type { WidgetComponentProps } from '@/types/widget'

interface ActionItem {
  label: string
  prompt: string
  primary?: boolean
  skill_hint?: string
}

interface ActionRowProps {
  actions: ActionItem[]
}

export function ActionRow({ props, onSubmit }: WidgetComponentProps<ActionRowProps>) {
  const actions = props.actions ?? []

  const handleClick = (action: ActionItem) => {
    onSubmit?.({
      _action: 'send_message',
      prompt: action.prompt,
      skill_hint: action.skill_hint,
    })
  }

  return (
    <div className="flex gap-1.5 flex-wrap mt-1">
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => handleClick(action)}
          className={
            action.primary
              ? 'text-xs px-3 py-[5px] rounded-ck bg-ck-t1 text-ck-bg1 border border-ck-t1 cursor-pointer font-[inherit] transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent'
              : 'text-xs px-3 py-[5px] rounded-ck bg-transparent text-ck-t2 border border-ck-b1 cursor-pointer font-[inherit] hover:bg-ck-bg2 transition-colors ease-claude active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ck-accent'
          }
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
