import React from 'react';
import type { Message } from '@kedge-agentic/react-sdk';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="text-[10px] text-zinc-400 text-center py-0.5">
        {message.content}
      </div>
    );
  }

  const timeStr = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString()
    : message.timestamp
      ? new Date(message.timestamp).toLocaleTimeString()
      : '';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
          isUser
            ? 'bg-blue-500 text-white rounded-br-sm'
            : 'bg-zinc-100 text-zinc-800 rounded-bl-sm'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {timeStr && (
          <p
            className={`text-[9px] mt-1 ${
              isUser ? 'text-blue-200' : 'text-zinc-400'
            }`}
          >
            {timeStr}
          </p>
        )}
      </div>
    </div>
  );
}
