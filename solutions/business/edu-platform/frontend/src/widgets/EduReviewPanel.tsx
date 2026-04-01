import { useState, useCallback } from 'react'
import type { WidgetComponentProps } from '@kedge-agentic/chat-interface'

interface ReviewItem {
  id: string
  content: string
  knowledge_point?: string
  difficulty?: number
  source?: 'bank' | 'ai'
}

type ItemStatus = 'keep' | 'replace' | 'tweak' | 'remove' | null

interface EduReviewPanelProps {
  title: string
  items: ReviewItem[]
  submit_action: string
}

const STATUS_STYLES: Record<string, string> = {
  keep: 'border-[var(--ck-success-t)] bg-[rgba(234,243,222,0.3)]',
  replace: 'border-[var(--ck-warn-t)] bg-[rgba(250,238,218,0.3)]',
  remove: 'opacity-40 line-through',
}

export function EduReviewPanel({
  props,
  onSubmit,
}: WidgetComponentProps<EduReviewPanelProps>) {
  const items = props.items ?? []
  const [decisions, setDecisions] = useState<Record<string, ItemStatus>>({})

  const handleAction = useCallback((itemId: string, status: ItemStatus) => {
    setDecisions((prev) => ({
      ...prev,
      [itemId]: prev[itemId] === status ? null : status,
    }))
  }, [])

  const handleKeepAll = useCallback(() => {
    const all: Record<string, ItemStatus> = {}
    for (const item of items) {
      all[item.id] = 'keep'
    }
    setDecisions(all)
  }, [items])

  const handleSubmit = useCallback(() => {
    onSubmit?.({
      decisions,
      _action: props.submit_action,
    })
  }, [decisions, onSubmit, props.submit_action])

  const confirmedCount = Object.values(decisions).filter((v) => v !== null && v !== undefined).length

  return (
    <div className="border-[0.5px] border-[var(--ck-b1)] rounded-[var(--ck-rl)] bg-[var(--ck-bg1)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b-[0.5px] border-[var(--ck-b1)]">
        <span className="text-[13px] font-semibold">{props.title}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-[var(--ck-info-bg)] text-[var(--ck-info-t)]">
          ReviewPanel
        </span>
      </div>

      <div className="p-3.5">
        {/* All items displayed vertically */}
        {items.map((item) => {
          const status = decisions[item.id]
          const statusClass = status ? STATUS_STYLES[status] ?? '' : ''

          return (
            <div
              key={item.id}
              className={`border-[0.5px] border-[var(--ck-b1)] rounded-[var(--ck-r)] p-3.5 mb-2.5 bg-[var(--ck-bg1)] transition-[border-color] duration-150 ${statusClass}`}
            >
              {/* Question content */}
              <div className="text-[13px] leading-[1.7] mb-2.5">
                <span className="font-semibold mr-1">{item.id}.</span>
                {item.content.split('\n').map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </div>

              {/* Meta tags */}
              <div className="flex gap-1.5 text-[11px] text-[var(--ck-t3)] mb-2.5 flex-wrap">
                {item.knowledge_point && (
                  <span className="px-2 py-0.5 bg-[var(--ck-bg2)] rounded">
                    {item.knowledge_point}
                  </span>
                )}
                {item.difficulty != null && (
                  <span className="px-2 py-0.5 bg-[var(--ck-bg2)] rounded">
                    难度 {item.difficulty}
                  </span>
                )}
                {item.source && (
                  <span
                    className={`px-2 py-0.5 rounded ${
                      item.source === 'bank'
                        ? 'bg-[var(--ck-info-bg)] text-[var(--ck-info-t)]'
                        : 'bg-[var(--ck-warn-bg)] text-[var(--ck-warn-t)]'
                    }`}
                  >
                    {item.source === 'bank' ? '题库' : 'AI 原创'}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleAction(item.id, 'keep')}
                  className={`text-[11px] px-3 py-[5px] rounded-md cursor-pointer border-[0.5px] transition-colors ${
                    status === 'keep'
                      ? 'bg-[var(--ck-success-bg)] text-[var(--ck-success-t)] border-transparent outline outline-2 outline-[var(--ck-success-t)] outline-offset-1'
                      : 'bg-[var(--ck-success-bg)] text-[var(--ck-success-t)] border-transparent hover:opacity-80'
                  }`}
                >
                  保留
                </button>
                <button
                  onClick={() => handleAction(item.id, 'replace')}
                  className={`text-[11px] px-3 py-[5px] rounded-md cursor-pointer border-[0.5px] transition-colors ${
                    status === 'replace'
                      ? 'bg-[var(--ck-warn-bg)] text-[var(--ck-warn-t)] border-transparent outline outline-2 outline-[var(--ck-warn-t)] outline-offset-1'
                      : 'bg-[var(--ck-warn-bg)] text-[var(--ck-warn-t)] border-transparent hover:opacity-80'
                  }`}
                >
                  替换
                </button>
                <button
                  onClick={() => handleAction(item.id, 'tweak')}
                  className={`text-[11px] px-3 py-[5px] rounded-md cursor-pointer border-[0.5px] transition-colors ${
                    status === 'tweak'
                      ? 'border-[var(--ck-b1)] bg-[var(--ck-bg2)] text-[var(--ck-t2)] outline outline-2 outline-[var(--ck-t2)] outline-offset-1'
                      : 'border-[var(--ck-b1)] bg-[var(--ck-bg1)] text-[var(--ck-t2)] hover:bg-[var(--ck-bg2)]'
                  }`}
                >
                  微调
                </button>
                <button
                  onClick={() => handleAction(item.id, 'remove')}
                  className={`text-[11px] px-3 py-[5px] rounded-md cursor-pointer border-[0.5px] transition-colors ${
                    status === 'remove'
                      ? 'bg-[var(--ck-danger-bg)] text-[var(--ck-danger-t)] border-transparent outline outline-2 outline-[var(--ck-danger-t)] outline-offset-1'
                      : 'bg-[var(--ck-danger-bg)] text-[var(--ck-danger-t)] border-transparent hover:opacity-80'
                  }`}
                >
                  删除
                </button>
              </div>
            </div>
          )
        })}

        {/* Footer */}
        <div className="flex justify-between items-center mt-3.5 pt-3 border-t-[0.5px] border-[var(--ck-b1)]">
          <div className="text-[12px] text-[var(--ck-t2)]">
            <span className="font-semibold text-[var(--ck-t1)]">{confirmedCount}</span> / {items.length} 题已确认
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleKeepAll}
              className="text-[12px] px-3.5 py-1.5 rounded-[var(--ck-r)] cursor-pointer border-[0.5px] border-[var(--ck-b1)] bg-[var(--ck-bg1)] text-[var(--ck-t2)] hover:bg-[var(--ck-bg2)] transition-colors"
            >
              全部保留
            </button>
            <button
              onClick={handleSubmit}
              className="text-[12px] px-3.5 py-1.5 rounded-[var(--ck-r)] bg-[var(--ck-t1)] text-[var(--ck-bg1)] border-[0.5px] border-[var(--ck-t1)] cursor-pointer transition-colors hover:opacity-90 active:scale-[0.98]"
            >
              确认组卷 {'\u2197'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
