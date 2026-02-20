/**
 * HistoryList - Display analysis history
 *
 * Shows list of recent analyses with:
 * - Truncated quiz content preview
 * - Timestamp
 * - Click to switch to that analysis
 * - Delete button per item
 */

import { ClockIcon, TrashIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import type { QuizAnalysis } from '../types'

/** @deprecated Local history replaced by server-persisted messages */
export interface AnalysisRecord {
  id: string
  quiz: {
    content: string
    answer?: string
  }
  analysis: QuizAnalysis
  timestamp: Date
}

interface HistoryListProps {
  history: AnalysisRecord[]
  current: AnalysisRecord | null
  onSelect: (record: AnalysisRecord) => void
  onDelete: (id: string) => void
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

function formatTimestamp(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`

  return new Date(date).toLocaleDateString('zh-CN')
}

export default function HistoryList({ history, current, onSelect, onDelete }: HistoryListProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <ClockIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">暂无分析历史</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">分析历史</h3>
        <span className="text-xs text-slate-500">{history.length} 条记录</span>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {history.map(record => {
          const isActive = current?.id === record.id
          const preview = truncate(record.quiz.content, 60)

          return (
            <div
              key={record.id}
              className={`
                relative group p-3 border rounded-lg cursor-pointer transition-all duration-200
                ${
                  isActive
                    ? 'bg-blue-50 border-blue-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }
              `}
              onClick={() => onSelect(record)}
            >
              {/* Active Indicator */}
              {isActive && (
                <CheckCircleIcon className="absolute top-2 right-2 w-5 h-5 text-blue-600" />
              )}

              {/* Content Preview */}
              <p className="text-sm text-slate-800 pr-6 leading-relaxed">{preview}</p>

              {/* Metadata */}
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" />
                  {formatTimestamp(record.timestamp)}
                </span>
                {record.quiz.answer && <span className="text-green-600">含答案</span>}
              </div>

              {/* Delete Button */}
              <button
                onClick={e => {
                  e.stopPropagation()
                  if (confirm('确定删除这条分析记录吗？')) {
                    onDelete(record.id)
                  }
                }}
                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded bg-red-50 hover:bg-red-100 transition-opacity duration-200"
                title="删除记录"
              >
                <TrashIcon className="w-4 h-4 text-red-600" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
