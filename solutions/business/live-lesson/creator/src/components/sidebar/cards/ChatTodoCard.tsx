import { useId, useState } from 'react'
import { ChevronDown, Check, Menu } from 'lucide-react'
import type { TodoData, TodoItem as TodoItemType, TodoItemStatus } from '../../../types/chat-cards'

/**
 * ChatTodoCard — renders a `kind: 'todo'` card payload as the
 * agent's multi-step progress signal in the chat panel.
 *
 * Visual contract: `design/surfaces/creator-v7-rich-chat.jsx` lines
 * 130-229 + `creator-v7-rich-chat-doc.md` §1. Tailwind port: original
 * mockup uses inline styles + CSS vars; this version uses Tailwind
 * tokens that match the creator palette (green/blue/purple/gray).
 *
 * Header color shifts with progress:
 *   - all items done → green
 *   - any item active → blue (in-flight signal)
 *   - default → gray (queued)
 *
 * Click header to collapse / expand the item list.
 */

interface Props {
  data: TodoData
}

export default function ChatTodoCard({ data }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  // Stable per-instance id for aria-controls — multiple TodoCards
  // can coexist in the same chat panel (each agent turn may emit
  // its own), so hardcoded ids would collide.
  const itemsId = useId()

  const doneCount = data.items.filter((i) => i.status === 'done').length
  const total = data.items.length
  const allDone = doneCount === total && total > 0
  const hasActive = data.items.some((i) => i.status === 'active')

  // Three header states drive the label + status-icon backgrounds.
  // Keyed off content (not user input) so the same card payload
  // always renders the same colors.
  const variant: 'done' | 'active' | 'idle' = allDone
    ? 'done'
    : hasActive
      ? 'active'
      : 'idle'

  const variantStyles = {
    done: {
      labelDot: 'bg-green-600',
      labelText: 'text-green-700',
      labelTextSuffix: '已完成',
      headerBg: 'bg-green-50',
      headerIconBg: 'bg-green-600 text-white',
    },
    active: {
      labelDot: 'bg-blue-600',
      labelText: 'text-blue-700',
      labelTextSuffix: '执行中',
      headerBg: 'bg-blue-50',
      headerIconBg: 'bg-blue-600 text-white',
    },
    idle: {
      labelDot: 'bg-purple-600',
      labelText: 'text-purple-700',
      labelTextSuffix: '任务',
      headerBg: 'bg-white',
      headerIconBg: 'bg-gray-100 text-gray-400',
    },
  } as const
  const s = variantStyles[variant]

  return (
    <div
      className="self-start w-full max-w-[95%]"
      data-card-kind="todo"
      data-testid="chat-todo-card"
    >
      {/* Above-card label (mirrors mockup §1.4 header label) */}
      <div className="flex items-center gap-1 mb-1">
        <span
          className={`w-3.5 h-3.5 rounded flex items-center justify-center text-white text-[7px] font-bold ${s.labelDot}`}
        >
          {variant === 'done' ? <Check size={8} strokeWidth={3} /> : <Menu size={8} strokeWidth={3} />}
        </span>
        <span className={`text-[9px] font-semibold ${s.labelText}`}>
          AI 助手 · {s.labelTextSuffix}
        </span>
      </div>

      {/* Card body */}
      <div className="rounded-[10px] overflow-hidden border border-gray-200 bg-white">
        {/* Header (click to collapse) */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={`w-full flex items-center gap-2 px-3.5 py-2.5 transition-colors cursor-pointer text-left ${s.headerBg} ${!collapsed ? 'border-b border-gray-200' : ''}`}
          aria-expanded={!collapsed}
          aria-controls={itemsId}
        >
          {/* Header status icon */}
          <span
            className={`w-[18px] h-[18px] rounded-[5px] flex-shrink-0 flex items-center justify-center text-[9px] font-bold ${s.headerIconBg}`}
          >
            {variant === 'done' ? <Check size={10} strokeWidth={3} /> : <Menu size={10} strokeWidth={3} />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-900 truncate">
              {data.title}
            </div>
            {data.summary && (
              <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                {data.summary}
              </div>
            )}
          </div>
          {/* Progress pill */}
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded-[10px] flex-shrink-0 ${
              allDone
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
            aria-label={`${doneCount} of ${total} done`}
          >
            {doneCount}/{total}
          </span>
          <ChevronDown
            size={12}
            className={`text-gray-400 flex-shrink-0 transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}
          />
        </button>

        {/* Items */}
        {!collapsed && (
          <div className="py-1.5 px-2.5" id={itemsId}>
            {data.items.map((item) => (
              <TodoItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Single item row (private) ────────────────────────────────────────

interface ItemProps {
  item: TodoItemType
}

const STATUS_STYLES: Record<
  TodoItemStatus,
  { icon: string; iconBg: string; iconText: string; textWeight: string; textColor: string; lineThrough: boolean; animate: boolean }
> = {
  done: {
    icon: '✓',
    iconBg: 'bg-green-50',
    iconText: 'text-green-600',
    textWeight: 'font-normal',
    textColor: 'text-gray-400',
    lineThrough: true,
    animate: false,
  },
  active: {
    icon: '›',
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600',
    textWeight: 'font-semibold',
    textColor: 'text-gray-900',
    lineThrough: false,
    animate: true,
  },
  pending: {
    icon: '○',
    iconBg: 'bg-gray-100',
    iconText: 'text-gray-400',
    textWeight: 'font-normal',
    textColor: 'text-gray-900',
    lineThrough: false,
    animate: false,
  },
  error: {
    icon: '✗',
    iconBg: 'bg-red-50',
    iconText: 'text-red-600',
    textWeight: 'font-normal',
    textColor: 'text-gray-900',
    lineThrough: false,
    animate: false,
  },
}

function TodoItemRow({ item }: ItemProps) {
  const s = STATUS_STYLES[item.status]
  return (
    <div
      className="flex items-start gap-2 px-1.5 py-1 rounded-md"
      data-testid={`todo-item-${item.id}`}
      data-status={item.status}
    >
      <span
        className={`w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold ${s.iconBg} ${s.iconText} ${s.animate ? 'animate-aiBlink' : ''}`}
        aria-label={`status: ${item.status}`}
      >
        {s.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className={`text-[11px] line-clamp-2 ${s.textWeight} ${s.textColor} ${s.lineThrough ? 'line-through decoration-gray-300' : ''}`}
        >
          {item.label}
        </div>
        {item.detail && (
          <div className="text-[9px] text-gray-400 mt-0.5 leading-relaxed">
            {item.detail}
          </div>
        )}
      </div>
    </div>
  )
}
