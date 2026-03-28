import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SCENES } from '../data/content';
import { updateScene } from '../api/client';
import { useStudentSSE } from '../hooks/useSSE';
import { useStudentSession } from '../hooks/useSession';

import SceneNav from './SceneNav';
import LectureL1 from './LectureL1';
import LectureL2 from './LectureL2';
import LectureL3 from './LectureL3';
import TaskT1 from './TaskT1';
import TaskT2 from './TaskT2';
import TaskT3 from './TaskT3';
import TaskT4 from './TaskT4';
import RefPanel from './RefPanel';
import HelpCenter from './HelpCenter';
import BroadcastOverlay from './BroadcastOverlay';
import { JoinCodeScreen, RosterScreen } from './JoinFlow';

import type { VersionEntry } from './TaskT3';
import type { T1Result } from './TaskT1';
import type { T2Result } from './TaskT2';

/* ═══════════════════════════════════════════
   StudentApp — main student shell
   Join flow → lesson view → SSE broadcast
   ═══════════════════════════════════════════ */

export default function StudentApp() {
  const session = useStudentSession();
  const { broadcastData, dismissBroadcast } = useStudentSSE(
    session.studentSessionId,
    session.classSessionId,
  );

  /* ─── Local form state for join flow ─── */
  const [codeInput, setCodeInput] = useState('');

  /* ─── Lesson state ─── */
  const [si, setSi] = useState(session.currentSceneIdx);
  const [highlights, setHighlights] = useState<Record<string, string>>({});
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [t1Result, setT1Result] = useState<T1Result | null>(null);
  const [t2Result, setT2Result] = useState<T2Result | null>(null);
  const [fullPanel, setFullPanel] = useState<'none' | 'left' | 'right'>('none');
  const [mobilePanel, setMobilePanel] = useState<'main' | 'side'>('main');

  const maxSi = useRef(0);

  /* Keep maxSi in sync */
  useEffect(() => {
    if (si > maxSi.current) maxSi.current = si;
  }, [si]);

  /* Sync scene index from session on join */
  useEffect(() => {
    setSi(session.currentSceneIdx);
  }, [session.currentSceneIdx]);

  /* Notify backend when scene changes */
  const changeScene = useCallback(
    (idx: number) => {
      setSi(idx);
      if (session.studentSessionId) {
        updateScene(session.studentSessionId, idx).catch(() => {
          /* best-effort */
        });
      }
    },
    [session.studentSessionId],
  );

  const addVersion = useCallback((v: VersionEntry) => {
    setVersions((prev) => [...prev, v]);
  }, []);

  const scene = SCENES[si];
  const isLecture = scene?.type === 'lecture';
  const showLeft = fullPanel !== 'right';
  const showRight = fullPanel !== 'left' && !isLecture;

  /* ═══════════════ JOIN FLOW ═══════════════ */

  if (session.phase === 'init') {
    return (
      <JoinCodeScreen
        codeInput={codeInput}
        onCodeChange={setCodeInput}
        onSubmit={() => session.lookupSession(codeInput.trim())}
        error={session.error}
      />
    );
  }

  if (session.phase === 'joining') {
    return (
      <RosterScreen
        sessionCode={session.sessionCode ?? ''}
        roster={session.roster}
        onSelect={(id, name) => session.joinAsStudent(id, name)}
        error={session.error}
      />
    );
  }

  /* ═══════════════ TASK CONTENT ═══════════════ */

  const taskContent = () => {
    if (!session.studentSessionId) return null;
    switch (scene.id) {
      case 'T1':
        return (
          <TaskT1
            studentSessionId={session.studentSessionId}
            highlights={highlights}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            onResult={setT1Result}
            result={t1Result}
          />
        );
      case 'T2':
        return (
          <TaskT2
            studentSessionId={session.studentSessionId}
            picked={picked}
            onResult={setT2Result}
            result={t2Result}
          />
        );
      case 'T3':
        return (
          <TaskT3
            studentSessionId={session.studentSessionId}
            draft={draft}
            setDraft={setDraft}
            versions={versions}
            onVersionAdded={addVersion}
          />
        );
      case 'T4':
        return <TaskT4 draft={draft} setDraft={setDraft} versions={versions} />;
      default:
        return null;
    }
  };

  /* ═══════════════ LESSON VIEW ═══════════════ */

  return (
    <div
      className="h-dvh overflow-hidden"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Source Serif 4',Georgia,serif",
      }}
    >
      {/* Scene navigation */}
      <SceneNav
        currentIdx={si}
        maxVisited={maxSi.current}
        onSelect={changeScene}
      />

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {isLecture ? (
          /* LECTURE: full-width */
          <div style={{ flex: 1, overflowY: 'auto', background: '#fdfcfa' }}>
            {scene.id === 'L1' && <LectureL1 />}
            {scene.id === 'L2' && <LectureL2 />}
            {scene.id === 'L3' && <LectureL3 />}

            {/* Bottom nav */}
            <div
              className="lecture-container"
              style={{
                padding: '16px 32px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <button
                onClick={() => changeScene(Math.max(0, si - 1))}
                disabled={si === 0}
                style={{
                  padding: '12px 20px',
                  borderRadius: 8,
                  border: '1px solid #ebe8e2',
                  background: '#fff',
                  color: si === 0 ? '#d4d1c7' : '#3d3b36',
                  fontSize: 14,
                  cursor: si === 0 ? 'default' : 'pointer',
                }}
              >
                &larr; Previous
              </button>
              <button
                onClick={() =>
                  changeScene(Math.min(SCENES.length - 1, si + 1))
                }
                style={{
                  padding: '12px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#7c3aed',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        ) : (
          /* TASK: workspace + reference split */
          <>
            {/* Mobile tab bar */}
            <div className="panel-tab-bar">
              <button
                data-active={mobilePanel === 'main'}
                onClick={() => setMobilePanel('main')}
              >
                {scene.zh || scene.label}
              </button>
              <button
                data-active={mobilePanel === 'side'}
                onClick={() => setMobilePanel('side')}
              >
                Reading
              </button>
            </div>

            <div className="split-panels" data-active-panel={mobilePanel}>
            {showLeft && (
              <div
                className="split-main"
                style={{
                  background: '#1e1d1b',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    padding: '10px 20px 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: '#5c5a56',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    {scene.zh}
                  </span>
                  <button
                    onClick={() =>
                      setFullPanel(fullPanel === 'left' ? 'none' : 'left')
                    }
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      border: '1px solid rgba(255,255,255,.1)',
                      background:
                        fullPanel === 'left'
                          ? 'rgba(167,139,250,.15)'
                          : 'transparent',
                      color:
                        fullPanel === 'left' ? '#a78bfa' : '#5c5a56',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    {fullPanel === 'left' ? '\u2921' : '\u2922'}
                  </button>
                </div>

                <div
                  style={{
                    flex: 1,
                    padding: '8px 20px 20px',
                    overflowY: 'auto',
                    minHeight: 0,
                  }}
                >
                  {taskContent()}
                </div>

                {/* Inline HelpCenter for Task view */}
                {session.studentSessionId && (
                  <HelpCenter
                    sceneId={scene.id}
                    studentSessionId={session.studentSessionId}
                    mode="inline"
                  />
                )}

                <div
                  style={{
                    padding: '8px 20px',
                    borderTop: '1px solid rgba(255,255,255,.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={() => changeScene(Math.max(0, si - 1))}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 6,
                      border: '1px solid rgba(255,255,255,.08)',
                      background: 'transparent',
                      color: '#8a8780',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    &larr; Back
                  </button>
                  <button
                    onClick={() =>
                      changeScene(Math.min(SCENES.length - 1, si + 1))
                    }
                    disabled={si === SCENES.length - 1}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 6,
                      border: 'none',
                      background:
                        si === SCENES.length - 1 ? '#333' : '#a78bfa',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor:
                        si === SCENES.length - 1 ? 'default' : 'pointer',
                    }}
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}

            {showRight && (
              <div
                className="split-side"
                style={{
                  ...(fullPanel === 'right' ? { width: '100%', flex: 1 } : {}),
                  borderLeft: showLeft ? '1px solid #ebe8e2' : 'none',
                  background: '#fdfcfa',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    padding: '6px 14px',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={() =>
                      setFullPanel(
                        fullPanel === 'right' ? 'none' : 'right',
                      )
                    }
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      border: '1px solid #ebe8e2',
                      background:
                        fullPanel === 'right' ? '#f5f3ff' : '#fff',
                      color:
                        fullPanel === 'right' ? '#7c3aed' : '#9e9c96',
                      fontSize: 11,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  >
                    {fullPanel === 'right' ? '\u2921' : '\u2922'}
                  </button>
                </div>

                <RefPanel
                  sceneId={scene.id}
                  highlights={highlights}
                  activeTool={activeTool}
                  onSentClick={(id) => {
                    if (!activeTool) return;
                    setHighlights((p) => {
                      const n = { ...p };
                      if (n[id] === activeTool) delete n[id];
                      else n[id] = activeTool;
                      return n;
                    });
                  }}
                  picked={picked}
                  onPickTrans={(p) =>
                    setPicked((prev) =>
                      prev.includes(p)
                        ? prev.filter((x) => x !== p)
                        : [...prev, p],
                    )
                  }
                />
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* Floating Help for Lecture view only */}
      {isLecture && session.studentSessionId && (
        <HelpCenter
          sceneId={scene.id}
          studentSessionId={session.studentSessionId}
          mode="floating"
        />
      )}

      {/* Broadcast overlay */}
      {broadcastData && (
        <BroadcastOverlay data={broadcastData} onDismiss={dismissBroadcast} />
      )}
    </div>
  );
}
