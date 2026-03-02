import React from 'react'
import type { ViewMode } from '../types'

interface HeaderProps {
  viewMode: ViewMode
  onViewChange: (mode: ViewMode) => void
  connected: boolean
  onOpenHistory?: () => void
}

export function Header({ viewMode, onViewChange, connected, onOpenHistory }: HeaderProps) {
  return (
    <header className={`h-14 flex items-center justify-between px-4 border-b ${
      viewMode === 'farmer'
        ? 'bg-agri-green-600 border-agri-green-700'
        : 'bg-bank-blue-600 border-bank-blue-700'
    }`}>
      <div className="flex items-center gap-2">
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            aria-label="历史对话"
            title="历史对话"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
        <span className="text-2xl">🌾</span>
        <h1 className="text-white text-lg font-bold">
          慧农服
          {viewMode === 'bank' && <span className="text-sm font-normal ml-2 opacity-80">· 信贷评估</span>}
        </h1>
      </div>

      <div className="flex bg-white/20 rounded-lg p-0.5">
        <button
          onClick={() => onViewChange('farmer')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'farmer'
              ? 'bg-white text-agri-green-700'
              : 'text-white/80 hover:text-white hover:bg-white/10'
          }`}
        >
          农户端
        </button>
        <button
          onClick={() => onViewChange('bank')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'bank'
              ? 'bg-white text-bank-blue-700'
              : 'text-white/80 hover:text-white hover:bg-white/10'
          }`}
        >
          银行端
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-300' : 'bg-red-400'}`} />
        <span className="text-white/80 text-sm">{connected ? '已连接' : '未连接'}</span>
      </div>
    </header>
  )
}
