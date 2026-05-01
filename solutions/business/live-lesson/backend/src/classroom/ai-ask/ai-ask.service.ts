import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { AiQuestion } from '../../entities/ai-question.entity';
import { Lesson } from '../../entities/lesson.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { ObservationService } from '../observation/observation.service';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { OBSERVER_ENGINE, type ObserverEngine } from '@kedge-agentic/observer-engine';

@Injectable()
export class AiAskService {
  private readonly logger = new Logger(AiAskService.name);

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(AiQuestion)
    private readonly aiQuestionRepo: Repository<AiQuestion>,
    private readonly observationService: ObservationService,
    private readonly aiPromptBuilder: AiPromptBuilder,
    @Inject(OBSERVER_ENGINE) private readonly engine: ObserverEngine,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.studentRepo.manager.getRepository(Lesson);
  }

  async aiAsk(session: ClassroomSession, studentId: string, step: number, question: string): Promise<{ answer: string; category: string }> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    let rawAnswer: string;
    try {
      const systemPrompt = await this.buildAiSystemPrompt(session.lessonId, step);
      rawAnswer = await this.aiPromptBuilder.callGlm(systemPrompt, question);
    } catch (e) {
      this.logger.warn(`AI call failed: ${e}`);
      rawAnswer = '【其他】AI 助教暂时无法回答，请稍后再试。';
    }

    const parsed = this.aiPromptBuilder.parseCategoryFromResponse(rawAnswer);

    const aiQuestion = this.aiQuestionRepo.create({
      sessionId: session.id,
      studentId,
      studentName: student.name,
      step,
      question,
      answer: parsed.answer,
      category: parsed.category,
    });
    await this.aiQuestionRepo.save(aiQuestion);

    const latestSub = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId },
      order: { submittedAt: 'DESC' },
    });
    const correctRate = latestSub?.scoreJson?.total ?? 0;
    await this.observationService.observeTurn(
      session.id, studentId, student.name,
      { student: question, ai: parsed.answer },
      { currentStep: `step-${step}`, exerciseCorrectRate: correctRate, idleSeconds: 0 },
    ).catch(e => this.logger.warn(`Observation observeTurn failed: ${e}`));

    this.engine.dispatch({
      type: 'chat_turn',
      sessionId: session.id,
      entityId: studentId,
      tenantId: session.lessonId,
      payload: { student: question, ai: parsed.answer, step },
    }).catch(err => this.logger.error(`Observer dispatch chat_turn failed: ${err}`));

    return { answer: parsed.answer, category: parsed.category };
  }

  private async buildAiSystemPrompt(lessonId: string, step: number): Promise<string> {
    try {
      const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
      if (!lesson) {
        return this.aiPromptBuilder.buildFallbackPrompt();
      }

      const manifest = JSON.parse(lesson.manifestJson);
      return this.aiPromptBuilder.buildAskSystemPrompt(manifest, step);
    } catch {
      return this.aiPromptBuilder.buildFallbackPrompt();
    }
  }
}
