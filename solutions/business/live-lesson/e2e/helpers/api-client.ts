import { BACKEND_URL } from './constants';

type Json = Record<string, unknown>;

async function request(method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  const url = `${BACKEND_URL}${path}`;
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

// ── Lesson API ──

export async function getLessons() {
  return request('GET', '/api/lessons');
}

export async function getManifest(lessonId: string) {
  return request('GET', `/api/lessons/${lessonId}/manifest`);
}

// ── Session lifecycle ──

export async function createSession(lessonId: string) {
  return request('POST', '/api/classroom/sessions', { lessonId });
}

export async function getSession(code: string) {
  return request('GET', `/api/classroom/sessions/${code}`);
}

export async function startSession(code: string) {
  return request('POST', `/api/classroom/sessions/${code}/start`);
}

export async function endSession(code: string) {
  return request('POST', `/api/classroom/sessions/${code}/end`);
}

// ── Classroom operations ──

export async function joinStudent(code: string, name: string) {
  return request('POST', `/api/classroom/${code}/join`, { name });
}

export async function submitAnswer(code: string, studentId: string, step: number, data: Json) {
  return request('POST', `/api/classroom/${code}/submit`, { studentId, step, data });
}

export async function getState(code: string, step?: number) {
  const qs = step !== undefined ? `?step=${step}` : '';
  return request('GET', `/api/classroom/${code}/state${qs}`);
}

export async function setStep(code: string, step: number) {
  return request('POST', `/api/classroom/${code}/step`, { step });
}

// ── Exercise ──

export async function getExercise(code: string, step: number, studentId?: string) {
  const qs = studentId ? `?studentId=${studentId}` : '';
  return request('GET', `/api/classroom/${code}/steps/${step}/exercise${qs}`);
}

export async function checkAnswer(code: string, step: number, studentId: string, data: Json) {
  return request('POST', `/api/classroom/${code}/steps/${step}/check`, { studentId, data });
}

// ── AI ──

export async function aiAsk(code: string, studentId: string, step: number, question: string) {
  return request('POST', `/api/classroom/${code}/ai/ask`, { studentId, step, question });
}

export async function aiDiscuss(
  code: string,
  studentId: string,
  taskNum: number,
  messages: Array<{ role: 'ai' | 'student'; text: string }>,
  round: number,
  timeUsedSeconds: number,
) {
  return request('POST', `/api/classroom/${code}/ai/discuss`, {
    studentId, taskNum, messages, round, timeUsedSeconds,
  });
}

// ── Student progress ──

export async function getStudentProgress(code: string, studentId: string, include?: 'submissions') {
  const qs = include ? `?include=${include}` : '';
  return request('GET', `/api/classroom/${code}/students/${studentId}/progress${qs}`);
}

// ── Personal touch ──

export async function personalTouch(code: string, studentId: string) {
  return request('POST', `/api/classroom/${code}/personal-touch`, { studentId });
}

// ── Phase & discuss ──

export async function reportPhase(code: string, studentId: string, task: number, phase: string) {
  return request('POST', `/api/classroom/${code}/phase`, { studentId, task, phase });
}

export async function discussComplete(
  code: string,
  studentId: string,
  taskNum: number,
  completionType: 'goal_reached' | 'fallback_rounds' | 'fallback_time',
  roundsUsed: number,
  timeUsedSeconds: number,
) {
  return request('POST', `/api/classroom/${code}/ai/discuss-complete`, {
    studentId, taskNum, completionType, roundsUsed, timeUsedSeconds,
  });
}

// ── Observe ──

export async function observeStep(
  code: string,
  step: number,
  type: 'mc' | 'evidence' | 'map' | 'matrix' | 'discuss',
  view?: 'first' | 'latest',
) {
  const qs = view ? `?view=${view}` : '';
  return request('GET', `/api/classroom/${code}/steps/${step}/observe/${type}${qs}`);
}

// ── Session list ──

export async function listSessions(status?: string, limit?: number, offset?: number) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  const qs = params.toString() ? `?${params}` : '';
  return request('GET', `/api/classroom/sessions${qs}`);
}

// ── Translate ──

export async function translate(
  code: string,
  studentId: string,
  text: string,
  step: number,
  sourceContext: string,
  phase?: string,
) {
  return request('POST', `/api/classroom/${code}/translate`, {
    studentId, text, step, sourceContext, ...(phase && { phase }),
  });
}

// ── Chat history ──

export async function getChatHistory(code: string, studentId: string, threadId?: string) {
  const qs = threadId ? `?studentId=${studentId}&threadId=${threadId}` : `?studentId=${studentId}`;
  return request('GET', `/api/classroom/${code}/chat-history${qs}`);
}
