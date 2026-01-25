/**
 * CCAAS Demo Types
 */

export interface SkillHeader {
  whenToUse: string
  objective: string
  triggers: string[]
}

export interface Skill {
  id: string
  name: string
  slug?: string
  icon: string
  description: string
  enabled: boolean
  header?: SkillHeader
  content?: string                   // Full markdown content
  type?: 'skill' | 'sub-agent'
}

export interface TriggerInput {
  type: 'keyword' | 'intent' | 'pattern'
  value: string
  description?: string
}

export interface SkillFormData {
  name: string
  slug: string
  description: string
  content: string                    // Markdown content
  type: 'skill' | 'sub-agent'
  triggers: TriggerInput[]
  config: { icon?: string }
}

export interface FileInfo {
  id?: string                    // Backend file ID (for download)
  name: string
  size: number | string          // Bytes (number) or "Calculating..." (string)
  type: string                   // MIME type or "unknown"
}

// File Browser Types
export type FileStatus = 'new' | 'modified' | 'synced'

export interface FileNode {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  children?: FileNode[]
  fileId?: string
  mimeType?: string
  size?: number
  status?: FileStatus
  uploadedBy?: 'agent' | 'user'
  createdAt?: Date
}

export interface FilePreview {
  content: string
  truncated: boolean
  encoding: 'utf8' | 'base64'
  mimeType: string
  size: number
}

export interface FileCreatedEvent {
  type: 'file_created'
  payload: {
    id: string
    filename: string
    originalPath: string
    mimeType: string | null
    size: number
    status: FileStatus
    uploadedBy: 'agent' | 'user'
    createdAt: string
    sessionId: string
    messageId: string
  }
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  skill?: string
  files?: FileInfo[]             // Changed from file?: FileInfo
  status?: 'sending' | 'streaming' | 'complete'
  timestamp: Date
}

export interface SessionState {
  sessionId: string
  messages: Message[]
  activeSkill: string | null
  needsRestart: boolean
  isProcessing: boolean
}

export type ProtocolEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_activity'; tool: string; status: 'start' | 'end' }
  | { type: 'file_created'; file: FileInfo }
  | { type: 'skill_updated'; skillId: string; requiresRestart: boolean }
  | { type: 'agent_status'; status: 'idle' | 'running' | 'complete' | 'error' }
