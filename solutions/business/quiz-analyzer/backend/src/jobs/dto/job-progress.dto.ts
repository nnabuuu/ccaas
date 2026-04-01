import type { SyncField } from '../../../../mcp-server/src/common/types';

export interface StepProgress {
  field: SyncField;
  status: 'pending' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
}

export interface JobProgressDto {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalSteps: number;
  completedSteps: number;
  steps: StepProgress[];
}
