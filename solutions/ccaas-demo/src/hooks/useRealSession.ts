/**
 * Real Session Hook
 *
 * Connects to CCAAS backend via WebSocket and REST APIs.
 * All data is real - skills from API, real Claude Code CLI interactions.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import type { Skill, Message, FileInfo, SessionState, SkillHeader, SkillFormData } from '../types'
import type { ToolActivityEvent, AgentStatusEvent, TextDeltaEvent } from '@ccaas/shared'

// Backend configuration
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
const API_KEY = import.meta.env.VITE_API_KEY || ''
const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'default'

/**
 * Derive MIME type from filename extension.
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const mimeMap: Record<string, string> = {
    md: 'text/markdown',
    json: 'application/json',
    txt: 'text/plain',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    js: 'text/javascript',
    jsx: 'text/javascript',
    html: 'text/html',
    css: 'text/css',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    xml: 'application/xml',
    py: 'text/x-python',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
  }
  return mimeMap[ext || ''] || 'application/octet-stream'
}

// API helper
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (API_KEY) {
    headers['Authorization'] = `Bearer ${API_KEY}`
  }

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Backend skill type
interface BackendSkill {
  id: string
  tenantId: string
  name: string
  slug: string
  description: string | null
  content: string
  type: string
  config: Record<string, unknown>
  allowedTools: string[]
  triggers: Array<{
    type: string
    value: string
    priority?: number
    description?: string
  }>
  status: 'draft' | 'published' | 'archived'
  currentVersion: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

// Convert backend skill to frontend format
function convertSkill(backendSkill: BackendSkill): Skill {
  const header: SkillHeader = {
    whenToUse: backendSkill.triggers
      .filter(t => t.description)
      .map(t => t.description)
      .join('; ') || `When keywords match: ${backendSkill.triggers.map(t => t.value).join(', ')}`,
    objective: backendSkill.description || 'No description provided',
    triggers: backendSkill.triggers.map(t => t.value),
  }

  // Get icon from config or use default based on type
  const icon = (backendSkill.config.icon as string) ||
    (backendSkill.type === 'sub-agent' ? '🤖' : '⚡')

  return {
    id: backendSkill.id,
    name: backendSkill.name,
    slug: backendSkill.slug,
    icon,
    description: backendSkill.description || '',
    enabled: backendSkill.status === 'published',
    header,
    content: backendSkill.content,
    type: backendSkill.type as 'skill' | 'sub-agent',
  }
}

export function useRealSession() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [session, setSession] = useState<SessionState>({
    sessionId: `session-${Date.now()}`,
    messages: [],
    activeSkill: null,
    needsRestart: false,
    isProcessing: false,
  })
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const socketRef = useRef<Socket | null>(null)
  const currentMessageRef = useRef<string>('')
  const sessionIdRef = useRef(session.sessionId)

  // Fetch skills from backend
  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetchAPI<{ items: BackendSkill[] }>('/api/v1/skills')
      const convertedSkills = response.items.map(convertSkill)
      setSkills(convertedSkills)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch skills:', err)
      setError(`获取 skills 失败: ${err instanceof Error ? err.message : err}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // Connect to backend WebSocket
  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket'],
      autoConnect: true,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to CCAAS backend')
      setConnected(true)
      setError(null)
      // Fetch skills after connection
      fetchSkills()
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from CCAAS backend')
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('Connection error:', err)
      setError(`连接失败: ${err.message}`)
      setConnected(false)
    })

    socket.on('client_id', (data: { clientId: string }) => {
      console.log('Received client ID:', data.clientId)
    })

    socket.on('agent_status', (data: AgentStatusEvent & { error?: string | { message: string } }) => {
      console.log('Agent status:', data)

      if (data.status === 'running' || data.status === 'executing') {
        setSession(prev => ({ ...prev, isProcessing: true }))
      } else if (data.status === 'complete' || data.status === 'idle') {
        // First mark messages as complete
        setSession(prev => ({
          ...prev,
          isProcessing: false,
          activeSkill: null,
          messages: prev.messages.map(m =>
            m.status === 'streaming' ? { ...m, status: 'complete' } : m
          ),
        }))

        // Then fetch actual file info from backend to update sizes
        fetchAPI<Array<{ id: string; filename: string; size: number; mimeType?: string }>>(
          `/api/v1/sessions/${sessionIdRef.current}/files`
        )
          .then(backendFiles => {
            if (backendFiles && backendFiles.length > 0) {
              setSession(prev => ({
                ...prev,
                messages: prev.messages.map(m => ({
                  ...m,
                  files: m.files?.map(f => {
                    const backendFile = backendFiles.find(bf => bf.filename === f.name)
                    if (backendFile) {
                      return {
                        ...f,
                        id: backendFile.id,
                        size: backendFile.size,
                        type: backendFile.mimeType || f.type,
                      }
                    }
                    return f
                  }),
                })),
              }))
            }
          })
          .catch(err => {
            // Silently ignore - files will show "Calculating..." but still work
            console.log('Could not fetch file info:', err)
          })
      } else if (data.status === 'error') {
        // Handle both string and object error formats from backend
        const errorMsg = typeof data.error === 'string'
          ? data.error
          : data.error?.message || 'Unknown error'
        setError(errorMsg)
        setSession(prev => ({ ...prev, isProcessing: false }))
      }
    })

    socket.on('text_delta', (data: TextDeltaEvent) => {
      currentMessageRef.current += data.text

      setSession(prev => ({
        ...prev,
        messages: prev.messages.map(m =>
          m.status === 'streaming'
            ? { ...m, content: currentMessageRef.current }
            : m
        ),
      }))
    })

    socket.on('tool_activity', (data: ToolActivityEvent) => {
      console.log('Tool activity:', data)

      // Backend sends tool_activity with payload: { toolName, phase, toolInput }
      const { payload } = data
      if (payload?.toolName === 'Write' && payload?.phase === 'end' && payload?.toolInput) {
        const input = payload.toolInput as { file_path?: string }
        if (input.file_path) {
          const fileName = input.file_path.split('/').pop() || 'file'
          const newFile: FileInfo = {
            name: fileName,
            size: 'Calculating...',
            type: getMimeType(fileName),
          }

          // Accumulate files in array instead of replacing
          setSession(prev => ({
            ...prev,
            messages: prev.messages.map(m =>
              m.status === 'streaming'
                ? {
                    ...m,
                    files: [...(m.files || []), newFile],
                  }
                : m
            ),
          }))
        }
      }
    })

    socket.on('skill_updated', (data: { skillId: string; requiresRestart: boolean }) => {
      console.log('Skill updated:', data)
      if (data.requiresRestart) {
        setSession(prev => ({ ...prev, needsRestart: true }))
      }
      // Refresh skills list
      fetchSkills()
    })

    return () => {
      socket.disconnect()
    }
  }, [fetchSkills])

  // Toggle skill (publish/unpublish)
  const toggleSkill = useCallback(async (skillId: string) => {
    const skill = skills.find(s => s.id === skillId)
    if (!skill) return

    try {
      if (skill.enabled) {
        // Unpublish the skill (set status back to draft)
        await fetchAPI(`/api/v1/skills/${skillId}/unpublish`, {
          method: 'POST',
        })
      } else {
        // Publish the skill
        await fetchAPI(`/api/v1/skills/${skillId}/publish`, {
          method: 'POST',
        })
      }

      // Update local state
      setSkills(prev =>
        prev.map(s =>
          s.id === skillId ? { ...s, enabled: !s.enabled } : s
        )
      )

      // Mark session as needing restart if there are messages
      setSession(prev => {
        if (prev.messages.length > 0) {
          return { ...prev, needsRestart: true }
        }
        return prev
      })
    } catch (err) {
      console.error('Failed to toggle skill:', err)
      setError(`切换 skill 失败: ${err instanceof Error ? err.message : err}`)
    }
  }, [skills])

  // Restart session
  const restartSession = useCallback(async () => {
    try {
      // Call backend restart endpoint if session exists
      if (session.messages.length > 0) {
        await fetchAPI(`/api/v1/chat/sessions/${session.sessionId}/restart`, {
          method: 'POST',
        }).catch(() => {
          // Ignore error if session doesn't exist on backend
        })
      }

      // Generate new session ID
      const newSessionId = `session-${Date.now()}`
      sessionIdRef.current = newSessionId

      setSession({
        sessionId: newSessionId,
        messages: [],
        activeSkill: null,
        needsRestart: false,
        isProcessing: false,
      })
    } catch (err) {
      console.error('Failed to restart session:', err)
    }
  }, [session.sessionId, session.messages.length])

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!socketRef.current || !connected) {
      setError('未连接到后端')
      return
    }

    if (session.isProcessing) return

    // Create user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }

    // Create placeholder assistant message
    const assistantMessage: Message = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      status: 'streaming',
      timestamp: new Date(),
    }

    currentMessageRef.current = ''

    setSession(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage, assistantMessage],
      isProcessing: true,
    }))

    // Send to backend with tenant ID from environment
    socketRef.current.emit('chat', {
      sessionId: session.sessionId,
      message: content,
      resumeSession: session.messages.length > 0,
      tenantId: TENANT_ID,
    })
  }, [connected, session.sessionId, session.messages.length, session.isProcessing])

  // Download file from backend
  const downloadFile = useCallback(async (file: FileInfo) => {
    try {
      // If file has an ID from backend, use direct download
      if (file.id) {
        window.open(`${BACKEND_URL}/api/v1/files/${file.id}/download`, '_blank')
        return
      }

      // Fallback: try to fetch from backend files API by name
      const response = await fetch(
        `${BACKEND_URL}/api/v1/sessions/${sessionIdRef.current}/files`,
        {
          headers: API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {},
        }
      )

      if (response.ok) {
        const files = await response.json()
        const targetFile = files.find((f: { filename: string }) =>
          f.filename === file.name
        )

        if (targetFile?.id) {
          window.open(
            `${BACKEND_URL}/api/v1/files/${targetFile.id}/download`,
            '_blank'
          )
          return
        }
      }

      // File not ready yet
      setError('File not ready yet. Please wait a moment and try again.')
    } catch (err) {
      console.error('Failed to download file:', err)
      setError(`下载文件失败: ${err instanceof Error ? err.message : err}`)
    }
  }, [])

  // Create a new skill
  const createSkill = useCallback(async (data: SkillFormData) => {
    try {
      await fetchAPI('/api/v1/skills', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          slug: data.slug,
          description: data.description,
          content: data.content,
          type: data.type,
          triggers: data.triggers,
          config: data.config,
          tenantId: TENANT_ID,
        }),
      })
      await fetchSkills()
    } catch (err) {
      console.error('Failed to create skill:', err)
      throw new Error(`创建 skill 失败: ${err instanceof Error ? err.message : err}`)
    }
  }, [fetchSkills])

  // Update an existing skill
  const updateSkill = useCallback(async (id: string, data: SkillFormData) => {
    try {
      await fetchAPI(`/api/v1/skills/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: data.name,
          slug: data.slug,
          description: data.description,
          content: data.content,
          type: data.type,
          triggers: data.triggers,
          config: data.config,
        }),
      })
      await fetchSkills()

      // Mark session as needing restart if there are messages
      setSession(prev => {
        if (prev.messages.length > 0) {
          return { ...prev, needsRestart: true }
        }
        return prev
      })
    } catch (err) {
      console.error('Failed to update skill:', err)
      throw new Error(`更新 skill 失败: ${err instanceof Error ? err.message : err}`)
    }
  }, [fetchSkills])

  // Delete a skill
  const deleteSkill = useCallback(async (id: string) => {
    try {
      await fetchAPI(`/api/v1/skills/${id}`, {
        method: 'DELETE',
      })
      await fetchSkills()

      // Mark session as needing restart if there are messages
      setSession(prev => {
        if (prev.messages.length > 0) {
          return { ...prev, needsRestart: true }
        }
        return prev
      })
    } catch (err) {
      console.error('Failed to delete skill:', err)
      throw new Error(`删除 skill 失败: ${err instanceof Error ? err.message : err}`)
    }
  }, [fetchSkills])

  // Get full skill details (including content)
  const getSkillDetails = useCallback(async (id: string): Promise<Skill> => {
    try {
      const backendSkill = await fetchAPI<BackendSkill>(`/api/v1/skills/${id}`)
      return convertSkill(backendSkill)
    } catch (err) {
      console.error('Failed to get skill details:', err)
      throw new Error(`获取 skill 详情失败: ${err instanceof Error ? err.message : err}`)
    }
  }, [])

  return {
    skills,
    session,
    connected,
    error,
    loading,
    toggleSkill,
    restartSession,
    sendMessage,
    downloadFile,
    refreshSkills: fetchSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    getSkillDetails,
  }
}
