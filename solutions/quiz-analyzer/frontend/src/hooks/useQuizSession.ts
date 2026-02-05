import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { QuizAnalysis } from '../types';

interface UseQuizSessionOptions {
  quizId: string;
  sessionId?: string;
  tenantId?: string;
  autoConnect?: boolean;
}

interface QuizSessionState {
  socket: Socket | null;
  analysis: Partial<QuizAnalysis>;
  isConnected: boolean;
  isAnalyzing: boolean;
  error: string | null;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3005';

export function useQuizSession(options: UseQuizSessionOptions) {
  const {
    quizId,
    sessionId = `quiz-session-${quizId}`,
    tenantId = 'default',
    autoConnect = true,
  } = options;

  const [state, setState] = useState<QuizSessionState>({
    socket: null,
    analysis: {},
    isConnected: false,
    isAnalyzing: false,
    error: null,
  });

  // Connect to Socket.io server
  useEffect(() => {
    if (!autoConnect) return;

    const socketInstance = io(BACKEND_URL, {
      query: { sessionId, clientId: tenantId },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketInstance.on('connect', () => {
      console.log('[QuizSession] Connected:', sessionId);
      setState((prev) => ({ ...prev, isConnected: true, socket: socketInstance }));
    });

    socketInstance.on('disconnect', () => {
      console.log('[QuizSession] Disconnected');
      setState((prev) => ({ ...prev, isConnected: false }));
    });

    socketInstance.on('connect_error', (error) => {
      console.error('[QuizSession] Connection error:', error);
      setState((prev) => ({
        ...prev,
        error: `Connection failed: ${error.message}`,
      }));
    });

    // Listen for output updates from AI analysis
    socketInstance.on('output_update', (event: any) => {
      console.log('[QuizSession] Output update:', event);

      if (event.payload && event.payload.field) {
        const { field, value } = event.payload;

        setState((prev) => ({
          ...prev,
          analysis: {
            ...prev.analysis,
            [field]: value,
          },
        }));
      }
    });

    // Listen for analysis start/complete events
    socketInstance.on('analysis_started', () => {
      console.log('[QuizSession] Analysis started');
      setState((prev) => ({ ...prev, isAnalyzing: true }));
    });

    socketInstance.on('analysis_completed', () => {
      console.log('[QuizSession] Analysis completed');
      setState((prev) => ({ ...prev, isAnalyzing: false }));
    });

    setState((prev) => ({ ...prev, socket: socketInstance }));

    return () => {
      console.log('[QuizSession] Cleanup');
      socketInstance.disconnect();
    };
  }, [quizId, sessionId, tenantId, autoConnect]);

  // Send message to trigger analysis
  const sendMessage = useCallback(
    (content: string) => {
      if (!state.socket || !state.isConnected) {
        console.warn('[QuizSession] Cannot send message: not connected');
        return;
      }

      console.log('[QuizSession] Sending message:', content);
      state.socket.emit('message', {
        content,
        quizId,
        timestamp: new Date().toISOString(),
      });

      setState((prev) => ({ ...prev, isAnalyzing: true }));
    },
    [state.socket, state.isConnected, quizId],
  );

  // Start AI analysis for the quiz
  const startAnalysis = useCallback(() => {
    sendMessage(`请分析这道题目: ${quizId}`);
  }, [quizId, sendMessage]);

  // Clear current analysis
  const clearAnalysis = useCallback(() => {
    setState((prev) => ({ ...prev, analysis: {} }));
  }, []);

  // Manually connect
  const connect = useCallback(() => {
    if (state.socket && !state.isConnected) {
      state.socket.connect();
    }
  }, [state.socket, state.isConnected]);

  // Manually disconnect
  const disconnect = useCallback(() => {
    if (state.socket && state.isConnected) {
      state.socket.disconnect();
    }
  }, [state.socket, state.isConnected]);

  return {
    // State
    socket: state.socket,
    analysis: state.analysis,
    isConnected: state.isConnected,
    isAnalyzing: state.isAnalyzing,
    error: state.error,

    // Actions
    sendMessage,
    startAnalysis,
    clearAnalysis,
    connect,
    disconnect,
  };
}
