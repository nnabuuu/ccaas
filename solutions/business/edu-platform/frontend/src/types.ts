export type LessonSyncField =
  | 'lesson_overview'
  | 'teaching_objectives'
  | 'key_points'
  | 'teaching_process'
  | 'assessment'
  | 'homework'

export interface DisplayItem {
  field: LessonSyncField
  value: unknown
  preview: string
  timestamp: number
}

export const LESSON_FIELDS: { field: LessonSyncField; title: string; icon: string }[] = [
  { field: 'lesson_overview', title: '教案概述', icon: '📋' },
  { field: 'teaching_objectives', title: '教学目标', icon: '🎯' },
  { field: 'key_points', title: '重难点分析', icon: '💡' },
  { field: 'teaching_process', title: '教学过程', icon: '📐' },
  { field: 'assessment', title: '评价方案', icon: '✅' },
  { field: 'homework', title: '作业设计', icon: '📝' },
]
