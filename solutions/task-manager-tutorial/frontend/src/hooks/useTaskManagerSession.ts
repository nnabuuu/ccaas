import { useState, useEffect, useCallback } from 'react'

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

/**
 * Main session hook for the Task Manager tutorial.
 * Combines:
 * - Solution backend REST API (tasks/projects CRUD)
 * - CCAAS WebSocket connection (chat relay)
 * - output_update event handling (AI -> form sync)
 */
export function useTaskManagerSession() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)

  // Fetch tasks from solution backend
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

  // Fetch projects from solution backend
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

  // Initial data load and connection check
  useEffect(() => {
    refreshTasks()
    refreshProjects()

    // TODO: Replace with CCAAS WebSocket connection via react-sdk useAgentConnection
    fetch('/api/v1/health')
      .then(res => setIsConnected(res.ok))
      .catch(() => setIsConnected(false))
  }, [refreshTasks, refreshProjects])

  // Send message (placeholder - will be connected to CCAAS WebSocket)
  const sendMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, msg])

    // TODO: Connect to CCAAS WebSocket for AI relay
    // The react-sdk useAgentConnection hook will handle this
  }, [])

  return {
    tasks,
    projects,
    messages,
    isConnected,
    sendMessage,
    refreshTasks,
    refreshProjects,
  }
}
