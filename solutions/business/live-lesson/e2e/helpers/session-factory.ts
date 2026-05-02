import { createSession, startSession, joinStudent } from './api-client';
import { LESSON_ID } from './constants';

export interface TestSession {
  sessionId: string;
  code: string;
  lessonId: string;
}

export interface TestStudent {
  studentId: string;
  name: string;
}

/**
 * Create a new session, start it, and optionally join a student.
 * Returns the session info and (if requested) the student info.
 */
export async function createTestSession(opts?: {
  lessonId?: string;
  studentName?: string;
}): Promise<{ session: TestSession; student?: TestStudent }> {
  const lessonId = opts?.lessonId ?? LESSON_ID;

  const createRes = await createSession(lessonId);
  if (createRes.status !== 201 && createRes.status !== 200) {
    throw new Error(`Failed to create session: ${createRes.status} ${JSON.stringify(createRes.data)}`);
  }
  const session = createRes.data as TestSession;

  const startRes = await startSession(session.code);
  if (startRes.status !== 201 && startRes.status !== 200) {
    throw new Error(`Failed to start session: ${startRes.status} ${JSON.stringify(startRes.data)}`);
  }

  let student: TestStudent | undefined;
  if (opts?.studentName) {
    const joinRes = await joinStudent(session.code, opts.studentName);
    if (joinRes.status !== 201 && joinRes.status !== 200) {
      throw new Error(`Failed to join student: ${joinRes.status} ${JSON.stringify(joinRes.data)}`);
    }
    student = joinRes.data as TestStudent;
  }

  return { session, student };
}
