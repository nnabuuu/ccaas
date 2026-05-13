import { Injectable } from '@nestjs/common';
import type { ObservationState, ClusterStats, ClassifyResult } from '../../schemas/classroom/clustering';

@Injectable()
export class ClusterAggregator {
  // sessionId → taskNum → Map<`${studentId}:${clusterId}`, ObservationState>
  private sessions = new Map<string, Map<number, Map<string, ObservationState>>>();
  // `${sessionId}:${taskNum}:${studentId}` → boolean[] (true = new cluster hit)
  private missHistory = new Map<string, boolean[]>();

  ingest(
    sessionId: string,
    taskNum: number,
    studentId: string,
    studentName: string,
    event: ClassifyResult,
  ): void {
    const effectiveClusterId =
      event.confidence === 'high' ? event.clusterId : 'other';

    const index = this.ensureIndex(sessionId, taskNum);
    const key = `${studentId}:${effectiveClusterId}`;
    const existing = index.get(key);

    switch (event.eventType) {
      case 'new_signal':
        if (!existing) {
          index.set(key, {
            studentId,
            studentName,
            clusterId: effectiveClusterId,
            status: 'active',
            evidenceSpans: [event.evidenceSpan],
            isHighlight: event.isHighlight,
            highlightGist: event.highlightGist,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        } else {
          existing.evidenceSpans.push(event.evidenceSpan);
          if (existing.evidenceSpans.length > 5) existing.evidenceSpans = existing.evidenceSpans.slice(-5);
          if (event.isHighlight) {
            existing.isHighlight = true;
            existing.highlightGist = event.highlightGist ?? existing.highlightGist;
          }
          existing.updatedAt = Date.now();
        }
        break;

      case 'reinforcing':
        if (existing) {
          existing.evidenceSpans.push(event.evidenceSpan);
          if (existing.evidenceSpans.length > 5) existing.evidenceSpans = existing.evidenceSpans.slice(-5);
          if (event.isHighlight) {
            existing.isHighlight = true;
            existing.highlightGist = event.highlightGist ?? existing.highlightGist;
          }
          existing.updatedAt = Date.now();
        } else {
          // LLM said reinforcing but no prior record — treat as new_signal
          index.set(key, {
            studentId,
            studentName,
            clusterId: effectiveClusterId,
            status: 'active',
            evidenceSpans: [event.evidenceSpan],
            isHighlight: event.isHighlight,
            highlightGist: event.highlightGist,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
        break;

      case 'state_change':
        this.handleStateChange(
          index,
          studentId,
          studentName,
          effectiveClusterId,
          event,
        );
        break;
    }
  }

  getClusterStats(sessionId: string, taskNum: number): ClusterStats[] {
    const index = this.sessions.get(sessionId)?.get(taskNum);
    if (!index) return [];

    const byClusters = new Map<string, ObservationState[]>();
    for (const obs of index.values()) {
      const list = byClusters.get(obs.clusterId) || [];
      list.push(obs);
      byClusters.set(obs.clusterId, list);
    }

    return [...byClusters.entries()].map(([clusterId, observations]) => ({
      clusterId,
      observationCount: observations.length,
      uniqueStudents: new Set(observations.map(o => o.studentId)).size,
      activeCount: observations.filter(o => o.status === 'active').length,
      resolvedCount: observations.filter(o => o.status === 'resolved').length,
      observations,
    }));
  }

  /**
   * Returns per-student cluster hit status for the discuss progress tracker.
   * `clusterDefs` supplies the full list from manifest so unhit clusters appear too.
   */
  getStudentClusters(
    sessionId: string,
    taskNum: number,
    studentId: string,
    clusterDefs: Array<{ id: string; label: string }>,
  ): Array<{ id: string; label: string; hit: boolean }> {
    const index = this.sessions.get(sessionId)?.get(taskNum);
    return clusterDefs.map(c => ({
      id: c.id,
      label: c.label,
      hit: !!index?.has(`${studentId}:${c.id}`),
    }));
  }

  recordHit(sessionId: string, taskNum: number, studentId: string, isNewSignal: boolean): void {
    const key = `${sessionId}:${taskNum}:${studentId}`;
    const history = this.missHistory.get(key) || [];
    history.push(isNewSignal);
    if (history.length > 20) history.shift();
    this.missHistory.set(key, history);
  }

  getConsecutiveMisses(sessionId: string, taskNum: number, studentId: string): number {
    const key = `${sessionId}:${taskNum}:${studentId}`;
    const history = this.missHistory.get(key) || [];
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (!history[i]) count++;
      else break;
    }
    return count;
  }

  /**
   * Returns cluster IDs this student has NOT yet hit.
   */
  getUnhitClusterIds(
    sessionId: string,
    taskNum: number,
    studentId: string,
    clusterDefs: Array<{ id: string; label: string; description?: string }>,
  ): Array<{ id: string; label: string; description?: string }> {
    const index = this.sessions.get(sessionId)?.get(taskNum);
    return clusterDefs.filter(c => !index?.has(`${studentId}:${c.id}`));
  }

  cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    const prefix = `${sessionId}:`;
    const toDelete = [...this.missHistory.keys()].filter(k => k.startsWith(prefix));
    for (const key of toDelete) this.missHistory.delete(key);
  }

  private ensureIndex(
    sessionId: string,
    taskNum: number,
  ): Map<string, ObservationState> {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Map());
    }
    const taskMap = this.sessions.get(sessionId)!;
    if (!taskMap.has(taskNum)) {
      taskMap.set(taskNum, new Map());
    }
    return taskMap.get(taskNum)!;
  }

  private handleStateChange(
    index: Map<string, ObservationState>,
    studentId: string,
    studentName: string,
    newClusterId: string,
    event: ClassifyResult,
  ): void {
    const STATE_CHANGE_WINDOW_MS = 2 * 60 * 1000;

    for (const [, obs] of index.entries()) {
      if (obs.studentId !== studentId || obs.status !== 'active') continue;

      if (obs.clusterId === newClusterId) {
        obs.status = 'resolved';
        obs.updatedAt = Date.now();
      } else if (Date.now() - obs.updatedAt < STATE_CHANGE_WINDOW_MS) {
        obs.status = 'resolved';
        obs.updatedAt = Date.now();
      }
    }

    const newKey = `${studentId}:${newClusterId}`;
    if (!index.has(newKey)) {
      index.set(newKey, {
        studentId,
        studentName,
        clusterId: newClusterId,
        status: 'active',
        evidenceSpans: [event.evidenceSpan],
        isHighlight: event.isHighlight,
        highlightGist: event.highlightGist,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }
}
