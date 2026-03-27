import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { DATABASE_TOKEN } from '../database/database.module';
import { SseService } from '../sse/sse.service';
import {
  EvaluatorService,
  T1Evaluation,
  T2Evaluation,
  WritingEvaluation,
} from '../evaluator/evaluator.service';
import { DUMMY_REPLIES } from '../content/dummy-replies';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @Inject(DATABASE_TOKEN) private db: Database.Database,
    private sseService: SseService,
    private evaluatorService: EvaluatorService,
  ) {}

  // ─── Scene management ───

  updateScene(studentSessionId: string, sceneIdx: number) {
    const student = this.getStudentSession(studentSessionId);
    this.db
      .prepare('UPDATE student_sessions SET current_scene_idx = ? WHERE id = ?')
      .run(sceneIdx, studentSessionId);

    // Emit to teacher
    this.sseService.emitToTeachers(student.class_session_id, 'scene_changed', {
      studentSessionId,
      studentName: student.student_name,
      sceneIdx,
    });

    return { ...student, current_scene_idx: sceneIdx };
  }

  // ─── T1 artifacts ───

  saveT1(studentSessionId: string, highlights: Record<string, string>) {
    this.getStudentSession(studentSessionId); // validate exists
    const json = JSON.stringify(highlights);

    const existing = this.db
      .prepare('SELECT student_session_id FROM t1_artifacts WHERE student_session_id = ?')
      .get(studentSessionId);

    if (existing) {
      this.db
        .prepare('UPDATE t1_artifacts SET highlights = ? WHERE student_session_id = ?')
        .run(json, studentSessionId);
    } else {
      this.db
        .prepare('INSERT INTO t1_artifacts (student_session_id, highlights) VALUES (?, ?)')
        .run(studentSessionId, json);
    }

    return { studentSessionId, highlights };
  }

  async evaluateT1(studentSessionId: string): Promise<T1Evaluation> {
    const student = this.getStudentSession(studentSessionId);
    const artifact = this.db
      .prepare('SELECT * FROM t1_artifacts WHERE student_session_id = ?')
      .get(studentSessionId) as any;

    if (!artifact || !artifact.highlights) {
      throw new NotFoundException('No T1 highlights found');
    }

    const highlights = JSON.parse(artifact.highlights);
    const evaluation = await this.evaluatorService.evaluateT1(
      studentSessionId,
      highlights,
    );

    // Store evaluation
    this.db
      .prepare(
        `UPDATE t1_artifacts
         SET evaluation = ?, submitted_at = datetime('now')
         WHERE student_session_id = ?`,
      )
      .run(JSON.stringify(evaluation), studentSessionId);

    // Emit to teacher
    this.sseService.emitToTeachers(student.class_session_id, 't1_submitted', {
      studentSessionId,
      studentName: student.student_name,
      evaluation,
    });

    return evaluation;
  }

  // ─── T2 artifacts ───

  saveT2(studentSessionId: string, pickedTransitions: string[]) {
    this.getStudentSession(studentSessionId);
    const json = JSON.stringify(pickedTransitions);

    const existing = this.db
      .prepare('SELECT student_session_id FROM t2_artifacts WHERE student_session_id = ?')
      .get(studentSessionId);

    if (existing) {
      this.db
        .prepare(
          'UPDATE t2_artifacts SET picked_transitions = ? WHERE student_session_id = ?',
        )
        .run(json, studentSessionId);
    } else {
      this.db
        .prepare(
          'INSERT INTO t2_artifacts (student_session_id, picked_transitions) VALUES (?, ?)',
        )
        .run(studentSessionId, json);
    }

    return { studentSessionId, pickedTransitions };
  }

  async evaluateT2(studentSessionId: string): Promise<T2Evaluation> {
    const student = this.getStudentSession(studentSessionId);
    const artifact = this.db
      .prepare('SELECT * FROM t2_artifacts WHERE student_session_id = ?')
      .get(studentSessionId) as any;

    if (!artifact || !artifact.picked_transitions) {
      throw new NotFoundException('No T2 transitions found');
    }

    const transitions = JSON.parse(artifact.picked_transitions);
    const evaluation = await this.evaluatorService.evaluateT2(
      studentSessionId,
      transitions,
    );

    this.db
      .prepare(
        `UPDATE t2_artifacts
         SET evaluation = ?, submitted_at = datetime('now')
         WHERE student_session_id = ?`,
      )
      .run(JSON.stringify(evaluation), studentSessionId);

    this.sseService.emitToTeachers(student.class_session_id, 't2_submitted', {
      studentSessionId,
      studentName: student.student_name,
      evaluation,
    });

    return evaluation;
  }

  // ─── Writing versions ───

  getVersions(studentSessionId: string) {
    this.getStudentSession(studentSessionId);
    const versions = this.db
      .prepare(
        `SELECT * FROM writing_versions
         WHERE student_session_id = ?
         ORDER BY version_number ASC`,
      )
      .all(studentSessionId) as any[];

    return versions.map((v) => ({
      ...v,
      evaluation: v.evaluation ? JSON.parse(v.evaluation) : null,
    }));
  }

  createVersion(
    studentSessionId: string,
    text: string,
    sceneId: 'T3' | 'T4',
  ) {
    const student = this.getStudentSession(studentSessionId);
    const id = uuid();
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    // Auto-increment version_number
    const latest = this.db
      .prepare(
        `SELECT MAX(version_number) as max_ver FROM writing_versions
         WHERE student_session_id = ?`,
      )
      .get(studentSessionId) as any;
    const versionNumber = (latest?.max_ver || 0) + 1;

    this.db
      .prepare(
        `INSERT INTO writing_versions (id, student_session_id, version_number, text, word_count, scene_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, studentSessionId, versionNumber, text, wordCount, sceneId);

    const version = this.db
      .prepare('SELECT * FROM writing_versions WHERE id = ?')
      .get(id) as any;

    this.sseService.emitToTeachers(student.class_session_id, 'version_created', {
      studentSessionId,
      studentName: student.student_name,
      version: { ...version, evaluation: null },
    });

    return { ...version, evaluation: null };
  }

  async evaluateVersion(
    studentSessionId: string,
    versionId: string,
  ): Promise<WritingEvaluation> {
    const student = this.getStudentSession(studentSessionId);
    const version = this.db
      .prepare(
        'SELECT * FROM writing_versions WHERE id = ? AND student_session_id = ?',
      )
      .get(versionId, studentSessionId) as any;

    if (!version) throw new NotFoundException('Version not found');

    // Get previous version for comparison
    let prevContext: { text: string; versionNumber: number; evaluation?: WritingEvaluation } | undefined;
    if (version.version_number > 1) {
      const prev = this.db
        .prepare(
          `SELECT * FROM writing_versions
           WHERE student_session_id = ? AND version_number = ?`,
        )
        .get(studentSessionId, version.version_number - 1) as any;
      if (prev) {
        prevContext = {
          text: prev.text,
          versionNumber: prev.version_number,
          evaluation: prev.evaluation ? JSON.parse(prev.evaluation) : undefined,
        };
      }
    }

    const evaluation = await this.evaluatorService.evaluateWriting(
      studentSessionId,
      version.text,
      prevContext,
    );

    // Ensure wordCount from actual text
    evaluation.wordCount = version.word_count;

    this.db
      .prepare('UPDATE writing_versions SET evaluation = ? WHERE id = ?')
      .run(JSON.stringify(evaluation), versionId);

    this.sseService.emitToTeachers(
      student.class_session_id,
      'version_evaluated',
      {
        studentSessionId,
        studentName: student.student_name,
        versionId,
        evaluation,
      },
    );

    return evaluation;
  }

  // ─── Help messages ───

  getHelpMessages(studentSessionId: string) {
    this.getStudentSession(studentSessionId);
    return this.db
      .prepare(
        `SELECT * FROM help_messages
         WHERE student_session_id = ?
         ORDER BY created_at ASC`,
      )
      .all(studentSessionId);
  }

  async sendHelpMessage(
    studentSessionId: string,
    content: string,
    sceneId: string,
  ): Promise<{ userMessage: any; assistantMessage: any }> {
    const student = this.getStudentSession(studentSessionId);

    // Store user message
    const userMsgId = uuid();
    this.db
      .prepare(
        `INSERT INTO help_messages (id, student_session_id, scene_id, role, content, is_dummy_reply)
         VALUES (?, ?, ?, 'user', ?, 0)`,
      )
      .run(userMsgId, studentSessionId, sceneId, content);

    const userMessage = this.db
      .prepare('SELECT * FROM help_messages WHERE id = ?')
      .get(userMsgId);

    // Check dummy replies first (exact match)
    const dummyReply = DUMMY_REPLIES[content.trim()];
    let reply: string;
    let isDummy: boolean;

    if (dummyReply) {
      reply = dummyReply;
      isDummy = true;
    } else {
      // Get conversation history for CCAAS context
      const history = this.db
        .prepare(
          `SELECT role, content FROM help_messages
           WHERE student_session_id = ? AND role IN ('user', 'assistant')
           ORDER BY created_at ASC`,
        )
        .all(studentSessionId) as { role: 'user' | 'assistant'; content: string }[];

      reply = await this.evaluatorService.helpChat(
        studentSessionId,
        content,
        sceneId,
        history,
      );
      isDummy = false;
    }

    // Store assistant message
    const assistantMsgId = uuid();
    this.db
      .prepare(
        `INSERT INTO help_messages (id, student_session_id, scene_id, role, content, is_dummy_reply)
         VALUES (?, ?, ?, 'assistant', ?, ?)`,
      )
      .run(assistantMsgId, studentSessionId, sceneId, reply, isDummy ? 1 : 0);

    const assistantMessage = this.db
      .prepare('SELECT * FROM help_messages WHERE id = ?')
      .get(assistantMsgId);

    // Emit to teacher
    this.sseService.emitToTeachers(student.class_session_id, 'help_message', {
      studentSessionId,
      studentName: student.student_name,
      sceneId,
      question: content,
      isDummy,
    });

    return { userMessage, assistantMessage };
  }

  // ─── Helpers ───

  private getStudentSession(studentSessionId: string) {
    const student = this.db
      .prepare('SELECT * FROM student_sessions WHERE id = ?')
      .get(studentSessionId) as any;
    if (!student) throw new NotFoundException('Student session not found');
    return student;
  }
}
