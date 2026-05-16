import { MessageSquare } from 'lucide-react'
import type { Project } from '../../types'

interface AiPanelProps {
  project: Project
}

export default function AiPanel({ project }: AiPanelProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <MessageSquare size={16} className="text-teal-500" />
          AI Assistant
        </div>
      </div>

      {/* Project info */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="text-xs text-gray-500 mb-1">项目</div>
        <div className="text-sm font-medium text-gray-900">{project.title}</div>
        {project.description && (
          <div className="text-xs text-gray-500 mt-1">{project.description}</div>
        )}
      </div>

      {/* Chat area placeholder */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <MessageSquare size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">AI chat coming soon</p>
          <p className="text-xs text-gray-300 mt-1">Describe your lesson plan here</p>
        </div>
      </div>

      {/* Input placeholder */}
      <div className="p-3 border-t border-gray-200">
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400">
          Ask AI to help design your lesson...
        </div>
      </div>
    </div>
  )
}
