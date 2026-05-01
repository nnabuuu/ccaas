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
import { buildTaskMap } from '../task-map.utils';

@Injectable()
export class DiscussService {
  private readonly logger = new Logger(DiscussService.name);

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

  async aiDiscuss(
    session: ClassroomSession,
    studentId: string,
    taskNum: number,
    messages: Array<{ role: 'ai' | 'student'; text: string }>,
    round: number,
    timeUsedSeconds: number,
  ): Promise<{ reply: string; goalReached: boolean }> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    const lastStudentMsg = [...messages].reverse().find(m => m.role === 'student')?.text || '';

    try {
      const systemPrompt = await this.buildSocraticSystemPrompt(session, studentId, taskNum);

      const llmMessages = messages.map(m => ({
        role: (m.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.text,
      }));

      const rawResponse = await this.aiPromptBuilder.callGlmConversation(
        systemPrompt, llmMessages, { maxTokens: 512, temperature: 0.75 },
      );

      const goalReached = rawResponse.includes('[GOAL_REACHED]');
      const reply = rawResponse.replace(/\s*\[GOAL_REACHED\]\s*/g, ' ').trim();

      const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
      const taskMap = lesson ? buildTaskMap(JSON.parse(lesson.manifestJson)) : null;
      const stepIdx = taskMap?.taskToStep[taskNum] ?? taskNum;
      await this.aiQuestionRepo.save(this.aiQuestionRepo.create({
        sessionId: session.id,
        studentId,
        studentName: student.name,
        step: stepIdx,
        question: `[discuss:socratic:r${round}] ${lastStudentMsg}`,
        answer: reply,
        category: 'discuss',
      }));

      const latestSub = await this.submissionRepo.findOne({
        where: { sessionId: session.id, studentId },
        order: { submittedAt: 'DESC' },
      });
      await this.observationService.observeTurn(
        session.id, studentId, student.name,
        { student: lastStudentMsg, ai: reply },
        { currentStep: `task-${taskNum}`, exerciseCorrectRate: latestSub?.scoreJson?.total ?? 0, idleSeconds: 0 },
      ).catch(e => this.logger.warn(`Observation observeTurn failed: ${e}`));

      if (goalReached) {
        await this.observationService.addSystemEvent(
          session.id, studentId, student.name, 'discuss_complete',
          { taskNum, completionType: 'goal_reached', roundsUsed: round, timeUsedSeconds },
          `讨论完成: 目标达成 (${round} 轮)`,
        );
      }

      this.engine.dispatch({
        type: 'chat_turn',
        sessionId: session.id,
        entityId: studentId,
        tenantId: session.lessonId,
        payload: { student: lastStudentMsg, ai: reply, taskNum, round },
      }).catch(err => this.logger.error(`Observer dispatch chat_turn failed: ${err}`));

      return { reply, goalReached };
    } catch (e) {
      this.logger.warn(`AI discuss call failed: ${e}`);
      return {
        reply: 'Sorry, let me think about that differently. Could you rephrase your answer?',
        goalReached: false,
      };
    }
  }

  async discussComplete(
    session: ClassroomSession,
    studentId: string,
    taskNum: number,
    completionType: 'goal_reached' | 'fallback_rounds' | 'fallback_time',
    roundsUsed: number,
    timeUsedSeconds: number,
    mcSelectedIndex?: number,
  ): Promise<{ ok: boolean; mcCorrect?: boolean }> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    let mcCorrect: boolean | undefined;

    if (mcSelectedIndex !== undefined) {
      const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
      if (lesson) {
        const manifest = JSON.parse(lesson.manifestJson);
        const taskMap = buildTaskMap(manifest);
        const stepIdx = taskMap.taskToStep[taskNum];
        const stepDef = (manifest.readingSteps || []).find((s: any) => s.idx === stepIdx);
        const correctIndex = stepDef?.discuss?.fallbackMC?.correctIndex;
        if (correctIndex !== undefined) {
          mcCorrect = mcSelectedIndex === correctIndex;
        }
      }
    }

    await this.observationService.addSystemEvent(
      session.id, studentId, student.name, 'discuss_complete',
      {
        taskNum,
        completionType,
        roundsUsed,
        timeUsedSeconds,
        ...(mcSelectedIndex !== undefined && { mcSelectedIndex, mcCorrect }),
      },
      completionType === 'goal_reached'
        ? `讨论完成: 目标达成 (${roundsUsed} 轮)`
        : `讨论完成: ${completionType === 'fallback_rounds' ? '轮次用完' : '时间到'}, MC ${mcCorrect ? '正确' : '错误'}`,
    );

    return { ok: true, mcCorrect };
  }

  private async buildSocraticSystemPrompt(
    session: ClassroomSession,
    studentId: string,
    taskNum: number,
  ): Promise<string> {
    const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
    if (!lesson) return this.aiPromptBuilder.buildDiscussFallbackPrompt('probeReply');

    const manifest = JSON.parse(lesson.manifestJson);
    const readingSteps = manifest.readingSteps || [];
    const taskMap = buildTaskMap(manifest);
    const stepIdx = taskMap.taskToStep[taskNum] ?? taskNum;
    const stepDef = readingSteps.find((s: any) => s.idx === stepIdx);

    const submission = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step: stepIdx },
    });

    const studentLog = this.observationService.getStudentLog(session.id, studentId);
    let priorObservationContext: string | null = null;
    if (studentLog?.events.length) {
      const relevantEvents = studentLog.events
        .filter(e => e.source === 'llm')
        .slice(-3)
        .map(e => `- ${e.gist}`)
        .join('\n');
      if (relevantEvents) {
        priorObservationContext = relevantEvents;
      }
    }

    return this.aiPromptBuilder.buildSocraticPrompt(
      manifest, stepDef, submission, priorObservationContext,
    );
  }
}
