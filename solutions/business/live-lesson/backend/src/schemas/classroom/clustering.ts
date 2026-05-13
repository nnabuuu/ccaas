/** Clustering types (from cluster-aggregator + cluster-classifier) */

export interface ObservationState {
  studentId: string;
  studentName: string;
  clusterId: string;
  status: 'active' | 'resolved';
  evidenceSpans: string[];
  isHighlight: boolean;
  highlightGist?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ClusterStats {
  clusterId: string;
  observationCount: number;
  uniqueStudents: number;
  activeCount: number;
  resolvedCount: number;
  observations: ObservationState[];
}

export interface ClassifyResult {
  clusterId: string;
  confidence: 'high' | 'medium' | 'low';
  evidenceSpan: string;
  eventType: 'new_signal' | 'reinforcing' | 'state_change';
  isHighlight: boolean;
  highlightGist?: string;
}
