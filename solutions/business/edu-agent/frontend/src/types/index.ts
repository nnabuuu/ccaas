// Re-export from react-sdk
export type {
  Message,
  ContentBlock,
  TextBlock,
  ToolBlock,
  ToolActivity,
  OutputUpdate,
  UseAgentConnectionReturn,
  UseAgentChatReturn,
  UseAgentStatusReturn,
  AgentStatusValue,
  SolutionConfig,
} from '@ccaas/react-sdk'

// Navigation
export interface NavigationUpdate {
  route: string
  reason?: string
}

// Hub
export interface SessionHistoryItem {
  id: string
  title: string
  type: 'lesson-plan' | 'problem-explain'
  createdAt: string
  preview?: string
}
