/** Types for the Observe API responses */

export interface McObserveData {
  stats: {
    totalStudents: number;
    submitted: number;
    avgScore: number;
    perfectCount: number;
    zeroCount: number;
    avgTime: number;
    fastestTime: number;
    slowestTime: number;
  };
  questions: Array<{
    idx: number;
    stem: string;
    tag?: string;
    options: string[];
    correctIdx: number;
    distribution: Array<{ count: number; pct: number }>;
    correctRate: number;
  }>;
  misconceptions: Array<{
    id: string;
    label: string;
    count: number;
    severity: 'high' | 'medium' | 'low';
    students: Array<{ id: string; name: string }>;
  }>;
  students: Array<{
    id: string;
    name: string;
    score: number;
    time: number;
    answers: Record<string, { selected: number; correct: boolean; changed: boolean; timeSpent: number }>;
    keyInsights: string[];
  }>;
}

export interface EvidenceObserveData {
  stats: {
    totalStudents: number;
    allDone: number;
    perfectAll: number;
    evidenceHitRate: number;
    funcWrongCount: number;
  };
  sections: Array<{
    id: string;
    label: string;
    func: string;
    funcZh?: string;
    funcCorrectRate: number;
    evidenceHitRate: number;
    perfectCount: number;
    evidenceBar: { hit: number; total: number; pct: number };
  }>;
  misconceptions: Array<{
    id: string;
    label: string;
    count: number;
    severity: 'high' | 'medium' | 'low';
    students: Array<{ id: string; name: string }>;
  }>;
  students: Array<{
    id: string;
    name: string;
    time: number;
    completed: boolean;
    sections: Record<string, {
      func: string;
      funcCorrect: boolean;
      attempts: number;
      evidenceHit: number;
      evidenceTotal: number;
      wrongPicks?: string[];
      perfect: boolean;
      missed?: string[];
    }>;
    keyInsights: string[];
  }>;
}

export interface MapObserveData {
  stats: {
    totalStudents: number;
    submitted: number;
    avgDeviation: number;
    reasonedCount: number;
  };
  axes: { x: { neg: string; pos: string; label: string }; y: { neg: string; pos: string; label: string } };
  items: Array<{
    id: string;
    label: string;
    expected: [number, number];
    studentPlacements: Array<{ studentId: string; studentName: string; x: number; y: number; deviation: number }>;
  }>;
  misconceptions: Array<{
    id: string;
    label: string;
    count: number;
    severity: 'high' | 'medium' | 'low';
    students: Array<{ id: string; name: string }>;
  }>;
  students: Array<{
    id: string;
    name: string;
    placed: number;
    reasoned: boolean;
    time: number;
    submitted: boolean;
    placements: Record<string, [number, number]>;
    reasons: Record<string, string>;
    avgDeviation: number;
    keyInsights: string[];
    llmFeedback?: string;
    llmItemComments?: Record<string, { relevant: boolean; comment: string }>;
  }>;
}

export interface MatrixObserveData {
  stats: {
    totalStudents: number;
    submitted: number;
    avgCompletion: number;
    avgQuality: number;
    whatAvg: number;
    whyAvg: number;
    needAttention: number;
  };
  rows: Array<{
    id: string;
    concept: string;
    paraRef?: string;
    whatAvg: number;
    whyAvg: number;
    whatDist: [number, number, number, number];
    whyDist: [number, number, number, number];
  }>;
  patterns: Array<{
    id: string;
    label: string;
    count: number;
    severity: 'high' | 'medium' | 'low';
    students: Array<{ id: string; name: string }>;
  }>;
  students: Array<{
    id: string;
    name: string;
    time: number;
    submitted: boolean;
    completion: { filled: number; total: number; pct: number };
    avgQuality: number;
    responses: Record<string, {
      what: string;
      why: string;
      whatQ: number;
      whyQ: number;
    }>;
    keyInsights: string[];
  }>;
}

export interface ImageUploadObserveData {
  stats: {
    totalStudents: number;
    submitted: number;
    avgScore: number;
    perfectCount: number;
    pendingReview: number;
  };
  rubricStats: Array<{
    id: string;
    label: string;
    avgScore: number;
    distribution: Record<number, number>;
  }>;
  students: Array<{
    id: string;
    name: string;
    score: number;
    images: string[];
    rubricResults: Array<{ id: string; label: string; score: number; comment: string }>;
    feedback: string;
    keyInsights: string[];
  }>;
}

export interface RichContentQuizObserveData extends ImageUploadObserveData {
  scaffoldDistribution?: {
    independent: number;
    partial: number;
    full: number;
  };
  errorClusters?: Array<{
    type: string;
    count: number;
    students: Array<{ id: string; name: string }>;
  }>;
  students: Array<ImageUploadObserveData['students'][number] & {
    parts?: Record<string, {
      completed: boolean;
      attempts: number;
      scaffoldLevel: number;
      attemptsHistory?: Array<{
        version: number;
        images: string[];
        method: string;
        score: { total: number };
        submittedAt: string;
      }>;
    }>;
    scaffoldTier?: 'independent' | 'partial' | 'full';
    method?: 'handwrite' | 'photo';
  }>;
}

export interface GuidedDiscoveryObserveData {
  stats: {
    totalStudents: number;
    submitted: number;
    avgScore: number;
    perfectCount: number;
    avgTime: number;
  };
  stepDefs: Array<{
    id: string;
    title: string;
    type: string;
    spec: import('../answer-key.schema').GuidedDiscoveryStep;
  }>;
  stepStats: Array<{
    id: string;
    title: string;
    passedCount: number;
    passedRate: number;
    errors: Array<{
      description: string;
      count: number;
      students: Array<{ id: string; name: string }>;
    }>;
  }>;
  students: Array<{
    id: string;
    name: string;
    submitted: boolean;
    score: number;
    time: number;
    stepResults: Record<string, boolean>;
    stepAnswers: Record<string, Record<string, unknown>>;
    keyInsights: string[];
  }>;
}

export interface DiscussObserveData {
  stats: {
    totalStudents: number;
    discussedCount: number;
    goalReachedCount: number;
    avgRounds: number;
    avgTime: number;
    fallbackCount: number;
    medianTime: number;
    goalReachedRate: number;
  };
  clusterCoverage?: {
    definitions: Array<{ id: string; label: string }>;
    classCoverage: Array<{
      clusterId: string;
      label: string;
      hitCount: number;
      hitRate: number;
    }>;
    overallRate: number;
  };
  students: Array<{
    id: string;
    name: string;
    method: 'socratic' | 'fallback';
    goalReached: boolean;
    roundsUsed: number;
    timeUsedSeconds: number;
    completionType: 'goal_reached' | 'fallback_rounds' | 'fallback_time' | '';
    conversation: Array<{ role: 'ai' | 'student'; text: string }>;
    keyInsights: string[];
    clusterHits?: Array<{ id: string; label: string; hit: boolean }>;
  }>;
}
