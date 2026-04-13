import type { Block } from './lesson-plan'

export type TemplateScope = 'district' | 'school' | 'teacher'
export type PromotionStatus = 'pending' | 'approved' | 'rejected'

export interface Template {
  id: string
  name: string
  description: string
  lesson_type: string
  subject: string
  scope: TemplateScope
  version: string
  blocks: Block[]
  usage_count: number
  promotion_status?: PromotionStatus
  created_at: string
  updated_at: string
}

export interface TemplateListItem {
  id: string
  name: string
  description: string
  lesson_type: string
  subject: string
  scope: TemplateScope
  version: string
  usage_count: number
  promotion_status?: PromotionStatus
  block_summary: string[]
}

export interface TemplateListResponse {
  items: TemplateListItem[]
  total: number
  page: number
  page_size: number
}

export interface PromoteRequest {
  target_scope: TemplateScope
  reason: string
}
