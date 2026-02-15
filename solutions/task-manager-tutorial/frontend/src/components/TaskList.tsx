import { Task, Project } from '../hooks/useTaskManagerSession'

interface TaskListProps {
  tasks: Task[]
  projects: Project[]
  onRefresh: () => void
}

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-gray-100 text-gray-800',
}

const statusLabels: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
}

export function TaskList({ tasks, projects, onRefresh }: TaskListProps) {
  const getProjectName = (projectId: string | null) => {
    if (!projectId) return null
    return projects.find(p => p.id === projectId)?.name ?? null
  }

  if (tasks.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-lg">No tasks yet</p>
        <p className="text-sm mt-2">Use the chat to create tasks with AI assistance</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex justify-end mb-3">
        <button
          onClick={onRefresh}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          Refresh
        </button>
      </div>
      <ul className="space-y-2">
        {tasks.map(task => (
          <li
            key={task.id}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">{task.title}</h3>
                {task.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </span>
                  <span className="text-xs text-gray-500">
                    {statusLabels[task.status] ?? task.status}
                  </span>
                  {getProjectName(task.projectId) && (
                    <span className="text-xs text-primary-600">
                      {getProjectName(task.projectId)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
