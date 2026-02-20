export interface SolutionStep {
  stepNumber: number
  description: string
  explanation: string
  formula?: string
}

export interface Explanation {
  [key: string]: unknown
  problemAnalysis?: string
  keyKnowledge: string[]
  solutionSteps: SolutionStep[] | string[]
  answer?: string
  commonMistakes: string[]
  relatedProblems: string[]
  hints?: string
  difficulty?: number
}

export type ProblemSyncField =
  | 'problemAnalysis' | 'keyKnowledge' | 'solutionSteps'
  | 'answer' | 'commonMistakes' | 'relatedProblems'
  | 'hints' | 'difficulty'
