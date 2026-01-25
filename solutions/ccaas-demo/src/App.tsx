/**
 * CCAAS Demo App
 *
 * Interactive demo showcasing Claude Code as a Service features:
 * - Real skills from backend API
 * - Real Claude Code CLI interactions
 * - File creation and download
 */

import { SkillsSidebar } from './components/SkillsSidebar'
import { ChatPanel } from './components/ChatPanel'
import { useRealSession } from './hooks/useRealSession'

export default function App() {
  const {
    skills,
    session,
    connected,
    error,
    loading,
    toggleSkill,
    restartSession,
    sendMessage,
    downloadFile,
    refreshSkills,
  } = useRealSession()

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">CCAAS Demo</h1>
            <p className="text-sm text-gray-500">Claude Code as a Service</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-500">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Refresh Skills Button */}
          <button
            onClick={refreshSkills}
            disabled={loading}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? '加载中...' : '🔄 刷新 Skills'}
          </button>

          {/* Session ID */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Session:</span>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
              {session.sessionId.slice(0, 16)}...
            </code>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center gap-3">
          <span className="text-red-500">⚠️</span>
          <span className="text-red-700">{error}</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-auto px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            重新加载
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && skills.length === 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 flex items-center gap-3">
          <span className="animate-spin">⏳</span>
          <span className="text-blue-700">正在从后端加载 Skills...</span>
        </div>
      )}

      {/* No Skills Warning */}
      {!loading && skills.length === 0 && connected && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3">
          <span className="text-amber-500">💡</span>
          <span className="text-amber-700">
            没有找到 Skills。请先在后端创建 Skills，或检查 API Key 配置。
          </span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Skills Sidebar */}
        <SkillsSidebar
          skills={skills}
          needsRestart={session.needsRestart}
          onToggle={toggleSkill}
          onRestart={restartSession}
        />

        {/* Chat Panel */}
        <ChatPanel
          messages={session.messages}
          activeSkill={session.activeSkill}
          isProcessing={session.isProcessing}
          onSend={sendMessage}
          onDownload={downloadFile}
        />
      </div>
    </div>
  )
}
