interface CollapsedChatTabProps {
  onClick: () => void
}

export default function CollapsedChatTab({ onClick }: CollapsedChatTabProps) {
  return (
    <button
      onClick={onClick}
      className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-24 rounded-l-lg shadow-md bg-white border border-r-0 border-gray-200 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-primary-600 hover:bg-gray-50 transition-colors"
      title="展开聊天"
    >
      {/* Chat bubble icon */}
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      {/* Left chevron */}
      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="10,3 6,8 10,13" />
      </svg>
    </button>
  )
}
