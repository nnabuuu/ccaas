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
    if (taskNum !== undefined && taskNum <= student.currentTask) {
      const isComplete = !score || score.total === 100;
      if (isComplete) {
        const nextTask = taskNum + 1;
        if (nextTask <= taskMap.maxTask && (student.currentTask === taskNum)) {
          student.currentTask = nextTask;
          student.currentPhase = 'listen';
          student.stepStartedAt = new Date().toISOString();
        } else if (student.currentTask === taskNum) {
          student.currentTask = taskNum;
          student.currentPhase = 'completed';
        }
        await this.studentRepo.save(student);
      }
    }

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
