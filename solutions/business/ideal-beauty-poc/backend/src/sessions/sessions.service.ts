import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { DATABASE_TOKEN } from '../database/database.module';
import { SseService } from '../sse/sse.service';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: Database.Database,
    private sseService: SseService,
  ) {}

  createSession(teacherId: string) {
    const id = uuid();
    const sessionCode = this.generateSessionCode();

    this.db
      .prepare(
        `INSERT INTO class_sessions (id, teacher_id, session_code, status)
         VALUES (?, ?, ?, 'waiting')`,
      )
      .run(id, teacherId, sessionCode);

    return this.getSession(id);
  }

  getSession(id: string) {
    const session = this.db
      .prepare('SELECT * FROM class_sessions WHERE id = ?')
      .get(id) as any;
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  getSessionByCode(code: string) {
    const session = this.db
      .prepare(
        `SELECT * FROM class_sessions WHERE session_code = ? AND status != 'ended'`,
      )
      .get(code) as any;
    if (!session) throw new NotFoundException('Session not found or ended');
    return session;
  }

  joinSession(sessionId: string, studentId: string, studentName: string) {
    const session = this.getSession(sessionId);
    if (session.status === 'ended') {
      throw new NotFoundException('Session has ended');
    }

    // Activate session if waiting
    if (session.status === 'waiting') {
      this.db
        .prepare(`UPDATE class_sessions SET status = 'active' WHERE id = ?`)
        .run(sessionId);
    }

    // Upsert student session
    const existing = this.db
      .prepare(
        `SELECT id FROM student_sessions
         WHERE class_session_id = ? AND student_id = ?`,
      )
      .get(sessionId, studentId) as any;

    let studentSessionId: string;
    if (existing) {
      studentSessionId = existing.id;
      // Update name in case it changed
      this.db
        .prepare('UPDATE student_sessions SET student_name = ? WHERE id = ?')
        .run(studentName, studentSessionId);
    } else {
      studentSessionId = uuid();
      this.db
        .prepare(
          `INSERT INTO student_sessions (id, class_session_id, student_id, student_name)
           VALUES (?, ?, ?, ?)`,
        )
        .run(studentSessionId, sessionId, studentId, studentName);
    }

    const studentSession = this.db
      .prepare('SELECT * FROM student_sessions WHERE id = ?')
      .get(studentSessionId);

    // Emit SSE to teacher
    this.sseService.emitToTeachers(sessionId, 'student_joined', {
      studentSession,
    });

    return studentSession;
  }

  endSession(sessionId: string) {
    this.db
      .prepare(
        `UPDATE class_sessions SET status = 'ended', ended_at = datetime('now')
         WHERE id = ?`,
      )
      .run(sessionId);
    return this.getSession(sessionId);
  }

  getStudentsWithProgress(sessionId: string) {
    const students = this.db
      .prepare(
        `SELECT ss.*,
           t1.highlights AS t1_highlights,
           t1.evaluation AS t1_evaluation,
           t1.submitted_at AS t1_submitted_at,
           t2.picked_transitions AS t2_picked_transitions,
           t2.evaluation AS t2_evaluation,
           t2.submitted_at AS t2_submitted_at
         FROM student_sessions ss
         LEFT JOIN t1_artifacts t1 ON t1.student_session_id = ss.id
         LEFT JOIN t2_artifacts t2 ON t2.student_session_id = ss.id
         WHERE ss.class_session_id = ?
         ORDER BY ss.joined_at`,
      )
      .all(sessionId) as any[];

    // Attach latest writing version for each student
    return students.map((s) => {
      const latestVersion = this.db
        .prepare(
          `SELECT * FROM writing_versions
           WHERE student_session_id = ?
           ORDER BY version_number DESC LIMIT 1`,
        )
        .get(s.id) as any;

      const versionCount = this.db
        .prepare(
          'SELECT COUNT(*) as count FROM writing_versions WHERE student_session_id = ?',
        )
        .get(s.id) as any;

      return {
        ...s,
        t1_highlights: s.t1_highlights ? JSON.parse(s.t1_highlights) : null,
        t1_evaluation: s.t1_evaluation ? JSON.parse(s.t1_evaluation) : null,
        t2_picked_transitions: s.t2_picked_transitions
          ? JSON.parse(s.t2_picked_transitions)
          : null,
        t2_evaluation: s.t2_evaluation ? JSON.parse(s.t2_evaluation) : null,
        latest_version: latestVersion
          ? {
              ...latestVersion,
              evaluation: latestVersion.evaluation
                ? JSON.parse(latestVersion.evaluation)
                : null,
            }
          : null,
        version_count: versionCount?.count || 0,
      };
    });
  }

  broadcast(
    sessionId: string,
    body: {
      studentSessionId: string;
      artifactType: 'writing' | 't1' | 't2';
      versionId?: string;
    },
  ) {
    let broadcastData: any = { artifactType: body.artifactType };

    const student = this.db
      .prepare('SELECT * FROM student_sessions WHERE id = ?')
      .get(body.studentSessionId) as any;
    if (!student) throw new NotFoundException('Student session not found');

    broadcastData.studentName = student.student_name;

    if (body.artifactType === 'writing' && body.versionId) {
      const version = this.db
        .prepare('SELECT * FROM writing_versions WHERE id = ?')
        .get(body.versionId) as any;
      if (version) {
        broadcastData.version = {
          ...version,
          evaluation: version.evaluation
            ? JSON.parse(version.evaluation)
            : null,
        };
      }
    } else if (body.artifactType === 't1') {
      const artifact = this.db
        .prepare('SELECT * FROM t1_artifacts WHERE student_session_id = ?')
        .get(body.studentSessionId) as any;
      if (artifact) {
        broadcastData.artifact = {
          highlights: artifact.highlights
            ? JSON.parse(artifact.highlights)
            : null,
          evaluation: artifact.evaluation
            ? JSON.parse(artifact.evaluation)
            : null,
        };
      }
    } else if (body.artifactType === 't2') {
      const artifact = this.db
        .prepare('SELECT * FROM t2_artifacts WHERE student_session_id = ?')
        .get(body.studentSessionId) as any;
      if (artifact) {
        broadcastData.artifact = {
          pickedTransitions: artifact.picked_transitions
            ? JSON.parse(artifact.picked_transitions)
            : null,
          evaluation: artifact.evaluation
            ? JSON.parse(artifact.evaluation)
            : null,
        };
      }
    }

    // Emit to all students
    this.sseService.emitToAllStudents(sessionId, 'broadcast_start', broadcastData);

    return broadcastData;
  }

  endBroadcast(sessionId: string) {
    this.sseService.emitToAllStudents(sessionId, 'broadcast_end', {});
  }

  getInsights(sessionId: string, sceneId: string) {
    // Data-driven insights from actual student data
    const students = this.getStudentsWithProgress(sessionId);
    const total = students.length;

    if (total === 0) {
      return { sceneId, summary: 'No students have joined yet.', details: {} };
    }

    const atScene = students.filter(
      (s) => this.sceneIdForIdx(s.current_scene_idx) === sceneId,
    ).length;

    let details: any = { totalStudents: total, atScene };

    switch (sceneId) {
      case 'T1': {
        const submitted = students.filter((s) => s.t1_evaluation).length;
        details.submitted = submitted;
        details.pending = total - submitted;
        break;
      }
      case 'T2': {
        const submitted = students.filter((s) => s.t2_evaluation).length;
        details.submitted = submitted;
        details.pending = total - submitted;
        break;
      }
      case 'T3':
      case 'T4': {
        const withVersions = students.filter((s) => s.version_count > 0).length;
        const withEval = students.filter(
          (s) => s.latest_version?.evaluation,
        ).length;
        details.withVersions = withVersions;
        details.withEvaluation = withEval;
        break;
      }
    }

    return { sceneId, summary: `${atScene}/${total} students at ${sceneId}`, details };
  }

  private sceneIdForIdx(idx: number): string {
    const scenes = ['L1', 'T1', 'L2', 'T2', 'L3', 'T3', 'T4'];
    return scenes[idx] || 'L1';
  }

  private generateSessionCode(): string {
    // 6-digit numeric code, check uniqueness against active sessions
    for (let i = 0; i < 100; i++) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const existing = this.db
        .prepare(
          `SELECT id FROM class_sessions WHERE session_code = ? AND status != 'ended'`,
        )
        .get(code);
      if (!existing) return code;
    }
    // Fallback: use timestamp-based
    return String(Date.now()).slice(-6);
  }
}
