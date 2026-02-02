import React, { useState, useRef, useEffect } from 'react';
import { useMosaicStore } from '../../hooks/useStore';
import MessageBubble from './MessageBubble';
import AssessmentCard from '../assessment/AssessmentCard';

interface ChatPanelProps {
  sendMessage: (content: string) => void | Promise<void>;
}

const QUICK_ACTIONS = [
  { label: '转换', command: '转换这张图片为乐高马赛克' },
  { label: '优化', command: '请优化当前马赛克设计' },
  { label: '导出', command: '导出拼装指南 PDF' },
];

export default function ChatPanel({ sendMessage }: ChatPanelProps) {
  const messages = useMosaicStore((s) => s.messages);
  const assessment = useMosaicStore((s) => s.assessment);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sendMessage(text);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="h-9 flex items-center px-3 border-b border-gray-200 shrink-0">
        <span className="text-xs font-medium text-gray-600">AI Chat</span>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <div className="text-3xl mb-2">🤖</div>
            <p className="text-xs">Upload an image and ask me to convert it</p>
            <p className="text-[10px] mt-1">or use quick actions below</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Assessment Card (shows inline when available) */}
        {assessment && (
          <AssessmentCard assessment={assessment} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Decision buttons (when assessment is available) */}
      {assessment && (
        <div className="px-3 py-2 border-t border-gray-100 flex gap-2">
          <button
            onClick={() => sendMessage('approve')}
            className="flex-1 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => sendMessage('refine')}
            className="flex-1 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            ↻ Refine
          </button>
          <button
            onClick={() => sendMessage('reject')}
            className="flex-1 py-1.5 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
          >
            ✗ Reject
          </button>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-3 py-1.5 flex gap-1.5 border-t border-gray-100">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => sendMessage(action.command)}
            className="px-2 py-1 text-[10px] bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="px-3 pb-3 pt-1">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message AI..."
            rows={1}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`px-3 rounded-lg text-sm transition-colors ${
              input.trim()
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
