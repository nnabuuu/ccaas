import type { Block } from './lesson-plan'

export type TemplateScope = 'district' | 'school' | 'teacher'
export type PromotionStatus = 'pending' | 'approved' | 'rejected'

export interface Template {
  id: string
  name: string
  description?: string
  scope: TemplateScope
  lesson_type?: string
  subject?: string
  version?: string
  blocks: Block[]
  usage_count?: number
  promotion_status?: PromotionStatus | null
  created_at: string
  updated_at: string
}

export interface TemplateListResponse {
  data: Template[]
  total: number
  page: number
  page_size: number
}

export interface Promotion {
  id: string
  template_id: string
  target_scope: TemplateScope
  reason: string
  status: PromotionStatus
  created_at: string
}
