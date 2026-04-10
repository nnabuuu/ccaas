export interface CreateArticleDto {
  title: string;
  inputType: 'topic' | 'draft';
  initialInput: string;
}

export interface ArticleResponse {
  id: string;
  title: string;
  inputType: 'topic' | 'draft';
  initialInput: string;
  status: 'draft' | 'running' | 'completed' | 'failed';
  latestRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunResponse {
  id: string;
  articleId: string;
  taskId: string;
  status: string;
  finalScore: number | null;
  totalIterations: number;
  exitReason: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface IterationResponse {
  id: number;
  runId: string;
  iteration: number;
  score: number | null;
  articleText: string | null;
  analysisReport: unknown | null;
  writerNotes: unknown | null;
  dimensionScores: DimensionScore[] | null;
  tokensUsed: number;
  durationMs: number;
  createdAt: string;
}

export interface DimensionScore {
  name: string;
  score: number;
  weight: number;
}
