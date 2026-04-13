export interface PendingItem {
  type: string
  title: string
  count: number
  deadline: string
  progress: string
  skill_status: string
  link: string
}

export interface PendingData {
  items: PendingItem[]
  total: number
}

export interface SuggestedAction {
  label: string
  prompt: string
}

export interface AIInsight {
  summary: string
  suggested_actions: SuggestedAction[]
}

export interface AIBriefing {
  insights: AIInsight[]
  common_actions: SuggestedAction[]
}

export interface ActivityItem {
  entity_type: string
  entity_id: string
  entity_display_name: string
  action: string
  detail: string
  timestamp: string
}

export interface WeeklySummary {
  lesson_plan_edits: number
  submissions_graded: number
}

export interface WeekDots {
  days: Record<string, string[]>
}
