import { Message } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { User, Robot, SpinnerGap } from '@phosphor-icons/react';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`
          w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
          ${isUser ? 'bg-blue-500' : 'bg-gray-200'}
        `}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" weight="regular" />
        ) : (
          <Robot className="w-4 h-4 text-gray-600" weight="regular" />
        )}
      </div>

      {/* Content */}
      <div
        className={`
          max-w-[80%] rounded-lg px-4 py-2
          ${isUser ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'}
        `}
      >
        {message.isStreaming && !message.content ? (
          <div className="flex items-center gap-2">
            <SpinnerGap className="w-4 h-4 animate-spin" weight="regular" />
            <span className="text-sm">正在输入...</span>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                // Override paragraph to avoid extra margins
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                // Style code blocks
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code
                      className={`${
                        isUser ? 'bg-blue-400' : 'bg-gray-200'
                      } px-1 rounded`}
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.isStreaming && message.content && (
          <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5" />
        )}
      </div>
    </div>
  );
}
