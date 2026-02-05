import axios from 'axios';
import type {
  Quiz,
  QuizAnalysis,
  BatchJob,
  SearchQuizzesParams,
  PaginationInfo,
  KnowledgePoint,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3005';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Quizzes API
export const quizzesApi = {
  list: async (limit = 50, offset = 0) => {
    const response = await client.get<{
      quizzes: Quiz[];
      pagination: PaginationInfo;
    }>(`/api/v1/quizzes`, {
      params: { limit, offset },
    });
    return response.data;
  },

  search: async (params: SearchQuizzesParams) => {
    const response = await client.post<{
      quizzes: Quiz[];
      pagination: PaginationInfo;
    }>('/api/v1/quizzes/search', params);
    return response.data;
  },

  get: async (id: string) => {
    const response = await client.get<Quiz>(`/api/v1/quizzes/${id}`);
    return response.data;
  },

  create: async (quiz: Partial<Quiz>) => {
    const response = await client.post<Quiz>('/api/v1/quizzes', quiz);
    return response.data;
  },

  update: async (id: string, quiz: Partial<Quiz>) => {
    const response = await client.put<Quiz>(`/api/v1/quizzes/${id}`, quiz);
    return response.data;
  },
};

// Knowledge Points API
export const knowledgePointsApi = {
  list: async (subjectId?: string) => {
    const response = await client.get<KnowledgePoint[]>('/api/v1/knowledge-points', {
      params: { subjectId },
    });
    return response.data;
  },

  getTree: async (subjectId?: string, gradeLevel?: string) => {
    const response = await client.get<{
      tree: KnowledgePoint[];
      totalNodes: number;
    }>('/api/v1/knowledge-points/tree', {
      params: { subjectId, gradeLevel },
    });
    return response.data;
  },

  get: async (id: string) => {
    const response = await client.get<KnowledgePoint>(`/api/v1/knowledge-points/${id}`);
    return response.data;
  },
};

// Analyses API
export const analysesApi = {
  get: async (quizId: string) => {
    const response = await client.get<QuizAnalysis>(`/api/v1/analyses/${quizId}`);
    return response.data;
  },

  create: async (analysis: Partial<QuizAnalysis>) => {
    const response = await client.post<QuizAnalysis>('/api/v1/analyses', analysis);
    return response.data;
  },

  update: async (quizId: string, analysis: Partial<QuizAnalysis>) => {
    const response = await client.put<QuizAnalysis>(
      `/api/v1/analyses/${quizId}`,
      analysis,
    );
    return response.data;
  },

  delete: async (quizId: string) => {
    const response = await client.delete(`/api/v1/analyses/${quizId}`);
    return response.data;
  },
};

// Batch API
export const batchApi = {
  create: async (name: string, quizIds: string[]) => {
    const response = await client.post<{
      message: string;
      job: BatchJob;
    }>('/api/v1/batch/analyze', {
      name,
      quiz_ids: quizIds,
    });
    return response.data;
  },

  listJobs: async (limit = 50, offset = 0) => {
    const response = await client.get<{
      jobs: BatchJob[];
      pagination: PaginationInfo;
    }>('/api/v1/batch/jobs', {
      params: { limit, offset },
    });
    return response.data;
  },

  getJob: async (id: string) => {
    const response = await client.get<BatchJob>(`/api/v1/batch/jobs/${id}`);
    return response.data;
  },

  cancelJob: async (id: string) => {
    const response = await client.delete<{
      message: string;
      job: BatchJob;
    }>(`/api/v1/batch/jobs/${id}`);
    return response.data;
  },

  getStatus: async () => {
    const response = await client.get<{
      queueSize: number;
      isProcessing: boolean;
    }>('/api/v1/batch/status');
    return response.data;
  },
};

// Health API
export const healthApi = {
  check: async () => {
    const response = await client.get('/health');
    return response.data;
  },
};

export default client;
