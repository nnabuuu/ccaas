import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { Lesson } from '../../entities/lesson.entity';
import { GradingService } from '../exercise/grading.service';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { sanitizeAnswerKey } from '../../schemas/manifest.utils';
import { PersonalTouchSchema, BonusArticleSchema, BonusStepSchema } from '../../schemas';
import type { PersonalTouch, GradeResult } from '../../schemas';
import { getCachedTaskMap } from '../task-map.utils';
import { ExerciseService } from '../exercise/exercise.service';

@Injectable()
export class PersonalizationService {
  private readonly logger = new Logger(PersonalizationService.name);

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(ClassroomSession)
    private readonly sessionRepo: Repository<ClassroomSession>,
    private readonly gradingService: GradingService,
    private readonly aiPromptBuilder: AiPromptBuilder,
    private readonly exerciseService: ExerciseService,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.studentRepo.manager.getRepository(Lesson);
  }

  async getPersonalTouch(session: ClassroomSession, studentId: string) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) throw new NotFoundException('Student not found in this session');

    const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const manifest = JSON.parse(lesson.manifestJson);
    const taskMap = await getCachedTaskMap(session.lessonId, this.lessonRepo);

    const ptParsed = PersonalTouchSchema.safeParse(manifest.personalTouch);
    if (!ptParsed.success) {
      this.logger.warn(`personalTouch schema invalid: ${ptParsed.error.message}`);
      return { strategies: [], tier: { label: '', labelEn: '', tone: 'neutral' }, aiComment: '', bonusUnlocked: false };
    }
    const personalTouch: PersonalTouch = ptParsed.data;

    const allSubs = await this.submissionRepo.find({
      where: { sessionId: session.id, studentId },
    });
    const subsByStep = new Map(allSubs.map(s => [s.step, s]));

    const strategies: Array<{ task: number; strategy: string; score: number; attempts: number }> = [];
    for (const sl of personalTouch.strategyLabels) {
      const stepNum = taskMap.taskToStep[sl.taskIdx];
      if (stepNum === undefined) continue;
      const sub = subsByStep.get(stepNum);
      const score = sub?.scoreJson?.total ?? 0;
      const attempts = sub?.scoreJson?.attemptCounts
        ? Math.max(...Object.values(sub.scoreJson.attemptCounts as Record<string, number>))
        : 1;
      strategies.push({ task: sl.taskIdx, strategy: sl.strategy, score, attempts });
    }

    const avg = strategies.length > 0
      ? strategies.reduce((sum, s) => sum + s.score, 0) / strategies.length
      : 0;
    const sortedTiers = [...personalTouch.tiers].sort((a, b) => b.minScore - a.minScore);
    const tier = sortedTiers.find(t => avg >= t.minScore) || { label: '', labelEn: '', tone: 'neutral' as const };

    let aiComment = '';
    try {
      const { system, user } = this.aiPromptBuilder.buildPersonalTouchPrompt(strategies);
      aiComment = await this.aiPromptBuilder.callGlm(system, user, { maxTokens: 256, temperature: 0.8 });
    } catch (e) {
      this.logger.warn(`Personal touch AI comment failed: ${e}`);
      aiComment = '你完成了所有阅读策略练习，继续保持！';
    }

    const currentSession = await this.sessionRepo.findOne({ where: { id: session.id } });
    const bonusUnlocked = (currentSession?.currentStep ?? 0) < 5;

    return { strategies, tier, aiComment, bonusUnlocked };
  }

  async getBonusExercise(session: ClassroomSession, bonusStep: number) {
    const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const manifest = JSON.parse(lesson.manifestJson);
    const rawBonusSteps: unknown[] = manifest.bonusSteps || [];

    if (bonusStep < 1 || bonusStep > rawBonusSteps.length) {
      throw new BadRequestException(`bonusStep must be between 1 and ${rawBonusSteps.length}`);
    }

    const parsed = BonusStepSchema.safeParse(rawBonusSteps[bonusStep - 1]);
    if (!parsed.success) {
      throw new NotFoundException(`Invalid bonus exercise definition at step ${bonusStep}`);
    }
    const stepDef = parsed.data;

    const spec = sanitizeAnswerKey(stepDef.answerKey, stepDef.exerciseLabel);
    if (!spec) throw new NotFoundException(`Unsupported bonus exercise type`);

    const articleParsed = BonusArticleSchema.safeParse(manifest.bonusArticle);

    return {
      exercise: spec,
      article: articleParsed.success ? articleParsed.data : null,
      label: stepDef.labelEn || stepDef.label,
      strategy: stepDef.strategy || '',
    };
  }

  async checkBonusAnswer(
    session: ClassroomSession,
    studentId: string,
    bonusStep: number,
    data: Record<string, unknown>,
  ) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) throw new NotFoundException('Student not found in this session');

    const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const manifest = JSON.parse(lesson.manifestJson);
    const rawBonusSteps: unknown[] = manifest.bonusSteps || [];

    if (bonusStep < 1 || bonusStep > rawBonusSteps.length) {
      throw new BadRequestException(`bonusStep must be between 1 and ${rawBonusSteps.length}`);
    }

    const parsed = BonusStepSchema.safeParse(rawBonusSteps[bonusStep - 1]);
    if (!parsed.success) {
      throw new NotFoundException(`Invalid bonus exercise definition at step ${bonusStep}`);
    }
    const stepDef = parsed.data;

    const gradeResult = await this.gradingService.grade(stepDef.answerKey, data);

    const BONUS_STEP_OFFSET = 100;
    const virtualStep = BONUS_STEP_OFFSET + bonusStep;
    const existing = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step: virtualStep },
    });
    if (existing) {
      existing.dataJson = data;
      existing.scoreJson = gradeResult;
      await this.submissionRepo.save(existing);
    } else {
      const submission = this.submissionRepo.create({
        sessionId: session.id,
        lessonId: session.lessonId,
        studentId,
        step: virtualStep,
        dataJson: data,
        scoreJson: gradeResult,
      });
      await this.submissionRepo.save(submission);
    }

    const ak = stepDef.answerKey as Record<string, unknown>;
    const items = gradeResult ? this.exerciseService.buildCheckItems(ak, data, gradeResult) : [];
    const allCorrect = gradeResult ? gradeResult.total === 100 : false;

    return { type: stepDef.answerKey.type, allCorrect, items };
  }
}
