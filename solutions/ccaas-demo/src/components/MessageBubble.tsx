/**
 * Message Bubble Component
 *
 * Displays a chat message with optional file attachment.
 */

import type { Message, FileInfo } from '../types'
import { FileCard } from './FileCard'

interface MessageBubbleProps {
  message: Message
  onDownload: (file: FileInfo) => void
}

export function MessageBubble({ message, onDownload }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] ${
          isUser
            ? 'bg-blue-500 text-white rounded-2xl rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md'
        } px-4 py-3`}
      >
        {!isUser && message.skill && (
          <div className="flex items-center gap-2 mb-2 text-sm text-blue-600 font-medium">
            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Using: {message.skill === 'hello-world' ? 'Hello World' :
                    message.skill === 'report' ? 'Report Generator' :
                    message.skill === 'document' ? 'Document Writer' :
                    message.skill === 'analysis' ? 'Data Analyzer' : message.skill}
          </div>
        )}

        <div className="whitespace-pre-wrap">
          {message.content}
          {message.status === 'streaming' && (
            <span className="inline-block w-2 h-4 bg-current animate-blink ml-1">|</span>
          )}
        </div>

        {message.files?.map((file, index) => (
          <FileCard key={file.id || index} file={file} onDownload={onDownload} />
        ))}
      </div>
    </div>
  )
}
