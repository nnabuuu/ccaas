import { useTaskManagerSession } from '../hooks/useTaskManagerSession'
import { TaskList } from '../components/TaskList'
import { ChatPanel } from '../components/ChatPanel'

export function TaskManagerPage() {
  const {
    tasks,
    projects,
    isConnected,
    messages,
    sendMessage,
    refreshTasks,
  } = useTaskManagerSession()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left panel: Task list */}
      <div className="w-1/2 border-r border-gray-200 overflow-auto">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-semibold text-gray-900">Task Manager</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tasks.length} tasks across {projects.length} projects
          </p>
        </div>
        <TaskList
          tasks={tasks}
          projects={projects}
          onRefresh={refreshTasks}
        />
      </div>

      {/* Right panel: Chat */}
      <div className="w-1/2 flex flex-col">
        <ChatPanel
          messages={messages}
          isConnected={isConnected}
          onSendMessage={sendMessage}
        />
      </div>
    </div>
  )
}
