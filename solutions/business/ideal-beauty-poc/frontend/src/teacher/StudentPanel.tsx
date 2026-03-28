import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { SCENES } from '../data/content';
import { getInsights } from '../api/client';
import type {
  WritingVersion as ApiWritingVersion,
  StudentProgress as ApiStudentProgress,
  T1Evaluation,
  T2Evaluation,
} from '../api/client';
import { computeScore } from '../ui/ScoreBadge';
import FullDetail from './FullDetail';

/* ═══════ Types ═══════ */

export interface WritingVersion extends ApiWritingVersion {}

export interface StudentProgress extends Omit<ApiStudentProgress, 'latest_version'> {
  latest_version: WritingVersion | null;
  versions?: WritingVersion[];
}

interface StudentPanelProps {
  sceneId: string;
  students: StudentProgress[];
  sessionId: string;
  onBroadcast: (student: StudentProgress, version: WritingVersion) => void;
}

/* ═══════ Helpers ═══════ */

function getScore(s: StudentProgress): number | null {
  return computeScore(s.latest_version?.evaluation);
}

/* ═══════ Memoized student row ═══════ */

interface StudentRowProps {
  s: StudentProgress;
  sceneId: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  onFocus: (id: string) => void;
  onBroadcast: (student: StudentProgress, version: WritingVersion) => void;
}

