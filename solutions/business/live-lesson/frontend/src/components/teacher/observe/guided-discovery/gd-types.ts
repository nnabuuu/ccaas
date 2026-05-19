import type { ObserveData } from '../ObserveDrawer'

export interface GdData extends ObserveData {
  stats: {
    totalStudents: number; submitted: number; avgScore: number
    perfectCount: number; avgTime: number
  }
  stepDefs: Array<{ id: string; title: string; type: string }>
  stepStats: Array<{
    id: string; title: string; passedCount: number; passedRate: number
    errors: Array<{
      description: string; count: number
      students: Array<{ id: string; name: string }>
    }>
  }>
  students: Array<{
    id: string; name: string; submitted: boolean; score: number; time: number
    stepResults: Record<string, boolean>
    stepAnswers: Record<string, Record<string, unknown>>
    keyInsights: string[]
  }>
}
