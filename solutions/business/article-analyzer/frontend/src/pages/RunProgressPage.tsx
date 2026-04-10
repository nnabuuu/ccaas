import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getRunProgress,
  getIterations,
  subscribeToRunEvents,
  type RunProgress,
  type IterationResponse,
  type HarnessEventEnvelope,
} from '../api';
import ScoreChart from '../components/ScoreChart';
import RadarChart from '../components/RadarChart';
import ScorecardTable from '../components/ScorecardTable';
import IterationTimeline from '../components/IterationTimeline';
import VersionDiff from '../components/VersionDiff';
import CompletionSummary from '../components/CompletionSummary';
import PipelineStep from '../components/PipelineStep';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';

import Skeleton from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import SectionHeader from '../components/ui/SectionHeader';
import ProgressBar from '../components/ui/ProgressBar';
import Tabs from '../components/ui/Tabs';

interface LiveState {
  currentStep: string | null;
  currentIteration: number | null;
  agentStatus: string | null;
  lastTextDelta: string | null;
}

const TAB_LIST = ['Chart', 'Timeline', 'Scorecard', 'Diff'] as const;

export default function RunProgressPage() {
  const { id } = useParams<{ id: string }>();
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [iterations, setIterations] = useState<IterationResponse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('Chart');
  const [live, setLive] = useState<LiveState>({
    currentStep: null,
    currentIteration: null,
    agentStatus: null,
    lastTextDelta: null,
  });
  const [sseConnected, setSseConnected] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(() => {
    if (!id) return;
    getRunProgress(id)
      .then(setProgress)
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load');
      });
    getIterations(id).then(setIterations).catch(() => {});
  }, [id]);

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  const handleEventRef = useRef<(envelope: HarnessEventEnvelope) => void>(
    () => {},
  );
  handleEventRef.current = (envelope: HarnessEventEnvelope) => {
    const { type, data } = envelope.event;
    const eventData = data as Record<string, unknown>;

    switch (type) {
      case 'step_started':
        setLive((prev) => ({
          ...prev,
          currentStep: (eventData.stepId as string) ?? null,
          currentIteration: (eventData.iteration as number) ?? null,
          agentStatus: 'working',
          lastTextDelta: null,
        }));
        break;

      case 'step_completed':
        setLive((prev) => ({
          ...prev,
          currentStep: null,
          agentStatus: null,
        }));
        fetchDataRef.current();
        break;

      case 'iteration_started':
        setLive((prev) => ({
          ...prev,
          currentIteration: (eventData.iteration as number) ?? null,
          currentStep: null,
        }));
        break;

      case 'iteration_completed':
        setLive((prev) => ({
          ...prev,
          currentStep: null,
          agentStatus: null,
          lastTextDelta: null,
        }));
        fetchDataRef.current();
        break;

      case 'session_event': {
        const eventType = eventData.eventType as string;
        const payload = eventData.payload as Record<string, unknown>;
        if (eventType === 'text_delta' && payload?.delta) {
          setLive((prev) => ({
            ...prev,
            lastTextDelta: String(payload.delta),
          }));
        } else if (eventType === 'agent_status') {
          setLive((prev) => ({
            ...prev,
            agentStatus: (payload?.status as string) ?? null,
          }));
        }
        break;
      }

      case 'run_completed':
      case 'run_failed':
        setLive({
          currentStep: null,
          currentIteration: null,
          agentStatus: null,
          lastTextDelta: null,
        });
        fetchDataRef.current();
        break;
    }
  };

  useEffect(() => {
    if (!id) return;

    fetchDataRef.current();

    const cleanupSse = subscribeToRunEvents(
      id,
      (envelope) => {
        setSseConnected(true);
        handleEventRef.current(envelope);
      },
      () => {
        setSseConnected(false);
      },
    );
    return () => {
      cleanupSse();
    };
  }, [id]);

  useEffect(() => {
    if (sseConnected || !id) return;
    if (progress && progress.status !== 'running') return;

    intervalRef.current = setInterval(() => fetchDataRef.current(), 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [id, sseConnected, progress?.status]);

  if (loadError) {
    return (
      <ErrorState
        message={loadError}
        onRetry={() => {
          setLoadError(null);
          fetchData();
        }}
      />
    );
  }

  if (!progress) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton variant="line" lines={1} />
        <Skeleton variant="card" lines={1} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton variant="chart" />
          <Skeleton variant="chart" />
        </div>
      </div>
    );
  }

  const latestIteration =
    iterations.length > 0 ? iterations[iterations.length - 1] : null;

  const sseStatusColor = sseConnected
    ? 'bg-green-500'
    : progress.status === 'running'
      ? 'bg-yellow-500'
      : 'bg-slate-400';

  const sseStatusLabel = sseConnected
    ? 'SSE connected'
    : progress.status === 'running'
      ? 'Reconnecting...'
      : 'Idle';

  // Trend arrow: delta between last two scores
  const trajectory = progress.scoreTrajectory;
  let trendDelta: number | null = null;
  if (trajectory.length >= 2) {
    trendDelta =
      trajectory[trajectory.length - 1].score -
      trajectory[trajectory.length - 2].score;
  }

  // Elapsed time from iterations
  const firstCreatedAt =
    iterations.length > 0 ? iterations[0].createdAt : undefined;
  const lastCreatedAt =
    iterations.length > 0
      ? iterations[iterations.length - 1].createdAt
      : undefined;

  const isCompleted = progress.status === 'completed';
  const isFailed = progress.status === 'failed';

  return (
    <div className="animate-fade-in">
      {/* Completion Summary */}
      {(isCompleted || isFailed) && (
        <div className="mt-4">
          <CompletionSummary
            finalScore={progress.latestScore}
            totalIterations={progress.currentIteration}
            maxIterations={progress.maxIterations}
            exitReason={progress.exitReason}
            startedAt={firstCreatedAt}
            completedAt={lastCreatedAt}
            status={isFailed ? 'failed' : 'completed'}
          />
        </div>
      )}

      {/* Hero cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
        {/* Score card */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Score
            </span>
            <StatusBadge status={progress.status} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-slate-900 dark:text-slate-100">
              {progress.latestScore != null
                ? progress.latestScore.toFixed(1)
                : '—'}
            </span>
            <span className="text-base text-slate-400 dark:text-slate-500">
              / 100
            </span>
          </div>
          {trendDelta !== null && (
            <div
              className={`mt-1 flex items-center gap-1 text-sm font-medium ${
                trendDelta >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              <span>{trendDelta >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trendDelta).toFixed(1)}</span>
            </div>
          )}
        </Card>

        {/* Iteration progress card */}
        <Card>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Iteration
          </span>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {progress.currentIteration}
            <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
              {' '}/ {progress.maxIterations}
            </span>
          </p>
          <div className="mt-3">
            <ProgressBar
              current={progress.currentIteration}
              max={progress.maxIterations}
              status={progress.status === 'completed' ? 'completed' : progress.status === 'failed' ? 'failed' : 'running'}
            />
          </div>
        </Card>

        {/* Pipeline + SSE card */}
        <Card>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Pipeline
          </span>
          <div className="mt-2">
            <PipelineStep
              currentStep={live.currentStep}
              status={progress.status}
            />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span
              className={`inline-block h-2 w-2 rounded-full ${sseStatusColor}`}
            />
            <span>{sseStatusLabel}</span>
          </div>
        </Card>
      </div>

      {/* Live activity indicator */}
      {progress.status === 'running' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-primary-600 dark:text-primary-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
          </span>
          <span>
            {live.currentStep
              ? `Step: ${live.currentStep}`
              : live.currentIteration
                ? `Iteration ${live.currentIteration}`
                : 'Running...'}
            {live.agentStatus && live.agentStatus !== 'idle'
              ? ` (${live.agentStatus})`
              : ''}
          </span>
          {live.lastTextDelta && (
            <span className="truncate max-w-xs text-xs text-slate-400 dark:text-slate-500">
              — {live.lastTextDelta}
            </span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6">
        <Tabs
          tabs={[...TAB_LIST]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'Chart' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            <Card padding="md">
              <SectionHeader title="Score Trajectory" />
              <ScoreChart data={progress.scoreTrajectory} />
            </Card>
            <Card padding="md">
              <SectionHeader title="Dimension Scores" />
              <RadarChart
                dimensions={latestIteration?.dimensionScores ?? null}
              />
            </Card>
          </div>
        )}

        {activeTab === 'Timeline' && (
          <div className="animate-fade-in">
            <IterationTimeline iterations={iterations} />
          </div>
        )}

        {activeTab === 'Scorecard' && (
          <div className="animate-fade-in">
            <ScorecardTable iterations={iterations} />
          </div>
        )}

        {activeTab === 'Diff' && (
          <div className="animate-fade-in">
            {iterations.length >= 2 ? (
              <VersionDiff iterations={iterations} />
            ) : (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Need at least 2 iterations to show diff.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
