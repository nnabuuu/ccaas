import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SCENES } from '../data/content';
import { getStudents, getVersions, broadcast, endBroadcast } from '../api/client';
import { useTeacherSSE } from '../hooks/useSSE';
import { useTeacherSession } from '../hooks/useSession';
import PulseBar from './PulseBar';
import TeachContent from './TeachContent';
import StudentPanel, {
  type StudentProgress,
  type WritingVersion,
} from './StudentPanel';
import BroadcastOverlay from './BroadcastOverlay';

/* ═══════ Types ═══════ */

interface BroadcastState {
  student: StudentProgress;
  version: WritingVersion;
}

/* ═══════ Component ═══════ */

export default function TeacherApp() {
  const session = useTeacherSession();
  const { events, connected } = useTeacherSSE(session.classSessionId);

  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [si, setSi] = useState(0);
  const [broadcastState, setBroadcastState] =
    useState<BroadcastState | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'main' | 'side'>('main');

  const scene = SCENES[si];

  // Load students — fetch versions only for students who have them
  const loadingRef = useRef(false);
  const loadStudents = useCallback(async () => {
    if (!session.classSessionId || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await getStudents(session.classSessionId);
      // Only fetch versions for students with version_count > 0
      const needVersions = data.filter((s) => s.version_count > 0);
      const versionMap = new Map<string, WritingVersion[]>();
      if (needVersions.length > 0) {
        const results = await Promise.allSettled(
          needVersions.map((s) => getVersions(s.id)),
        );
        needVersions.forEach((s, i) => {
          const result = results[i];
          if (result.status === 'fulfilled') {
            versionMap.set(s.id, result.value);
          } else if (s.latest_version) {
            versionMap.set(s.id, [s.latest_version]);
          }
        });
      }
      setStudents(
        data.map((s) => ({
          ...s,
          versions: versionMap.get(s.id) || [],
        })),
      );
    } catch {
      // Silently fail — will retry on next poll
    } finally {
      loadingRef.current = false;
    }
  }, [session.classSessionId]);

  // Poll students every 8s when session is active
  // SSE events reset the timer so fresh data arrives faster after changes
  const eventsLenRef = useRef(0);
  useEffect(() => {
    if (!session.classSessionId) return;
    loadStudents();
    const interval = setInterval(loadStudents, 8000);
    return () => clearInterval(interval);
  }, [session.classSessionId, loadStudents]);

  // Debounced SSE-triggered refresh — coalesce rapid events
  useEffect(() => {
    if (events.length === eventsLenRef.current) return;
    eventsLenRef.current = events.length;
    const timeout = setTimeout(loadStudents, 500);
    return () => clearTimeout(timeout);
  }, [events.length, loadStudents]);

  // Handle broadcast
  const handleBroadcast = useCallback(
    (student: StudentProgress, version: WritingVersion) => {
      setBroadcastState({ student, version });
    },
    [],
  );

  const handleBroadcastSend = useCallback(async () => {
    if (!broadcastState || !session.classSessionId) return;
    try {
      await broadcast(session.classSessionId, {
        studentSessionId: broadcastState.student.id,
        artifactType: 'writing',
        versionId: broadcastState.version.id,
      });
    } catch {
      // Broadcast send failed — modal stays open
    }
  }, [broadcastState, session.classSessionId]);

  const handleBroadcastClose = useCallback(async () => {
    if (session.classSessionId) {
      try {
        await endBroadcast(session.classSessionId);
      } catch {
        // Ignore end errors
      }
    }
    setBroadcastState(null);
  }, [session.classSessionId]);

  /* ═══════ Init screen ═══════ */
  if (session.phase === 'init') {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Source Serif 4',Georgia,serif",
          background: '#f8f7f4',
        }}
      >
        <div
          className="modal-card"
          style={{
            padding: '40px 36px',
            background: '#fff',
            borderRadius: 16,
            border: '1px solid #ebe8e2',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#1a1a18',
              marginBottom: 6,
              fontFamily: "'DM Sans',system-ui,sans-serif",
            }}
          >
            Ideal Beauty
          </div>
          <div
            style={{
              fontSize: 14,
              color: '#6b6963',
              marginBottom: 28,
            }}
          >
            Teacher Dashboard
          </div>
          <button
            onClick={session.createSession}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: 10,
              border: 'none',
              background: '#7c3aed',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'DM Sans',system-ui,sans-serif",
            }}
          >
            Start Session
          </button>
          {session.error && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: '#ef4444',
              }}
            >
              {session.error}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══════ Active dashboard ═══════ */
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Source Serif 4',Georgia,serif",
        overflow: 'hidden',
      }}
    >
      {/* Session code banner */}
      {session.sessionCode && (
        <div
          style={{
            background: '#7c3aed',
            padding: '6px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>
            Session Code:
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: 3,
              fontFamily: "'DM Sans',system-ui,sans-serif",
            }}
          >
            {session.sessionCode}
          </span>
          <button
            onClick={() =>
              navigator.clipboard.writeText(session.sessionCode ?? '')
            }
            style={{
              padding: '2px 10px',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,.3)',
              background: 'transparent',
              color: 'rgba(255,255,255,.8)',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
        </div>
      )}

      {/* Pulse bar */}
      <PulseBar
        sceneIdx={si}
        setSceneIdx={setSi}
        students={students}
        connected={connected}
      />

      {/* Mobile tab bar */}
      <div className="panel-tab-bar">
        <button
          data-active={mobilePanel === 'main'}
          onClick={() => setMobilePanel('main')}
        >
          Lesson
        </button>
        <button
          data-active={mobilePanel === 'side'}
          onClick={() => setMobilePanel('side')}
        >
          Students ({students.length})
        </button>
      </div>

      {/* Body: teaching content + student panel */}
      <div className="split-panels" data-active-panel={mobilePanel}>
        {/* Left: teaching content (scrollable) */}
        <div
          className="split-main"
          style={{
            padding: '16px 22px',
            background: '#f8f7f4',
          }}
        >
          <TeachContent sceneId={scene.id} />
        </div>

        {/* Right: student panel */}
        <div
          className="split-side-narrow"
          style={{
            borderLeft: '1px solid #ebe8e2',
            background: '#fdfcfa',
          }}
        >
          <StudentPanel
            sceneId={scene.id}
            students={students}
            sessionId={session.classSessionId ?? ''}
            onBroadcast={handleBroadcast}
          />
        </div>
      </div>

      {/* Broadcast overlay */}
      {broadcastState && (
        <BroadcastOverlay
          student={broadcastState.student}
          version={broadcastState.version}
          onSend={handleBroadcastSend}
          onClose={handleBroadcastClose}
        />
      )}
    </div>
  );
}
