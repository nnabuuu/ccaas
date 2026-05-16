import type { ReactNode } from 'react'

interface EditorLayoutProps {
  left: ReactNode
  right: ReactNode
}

export default function EditorLayout({ left, right }: EditorLayoutProps) {
  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left AI panel */}
      <div className="w-[340px] shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto">
        {left}
      </div>
      {/* Right working area */}
      <div className="flex-1 flex flex-col overflow-hidden">{right}</div>
    </div>
  )
}
