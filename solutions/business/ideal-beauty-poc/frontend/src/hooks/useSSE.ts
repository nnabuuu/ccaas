import { useEffect, useRef, useCallback, useState } from 'react';
import { API_URL } from '../config';

interface SSEEvent {
  type: string;
  data: unknown;
}

const MAX_EVENTS = 200;

export function useTeacherSSE(sessionId: string | null) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(
      `${API_URL}/api/sessions/${sessionId}/stream`,
    );
    esRef.current = es;

    const onConnected = () => setConnected(true);
    es.addEventListener('connected', onConnected);

    const eventTypes = [
      'student_joined',
      'scene_changed',
      't1_submitted',
      't2_submitted',
      'version_created',
      'version_evaluated',
      'help_message',
    ];

    const handlers = new Map<string, (e: MessageEvent) => void>();
    eventTypes.forEach(type => {
      const handler = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setEvents(prev =>
            prev.length >= MAX_EVENTS
              ? [...prev.slice(-MAX_EVENTS + 1), { type, data }]
              : [...prev, { type, data }],
          );
        } catch {
          // ignore parse errors
        }
      };
      handlers.set(type, handler);
      es.addEventListener(type, handler as EventListener);
    });

    es.onerror = () => setConnected(false);

    return () => {
      es.removeEventListener('connected', onConnected);
      handlers.forEach((handler, type) => {
        es.removeEventListener(type, handler as EventListener);
      });
      es.close();
      esRef.current = null;
    };
  }, [sessionId]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, connected, clearEvents };
}

export function useStudentSSE(
  studentSessionId: string | null,
  classSessionId: string | null,
) {
  const [broadcastData, setBroadcastData] = useState<Record<string, unknown> | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!studentSessionId || !classSessionId) return;

    const es = new EventSource(
      `${API_URL}/api/students/${studentSessionId}/stream?classSessionId=${classSessionId}`,
    );
    esRef.current = es;

    const onConnected = () => setConnected(true);
    const onBroadcastStart = (e: MessageEvent) => {
      try {
        setBroadcastData(JSON.parse(e.data));
      } catch {
        // ignore
      }
    };
    const onBroadcastEnd = () => setBroadcastData(null);

    es.addEventListener('connected', onConnected);
    es.addEventListener('broadcast_start', onBroadcastStart);
    es.addEventListener('broadcast_end', onBroadcastEnd);

    es.onerror = () => setConnected(false);

    return () => {
      es.removeEventListener('connected', onConnected);
      es.removeEventListener('broadcast_start', onBroadcastStart);
      es.removeEventListener('broadcast_end', onBroadcastEnd);
      es.close();
      esRef.current = null;
    };
  }, [studentSessionId, classSessionId]);

  const dismissBroadcast = useCallback(() => setBroadcastData(null), []);

  return { broadcastData, connected, dismissBroadcast };
}
