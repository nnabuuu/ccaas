/**
 * Quiz Analyzer - Simplified Single-Page App
 *
 * Layout:
 * - Left Panel (40%): QuizInput
 * - Right Panel (60%): AnalysisDisplay + ChatSection
 *
 * Message history is automatically loaded from server via useAgentChat.
 */

import { useState, useCallback, useMemo } from 'react'
import { SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/solid'
import QuizInput from './components/QuizInput'
import CompleteAnalysisView from './components/CompleteAnalysisView'
import SimpleChatSection from './components/SimpleChatSection'
import { useQuizSession } from './hooks/useQuizSession'

function App() {
  const session = useQuizSession()
  const [isChatExpanded, setIsChatExpanded] = useState(false)

  // Handle analyze button click
  const handleAnalyze = useCallback(
    (content: string, answer?: string) => {
      session.sendMessage(
        `请分析这道题目：\n\n${content}${answer ? `\n\n参考答案：\n${answer}` : ''}`
      )
    },
    [session.sendMessage]
  )

  // Memoize hasAnalysisResults check
  const hasAnalysisResults = useMemo(
    () => Object.keys(session.analysisResults).length > 0,
    [session.analysisResults]
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SparklesIcon className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">题目处理器</h1>
                <p className="text-sm text-slate-500">AI 驱动的题目分析工具</p>
              </div>
            </div>

            {/* New Conversation Button */}
            <button
              onClick={() => session.clearConversation()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              新对话
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-140px)]">
          {/* Left Panel (40%) */}
          <div className="lg:col-span-2 space-y-6 overflow-y-auto">
            {/* Quiz Input */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">输入题目</h2>
              <QuizInput
                onAnalyze={handleAnalyze}
                disabled={session.isProcessing}
              />
            </div>

          </div>

          {/* Right Panel (60%) */}
          <div className="lg:col-span-3 space-y-6 overflow-y-auto">
            {/* Analysis Display */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">分析结果</h2>

              {/* Loading history from server */}
              {session.isLoadingHistory && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-400 border-t-transparent" />
                  <p className="mt-4 text-slate-600">加载对话历史...</p>
                </div>
              )}

              {/* AI processing in progress */}
              {!session.isLoadingHistory && session.isProcessing && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
                  <p className="mt-4 text-slate-600">AI 分析中...</p>
                  {session.isThinking && session.thinkingContent && (
                    <p className="mt-2 text-sm text-slate-500">{session.thinkingContent}</p>
                  )}
                </div>
              )}

              {/* Show real-time analysis results from AI */}
              {!session.isLoadingHistory && !session.isProcessing && hasAnalysisResults && (
                <CompleteAnalysisView
                  analysis={session.analysisResults}
                  quiz={null}
                />
              )}

              {/* Empty state */}
              {!session.isLoadingHistory && !session.isProcessing && !hasAnalysisResults && (
                <div className="text-center py-12 text-slate-400">
                  <SparklesIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">等待输入题目</p>
                  <p className="text-sm mt-2">在左侧输入题目内容并点击"分析题目"</p>
                </div>
              )}
            </div>

            {/* Chat Section - Collapsible */}
            <div
              className={`bg-white rounded-xl shadow-sm border border-slate-200 transition-all duration-300 ${
                isChatExpanded ? 'h-[500px]' : 'h-[60px]'
              }`}
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer border-b border-slate-200"
                onClick={() => setIsChatExpanded(!isChatExpanded)}
              >
                <h2 className="text-lg font-semibold text-slate-900">AI 对话</h2>
                <button className="text-slate-500 hover:text-slate-700">
                  {isChatExpanded ? '收起' : '展开'}
                </button>
              </div>

              {isChatExpanded && (
                <div className="h-[calc(100%-60px)]">
                  <SimpleChatSection
                    messages={session.messages}
                    isProcessing={session.isProcessing}
                    isThinking={session.isThinking}
                    thinkingContent={session.thinkingContent}
                    onSendMessage={session.sendMessage}
                    activeTools={session.activeTools}
                    activeSubAgents={session.activeSubAgents}
                    todoItems={session.todoItems}
                    todoStats={session.todoStats}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-6">
        <div className="max-w-[1800px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div>
              {session.connected ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  已连接 · 会话 ID: {session.sessionId.substring(0, 8)}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                  未连接
                </span>
              )}
            </div>
            <div>
              {session.messages.length > 0 && (
                <span>{session.messages.length} 条消息</span>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
