export interface ThinkingIndicatorProps {
  isThinking: boolean
  content?: string
}

export function ThinkingIndicator({ isThinking, content }: ThinkingIndicatorProps) {
  if (!isThinking) return null

  return (
    <div className="bg-gray-100 rounded-lg p-3 mb-2 text-sm text-gray-600">
      <div className="flex items-center gap-2 mb-1">
        <span className="animate-pulse">
          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </span>
        <span className="font-medium">思考中...</span>
      </div>
      {content && (
        <div className="text-xs text-gray-400 max-h-20 overflow-y-auto whitespace-pre-wrap">
          {content.length > 200 ? `...${content.slice(-200)}` : content}
        </div>
      )}
    </div>
  )
}
