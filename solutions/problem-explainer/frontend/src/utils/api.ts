const API_BASE = '/api';

export async function fetchSubjects(): Promise<{ id: string; name: string; hasFormula: boolean }[]> {
  const response = await fetch(`${API_BASE}/subjects`);
  if (!response.ok) {
    throw new Error('Failed to fetch subjects');
  }
  return response.json();
}

export async function createProblem(data: {
  content: string;
  imageUrl?: string;
  subject: string;
  gradeLevel?: string;
}) {
  const response = await fetch(`${API_BASE}/problems`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create problem');
  }
  return response.json();
}

export async function fetchProblem(id: string) {
  const response = await fetch(`${API_BASE}/problems/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch problem');
  }
  return response.json();
}

export async function fetchMessages(sessionId: string) {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/messages`);
  if (!response.ok) {
    throw new Error('Failed to fetch messages');
  }
  return response.json();
}
