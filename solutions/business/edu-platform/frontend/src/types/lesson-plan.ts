export type BlockType = 'section' | 'text' | 'list' | 'table' | 'timeline' | 'callout' | 'image'

export interface Block {
  id: string
  type: BlockType
  content: Record<string, unknown>
  sort_order: number
  placeholder?: string
  is_required?: boolean
}

export type LessonPlanStatus = 'draft' | 'published' | 'in_use' | 'ai_generated'

export interface LessonPlan {
  id: string
  title: string
  class_name: string
  subject: string
  lesson_type: string
  duration: number
  status: LessonPlanStatus
  blocks: Block[]
  source_template_id?: string
  requirement?: RequirementLink
  created_at: string
  updated_at: string
}

export interface RequirementLink {
  id: string
  code: string
  text: string
  interpretation?: string
  version?: string
}

export interface LessonPlanListItem {
  id: string
  title: string
  class_name: string
  subject: string
  lesson_type: string
  duration: number
  status: LessonPlanStatus
  requirement?: RequirementLink
  updated_at: string
}

export interface LessonPlanListResponse {
  items: LessonPlanListItem[]
  total: number
  page: number
  page_size: number
}
