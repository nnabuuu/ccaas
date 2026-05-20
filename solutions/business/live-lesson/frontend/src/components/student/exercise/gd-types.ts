export interface GdProgress {
  currentStepIdx: number
  completedStepIds: string[]
  stepResults: Record<string, boolean>
  stepFeedbacks: Record<string, string>
}
