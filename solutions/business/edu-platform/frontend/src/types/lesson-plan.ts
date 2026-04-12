export type BlockType = 'section' | 'text' | 'list' | 'table' | 'timeline' | 'callout' | 'image'

export interface SectionContent {
  title: string
}

export interface TextContent {
  text: string
}

export interface ListContent {
  items: string[]
  ordered?: boolean
}

export interface TableContent {
  headers: string[]
  rows: string[][]
}

export interface TimelineRow {
  time: string
  duration: string
  description: string
}

export interface TimelineContent {
  rows: TimelineRow[]
}

export interface CalloutContent {
  text: string
  variant?: 'info' | 'warning'
}

export interface ImageContent {
  url?: string
  alt?: string
}

export interface Block {
  id: string
  type: BlockType
  content: Record<string, unknown>
  sort_order: number
  placeholder?: string
  is_required?: boolean
}

export type LessonPlanStatus = 'draft' | 'published' | 'in_use' | 'ai_generated'

export interface RequirementInfo {
  id: string
  code: string
  text: string
  interpretation?: string
}

export interface LessonPlan {
  id: string
  title: string
  status: LessonPlanStatus
  subject_id?: string
  subject_name?: string
  class_name?: string
  lesson_type?: string
  duration?: number
  blocks: Block[]
  requirement?: RequirementInfo | null
  source_template_id?: string
  created_at: string
  updated_at: string
}

export interface LessonPlanListResponse {
  data: LessonPlan[]
  total: number
  page: number
  page_size: number
}

export function createEmptyBlock(type: BlockType, sortOrder: number): Block {
  const defaults: Record<BlockType, Record<string, unknown>> = {
    section: { title: '' },
    text: { text: '' },
    list: { items: [], ordered: false },
    table: { headers: ['列1', '列2', '列3'], rows: [['', '', '']] },
    timeline: { rows: [{ time: '', duration: '', description: '' }] },
    callout: { text: '', variant: 'info' },
    image: { url: '', alt: '' },
  }

  return {
    id: crypto.randomUUID(),
    type,
    content: defaults[type],
    sort_order: sortOrder,
  }
}
