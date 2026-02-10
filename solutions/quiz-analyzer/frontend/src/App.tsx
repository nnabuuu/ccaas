/**
 * Quiz Analyzer - Simplified Single-Page App
 *
 * Layout:
 * - Left Panel (40%): QuizInput + HistoryList
 * - Right Panel (60%): AnalysisDisplay + ChatSection
 */

import { useState, useCallback, useMemo } from 'react'
import { SparklesIcon } from '@heroicons/react/24/solid'
import QuizInput from './components/QuizInput'
import HistoryList from './components/HistoryList'
import ExportButton from './components/ExportButton'
import CompleteAnalysisView from './components/CompleteAnalysisView'
import SimpleChatSection from './components/SimpleChatSection'
import { useQuizSession } from './hooks/useQuizSession'
import { useLocalHistory } from './hooks/useLocalHistory'
import type { Quiz } from './types'

function App() {
  const session = useQuizSession()
  const history = useLocalHistory()
  const [isChatExpanded, setIsChatExpanded] = useState(false)

  // Handle analyze button click
  const handleAnalyze = useCallback(
    (content: string, answer?: string) => {
      session.sendMessage(
        `请分析这道题目：\n\n${content}${answer ? `\n\n参考答案：\n${answer}` : ''}`
      )
      // TODO: Listen for MCP tool completion to save analysis to history
    },
    [session.sendMessage]
  )

  // ✅ Memoize currentQuiz object creation (rerender-memo)
  const currentQuiz: Quiz | null = useMemo(() => {
    if (!history.current) return null
    return {
      id: history.current.id,
      tenant_id: 'quiz-analyzer',
      content: history.current.quiz.content,
      correct_answer: history.current.quiz.answer,
      subject_id: '',
      created_at: history.current.timestamp.toISOString(),
      updated_at: history.current.timestamp.toISOString(),
    }
  }, [history.current])

  // ✅ Memoize hasAnalysisResults check (js-cache-function-results)
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

            {/* Export Button */}
            {history.current && (
              <ExportButton
                onExportJSON={history.exportJSON}
                onExportMarkdown={history.exportMarkdown}
                onCopyToClipboard={history.copyToClipboard}
              />
            )}
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

            {/* History List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <HistoryList
                history={history.history}
                current={history.current}
                onSelect={history.setCurrent}
                onDelete={history.deleteRecord}
              />
            </div>
          </div>

          {/* Right Panel (60%) */}
          <div className="lg:col-span-3 space-y-6 overflow-y-auto">
            {/* Analysis Display */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">分析结果</h2>

              {session.isProcessing && !history.current && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
                  <p className="mt-4 text-slate-600">AI 分析中...</p>
                  {session.isThinking && session.thinkingContent && (
                    <p className="mt-2 text-sm text-slate-500">{session.thinkingContent}</p>
                  )}
                </div>
              )}

              {/* Show real-time analysis results from AI */}
              {!session.isProcessing && !history.current && hasAnalysisResults && (
                <CompleteAnalysisView
                  analysis={session.analysisResults}
                  quiz={null}
                />
              )}

              {!session.isProcessing && !history.current && !hasAnalysisResults && (
                <div className="text-center py-12 text-slate-400">
                  <SparklesIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">等待输入题目</p>
                  <p className="text-sm mt-2">在左侧输入题目内容并点击"分析题目"</p>
                </div>
              )}

              {history.current && currentQuiz && (
                <CompleteAnalysisView
                  analysis={history.current.analysis}
                  quiz={currentQuiz}
                />
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
              {history.history.length > 0 && (
                <span>{history.history.length} 条分析历史</span>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
