import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import type { ClassroomSessionRecord } from '../../domain/types/classroom-session';
import { STUDENT_REPO_PORT, type StudentRepoPort } from '../../domain/ports/student-repo.port';
import type { StudentRecord } from '../../domain/types/student';
import { AI_QUESTION_REPO_PORT, type AiQuestionRepoPort } from '../../domain/ports/ai-question-repo.port';
import { CHAT_MESSAGE_REPO_PORT, type ChatMessageRepoPort } from '../../domain/ports/chat-message-repo.port';
import { LESSON_REPO_PORT, type LessonRepoPort } from '../../domain/ports/lesson-repo.port';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';
import { ManifestCacheService } from '../classroom/manifest-cache.service';
import { StateCacheService } from '../../adapters/transport/state-cache.service';
import { WorkflowDispatchService } from '../../adapters/workflow-outbox/workflow-dispatch.service';

@Injectable()
export class AiAskService {
  private readonly logger = new Logger(AiAskService.name);

  constructor(
    @Inject(STUDENT_REPO_PORT)
    private readonly studentRepo: StudentRepoPort,
    @Inject(LESSON_REPO_PORT)
    private readonly lessonRepo: LessonRepoPort,
    @Inject(AI_QUESTION_REPO_PORT)
    private readonly aiQuestionRepo: AiQuestionRepoPort,
    @Inject(CHAT_MESSAGE_REPO_PORT)
    private readonly chatMessageRepo: ChatMessageRepoPort,
    private readonly aiPromptBuilder: AiPromptBuilder,
    private readonly manifestCache: ManifestCacheService,
    private readonly stateCache: StateCacheService,
    private readonly workflowDispatch: WorkflowDispatchService,
  ) {}

  async aiAsk(
    session: ClassroomSessionRecord,
    studentId: string,
    step: number,
    question: string,
    messages?: Array<{ role: string; text: string }>,
  ): Promise<{ answer: string; category: string }> {
    const student = await this.studentRepo.findBySessionAndId(session.id, studentId);
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

    await this.aiQuestionRepo.insert({
      sessionId: session.id,
      studentId,
      studentName: student.name,
      step,
      question,
      answer: parsed.answer,
      category: parsed.category,
    });
    this.stateCache.markDirty(session.id);

    if (messages && messages.length > 0) {
      const threadId = `continue:${step}`;
      await this.chatMessageRepo.appendContinueChatTurn({
        sessionId: session.id, studentId, threadId,
        studentContent: question,
        aiContent: parsed.answer,
      });

      this.workflowDispatch.pushEvent({
        sessionId: session.id,
        manifestName: 'LessonSession',
        streamApiName: 'events',
        entityId: studentId,
        payload: { type: 'continue_chat_turn', studentId, step },
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Workflow outbox enqueue (continue_chat_turn) failed: ${msg}`);
      });
    }

    this.workflowDispatch.pushEvent({
      sessionId: session.id,
      manifestName: 'LessonSession',
      streamApiName: 'events',
      entityId: studentId,
      payload: {
        type: 'chat_turn',
        studentId,
        step,
        student: question,
        ai: parsed.answer,
      },
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Workflow outbox enqueue (chat_turn) failed: ${msg}`);
    });

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
