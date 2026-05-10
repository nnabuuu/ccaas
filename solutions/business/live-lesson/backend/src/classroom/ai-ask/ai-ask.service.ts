import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { AiQuestion } from '../../entities/ai-question.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { Lesson } from '../../entities/lesson.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { ManifestCacheService } from '../manifest-cache.service';
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
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepo: Repository<ChatMessage>,
    private readonly aiPromptBuilder: AiPromptBuilder,
    private readonly manifestCache: ManifestCacheService,
    @Inject(OBSERVER_ENGINE) private readonly engine: ObserverEngine,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.studentRepo.manager.getRepository(Lesson);
  }

  async aiAsk(
    session: ClassroomSession,
    studentId: string,
    step: number,
    question: string,
    messages?: Array<{ role: string; text: string }>,
  ): Promise<{ answer: string; category: string }> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    let rawAnswer: string;
    try {
      if (messages && messages.length > 0) {
        const systemPrompt = await this.buildContinueChatSystemPrompt(session.lessonId, step);
        const llmMessages = messages.map(m => ({
          role: (m.role === 'student' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text,
        }));
        rawAnswer = await this.aiPromptBuilder.callLlmConversation(systemPrompt, llmMessages);
      } else {
        const systemPrompt = await this.buildAiSystemPrompt(session.lessonId, step);
        rawAnswer = await this.aiPromptBuilder.callLlm(systemPrompt, question);
      }
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

    if (messages && messages.length > 0) {
      const threadId = `continue:${step}`;
      await this.chatMessageRepo.manager.transaction(async (em) => {
        const repo = em.getRepository(ChatMessage);
        const existingCount = await repo.count({
          where: { sessionId: session.id, studentId, threadId },
        });
        await repo.save([
          repo.create({ sessionId: session.id, studentId, threadId, role: 'student', content: question, seq: existingCount }),
          repo.create({ sessionId: session.id, studentId, threadId, role: 'ai', content: parsed.answer, seq: existingCount + 1 }),
        ]);
      });

      this.engine.dispatch({
        type: 'continue_chat_turn',
        sessionId: session.id,
        entityId: studentId,
        tenantId: session.lessonId,
        payload: { step, messageCount: messages.length },
      }).catch(err => this.logger.error(`Observer dispatch continue_chat_turn failed: ${err}`));
    }

    this.engine.dispatch({
      type: 'chat_turn',
      sessionId: session.id,
      entityId: studentId,
      tenantId: session.lessonId,
      payload: { student: question, ai: parsed.answer, step },
    }).catch(err => this.logger.error(`Observer dispatch chat_turn failed: ${err}`));

    return { answer: parsed.answer, category: parsed.category };
  }

  private async buildPromptFromManifest(
    lessonId: string,
    step: number,
    builder: (manifest: any, step: number) => string,
  ): Promise<string> {
    try {
      const manifest = await this.manifestCache.getManifest(lessonId, this.lessonRepo);
      if (!manifest) {
        return this.aiPromptBuilder.buildFallbackPrompt();
      }
      return builder(manifest, step);
    } catch {
      return this.aiPromptBuilder.buildFallbackPrompt();
    }
  }

  private buildAiSystemPrompt(lessonId: string, step: number): Promise<string> {
    return this.buildPromptFromManifest(lessonId, step, (m, s) => this.aiPromptBuilder.buildAskSystemPrompt(m, s));
  }

  private buildContinueChatSystemPrompt(lessonId: string, step: number): Promise<string> {
    return this.buildPromptFromManifest(lessonId, step, (m, s) => this.aiPromptBuilder.buildContinueChatPrompt(m, s));
  }
}
