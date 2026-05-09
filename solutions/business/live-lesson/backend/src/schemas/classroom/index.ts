// Session lifecycle
export type {
  SessionStatus,
  CreateSessionResponse,
  SessionInfoResponse,
  StartSessionResponse,
  EndSessionResponse,
  BatchCheckItem,
  SetStepResponse,
  NotifyResponse,
  SessionListItem,
  SessionListResponse,
} from './session';

// Student responses
export type {
  JoinResponse,
  SubmitResponse,
  SubmissionResponse,
  StudentSnapshotResponse,
  StudentProgressResponse,
  ChatMessageResponse,
  SnapshotEntry,
} from './student';

// State (getState decomposition)
export type {
  ActiveNotification,
  EnrichedSubmission,
  StudentStepHistory,
  StudentState,
  StepMetrics,
  HealthCards,
  QuestionRecord,
  ObservationBlock,
  CoachingBlock,
  ClusterStatsBlock,
  ClassroomStateResponse,
} from './state';

// AI / discuss / personal-touch
export type {
  AiAskResponse,
  AiDiscussResponse,
  DiscussCompleteResponse,
  PersonalTouchResponse,
  CheckResultResponse,
} from './ai';

// Observe API data
export type {
  McObserveData,
  EvidenceObserveData,
  MapObserveData,
  MatrixObserveData,
  DiscussObserveData,
} from './observe-data';

// Observation (shared)
export type {
  StudentObsStatus,
  IndicatorDef,
  StudentEvent,
  StudentLog,
  Alert,
  IndicatorStats,
} from './observation';

// Coaching
export type {
  DiscussionHighlight,
  CoachingStateInput,
  CoachingInsight,
} from './coaching';

// Clustering
export type {
  ObservationState,
  ClusterStats,
  ClassifyResult,
} from './clustering';
