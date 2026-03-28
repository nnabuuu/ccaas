import { useState, useCallback } from 'react';
import * as api from '../api/client';

type Phase = 'init' | 'joining' | 'joined';

interface Roster {
  id: string;
  name: string;
  avatar: string;
}

interface StudentSessionState {
  phase: Phase;
  classSessionId: string | null;
  sessionCode: string | null;
  roster: Roster[];
  studentSessionId: string | null;
  studentName: string | null;
  currentSceneIdx: number;
  error: string | null;
}

export function useStudentSession() {
  const [state, setState] = useState<StudentSessionState>({
    phase: 'init',
    classSessionId: null,
    sessionCode: null,
    roster: [],
    studentSessionId: null,
    studentName: null,
    currentSceneIdx: 0,
    error: null,
  });

  const lookupSession = useCallback(async (code: string) => {
    setState(prev => ({ ...prev, error: null }));
    try {
      const session = await api.getSessionByCode(code);
      const roster = await api.getRoster(session.id);
      setState(prev => ({
        ...prev,
        phase: 'joining',
        classSessionId: session.id,
        sessionCode: session.session_code,
        roster,
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Session not found';
      setState(prev => ({ ...prev, error: msg }));
    }
  }, []);

  const joinAsStudent = useCallback(async (studentId: string, studentName: string) => {
    if (!state.classSessionId) return;
    setState(prev => ({ ...prev, error: null }));
    try {
      const result = await api.joinSession(state.classSessionId, studentId);
      setState(prev => ({
        ...prev,
        phase: 'joined',
        studentSessionId: result.id,
        studentName: studentName,
        currentSceneIdx: result.current_scene_idx || 0,
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to join';
      setState(prev => ({ ...prev, error: msg }));
    }
  }, [state.classSessionId]);

  return { ...state, lookupSession, joinAsStudent };
}

interface TeacherSessionState {
  phase: 'init' | 'active';
  classSessionId: string | null;
  sessionCode: string | null;
  error: string | null;
}

export function useTeacherSession() {
  const [state, setState] = useState<TeacherSessionState>({
    phase: 'init',
    classSessionId: null,
    sessionCode: null,
    error: null,
  });

  const createSession = useCallback(async () => {
    setState(prev => ({ ...prev, error: null }));
    try {
      const session = await api.createSession('teacher-001');
      setState({
        phase: 'active',
        classSessionId: session.id,
        sessionCode: session.session_code,
        error: null,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create session';
      setState(prev => ({ ...prev, error: msg }));
    }
  }, []);

  return { ...state, createSession };
}
