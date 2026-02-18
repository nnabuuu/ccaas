/**
 * Quiz Analyzer - Three-Column Layout
 *
 * Layout:
 * - Left (30%): Quiz Input Form
 * - Middle (35%): Standardized Quiz Display
 * - Right (35%): AI Chat + Quick Actions
 *
 * Supports teacher view (full analysis) and student view (guided tutoring)
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/solid'
import { useChatLayout, ChatSection, CollapsedChatTab } from '@ccaas/react-sdk'
import ErrorBoundary from './components/ErrorBoundary'
import ConnectionStatus from './components/ConnectionStatus'
import QuizInputForm, { type QuizInputData } from './components/QuizInputForm'
import StandardizedQuizDisplay, {
  type StandardizedQuizData,
  type ParsedQuiz,
  type QuizMetadata,
} from './components/StandardizedQuizDisplay'
import ChatWithQuickActions from './components/ChatWithQuickActions'
import ViewModeToggle from './components/ViewModeToggle'
import { useQuizSession } from './hooks/useQuizSession'

function AppNew() {
  const [viewMode, setViewMode] = useState<'teacher' | 'student'>('teacher')
  const session = useQuizSession({ viewMode })

  // Chat layout hook
  const layout = useChatLayout()

  // Quiz input state
  const [quizInput, setQuizInput] = useState<QuizInputData | null>(null)

  // Standardized quiz display state
  const [standardizedQuiz, setStandardizedQuiz] = useState<StandardizedQuizData>({
    parsed: null,
    metadata: null,
  })

  // Analysis in progress
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Build analysis prompt based on view mode
  const buildAnalysisPrompt = useCallback(
    (input: QuizInputData): string => {
      if (viewMode === 'student') {
        return `请帮我检查这道题的解答：

【题目内容】
${input.content}

【我的解答】
${input.studentAnswer || '（未提供解答）'}

请按以下步骤进行辅导：
1. 使用 parse_quiz_content 工具解析题目内容（题干、选项、题型）
2. 使用 search_knowledge_points_json 工具标注相关知识点
3. 判断我的答案是否正确
4. 如果有错误，请指出具体错在哪里，并用引导的方式帮我思考

注意：请不要直接告诉我完整答案或完整解题步骤，用苏格拉底式引导帮助我自己发现问题。
请使用 write_output 工具将解析结果写入 parsedQuiz 和 knowledgePointTags 字段。
`
      }

      // Teacher mode (default)
      let prompt = `请帮我分析这道题目：

【题目内容】
${input.content}

【参考答案】
${input.correctAnswer}
`

      if (input.studentAnswer) {
        prompt += `
【学生答案】
${input.studentAnswer}
`
      }

      prompt += `
请按以下步骤进行分析：
1. 使用 parse_quiz_content 工具解析题目内容（题干、选项、题型）
2. 使用 search_knowledge_points_json 工具标注相关知识点
3. 使用 search_catalog 工具查找所属目录
${input.studentAnswer ? '4. 分析学生答案的错误原因和知识盲点\n5. 生成标准解题思路' : '4. 生成标准解题思路'}

请使用 write_output 工具将每个步骤的结果写入对应字段。
`

      return prompt
    },
    [viewMode]
  )

  // Handle quiz input submit
  const handleQuizSubmit = useCallback(
    (data: QuizInputData) => {
      setQuizInput(data)
      setIsAnalyzing(true)

      // Reset standardized quiz display
      setStandardizedQuiz({
        parsed: null,
        metadata: null,
      })

      // Send analysis request to AI
      const prompt = buildAnalysisPrompt(data)
      session.sendMessage(prompt)
    },
    [buildAnalysisPrompt, session.sendMessage]
  )

  // Handle primary quick action button
  const handleStartAnalysis = useCallback(() => {
    if (quizInput) {
      handleQuizSubmit(quizInput)
    }
  }, [quizInput, handleQuizSubmit])

  // Shared reset — clears conversation, form, and display state
  const resetSession = useCallback(() => {
    session.clearConversation()
    setQuizInput(null)
    setStandardizedQuiz({ parsed: null, metadata: null })
    setIsAnalyzing(false)
  }, [session.clearConversation])

  // Switch view mode: change template and reset (new sessionId picks up new template)
  const handleViewModeChange = useCallback(
    (mode: 'teacher' | 'student') => {
      setViewMode(mode)
      resetSession()
    },
    [resetSession]
  )

  // Can analyze depends on view mode
  const canAnalyze = useMemo(() => {
    if (!quizInput || !quizInput.content) return false
    if (viewMode === 'student') return !!quizInput.studentAnswer
    return !!quizInput.correctAnswer
  }, [quizInput, viewMode])

  // Listen to output_update events to update standardized quiz display
  useEffect(() => {
    // Parse analysis results from session.analysisResults
    const results = session.analysisResults

    // Update parsed quiz
    if (results.parsedQuiz) {
      const parsed = results.parsedQuiz as ParsedQuiz
      setStandardizedQuiz((prev) => ({
        ...prev,
        parsed,
      }))
    }

    // Update metadata
    const hasMetadata =
      results.knowledge_point_tags || results.knowledgePointTags || results.catalog || results.difficulty

    if (hasMetadata) {
      const metadata: QuizMetadata = {
        knowledgePoints: (results.knowledge_point_tags || results.knowledgePointTags) as any[] || [],
        catalog: (results.catalog as any) || { subjectId: '', path: [] },
        difficulty: (results.difficulty as number) || 0,
      }

      setStandardizedQuiz((prev) => ({
        ...prev,
        metadata,
      }))
    }

    // Stop analyzing when AI is done
    if (!session.isProcessing && isAnalyzing) {
      setIsAnalyzing(false)
    }
  }, [session.analysisResults, session.isProcessing, isAnalyzing])

  // Clear conversation button handler
  const handleClearConversation = resetSession

  // Shared chat content element (define once, use conditionally)
  const chatContent = (
    <ChatSection
      mode={layout.mode}
      isCollapsed={layout.isCollapsed}
      onModeChange={layout.setMode}
      onToggleCollapse={() => layout.setCollapsed(!layout.isCollapsed)}
    >
      <ChatWithQuickActions
        onStartAnalysis={handleStartAnalysis}
        canAnalyze={canAnalyze}
        viewMode={viewMode}
        messages={session.messages}
        isProcessing={session.isProcessing}
        isThinking={session.isThinking}
        thinkingContent={session.thinkingContent}
        onSendMessage={session.sendMessage}
        onCancel={session.cancelProcessing}
        activeTools={session.activeTools}
        activeSubAgents={session.activeSubAgents}
        todoItems={session.todoItems}
        todoStats={session.todoStats}
      />
    </ChatSection>
  )

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-slate-200">
          <div className="max-w-[1920px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SparklesIcon className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">题目分析器</h1>
                  <p className="text-sm text-slate-500">AI 驱动的智能题目分析工具</p>
                </div>
              </div>

              {/* View Mode Toggle + New Conversation Button */}
              <div className="flex items-center gap-3">
                <ViewModeToggle value={viewMode} onChange={handleViewModeChange} />

                <button
                  onClick={handleClearConversation}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                  新对话
                </button>
              </div>
            </div>
          </div>
        </header>

      {/* Main Content - Three Column Layout */}
      <main id="main-container" className="flex-1 relative overflow-hidden max-w-[1920px] mx-auto">
        <div id="grid-container" className="grid grid-cols-12 gap-4 h-full p-4">
          {/* Left Column - Input Form (30%) */}
          <div id="left-column" className="col-span-12 lg:col-span-3 flex flex-col bg-white rounded-lg shadow-sm border border-slate-200 p-6 overflow-y-auto">
            <QuizInputForm
              key={viewMode}
              onSubmit={handleQuizSubmit}
              disabled={session.isProcessing}
              viewMode={viewMode}
            />
          </div>

          {/* Middle Column - Standardized Display (35%) */}
          <div id="middle-column" className="col-span-12 lg:col-span-4 flex flex-col bg-white rounded-lg shadow-sm border border-slate-200 p-6 overflow-y-auto">
            <StandardizedQuizDisplay
              data={standardizedQuiz}
              isLoading={isAnalyzing && !standardizedQuiz.parsed}
              hideCorrectAnswer={viewMode === 'student'}
            />
          </div>

          {/* Right Column - AI Chat (35%) */}
          <div id="right-column" className="col-span-12 lg:col-span-5 flex flex-col overflow-hidden bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            {/* Default/side-by-side mode: use shared chatContent */}
            {(layout.mode === 'default' || layout.mode === 'side-by-side') &&
             !layout.isCollapsed && chatContent}

            {/* Overlay mode: show placeholder */}
            {layout.mode === 'overlay' && (
              <div className="text-gray-400 text-center py-8">
                聊天面板已浮动到右侧
              </div>
            )}
          </div>
        </div>

        {/* Overlay: main 的直接子元素 */}
        {layout.mode === 'overlay' && !layout.isCollapsed && (
          <div
            id="overlay-panel"
            className={`absolute top-0 right-0 bottom-0 flex flex-col overflow-hidden bg-white border-l border-gray-200 shadow-xl z-10 ${
              layout.isResizing ? 'select-none' : ''
            }`}
            style={{
              width: layout.overlayWidth,
              minWidth: '320px',
            }}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors z-20"
              {...layout.overlayResizeProps}
            />
            {chatContent}
          </div>
        )}

        {/* Collapsed tab */}
        {layout.isCollapsed && (
          <CollapsedChatTab onClick={() => layout.setCollapsed(false)} />
        )}
      </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200">
          <div className="max-w-[1920px] mx-auto px-6 py-3">
            <div className="flex items-center justify-between text-xs">
              <ConnectionStatus
                connected={session.connected}
                error={session.error}
                onReconnect={session.reconnect}
              />
              <div className="text-slate-500">
                {session.messages.length > 0 && (
                  <span>{session.messages.length} 条消息</span>
                )}
                {session.sessionId && (
                  <span className="ml-3">
                    会话 ID: {session.sessionId.substring(0, 8)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  )
}

export default AppNew
