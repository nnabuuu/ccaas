/**
 * HistoryList - Display analysis history
 *
 * Shows list of recent analyses with:
 * - Truncated quiz content preview
 * - Timestamp
 * - Click to switch to that analysis
 * - Delete button per item
 */

import { Clock, Trash, CheckCircle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { QuizAnalysis } from '../types'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } },
}

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
      <div className="text-center py-12 text-ck-t3">
        <Clock weight="regular" className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">暂无分析历史</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ck-t2">分析历史</h3>
        <span className="text-xs text-ck-t3">{history.length} 条记录</span>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-2 max-h-[600px] overflow-y-auto ck-scrollbar">
        {history.map(record => {
          const isActive = current?.id === record.id
          const preview = truncate(record.quiz.content, 60)

          return (
            <motion.div
              key={record.id}
              variants={item}
              className={`
                relative group p-3 border rounded-ck cursor-pointer transition-all duration-200
                ${
                  isActive
                    ? 'bg-ck-info-bg border-ck-info-t/30 shadow-composer'
                    : 'bg-ck-bg1 border-ck-b1 hover:bg-ck-bg2 hover:border-ck-b1'
                }
              `}
              onClick={() => onSelect(record)}
            >
              {/* Active Indicator */}
              {isActive && (
                <CheckCircle weight="regular" className="absolute top-2 right-2 w-5 h-5 text-ck-info-t" />
              )}

              {/* Content Preview */}
              <p className="text-sm text-ck-t1 pr-6 leading-relaxed">{preview}</p>

              {/* Metadata */}
              <div className="flex items-center gap-3 mt-2 text-xs text-ck-t3">
                <span className="flex items-center gap-1">
                  <Clock weight="regular" className="w-3 h-3" />
                  {formatTimestamp(record.timestamp)}
                </span>
                {record.quiz.answer && <span className="text-ck-success-t">含答案</span>}
              </div>

              {/* Delete Button */}
              <button
                onClick={e => {
                  e.stopPropagation()
                  if (confirm('确定删除这条分析记录吗？')) {
                    onDelete(record.id)
                  }
                }}
                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded bg-ck-danger-bg hover:bg-ck-danger-bg transition-opacity duration-200"
                title="删除记录"
              >
                <Trash weight="regular" className="w-4 h-4 text-ck-danger-t" />
              </button>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