const StudentRow = memo(function StudentRow({
  s,
  sceneId,
  expanded,
  onToggle,
  onFocus,
  onBroadcast,
}: StudentRowProps) {
  const score = getScore(s);
  const vCount = s.version_count;

  return (
    <div>
      {/* Student row */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${s.student_name} details`}
        onClick={() => onToggle(s.id)}
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') &&
          (e.preventDefault(), onToggle(s.id))
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '7px 14px',
          cursor: 'pointer',
          background: expanded ? '#fafaf8' : 'transparent',
          borderLeft: expanded
            ? '3px solid #a78bfa'
            : '3px solid transparent',
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: 12,
            fontWeight: expanded ? 600 : 500,
            color: '#1a1a18',
          }}
        >
          {s.student_name}
        </span>

        {/* Score */}
        {score !== null && (
          <span style={{ fontSize: 11, fontWeight: 600, color: score >= 2 ? '#059669' : '#ef4444' }}>
            {score}/3
          </span>
        )}

        {/* Version count */}
        {vCount > 1 && (
          <span
            style={{
              fontSize: 11,
              color: '#7c3aed',
              fontWeight: 600,
            }}
          >
            {vCount}v
          </span>
        )}

        {/* Fullscreen button */}
        {(s.latest_version || (s.versions && s.versions.length > 0)) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFocus(s.id);
            }}
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              border: '1px solid #ede9fe',
              background: '#faf5ff',
              color: '#7c3aed',
              fontSize: 9,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            \u2922
          </button>
        )}

        {/* Expand arrow */}
        <span
          style={{
            fontSize: 11,
            color: '#b8b5ae',
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform .12s',
            display: 'inline-block',
          }}
        >
          \u25b8
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            padding: '6px 14px 10px 28px',
            background: '#fafaf8',
            borderBottom: '1px solid #f0eee8',
          }}
        >
          {/* T1: Structure analysis */}
          {(sceneId === 'T1' || sceneId === 'L2') &&
            s.t1_highlights && (
              <div style={{ marginBottom: 6 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: '#7c3aed',
                    fontWeight: 600,
                    marginBottom: 3,
                  }}
                >
                  Structure analysis
                </div>
                {[
                  { l: 'Topic', k: 'topic' },
                  { l: 'Point', k: 'point' },
                  { l: 'Evidence', k: 'evidence' },
                  { l: 'Elaboration', k: 'elaboration' },
                ].map((x) => (
                  <div
                    key={x.l}
                    style={{
                      fontSize: 11,
                      color: '#6b6963',
                      marginBottom: 1,
                    }}
                  >
                    <strong>{x.l}:</strong>{' '}
                    {s.t1_highlights?.[x.k] || 'Not tagged'}
                  </div>
                ))}
              </div>
            )}

          {/* T2: Transitions */}
          {(sceneId === 'T2' || sceneId === 'L3') &&
            s.t2_picked_transitions &&
            s.t2_picked_transitions.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: '#7c3aed',
                    fontWeight: 600,
                    marginBottom: 3,
                  }}
                >
                  Transitions: {s.t2_picked_transitions.length}{' '}
                  found
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 3,
                    flexWrap: 'wrap',
                  }}
                >
                  {s.t2_picked_transitions.map((w) => (
                    <span
                      key={w}
                      style={{
                        padding: '1px 6px',
                        borderRadius: 6,
                        background: 'rgba(52,211,153,.08)',
                        color: '#059669',
                        fontSize: 11,
                      }}
                    >
                      {w} \u2713
                    </span>
                  ))}
                </div>
              </div>
            )}

          {/* T3/T4: Writing versions */}
          {(sceneId === 'T3' || sceneId === 'T4') &&
            s.versions &&
            s.versions.length > 0 && (
              <div>
                {s.versions
                  .filter((v) => v.evaluation)
                  .map((v) => {
                    const t = computeScore(v.evaluation) ?? 0;
                    return (
                      <div
                        key={v.id}
                        style={{
                          marginBottom: 6,
                          padding: '6px 8px',
                          background: '#fff',
                          borderRadius: 6,
                          border: '1px solid #f0eee8',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 3,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#7c3aed',
                            }}
                          >
                            Draft {v.version_number}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color:
                                t >= 2
                                  ? '#059669'
                                  : '#ef4444',
                            }}
                          >
                            {t}/3
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: '#3d3b36',
                            lineHeight: 1.5,
                            maxHeight: 40,
                            overflow: 'hidden',
                          }}
                        >
                          {v.text}
                        </div>
                        <button
                          onClick={() => onBroadcast(s, v)}
                          style={{
                            marginTop: 4,
                            padding: '3px 8px',
                            borderRadius: 4,
                            border: '1px solid #ede9fe',
                            background: '#faf5ff',
                            color: '#7c3aed',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            width: '100%',
                          }}
                        >
                          Broadcast
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

          {/* No work */}
          {!s.latest_version &&
            !s.t1_highlights &&
            (!s.t2_picked_transitions ||
              s.t2_picked_transitions.length === 0) && (
              <div style={{ fontSize: 11, color: '#b8b5ae' }}>
                No work submitted yet.
              </div>
            )}
        </div>
      )}
    </div>
  );
});

/* ═══════ Component ═══════ */

export default function StudentPanel({
  sceneId,
  students,
  sessionId,
  onBroadcast,
}: StudentPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [insight, setInsight] = useState<string>('');

  // Fetch AI insight when scene changes
  useEffect(() => {
    if (!sessionId) return;
    setInsight('');
    getInsights(sessionId, sceneId)
      .then(data => {
        if (typeof data === 'string') {
          setInsight(data);
        } else if (data?.summary) {
          setInsight(data.summary);
        } else if ((data as unknown as Record<string, unknown>)?.insight) {
          setInsight(String((data as unknown as Record<string, unknown>).insight));
        } else {
          setInsight(JSON.stringify(data));
        }
      })
      .catch(() => setInsight('Unable to load insight.'));
  }, [sessionId, sceneId, students.length]);

  // Filter and sort students relevant to current scene
  const relevant = useMemo(() => {
    const si = SCENES.findIndex(s => s.id === sceneId);
    if (sceneId.startsWith('L')) {
      return [...students]
        .filter(s => s.current_scene_idx >= si)
        .sort((a, b) => b.current_scene_idx - a.current_scene_idx);
    }
    if (sceneId === 'T1' || sceneId === 'T2') {
      return students.filter(
        s =>
          s.current_scene_idx >=
          SCENES.findIndex(s2 => s2.id === sceneId),
      );
    }
    // T3/T4: writing scenes — sort by score
    return [...students]
      .filter(s => s.current_scene_idx >= 4)
      .sort((a, b) => (getScore(b) ?? -1) - (getScore(a) ?? -1));
  }, [sceneId, students]);

  // Metrics
  const evaluatedCount = students.filter(
    s => s.latest_version?.evaluation,
  ).length;

  // Stable callbacks for memoized rows
  const handleToggle = useCallback(
    (id: string) => setExpandedId(prev => (prev === id ? null : id)),
    [],
  );
  const handleFocus = useCallback((id: string) => setFocusedId(id), []);

  // Fullscreen detail view
  const focused = focusedId
    ? students.find(s => s.id === focusedId)
    : null;

  if (focused) {
    return (
      <FullDetail
        student={focused}
        onClose={() => setFocusedId(null)}
        onBroadcast={onBroadcast}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* AI Insight */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #ebe8e2',
          flexShrink: 0,
          background: '#fafaf8',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed' }}>AI</span>
          <span
            style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed' }}
          >
            Insight
          </span>
        </div>
        {insight ? (
          <div style={{ fontSize: 11, color: '#3d3b36', lineHeight: 1.6 }}>
            {insight}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skeleton" style={{ height: 10, width: '95%' }} />
            <div className="skeleton" style={{ height: 10, width: '70%' }} />
          </div>
        )}
      </div>

      {/* Metrics row */}
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid #ebe8e2',
          flexShrink: 0,
          display: 'flex',
          gap: 6,
        }}
      >
        {[
          { l: 'On this step', v: relevant.length, c: '#1a1a18' },
          { l: 'Evaluated', v: evaluatedCount, c: '#1a1a18' },
        ].map(m => (
          <div
            key={m.l}
            style={{
              flex: 1,
              padding: '5px 6px',
              borderRadius: 5,
              background: '#fff',
              border: '1px solid #ebe8e2',
              textAlign: 'center',
            }}
          >
            <div
              style={{ fontSize: 15, fontWeight: 700, color: m.c }}
            >
              {m.v}
            </div>
            <div style={{ fontSize: 11, color: '#9e9c96' }}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* Student list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            padding: '6px 14px 3px',
            fontSize: 11,
            fontWeight: 600,
            color: '#9e9c96',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Students ({relevant.length})
        </div>

        {relevant.map(s => (
          <StudentRow
            key={s.id}
            s={s}
            sceneId={sceneId}
            expanded={expandedId === s.id}
            onToggle={handleToggle}
            onFocus={handleFocus}
            onBroadcast={onBroadcast}
          />
        ))}
      </div>
    </div>
  );
}
