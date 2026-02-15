# 6.5 Frontend

In this section you will build the React frontend for the Task Manager. The frontend has three responsibilities: display domain data from the Solution backend, relay chat messages through CCAAS, and apply `output_update` events so the AI can populate forms. By the end you will have a working split-panel UI with a task list on the left and a chat panel on the right.

## Architecture Recap

Before writing code, recall how the frontend fits into the data flow:

```
┌──────────────────────────────────────────────────────┐
│                    Frontend                          │
│                                                      │
│  ┌─────────────┐    ┌────────────┐    ┌───────────┐ │
│  │ TaskList     │    │ ChatPanel  │    │ FormSync  │ │
│  │ (REST)       │    │ (WebSocket)│    │ (events)  │ │
│  └──────┬──────┘    └─────┬──────┘    └─────┬─────┘ │
│         │                 │                 │        │
└─────────┼─────────────────┼─────────────────┼────────┘
          │                 │                 │
    Solution Backend     CCAAS            CCAAS
    (port 3003)        (port 3001)      (port 3001)
    GET /api/tasks    WebSocket relay   output_update
```

The Vite dev server proxies requests so the frontend never needs to know the actual backend ports. All `/api` requests go to the Solution backend, all `/api/v1` and `/socket.io` requests go to CCAAS.

## Project Configuration

### vite.config.ts

The proxy configuration is the glue that connects the frontend to both backends:

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5281,
    proxy: {
      // CCAAS sessions API
      '/api/v1/sessions': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // CCAAS health API
      '/api/v1/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // CCAAS skills API
      '/api/v1/skills': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Solution backend API (tasks CRUD, projects CRUD)
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      // CCAAS WebSocket
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
```

{% hint style="warning" %}
**Order matters.** The `/api/v1/sessions` rule must appear before `/api` because Vite matches the first prefix that fits. If `/api` came first, CCAAS requests would be sent to the Solution backend and fail.
{% endhint %}

### Dependencies

The frontend depends on two workspace packages from the monorepo:

```json
{
  "dependencies": {
    "@ccaas/common": "file:../../../packages/common",
    "@ccaas/react-sdk": "file:../../../packages/react-sdk",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "socket.io-client": "^4.8.1"
  }
}
```

- **@ccaas/common** provides shared TypeScript types (`OutputUpdateEvent`, `TextDeltaEvent`, `TokenUsage`)
- **@ccaas/react-sdk** provides hooks for connecting to CCAAS (`useAgentConnection`, `useAgentChat`, `useOutputSync`)

## Step 1: Define Domain Types

Start by defining the TypeScript interfaces that match the Solution backend API responses. These types drive the entire frontend:

```typescript
// frontend/src/hooks/useTaskManagerSession.ts

export interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  projectId: string | null
  dueDate: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  color: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}
```

{% hint style="info" %}
**Why not use @ccaas/common types here?** These are domain types specific to the Task Manager Solution. The `@ccaas/common` package provides platform types (sessions, events, messages). Your Solution defines its own business entity types.
{% endhint %}

## Step 2: Build the Session Hook

The session hook is the heart of the frontend. It combines three concerns into one composable API:

1. **REST data fetching** -- load tasks and projects from the Solution backend
2. **WebSocket connection** -- maintain a live connection to CCAAS for chat
3. **Output sync** -- handle `output_update` events from the AI Agent

### Basic Version (REST Only)

Start with the simplest version that fetches data from the Solution backend:

```typescript
// frontend/src/hooks/useTaskManagerSession.ts

import { useState, useEffect, useCallback } from 'react'

export function useTaskManagerSession() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)

  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch {
      // Backend may not be running yet
    }
  }, [])

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch {
      // Backend may not be running yet
    }
  }, [])

  useEffect(() => {
    refreshTasks()
    refreshProjects()

    fetch('/api/v1/health')
      .then(res => setIsConnected(res.ok))
      .catch(() => setIsConnected(false))
  }, [refreshTasks, refreshProjects])

  const sendMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, msg])
  }, [])

  return {
    tasks, projects, messages, isConnected,
    sendMessage, refreshTasks, refreshProjects,
  }
}
```

This version works immediately: it loads tasks from the backend and lets users type messages (though they do not reach the AI yet).

### Full Version (With react-sdk Integration)

To connect to CCAAS, replace the manual WebSocket logic with hooks from `@ccaas/react-sdk`:

```typescript
// frontend/src/hooks/useTaskManagerSession.ts (full version)

