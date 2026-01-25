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
