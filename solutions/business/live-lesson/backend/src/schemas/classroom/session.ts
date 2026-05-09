/** Session lifecycle response types */

export type SessionStatus = 'waiting' | 'active' | 'ended';

export interface CreateSessionResponse {
  sessionId: string;
  code: string;
  lessonId: string;
  status: SessionStatus;
}

export interface SessionInfoResponse {
  sessionId: string;
  code: string;
  lessonId: string;
  status: SessionStatus;
  startedAt: Date | null;
  createdAt: Date;
}

export interface StartSessionResponse {
  ok: boolean;
  status: 'active';
  startedAt: Date | null;
}

export interface EndSessionResponse {
  ok: boolean;
  status: 'ended';
}

export interface BatchCheckItem {
  sessionId: string;
  code: string;
  lessonId: string;
  status: SessionStatus;
  title: string;
}

export interface SetStepResponse {
  ok: boolean;
  currentStep: number;
}

export interface NotifyResponse {
  ok: boolean;
  active: boolean;
  id: string;
}

export interface SessionListItem {
  sessionId: string;
  code: string;
  lessonId: string;
  lessonTitle: string;
  status: SessionStatus;
  currentStep: number;
  studentCount: number;
  /** Duration in seconds (startedAt → endedAt or now); null if not started */
  duration: number | null;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
}

export interface SessionListResponse {
  items: SessionListItem[];
  total: number;
}
