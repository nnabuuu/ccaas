import React, { useState, useRef, useEffect } from 'react';
import { ChatCircle, ArrowRight, CheckCircle, ArrowClockwise, XCircle } from '@phosphor-icons/react';
import { useMosaicStore } from '../../hooks/useStore';
import MessageBubble from './MessageBubble';
import AssessmentCard from '../assessment/AssessmentCard';
import type { Message } from '@kedge-agentic/react-sdk';

interface ChatPanelProps {
  sendMessage: (content: string) => void | Promise<void>;
  messages: Message[];
  isProcessing?: boolean;
}

const QUICK_ACTIONS = [
  { label: 'Convert', command: '转换这张图片为乐高马赛克' },
  { label: 'Optimize', command: '请优化当前马赛克设计' },
  { label: 'Export', command: '导出拼装指南 PDF' },
];

export default function ChatPanel({ sendMessage, messages, isProcessing }: ChatPanelProps) {
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
      <div className="h-9 flex items-center px-3 border-b border-zinc-200 shrink-0">
        <span className="text-xs font-medium text-zinc-600">AI Chat</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-zinc-400 mt-8">
            <ChatCircle size={32} weight="light" className="mx-auto mb-2 text-zinc-300" />
            <p className="text-xs">Upload an image and ask me to convert it</p>
            <p className="text-[10px] mt-1">or use quick actions below</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {assessment && (
          <AssessmentCard assessment={assessment} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {assessment && (
        <div className="px-3 py-2 border-t border-zinc-100 flex gap-2">
          <button
            onClick={() => sendMessage('approve')}
            className="flex-1 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors inline-flex items-center justify-center gap-1"
          >
            <CheckCircle size={14} weight="regular" />
            Approve
          </button>
          <button
            onClick={() => sendMessage('refine')}
            className="flex-1 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors inline-flex items-center justify-center gap-1"
          >
            <ArrowClockwise size={14} weight="regular" />
            Refine
          </button>
          <button
            onClick={() => sendMessage('reject')}
            className="flex-1 py-1.5 text-xs bg-zinc-300 text-zinc-700 rounded hover:bg-zinc-400 transition-colors inline-flex items-center justify-center gap-1"
          >
            <XCircle size={14} weight="regular" />
            Reject
          </button>
        </div>
      )}

      <div className="px-3 py-1.5 flex gap-1.5 border-t border-zinc-100">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => sendMessage(action.command)}
            className="px-2 py-1 text-[10px] bg-zinc-100 hover:bg-zinc-200 rounded text-zinc-600 transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="px-3 pb-3 pt-1">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message AI..."
            rows={1}
            className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`px-3 rounded-lg text-sm transition-colors flex items-center justify-center ${
              input.trim()
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-zinc-100 text-zinc-300 cursor-not-allowed'
            }`}
          >
            <ArrowRight size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