import { useState, useEffect, useCallback } from 'react'
import { useAgentConnection } from '@ccaas/react-sdk'
import { useAgentChat } from '@ccaas/react-sdk'
import { useOutputSync } from '@ccaas/react-sdk'

export function useTaskManagerSession() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [taskFormData, setTaskFormData] = useState<Record<string, unknown>>({})

  // 1. Connect to CCAAS
  const connection = useAgentConnection({
    serverUrl: '/',
    tenantId: 'task-manager-tutorial',
  })

  // 2. Handle output_update events
  const outputSync = useOutputSync({
    mode: 'auto',
  })

  // 3. Chat with AI Agent
  const chat = useAgentChat({
    connection,
    tenantId: 'task-manager-tutorial',
    onOutputUpdate: (update) => {
      outputSync.handleOutputUpdate(update)
      // Auto-apply to form data
      setTaskFormData(prev => ({
        ...prev,
        [update.field]: update.value,
      }))
    },
  })

  // REST data fetching (same as before)
  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) setTasks(await res.json())
    } catch { /* ignore */ }
  }, [])

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) setProjects(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    refreshTasks()
    refreshProjects()
  }, [refreshTasks, refreshProjects])

  return {
    // Domain data
    tasks, projects,
    refreshTasks, refreshProjects,
    // Chat
    messages: chat.messages,
    isConnected: connection.connected,
    isProcessing: chat.isProcessing,
    sendMessage: chat.sendMessage,
    // Form sync
    taskFormData,
    pendingUpdates: outputSync.pendingUpdates,
    modifiedFields: outputSync.modifiedFields,
  }
}
```

The three react-sdk hooks layer cleanly:

| Hook | Responsibility |
|------|---------------|
| `useAgentConnection` | Socket.io connection, session ID, reconnection |
| `useAgentChat` | Message history, text streaming, REST-based sendMessage |
| `useOutputSync` | Pending updates queue, undo stack, field tracking |

{% hint style="info" %}
**Why send messages via REST instead of WebSocket?** The `useAgentChat` hook sends messages by calling `POST /api/v1/sessions/{id}/completion`. This is a deliberate design choice: REST requests are easier to retry, can carry authentication headers, and produce clear HTTP error codes. The WebSocket is used for streaming responses back, not for sending.
{% endhint %}

## Step 3: Build the Task List Component

The task list renders domain data from the Solution backend. It knows nothing about CCAAS or WebSocket -- it is a pure presentation component:

```typescript
// frontend/src/components/TaskList.tsx

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
        <p className="text-sm mt-2">
          Use the chat to create tasks with AI assistance
        </p>
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
          <li key={task.id}
            className="bg-white rounded-lg border border-gray-200 p-4
                       hover:shadow-sm transition-shadow"
          >
            <h3 className="font-medium text-gray-900 truncate">
              {task.title}
            </h3>
            {task.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full
                font-medium ${priorityColors[task.priority]}`}>
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
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Key design decisions:

- **Priority badges use color coding** -- urgent is red, high is orange, medium is blue, low is gray
- **Status uses human-readable labels** -- `in_progress` becomes "In Progress"
- **Project name is resolved via lookup** -- the component receives the full projects list and finds the name by ID
- **Empty state guides the user** -- when there are no tasks, the UI suggests using the chat

## Step 4: Build the Chat Panel Component

The chat panel handles user input and displays the conversation. It receives messages and a send callback from the session hook:

```typescript
// frontend/src/components/ChatPanel.tsx

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '../hooks/useTaskManagerSession'

interface ChatPanelProps {
  messages: ChatMessage[]
  isConnected: boolean
  onSendMessage: (message: string) => void
}

export function ChatPanel({
  messages, isConnected, onSendMessage,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    onSendMessage(trimmed)
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with connection status */}
      <div className="p-4 border-b border-gray-200 bg-white
                      flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">AI Assistant</h2>
        <span className={`text-xs px-2 py-1 rounded-full ${
          isConnected
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p>Start a conversation to manage tasks</p>
            <p className="text-sm mt-2">
              Try: "Create a task to review the API docs"
            </p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
              msg.role === 'user'
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-900'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit}
        className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2
                       text-sm focus:outline-none focus:ring-2
                       focus:ring-primary-500 focus:border-transparent"
            disabled={!isConnected}
          />
          <button type="submit"
            disabled={!isConnected || !input.trim()}
            className="px-4 py-2 bg-primary-600 text-white text-sm
                       font-medium rounded-lg hover:bg-primary-700
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
```

Notable patterns:

- **Auto-scroll** -- a ref at the bottom of the message list scrolls into view when messages change
- **Connection indicator** -- a green/red badge shows WebSocket status
- **Disabled state** -- the input and button are disabled when not connected
- **User vs assistant styling** -- user messages are right-aligned and blue, assistant messages are left-aligned with a border

## Step 5: Compose the Page

The page component brings everything together using a split-panel layout:

```typescript
// frontend/src/pages/TaskManagerPage.tsx

import { useTaskManagerSession } from '../hooks/useTaskManagerSession'
import { TaskList } from '../components/TaskList'
import { ChatPanel } from '../components/ChatPanel'

export function TaskManagerPage() {
  const {
    tasks, projects, isConnected,
    messages, sendMessage, refreshTasks,
  } = useTaskManagerSession()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left panel: Task list */}
      <div className="w-1/2 border-r border-gray-200 overflow-auto">
        <div className="p-4 border-b border-gray-200 bg-white">
          <h1 className="text-xl font-semibold text-gray-900">
            Task Manager
          </h1>
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
```

The layout is a full-height flex container that splits the viewport 50/50. The left panel scrolls independently from the right panel.

## Step 6: Handle output\_update Events

When the AI Agent calls `write_output`, CCAAS sends an `output_update` event through the WebSocket. The `useOutputSync` hook from `@ccaas/react-sdk` provides two modes for handling these events:

### Auto Mode

In auto mode, updates are applied to the form data immediately:

```typescript
const outputSync = useOutputSync({ mode: 'auto' })

// In the onOutputUpdate callback:
onOutputUpdate: (update) => {
  outputSync.handleOutputUpdate(update)
  setTaskFormData(prev => ({
    ...prev,
    [update.field]: update.value,
  }))
}
```

### Manual Mode

In manual mode, updates are queued as pending. The user must click a "Sync" button to apply them:

```typescript
const outputSync = useOutputSync({ mode: 'manual' })

// Updates are queued in outputSync.pendingUpdates
// User clicks "Sync to Form":
outputSync.syncAllToForm(currentData, setData)
```

{% hint style="info" %}
**Which mode should you use?** Auto mode is simpler and works well when the AI fills out a single form. Manual mode is better when you want the user to review AI suggestions before applying them -- this is the Human-in-the-Loop pattern at its strongest.
{% endhint %}

### Building a Sync Indicator Component

To show the user that the AI has proposed changes, build a small indicator component:

```typescript
// frontend/src/components/SyncIndicator.tsx

interface SyncIndicatorProps {
  pendingCount: number
  onSyncAll: () => void
}

export function SyncIndicator({
  pendingCount, onSyncAll,
}: SyncIndicatorProps) {
  if (pendingCount === 0) return null

  return (
    <div className="flex items-center gap-2 p-3 bg-yellow-50
                    border border-yellow-200 rounded-lg">
      <span className="text-sm text-yellow-800">
        {pendingCount} field(s) updated by AI
      </span>
      <button
        onClick={onSyncAll}
        className="text-sm font-medium text-yellow-900
                   bg-yellow-200 px-3 py-1 rounded hover:bg-yellow-300"
      >
        Sync to Form
      </button>
    </div>
  )
}
```

### Undo Support

The `useOutputSync` hook includes built-in undo support. After syncing a field, the user can undo the change within a configurable timeout (default 30 seconds):

```typescript
// Check if undo is available for a field
const canUndoTitle = outputSync.canUndo('taskTitle')

// Undo the sync
outputSync.undoSync('taskTitle', currentData, setData)
```

## Step 7: Save Tasks to the Backend

After the AI fills out the form and the user reviews it, save the task to the Solution backend:

```typescript
const saveTask = async (formData: Record<string, unknown>) => {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: formData.taskTitle as string,
      description: formData.taskDescription as string,
      priority: formData.priority as string,
      status: formData.status as string,
      projectId: formData.projectId as string,
      dueDate: formData.dueDate as string,
      tags: formData.tags as string[],
    }),
  })

  if (response.ok) {
    // Refresh the task list to show the new task
    await refreshTasks()
    // Reset the form
    setTaskFormData({})
    outputSync.reset()
  }
}
```

This completes the data flow:

```
AI calls write_output
    → output_update event arrives
    → useOutputSync queues/applies the update
    → Form fields update
    → User reviews and clicks Save
    → POST /api/tasks
    → Database stores the task
    → refreshTasks() reloads the list
```

## Common Patterns

### Refreshing After AI Changes

When the AI creates or modifies data, refresh the task list automatically:

```typescript
// In the onOutputUpdate callback:
onOutputUpdate: (update) => {
  outputSync.handleOutputUpdate(update)

  // If the AI signals that a task was saved, refresh
  if (update.field === '_taskSaved') {
    refreshTasks()
  }
}
```

### Error Boundaries

Wrap the main page with an error boundary to catch rendering errors from malformed AI output:

```typescript
// frontend/src/App.tsx

import { ErrorBoundary } from './components/ErrorBoundary'
import { TaskManagerPage } from './pages/TaskManagerPage'

function App() {
  return (
    <ErrorBoundary>
      <TaskManagerPage />
    </ErrorBoundary>
  )
}
```

### Loading States

Show loading indicators while data is being fetched:

```typescript
const { tasks, isLoadingHistory } = useTaskManagerSession()

if (isLoadingHistory) {
  return <div className="p-8 text-center text-gray-500">Loading...</div>
}
```

## Common Pitfalls

{% hint style="danger" %}
**Pitfall 1: Forgetting the Vite proxy order.** If `/api` comes before `/api/v1/sessions` in the proxy config, all CCAAS requests will be routed to the Solution backend. The most specific routes must come first.
{% endhint %}

{% hint style="danger" %}
**Pitfall 2: Using local types instead of @ccaas/common.** For platform events like `OutputUpdateEvent` and `TextDeltaEvent`, always use types from `@ccaas/common`. Defining local types leads to mismatches when the event format changes. Domain types (Task, Project) are Solution-specific and should be defined locally.
{% endhint %}

{% hint style="danger" %}
**Pitfall 3: Not handling the nested output\_update structure.** The `output_update` event has a nested structure: `event.payload.data.field`. The `parseOutputUpdate` utility from `@ccaas/react-sdk` handles this for you. Do not parse the event manually.
{% endhint %}

## Checkpoint

Before proceeding to testing, verify:

- [ ] The frontend starts with `npm run dev` and shows the split-panel layout
- [ ] The task list loads data from the Solution backend (or shows the empty state)
- [ ] The chat panel accepts input and displays user messages
- [ ] The connection indicator shows the WebSocket status
- [ ] The Vite proxy routes `/api` to port 3003 and `/api/v1` to port 3001

To verify the UI loads correctly:

```bash
cd solutions/task-manager-tutorial/frontend
npm run dev
# Open http://localhost:5281 in your browser
```

You should see the Task Manager split-panel layout with an empty task list on the left and the AI chat panel on the right.

## Next Step

With the frontend in place, it is time to write tests that verify the entire stack works correctly. Proceed to [6.6 Testing](06-testing.md).
