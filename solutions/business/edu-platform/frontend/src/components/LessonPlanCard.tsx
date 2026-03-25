import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface LessonPlanCardProps {
  title: string
  icon: string
  content: unknown
  isLoading?: boolean
  index?: number
}

export function LessonPlanCard({ title, icon, content, isLoading, index = 0 }: LessonPlanCardProps) {
  const [expanded, setExpanded] = useState(true)

  if (isLoading) {
    return (
      <div
        className="bg-white rounded-xl shadow-sm p-4 mb-3 animate-fade-in"
        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-edu-blue-50 flex items-center justify-center text-sm">{icon}</div>
          <span className="font-medium text-gray-400">{title}</span>
        </div>
        <div className="space-y-2.5">
          <div className="h-3 bg-gray-200 animate-pulse rounded w-full" />
          <div className="h-3 bg-gray-200 animate-pulse rounded w-5/6" />
          <div className="h-3 bg-gray-200 animate-pulse rounded w-4/5" />
          <div className="h-3 bg-gray-200 animate-pulse rounded w-3/5" />
        </div>
      </div>
    )
  }

  if (!content) return null

  const renderContent = () => {
    if (typeof content === 'string') {
      return (
        <div className="markdown-content text-gray-700 text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )
    }

    if (Array.isArray(content)) {
      return (
        <div className="space-y-2">
          {content.map((item: any, i: number) => (
            <div key={i} className="p-3 rounded-lg bg-edu-blue-50 border border-edu-blue-100">
              {item.title && <div className="font-medium text-sm mb-1">{item.title}</div>}
              {item.description && <div className="text-xs text-gray-600">{item.description}</div>}
              {item.duration && <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-edu-blue-100 text-edu-blue-700">{item.duration}</span>}
            </div>
          ))}
        </div>
      )
    }

    if (typeof content === 'object' && content !== null) {
      const obj = content as Record<string, unknown>
      return (
        <div className="p-3 rounded-lg bg-edu-blue-50 border border-edu-blue-100">
          {Object.entries(obj).map(([key, val]) => (
            <div key={key} className="flex justify-between text-sm py-1 border-b last:border-0 border-edu-blue-100/50">
              <span className="text-gray-500">{key}</span>
              <span className="text-gray-800 font-medium">{String(val)}</span>
            </div>
          ))}
        </div>
      )
    }

    return <pre className="text-xs text-gray-600 whitespace-pre-wrap">{JSON.stringify(content, null, 2)}</pre>
  }

  return (
    <div
      className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow mb-3 overflow-hidden animate-fade-in ${
        expanded ? 'border-l-[3px] border-l-edu-blue-400' : ''
      }`}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-edu-blue-50 flex items-center justify-center text-sm">{icon}</div>
          <span className="font-medium text-sm">{title}</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? '' : '-rotate-180'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          {renderContent()}
        </div>
      )}
    </div>
  )
}
