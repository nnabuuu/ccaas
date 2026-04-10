const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3033';

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

export interface CreateArticleDto {
  title: string;
  inputType: 'topic' | 'draft';
  initialInput: string;
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

export interface RunProgress {
  runId: string;
  taskName: string;
  status: string;
  currentIteration: number;
  maxIterations: number;
  scoreTrajectory: { iteration: number; score: number }[];
  latestScore?: number;
  exitReason?: string;
}

export interface IterationResponse {
  id: number;
  runId: string;
  iteration: number;
  score: number | null;
  articleText: string | null;
  analysisReport: AnalysisReport | null;
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

export interface AnalysisReport {
  score: number;
  totalScore: number;
  dimensions: DimensionScore[];
  feedback: string;
  topIssue: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function listArticles(status?: string): Promise<ArticleResponse[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch(`/articles${qs}`);
}

export function getArticle(id: string): Promise<ArticleResponse> {
  return apiFetch(`/articles/${id}`);
}

export function createArticle(dto: CreateArticleDto): Promise<ArticleResponse> {
  return apiFetch('/articles', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function deleteArticle(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/articles/${id}`, { method: 'DELETE' });
}

export function startRun(articleId: string): Promise<RunResponse> {
  return apiFetch(`/articles/${articleId}/run`, { method: 'POST' });
}

export function listRuns(articleId: string): Promise<RunResponse[]> {
  return apiFetch(`/articles/${articleId}/runs`);
}

export function getRunProgress(runId: string): Promise<RunProgress> {
  return apiFetch(`/runs/${runId}/progress`);
}

export function getIterations(runId: string): Promise<IterationResponse[]> {
  return apiFetch(`/runs/${runId}/iterations`);
}

export function getIteration(
  runId: string,
  n: number,
): Promise<IterationResponse> {
  return apiFetch(`/runs/${runId}/iterations/${n}`);
}

// ─── SSE event streaming ───

export interface HarnessEventEnvelope {
  seq: number;
  runId: string;
  timestamp: string;
  event: {
    type: string;
    runId: string;
    data: unknown;
  };
}

/**
 * Subscribe to real-time run events via SSE.
 * Returns a cleanup function to abort the connection.
 */
export function subscribeToRunEvents(
  runId: string,
  onEvent: (envelope: HarnessEventEnvelope) => void,
  onError?: (err: unknown) => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_URL}/harness/runs/${runId}/events`, {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        onError?.(new Error(`SSE connect failed: ${res.status}`));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const envelope = JSON.parse(jsonStr) as HarnessEventEnvelope;
            onEvent(envelope);
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        onError?.(err);
      }
    }
  })();

  return () => controller.abort();
}
