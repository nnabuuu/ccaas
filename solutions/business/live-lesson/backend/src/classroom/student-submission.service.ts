import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { Lesson } from '../entities/lesson.entity';
import { GradingService } from './exercise/grading.service';
import { OBSERVER_ENGINE, type ObserverEngine } from '@kedge-agentic/observer-engine';
import type { GradeResult } from '../schemas';
import { getCachedTaskMap } from './task-map.utils';
import type { JoinResponse, SubmitResponse, SubmissionResponse, StudentProgressResponse } from '../schemas/classroom';

@Injectable()
export class StudentSubmissionService {
  private readonly logger = new Logger(StudentSubmissionService.name);

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    private readonly gradingService: GradingService,
    @Inject(OBSERVER_ENGINE) private readonly engine: ObserverEngine,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.studentRepo.manager.getRepository(Lesson);
  }

  async join(session: ClassroomSession, name: string): Promise<JoinResponse> {
    const existing = await this.studentRepo.findOne({
      where: { sessionId: session.id, name },
    });
    if (existing) {
      return { studentId: existing.id, name: existing.name, lessonId: session.lessonId, _broadcast: true };
    }

    const student = this.studentRepo.create({
      sessionId: session.id,
      lessonId: session.lessonId,
      name,
    });
    const saved = await this.studentRepo.save(student);

    this.engine.dispatch({
      type: 'student_join',
      sessionId: session.id,
      entityId: saved.id,
      tenantId: session.lessonId,
      payload: { studentName: saved.name },
    }).catch(err => this.logger.error(`Observer dispatch student_join failed: ${err}`));

    return { studentId: saved.id, name: saved.name, lessonId: session.lessonId, _broadcast: true };
  }

  async submit(session: ClassroomSession, studentId: string, step: number, data: Record<string, unknown>): Promise<SubmitResponse> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    const phase = data?.phase === 'discuss' ? 'discuss' : 'exercise';
    const score = phase === 'exercise'
      ? await this.gradeSubmission(session.lessonId, step, data)
      : null;

    const existing = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step, phase },
    });
    if (existing) {
      existing.dataJson = data;
      existing.scoreJson = score;
      await this.submissionRepo.save(existing);
    } else {
      const submission = this.submissionRepo.create({
        sessionId: session.id,
        lessonId: session.lessonId,
        studentId,
        step,
        phase,
        dataJson: data,
        scoreJson: score,
      });
      await this.submissionRepo.save(submission);
    }

    // Observation events only for exercise submissions — discuss has its own events in DiscussService
    if (phase === 'exercise') {
      const taskMap = await getCachedTaskMap(session.lessonId, this.lessonRepo);
      const taskNum = taskMap.stepToTask[step];

      this.engine.dispatch({
        type: 'exercise_result',
        sessionId: session.id,
        entityId: studentId,
        tenantId: session.lessonId,
        payload: { step, score: score?.total ?? null },
      }).catch(err => this.logger.error(`Observer dispatch exercise_result failed: ${err}`));

      const currentTask = student.currentTask;
      if (taskNum !== undefined && currentTask > taskNum) {
        this.engine.dispatch({
          type: 'step_complete',
          sessionId: session.id,
          entityId: studentId,
          tenantId: session.lessonId,
          payload: { step, taskNum, nextTask: currentTask },
        }).catch(err => this.logger.error(`Observer dispatch step_complete failed: ${err}`));
      }

      const exerciseCorrectRate = score?.total ?? 0;
      this.engine.dispatch({
        type: 'chat_turn',
        sessionId: session.id,
        entityId: studentId,
        tenantId: session.lessonId,
        payload: { student: JSON.stringify(data), ai: `得分 ${exerciseCorrectRate}%`, step },
      }).catch(err => this.logger.error(`Observer dispatch chat_turn failed: ${err}`));

      // Auto-advance: if advanceOn === 'submit' and score is 100%, advance to discuss
      if (score?.total === 100 && taskMap.advanceOn[step] === 'submit' && taskNum !== undefined) {
        await this.updatePhase(session, studentId, taskNum, 'discuss');
        const updated = await this.studentRepo.findOne({ where: { id: studentId, sessionId: session.id } });
        return { ok: true, score, currentTask: updated?.currentTask ?? taskNum, currentPhase: updated?.currentPhase ?? 'discuss' };
      }
    }

    return { ok: true, score, currentTask: student.currentTask, currentPhase: student.currentPhase };
  }

  private static readonly PHASE_RANK: Record<string, number> = { listen: 0, practice: 1, discuss: 2, takeaway: 3, completed: 4 };

  async updatePhase(session: ClassroomSession, studentId: string, task: number, phase: string) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }
    const oldRank = (student.currentTask * 10) + (StudentSubmissionService.PHASE_RANK[student.currentPhase] ?? 0);
    const newRank = (task * 10) + (StudentSubmissionService.PHASE_RANK[phase] ?? 0);
    if (newRank <= oldRank) return;
    const taskChanged = student.currentTask !== task;
    student.currentTask = task;
    student.currentPhase = phase;
    if (taskChanged) {
      student.stepStartedAt = new Date().toISOString();
      student.discussMeta = null;
    }
    await this.studentRepo.save(student);
  }

  async getProgress(session: ClassroomSession, studentId: string, includeSubmissions?: boolean): Promise<StudentProgressResponse | null> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) return null;

    const result: StudentProgressResponse = { currentTask: student.currentTask, currentPhase: student.currentPhase, discussMeta: student.discussMeta ?? null };
    if (includeSubmissions) {
      result.submissions = await this.buildSubmissionMap(session.id, studentId);
    }
    return result;
  }

  private async buildSubmissionMap(sessionId: string, studentId: string): Promise<Record<number, { data: unknown; score: GradeResult | null }>> {
    const submissions = await this.submissionRepo.find({
      where: { sessionId, studentId, phase: 'exercise' },
    });
    const map: Record<number, { data: unknown; score: GradeResult | null }> = {};
    for (const sub of submissions) {
      map[sub.step] = { data: sub.dataJson, score: (sub.scoreJson as GradeResult) ?? null };
    }
    return map;
  }

  async getSubmission(session: ClassroomSession, studentId: string, step: number): Promise<SubmissionResponse | null> {
    const sub = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step, phase: 'exercise' },
    });
    if (!sub) return null;
    return {
      data: sub.dataJson,
      score: sub.scoreJson ?? null,
      submittedAt: sub.submittedAt instanceof Date
        ? sub.submittedAt.toISOString()
        : String(sub.submittedAt),
    };
  }

  private async gradeSubmission(lessonId: string, step: number, data: Record<string, unknown>): Promise<GradeResult | null> {
    try {
      const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
      if (!lesson) return null;

      const manifest = JSON.parse(lesson.manifestJson);
      const readingSteps = manifest.readingSteps || [];

      const stepDef = readingSteps.find((s: any) => s.idx === step);
      if (!stepDef || !stepDef.answerKey) return null;

      return await this.gradingService.grade(stepDef.answerKey, data);
    } catch (e) {
      this.logger.warn(`Grading failed for step ${step}: ${e}`);
      return null;
    }
  }
}
