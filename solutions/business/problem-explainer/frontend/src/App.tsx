import { useState, useEffect, useCallback } from 'react'
import {
  ChatPanel,
  MessageBubble,
  ChatSection,
  CollapsedChatTab,
  useChatLayout,
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
} from '@ccaas/react-sdk'
import type { Message } from '@ccaas/react-sdk'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

import { useExplanationSync } from './hooks/useExplanationSync'
import ProblemInput from './components/ProblemInput/ProblemInput'
import ExplanationPanel from './components/ExplanationPanel/ExplanationPanel'
import QuickActions from './components/QuickActions/QuickActions'
import { Subject } from './types'
import { fetchSubjects } from './utils/api'

const TENANT_ID = 'problem-explainer'

/** Custom markdown renderer for problem-explainer (KaTeX support) */
function renderContent(content: string, isUser: boolean) {
  if (isUser) return <span className="whitespace-pre-wrap">{content}</span>
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          code: ({ className, children, ...props }) => {
            const isInline = !className
            return isInline ? (
              <code className="bg-gray-200 px-1 rounded" {...props}>{children}</code>
            ) : (
              <code className={className} {...props}>{children}</code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function App() {
  // State
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('math')
  const [selectedGrade, setSelectedGrade] = useState<string>('9')
  const [problemContent, setProblemContent] = useState('')
  const [problemImagePath, setProblemImagePath] = useState<string | null>(null)
  const [studentAnswerImagePath, setStudentAnswerImagePath] = useState<string | null>(null)

  // Layout hook from SDK
  const { mode, setMode, isCollapsed, setCollapsed, overlayWidth, isResizing, overlayResizeProps } = useChatLayout()

  // Sync hook
  const {
    explanation,
    pendingUpdates,
    modifiedFields,
    handleOutputUpdate,
    syncToForm,
    syncAllToForm,
    dismissUpdate,
    undoSync,
    canUndo,
    resetExplanation,
  } = useExplanationSync()

  // SDK hooks for agent connection
  // IMPORTANT: Must use absolute URL to backend (not empty string or relative path)
  // See MEMORY.md: "Empty string causes SDK to use current origin (frontend port)"
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'pe',
    transport: 'sse',
  })
  const status = useAgentStatus({ connection })
  const chat = useAgentChat({
    connection,
    tenantId: TENANT_ID,
    enabledSkillSlugs: ['problem-explainer'],
    solutionConfigEndpoint: '/api/config',
    onOutputUpdate: handleOutputUpdate,
  })

  // Load subjects
  useEffect(() => {
    fetchSubjects()
      .then(setSubjects)
      .catch((err) => console.error('Failed to load subjects:', err))
  }, [])

  // Build attachments
  const buildAttachments = useCallback(() => {
    const attachments: { type: string; path: string }[] = []
    if (problemImagePath) attachments.push({ type: 'image', path: problemImagePath })
    if (studentAnswerImagePath) attachments.push({ type: 'image', path: studentAnswerImagePath })
    return attachments.length > 0 ? attachments : undefined
  }, [problemImagePath, studentAnswerImagePath])

  // Quick action handler
  const handleQuickAction = useCallback(
    (action: string) => {
      let prompt = ''
      switch (action) {
        case 'start': {
          const hasText = !!problemContent
          const hasImage = !!problemImagePath
          const hasStudentAnswer = !!studentAnswerImagePath

          if (hasText && hasImage) {
            prompt = '请讲解这道题（题目文本 + 图片已附上）：\n\n' + problemContent
          } else if (hasText) {
            prompt = '请讲解这道题：\n\n' + problemContent
          } else if (hasImage) {
            prompt = '请讲解附件中的题目图片'
          } else {
            prompt = '请开始讲解'
          }
          if (hasStudentAnswer) {
            prompt += '\n\n同时，我上传了学生的答案图片，请一并分析。'
          }
          break
        }
        case 'next':
          prompt = '请继续讲解下一步'
          break
        case 'detail':
          prompt = '请更详细地解释这一步'
          break
        case 'practice':
        case 'example':
        case 'alternative':
          prompt = '请给我一道类似的变式练习题'
          break
        case 'ppt':
          prompt = problemContent
            ? `请使用 NotebookLM 为这道题生成讲题PPT课件：\n\n${problemContent}`
            : '请使用 NotebookLM 生成讲题PPT课件'
          break
        case 'why':
          prompt = '请更详细地解释这一步'
          break
        default:
          return
      }
      chat.sendMessage(prompt, { attachments: buildAttachments() })
    },
    [problemContent, problemImagePath, studentAnswerImagePath, chat, buildAttachments]
  )

  // Send message handler
  const handleSendMessage = useCallback(
    (content: string) => {
      if (problemContent && chat.messages.length === 0) {
        chat.sendMessage('题目：\n' + problemContent + '\n\n' + content, { attachments: buildAttachments() })
      } else {
        chat.sendMessage(content)
      }
    },
    [problemContent, chat, buildAttachments]
  )

  // New problem handler
  const handleNewProblem = useCallback(() => {
    setProblemContent('')
    setProblemImagePath(null)
    setStudentAnswerImagePath(null)
    resetExplanation()
  }, [resetExplanation])

  // Custom message renderer
  const renderMessage = useCallback((message: Message) => (
    <MessageBubble
      message={message}
      colorScheme="blue"
      renderContent={renderContent}
    />
  ), [])

  // Quick actions renderer
  const renderQuickActions = useCallback(() => (
    <QuickActions
      onAction={handleQuickAction}
      disabled={chat.isProcessing || !connection.connected}
    />
  ), [handleQuickAction, chat.isProcessing, connection.connected])

  // Shared chat panel props
  const chatPanelElement = (
    <ChatPanel
      messages={chat.messages}
      isProcessing={chat.isProcessing}
      connected={connection.connected}
      colorScheme="blue"
      title="对话"
      emptyStateText="开始对话来讲解题目"
      emptyStateSubtext="向AI助手描述您的讲题需求"
      placeholder={connection.connected ? '输入消息...' : '正在连接服务器...'}
      activeTools={status.activeTools}
      isThinking={status.isThinking}
      thinkingContent={status.thinkingContent}
      todoItems={status.todoItems}
      todoStats={status.todoStats}
      onSendMessage={handleSendMessage}
      onCancel={chat.cancelProcessing}
      renderMessage={renderMessage}
      renderQuickActions={renderQuickActions}
    />
  )

  // Shared content: header + problem input + explanation
  const headerElement = (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold text-gray-800">讲题专家</h1>
        <div className="flex items-center space-x-2">
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            {['7', '8', '9', '10', '11', '12'].map((g) => (
              <option key={g} value={g}>{g}年级</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <span className={'w-2 h-2 rounded-full ' + (connection.connected ? 'bg-green-500' : 'bg-red-500')} />
          <span className="text-sm text-gray-500">
            {connection.connected ? '已连接' : '未连接'}
          </span>
        </div>
        {pendingUpdates.size > 0 && (
          <button
            onClick={syncAllToForm}
            className="px-3 py-1.5 bg-yellow-500 text-white text-sm rounded-md hover:bg-yellow-600"
          >
            同步全部 ({pendingUpdates.size})
          </button>
        )}
        <button
          onClick={handleNewProblem}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200"
        >
          新题目
        </button>
      </div>
    </header>
  )

  const problemInputElement = (
    <div className="w-64 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
      <ProblemInput
        content={problemContent}
        imagePath={problemImagePath}
        onContentChange={setProblemContent}
        onImageUpload={setProblemImagePath}
        studentAnswerImagePath={studentAnswerImagePath}
        onStudentAnswerUpload={setStudentAnswerImagePath}
        sessionId={connection.sessionId}
      />
    </div>
  )

  const explanationElement = (
    <div className="flex-1 overflow-auto p-4">
      <ExplanationPanel
        explanation={explanation}
        pendingUpdates={pendingUpdates}
        modifiedFields={modifiedFields}
        onSync={syncToForm}
        onDismiss={dismissUpdate}
        onUndo={undoSync}
        canUndo={canUndo}
        hasFormula={subjects.find((s) => s.id === selectedSubject)?.hasFormula ?? false}
      />
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {headerElement}

      {/* === DEFAULT MODE: fixed right sidebar === */}
      {mode === 'default' && (
        <div className="flex-1 flex overflow-hidden">
          {problemInputElement}
          {explanationElement}
          <div className="w-96 border-l border-gray-200 bg-white flex flex-col flex-shrink-0">
            <ChatSection
              mode={mode}
              isCollapsed={isCollapsed}
              onModeChange={setMode}
              onToggleCollapse={() => setCollapsed(!isCollapsed)}
              colorScheme="blue"
            >
              {chatPanelElement}
            </ChatSection>
          </div>
        </div>
      )}

      {/* === SIDE-BY-SIDE MODE: resizable panels === */}
      {mode === 'side-by-side' && (
        <div className="flex-1 flex overflow-hidden">
          {problemInputElement}
          {isCollapsed ? (
            <main className="flex-1 relative overflow-auto p-4">
              <ExplanationPanel
                explanation={explanation}
                pendingUpdates={pendingUpdates}
                modifiedFields={modifiedFields}
                onSync={syncToForm}
                onDismiss={dismissUpdate}
                onUndo={undoSync}
                canUndo={canUndo}
                hasFormula={subjects.find((s) => s.id === selectedSubject)?.hasFormula ?? false}
              />
              <CollapsedChatTab onClick={() => setCollapsed(false)} />
            </main>
          ) : (
            <PanelGroup direction="horizontal" className="flex-1">
              <Panel defaultSize={60} minSize={30}>
                <div className="h-full overflow-auto p-4">
                  <ExplanationPanel
                    explanation={explanation}
                    pendingUpdates={pendingUpdates}
                    modifiedFields={modifiedFields}
                    onSync={syncToForm}
                    onDismiss={dismissUpdate}
                    onUndo={undoSync}
                    canUndo={canUndo}
                    hasFormula={subjects.find((s) => s.id === selectedSubject)?.hasFormula ?? false}
                  />
                </div>
              </Panel>
              <PanelResizeHandle className="w-1.5 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize" />
              <Panel defaultSize={40} minSize={20}>
                <div className="h-full border-l border-gray-200 bg-white flex flex-col">
                  <ChatSection
                    mode={mode}
                    isCollapsed={isCollapsed}
                    onModeChange={setMode}
                    onToggleCollapse={() => setCollapsed(!isCollapsed)}
                    colorScheme="blue"
                  >
                    {chatPanelElement}
                  </ChatSection>
                </div>
              </Panel>
            </PanelGroup>
          )}
        </div>
      )}

      {/* === OVERLAY MODE: floating chat panel === */}
      {mode === 'overlay' && (
        <div className="flex-1 flex overflow-hidden relative">
          {problemInputElement}
          {explanationElement}

          {!isCollapsed && (
            <div
              className="absolute top-0 right-0 bottom-0 z-30 bg-white shadow-xl border-l border-gray-200 flex flex-col"
              style={{ width: overlayWidth }}
            >
              {/* Resize handle */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors ${isResizing ? 'bg-blue-400' : 'bg-transparent'}`}
                {...overlayResizeProps}
              />
              <ChatSection
                mode={mode}
                isCollapsed={isCollapsed}
                onModeChange={setMode}
                onToggleCollapse={() => setCollapsed(!isCollapsed)}
                colorScheme="blue"
              >
                {chatPanelElement}
              </ChatSection>
            </div>
          )}

          {isCollapsed && (
            <CollapsedChatTab onClick={() => setCollapsed(false)} />
          )}
        </div>
      )}

      {/* Error Toast */}
      {connection.error && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg">
          {connection.error}
        </div>
      )}
    </div>
  )
}

export default App
