import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { Lesson } from '../entities/lesson.entity';
import { ObservationService } from './observation/observation.service';
import { GradingService } from './exercise/grading.service';
import { OBSERVER_ENGINE, type ObserverEngine } from '@kedge-agentic/observer-engine';
import type { GradeResult } from '../schemas';
import { getCachedTaskMap } from './task-map.utils';

@Injectable()
export class StudentSubmissionService {
  private readonly logger = new Logger(StudentSubmissionService.name);

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    private readonly observationService: ObservationService,
    private readonly gradingService: GradingService,
    @Inject(OBSERVER_ENGINE) private readonly engine: ObserverEngine,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.studentRepo.manager.getRepository(Lesson);
  }

  async join(session: ClassroomSession, name: string) {
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

    this.observationService.addSystemEvent(
      session.id, saved.id, saved.name, 'join', {}, `${saved.name} 加入课堂`,
    );

    this.engine.dispatch({
      type: 'student_join',
      sessionId: session.id,
      entityId: saved.id,
      tenantId: session.lessonId,
      payload: { studentName: saved.name },
    }).catch(err => this.logger.error(`Observer dispatch student_join failed: ${err}`));

    return { studentId: saved.id, name: saved.name, lessonId: session.lessonId, _broadcast: true };
  }

  async submit(session: ClassroomSession, studentId: string, step: number, data: Record<string, unknown>) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    const score = await this.gradeSubmission(session.lessonId, step, data);

    const existing = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step },
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
        dataJson: data,
        scoreJson: score,
      });
      await this.submissionRepo.save(submission);
    }

    const taskMap = await getCachedTaskMap(session.lessonId, this.lessonRepo);
    const taskNum = taskMap.stepToTask[step];

    await this.observationService.addSystemEvent(
      session.id, studentId, student.name, 'exercise_result',
      { step, score: score?.total ?? null },
      `提交 Step ${step} 答案${score ? `，得分 ${score.total}%` : ''}`,
    );

    this.engine.dispatch({
      type: 'exercise_result',
      sessionId: session.id,
      entityId: studentId,
      tenantId: session.lessonId,
      payload: { step, score: score?.total ?? null },
    }).catch(err => this.logger.error(`Observer dispatch exercise_result failed: ${err}`));

    const currentTask = student.currentTask;
    if (taskNum !== undefined && currentTask > taskNum) {
      await this.observationService.addSystemEvent(
        session.id, studentId, student.name, 'step_complete',
        { step, taskNum, nextTask: currentTask },
        `完成 Task ${taskNum}，进入 Task ${currentTask}`,
      );

      this.engine.dispatch({
        type: 'step_complete',
        sessionId: session.id,
        entityId: studentId,
        tenantId: session.lessonId,
        payload: { step, taskNum, nextTask: currentTask },
      }).catch(err => this.logger.error(`Observer dispatch step_complete failed: ${err}`));
    }

    const exerciseCorrectRate = score?.total ?? 0;
    await this.observationService.observeTurn(
      session.id, studentId, student.name,
      { student: JSON.stringify(data), ai: `得分 ${exerciseCorrectRate}%` },
      { currentStep: `step-${step}`, exerciseCorrectRate, idleSeconds: 0 },
    ).catch(e => this.logger.warn(`Observation observeTurn after submit failed: ${e}`));

    this.engine.dispatch({
      type: 'chat_turn',
      sessionId: session.id,
      entityId: studentId,
      tenantId: session.lessonId,
      payload: { student: JSON.stringify(data), ai: `得分 ${exerciseCorrectRate}%`, step },
    }).catch(err => this.logger.error(`Observer dispatch chat_turn failed: ${err}`));

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

  async getProgress(session: ClassroomSession, studentId: string) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) return null;

    // Crash recovery: if student completed the exercise (score=100) for their
    // current task but currentPhase is still 'practice' or earlier (phaseIdx <= 1),
    // the browser likely crashed before reporting the next phase. Persist the fix
    // so teacher dashboard and subsequent getProgress calls see consistent state.
    const PHASE_ORDER = ['listen', 'practice', 'discuss', 'takeaway'];
    const phaseIdx = PHASE_ORDER.indexOf(student.currentPhase);
    if (phaseIdx !== -1 && phaseIdx <= 1) {
      const taskMap = await getCachedTaskMap(session.lessonId, this.lessonRepo);
      const stepIdx = taskMap.taskToStep[student.currentTask];
      if (stepIdx !== undefined) {
        const sub = await this.submissionRepo.findOne({
          where: { sessionId: session.id, studentId, step: stepIdx },
        });
        const score = sub?.scoreJson as GradeResult | null;
        if (score?.total === 100) {
          const nextTask = student.currentTask + 1;
          if (nextTask <= taskMap.maxTask) {
            student.currentTask = nextTask;
            student.currentPhase = 'listen';
          } else {
            student.currentPhase = 'completed';
          }
          student.stepStartedAt = new Date().toISOString();
          student.discussMeta = null;
          await this.studentRepo.save(student);
          return { currentTask: student.currentTask, currentPhase: student.currentPhase, discussMeta: null };
        }
      }
    }

    return { currentTask: student.currentTask, currentPhase: student.currentPhase, discussMeta: student.discussMeta ?? null };
  }

  async getSnapshot(session: ClassroomSession, studentId: string) {
    const progress = await this.getProgress(session, studentId);
    if (!progress) return null;

    const submissions = await this.submissionRepo.find({
      where: { sessionId: session.id, studentId },
    });
    const submissionMap: Record<number, { data: any; score: any }> = {};
    for (const sub of submissions) {
      submissionMap[sub.step] = {
        data: sub.dataJson,
        score: sub.scoreJson ?? null,
      };
    }

    return { progress, submissions: submissionMap };
  }

  async getSubmission(session: ClassroomSession, studentId: string, step: number) {
    const sub = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step },
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
