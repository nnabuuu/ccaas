import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DISCUSS_TARGET_HIT_REPO_PORT,
  type DiscussTargetHitRepoPort,
} from '../../domain/ports/discuss-target-hit-repo.port';
import type { ObservationState, ClusterStats, ClassifyResult } from '../../schemas/classroom/clustering';

interface TargetPointState {
  studentId: string;
  studentName: string;
  targetPointId: string;
  hit: boolean;
  evidenceSpans: string[];
  firstHitAt: number;
}

@Injectable()
export class ClusterAggregator {
  private readonly logger = new Logger(ClusterAggregator.name);
  private static readonly MAX_CLUSTER_EVIDENCE = 5;
  private static readonly MAX_TP_EVIDENCE = 3;
  // sessionId → taskNum → Map<`${studentId}:${clusterId}`, ObservationState>
  private sessions = new Map<string, Map<number, Map<string, ObservationState>>>();
  // `${sessionId}:${taskNum}:${studentId}` → boolean[] (true = new cluster hit)
  private missHistory = new Map<string, boolean[]>();
  // sessionId → taskNum → Map<`${studentId}:${tpId}`, TargetPointState>
  private targetPointSessions = new Map<string, Map<number, Map<string, TargetPointState>>>();

  constructor(
    @Inject(DISCUSS_TARGET_HIT_REPO_PORT) private readonly targetHitRepo: DiscussTargetHitRepoPort,
  ) {}

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
          if (existing.evidenceSpans.length > ClusterAggregator.MAX_CLUSTER_EVIDENCE) existing.evidenceSpans = existing.evidenceSpans.slice(-ClusterAggregator.MAX_CLUSTER_EVIDENCE);
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
          if (existing.evidenceSpans.length > ClusterAggregator.MAX_CLUSTER_EVIDENCE) existing.evidenceSpans = existing.evidenceSpans.slice(-ClusterAggregator.MAX_CLUSTER_EVIDENCE);
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

    // Ingest target point hits (binary: only high-confidence marks as hit)
    if (event.targetPointHits?.length) {
      const tpIndex = this.ensureTargetPointIndex(sessionId, taskNum);
      for (const hit of event.targetPointHits) {
        const tpKey = `${studentId}:${hit.targetPointId}`;
        const existing = tpIndex.get(tpKey);
        if (existing) {
          if (hit.confidence === 'high' && !existing.hit) {
            existing.hit = true;
            existing.firstHitAt = Date.now();
            this.persistTargetHit(sessionId, studentId, studentName, taskNum, hit);
          }
          if (hit.confidence === 'high' && existing.evidenceSpans.length < ClusterAggregator.MAX_TP_EVIDENCE) {
            existing.evidenceSpans.push(hit.evidenceSpan);
          }
        } else {
          tpIndex.set(tpKey, {
            studentId,
            studentName,
            targetPointId: hit.targetPointId,
            hit: hit.confidence === 'high',
            evidenceSpans: hit.evidenceSpan ? [hit.evidenceSpan] : [],
            firstHitAt: hit.confidence === 'high' ? Date.now() : 0,
          });
          if (hit.confidence === 'high') {
            this.persistTargetHit(sessionId, studentId, studentName, taskNum, hit);
          }
        }
      }
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

  getStudentTargetPoints(
    sessionId: string,
    taskNum: number,
    studentId: string,
    defs: Array<{ id: string; label: string }>,
  ): Array<{ id: string; label: string; hit: boolean }> {
    const index = this.targetPointSessions.get(sessionId)?.get(taskNum);
    return defs.map(tp => ({
      id: tp.id,
      label: tp.label,
      hit: !!index?.get(`${studentId}:${tp.id}`)?.hit,
    }));
  }

  getTargetPointStats(
    sessionId: string,
    taskNum: number,
  ): Array<{ targetPointId: string; uniqueStudents: number; students: Array<{ studentId: string; studentName: string }> }> {
    const index = this.targetPointSessions.get(sessionId)?.get(taskNum);
    if (!index) return [];

    const byTp = new Map<string, Array<{ studentId: string; studentName: string }>>();
    for (const state of index.values()) {
      if (!state.hit) continue;
      const list = byTp.get(state.targetPointId) || [];
      if (!list.some(s => s.studentId === state.studentId)) {
        list.push({ studentId: state.studentId, studentName: state.studentName });
      }
      byTp.set(state.targetPointId, list);
    }

    return [...byTp.entries()].map(([targetPointId, students]) => ({
      targetPointId,
      uniqueStudents: students.length,
      students,
    }));
  }

  /** Restore target point hits from DB if not already in memory. */
  async restoreIfNeeded(sessionId: string): Promise<void> {
    if (this.targetPointSessions.has(sessionId)) return;
    const rows = await this.targetHitRepo.findBySession(sessionId);
    if (rows.length === 0) return;

    for (const row of rows) {
      const index = this.ensureTargetPointIndex(sessionId, row.taskNum);
      const key = `${row.studentId}:${row.targetPointId}`;
      if (!index.has(key)) {
        index.set(key, {
          studentId: row.studentId,
          studentName: row.studentName,
          targetPointId: row.targetPointId,
          hit: true,
          evidenceSpans: row.evidenceSpan ? [row.evidenceSpan] : [],
          firstHitAt: Number(row.hitAt),
        });
      }
    }
  }

  cleanupSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.targetPointSessions.delete(sessionId);
    const prefix = `${sessionId}:`;
    const toDelete = [...this.missHistory.keys()].filter(k => k.startsWith(prefix));
    for (const key of toDelete) this.missHistory.delete(key);
  }

  private ensureTargetPointIndex(
    sessionId: string,
    taskNum: number,
  ): Map<string, TargetPointState> {
    if (!this.targetPointSessions.has(sessionId)) {
      this.targetPointSessions.set(sessionId, new Map());
    }
    const taskMap = this.targetPointSessions.get(sessionId)!;
    if (!taskMap.has(taskNum)) {
      taskMap.set(taskNum, new Map());
    }
    return taskMap.get(taskNum)!;
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

  private persistTargetHit(
    sessionId: string, studentId: string, studentName: string,
    taskNum: number, hit: { targetPointId: string; evidenceSpan: string },
  ): void {
    this.targetHitRepo.upsertHit({
      sessionId, studentId, studentName, taskNum,
      targetPointId: hit.targetPointId,
      evidenceSpan: hit.evidenceSpan || '',
      hitAt: Date.now(),
    }).catch(e => this.logger.warn('Failed to persist target hit', e));
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
