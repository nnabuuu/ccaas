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
  icon: string
  description: string
  enabled: boolean
  header?: SkillHeader
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  skill?: string
  file?: FileInfo
  status?: 'sending' | 'streaming' | 'complete'
  timestamp: Date
}

export interface FileInfo {
  name: string
  size: string
  type: string
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
