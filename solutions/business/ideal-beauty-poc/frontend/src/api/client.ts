import { API_URL } from '../config';

/* ─── Response types (matching backend DTOs) ─── */

export interface ClassSession {
  id: string;
  teacher_id: string;
  session_code: string;
  status: 'waiting' | 'active' | 'ended';
  created_at: string;
  ended_at: string | null;
}

export interface RosterEntry {
  id: string;
  name: string;
  avatar: string;
}

export interface StudentSession {
  id: string;
  class_session_id: string;
  student_id: string;
  student_name: string;
  current_scene_idx: number;
  joined_at: string;
}

export interface T1Evaluation {
  topicSentence: { found: boolean; feedback: string };
  paragraphStructure: {
    point: { identified: boolean; feedback: string };
    evidence: { identified: boolean; feedback: string };
    elaboration: { identified: boolean; feedback: string };
  };
  overallTip: string;
}

export interface T2Evaluation {
  found: string[];
  missed: string[];
  feedback: string;
  encouragement: string;
}

export interface WritingEvaluation {
  hasTopicSentence: { score: number; comment: string };
  hasSpecificExample: { score: number; comment: string };
  usesTransitions: { score: number; comment: string };
  overallSuggestion: string;
  wordCount: number;
  improvementNote: string | null;
}

export interface WritingVersion {
  id: string;
  student_session_id: string;
  version_number: number;
  text: string;
  word_count: number;
  scene_id: string;
  evaluation: WritingEvaluation | null;
  created_at: string;
}

export interface StudentProgress {
  id: string;
  student_id: string;
  student_name: string;
  current_scene_idx: number;
  joined_at: string;
  t1_highlights: Record<string, string> | null;
  t1_evaluation: T1Evaluation | null;
  t2_picked_transitions: string[] | null;
  t2_evaluation: T2Evaluation | null;
  latest_version: WritingVersion | null;
  version_count: number;
}

export interface HelpMessage {
  id: string;
  student_session_id: string;
  scene_id: string;
  role: 'user' | 'assistant';
  content: string;
  is_dummy_reply: boolean;
  created_at: string;
}

export interface InsightsResponse {
  sceneId: string;
  summary: string;
  details: Record<string, number>;
}

export interface BroadcastData {
  artifactType: string;
  studentName: string;
  version?: WritingVersion;
  artifact?: Record<string, unknown>;
}

/* ─── Request helper ─── */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

/* ─── Sessions ─── */

export function createSession(teacherId: string) {
  return request<ClassSession>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ teacherId }),
  });
}

export function getSession(id: string) {
  return request<ClassSession>(`/sessions/${id}`);
}

export function getSessionByCode(code: string) {
  return request<ClassSession>(`/sessions/code/${code}`);
}

export function getRoster(sessionId: string) {
  return request<RosterEntry[]>(`/sessions/${sessionId}/roster`);
}

export function joinSession(sessionId: string, studentId: string) {
  return request<StudentSession>(`/sessions/${sessionId}/join`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}

export function getStudents(sessionId: string) {
  return request<StudentProgress[]>(`/sessions/${sessionId}/students`);
}

export function getInsights(sessionId: string, sceneId: string) {
  return request<InsightsResponse>(`/sessions/${sessionId}/insights/${sceneId}`);
}

export function broadcast(
  sessionId: string,
  body: { studentSessionId: string; artifactType: string; versionId?: string },
) {
  return request<BroadcastData>(`/sessions/${sessionId}/broadcast`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function endBroadcast(sessionId: string) {
  return request<{ ok: boolean }>(`/sessions/${sessionId}/broadcast/end`, {
    method: 'POST',
  });
}

/* ─── Students ─── */

export function updateScene(sid: string, sceneIdx: number) {
  return request<StudentSession>(`/students/${sid}/scene`, {
    method: 'PATCH',
    body: JSON.stringify({ sceneIdx }),
  });
}

export function saveT1(sid: string, highlights: Record<string, string>) {
  return request<{ studentSessionId: string; highlights: Record<string, string> }>(
    `/students/${sid}/t1`,
    { method: 'PUT', body: JSON.stringify({ highlights }) },
  );
}

export function evaluateT1(sid: string) {
  return request<T1Evaluation>(`/students/${sid}/t1/evaluate`, { method: 'POST' });
}

export function saveT2(sid: string, pickedTransitions: string[]) {
  return request<{ studentSessionId: string; pickedTransitions: string[] }>(
    `/students/${sid}/t2`,
    { method: 'PUT', body: JSON.stringify({ pickedTransitions }) },
  );
}

export function evaluateT2(sid: string) {
  return request<T2Evaluation>(`/students/${sid}/t2/evaluate`, { method: 'POST' });
}

export function getVersions(sid: string) {
  return request<WritingVersion[]>(`/students/${sid}/versions`);
}

export function createVersion(sid: string, text: string, sceneId?: string) {
  return request<WritingVersion>(`/students/${sid}/versions`, {
    method: 'POST',
    body: JSON.stringify({ text, sceneId: sceneId || 'T3' }),
  });
}

export function evaluateVersion(sid: string, vid: string) {
  return request<WritingEvaluation>(`/students/${sid}/versions/${vid}/evaluate`, {
    method: 'POST',
  });
}

export function getHelpMessages(sid: string) {
  return request<HelpMessage[]>(`/students/${sid}/help-messages`);
}

export function sendHelpMessage(sid: string, content: string, sceneId: string) {
  return request<{ userMessage: HelpMessage; assistantMessage: HelpMessage }>(
    `/students/${sid}/help-messages`,
    { method: 'POST', body: JSON.stringify({ content, sceneId }) },
  );
}
