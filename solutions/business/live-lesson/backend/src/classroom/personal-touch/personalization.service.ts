import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThanOrEqual, Not, Or, Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { Lesson } from '../../entities/lesson.entity';
import { AiQuestion } from '../../entities/ai-question.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { GradingService } from '../exercise/grading.service';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { ManifestCacheService } from '../manifest-cache.service';
import { CoachingService } from '../coaching.service';
import { sanitizeAnswerKey } from '../../schemas/manifest.utils';
import { PersonalTouchSchema, BonusArticleSchema, BonusStepSchema } from '../../schemas';
import type { PersonalTouch, GradeResult } from '../../schemas';
import { getCachedTaskMap } from '../task-map.utils';
import { ExerciseService } from '../exercise/exercise.service';
import { StateCacheService } from '../state-cache.service';
import { buildCheckItems } from '../exercise/build-check-items';
import type { PersonalTouchResponse, CheckResultResponse } from '../../schemas/classroom';

const BONUS_STEP_OFFSET = 100;

export interface RecapResponse {
  tier: { label: string; labelEn: string; tone: string } | null;
  highlights: Array<{ taskNum: number; gist: string; evidenceSpan: string }>;
  aiStats: { translateCount: number; askCount: number; discussRounds: number };
  totalTime: number | null;
  bonusCompleted: boolean;
  aiRecap: string;
}

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
    @InjectRepository(AiQuestion)
    private readonly aiQuestionRepo: Repository<AiQuestion>,
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepo: Repository<ChatMessage>,
    private readonly gradingService: GradingService,
    private readonly aiPromptBuilder: AiPromptBuilder,
    private readonly manifestCache: ManifestCacheService,
    private readonly exerciseService: ExerciseService,
    private readonly coachingService: CoachingService,
    private readonly stateCache: StateCacheService,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.studentRepo.manager.getRepository(Lesson);
  }

  private async computeTierAndStrategies(
    session: ClassroomSession,
    studentId: string,
  ): Promise<{
    strategies: Array<{ task: number; strategy: string; score: number; attempts: number }>;
    tier: { label: string; labelEn: string; tone: 'gold' | 'blue' | 'neutral' };
  } | null> {
    const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
    if (!manifest) return null;
    const taskMap = await getCachedTaskMap(session.lessonId, this.lessonRepo);
    const ptParsed = PersonalTouchSchema.safeParse(manifest.personalTouch);
    if (!ptParsed.success) return null;
    const personalTouch: PersonalTouch = ptParsed.data;

    const allSubs = await this.submissionRepo.find({
      where: { sessionId: session.id, studentId, phase: 'exercise' },
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

    return { strategies, tier: { label: tier.label, labelEn: tier.labelEn, tone: tier.tone as 'gold' | 'blue' | 'neutral' } };
  }

  async getPersonalTouch(session: ClassroomSession, studentId: string): Promise<PersonalTouchResponse> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) throw new NotFoundException('Student not found in this session');

    const computed = await this.computeTierAndStrategies(session, studentId);
    if (!computed) {
      this.logger.warn(`personalTouch schema invalid or lesson not found`);
      return { strategies: [], tier: { label: '', labelEn: '', tone: 'neutral' }, aiComment: '', bonusUnlocked: false };
    }
    const { strategies, tier } = computed;

    let aiComment = '';
    try {
      const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
      const { system, user } = this.aiPromptBuilder.buildPersonalTouchPrompt(strategies, manifest);
      aiComment = await this.aiPromptBuilder.callLlm(system, user, { maxTokens: 256, temperature: 0.8 });
    } catch (e) {
      this.logger.warn(`Personal touch AI comment failed: ${e}`);
      aiComment = '你完成了所有练习，继续保持！';
    }

    const BONUS_TIME_LIMIT_MIN = 15;
    const allSubs = await this.submissionRepo.find({
      where: { sessionId: session.id, studentId, phase: 'exercise' },
    });
    const lastSub = allSubs.length > 0
      ? allSubs.reduce((latest, s) => s.submittedAt > latest.submittedAt ? s : latest)
      : null;
    const startTime = session.startedAt ?? student.joinedAt;
    const elapsedMin = lastSub && startTime
      ? (new Date(lastSub.submittedAt).getTime() - new Date(startTime).getTime()) / 60_000
      : Infinity;
    const bonusUnlocked = elapsedMin <= BONUS_TIME_LIMIT_MIN;

    return { strategies, tier, aiComment, bonusUnlocked };
  }

  async getBonusExercise(session: ClassroomSession, bonusStep: number) {
    const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
    if (!manifest) throw new NotFoundException('Lesson not found');

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
  ): Promise<CheckResultResponse> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) throw new NotFoundException('Student not found in this session');

    const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
    if (!manifest) throw new NotFoundException('Lesson not found');

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

    const virtualStep = BONUS_STEP_OFFSET + bonusStep;
    const existing = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step: virtualStep, phase: 'exercise' },
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
        phase: 'exercise',
        dataJson: data,
        scoreJson: gradeResult,
      });
      await this.submissionRepo.save(submission);
    }
    this.stateCache.markDirty(session.id);

    const ak = stepDef.answerKey as Record<string, unknown>;
    const items = gradeResult ? buildCheckItems(ak, data, gradeResult) : [];
    const allCorrect = gradeResult ? gradeResult.total === 100 : false;

    return { type: stepDef.answerKey.type, allCorrect, items };
  }

  async getStudentRecap(session: ClassroomSession, studentId: string): Promise<RecapResponse> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) throw new NotFoundException('Student not found in this session');

    // ── Tier + strategies (shared logic with getPersonalTouch) ──
    let tier: RecapResponse['tier'] = null;
    let strategies: Array<{ task: number; strategy: string; score: number; attempts: number }> = [];
    try {
      const computed = await this.computeTierAndStrategies(session, studentId);
      if (computed) {
        strategies = computed.strategies;
        if (computed.tier.label) tier = computed.tier;
      }
    } catch (e) {
      this.logger.warn(`Recap tier computation failed: ${e}`);
    }

    // ── Highlights ──
    const allHighlights = await this.coachingService.getHighlights(session.id);
    const highlights = allHighlights
      .filter(h => h.studentId === studentId)
      .map(h => ({ taskNum: h.taskNum, gist: h.gist, evidenceSpan: h.evidenceSpan }));

    // ── Parallelized DB queries ──
    const [askCount, translateRow, discussRounds, lastSubArr, bonusCount] = await Promise.all([
      // AI Ask count — include NULL category rows (Or handles SQL NULL correctly)
      this.aiQuestionRepo.count({
        where: { sessionId: session.id, studentId, category: Or(Not('discuss'), IsNull()) },
      }),
      // Translate thread count
      this.chatMessageRepo
        .createQueryBuilder('m')
        .select('COUNT(DISTINCT m.threadId)', 'cnt')
        .where('m.sessionId = :sid AND m.studentId = :stid AND m.threadId LIKE :prefix', {
          sid: session.id, stid: studentId, prefix: 'translate:%',
        })
        .getRawOne() as Promise<{ cnt: string } | undefined>,
      // Discuss rounds
      this.submissionRepo.count({
        where: { sessionId: session.id, studentId, phase: 'discuss' },
      }),
      // Last submission (for total time)
      this.submissionRepo.find({
        where: { sessionId: session.id, studentId },
        order: { submittedAt: 'DESC' },
        take: 1,
      }),
      // Bonus completed
      this.submissionRepo.count({
        where: { sessionId: session.id, studentId, step: MoreThanOrEqual(BONUS_STEP_OFFSET + 1) },
      }),
    ]);

    const translateCount = parseInt(translateRow?.cnt ?? '0', 10);

    // ── Total time ──
    let totalTime: number | null = null;
    if (lastSubArr.length > 0 && student.joinedAt) {
      const elapsed = Math.round(
        (new Date(lastSubArr[0].submittedAt).getTime() - new Date(student.joinedAt).getTime()) / 1000,
      );
      if (elapsed >= 0) totalTime = elapsed;
    }

    // ── AI Recap (personalized summary, 5s timeout to avoid blocking student) ──
    const aiStats = { translateCount, askCount, discussRounds };
    let aiRecap = '';
    try {
      const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
      const { system, user } = this.aiPromptBuilder.buildRecapPrompt({
        strategies, highlights, aiStats, tier, manifest,
      });
      const timeout = new Promise<string>(r => setTimeout(() => r(''), 5000));
      aiRecap = await Promise.race([
        this.aiPromptBuilder.callLlm(system, user, { maxTokens: 512, temperature: 0.8 }),
        timeout,
      ]);
    } catch (e) {
      this.logger.warn(`Recap AI summary failed: ${e}`);
    }

    return {
      tier,
      highlights,
      aiStats,
      totalTime,
      bonusCompleted: bonusCount > 0,
      aiRecap,
    };
  }
}
