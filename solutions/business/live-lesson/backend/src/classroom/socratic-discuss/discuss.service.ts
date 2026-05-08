import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { AiQuestion } from '../../entities/ai-question.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { Lesson } from '../../entities/lesson.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { ObservationService } from '../observation/observation.service';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { OBSERVER_ENGINE, type ObserverEngine } from '@kedge-agentic/observer-engine';
import { buildTaskMap } from '../task-map.utils';
import { ClusterClassifier } from './cluster-classifier';
import { ClusterAggregator } from './cluster-aggregator';
import { StudentSubmissionService } from '../student-submission.service';

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
    @InjectRepository(ChatMessage)
    private readonly chatMessageRepo: Repository<ChatMessage>,
    private readonly observationService: ObservationService,
    private readonly aiPromptBuilder: AiPromptBuilder,
    private readonly clusterClassifier: ClusterClassifier,
    private readonly clusterAggregator: ClusterAggregator,
    private readonly studentSubmission: StudentSubmissionService,
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
  ): Promise<{ reply: string; goalReached: boolean; llmFailed: boolean }> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    const lastStudentMsg = [...messages].reverse().find(m => m.role === 'student')?.text || '';

    // ── discuss meta persistence ──
    if (!student.discussMeta) {
      student.discussMeta = { startedAt: new Date().toISOString() };
    }

    try {
      const systemPrompt = await this.buildSocraticSystemPrompt(session, studentId, taskNum);

      const llmMessages = messages.map(m => ({
        role: (m.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.text,
      }));

      const rawResponse = await this.aiPromptBuilder.callLlmConversation(
        systemPrompt, llmMessages, { maxTokens: 512, temperature: 0.75 },
      );

      const goalReached = rawResponse.includes('[GOAL_REACHED]');
      const reply = rawResponse.replace(/\s*\[GOAL_REACHED\]\s*/g, ' ').trim();

      const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
      const manifest = lesson ? JSON.parse(lesson.manifestJson) : null;
      const taskMap = manifest ? buildTaskMap(manifest) : null;
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

      await this.persistThread(
        session.id, studentId, `discuss:${taskNum}`, messages, reply,
      ).catch(e => this.logger.warn(`persistThread failed: ${e}`));

      const latestSub = await this.submissionRepo.findOne({
        where: { sessionId: session.id, studentId },
        order: { submittedAt: 'DESC' },
      });
      await this.observationService.observeTurn(
        session.id, studentId, student.name,
        { student: lastStudentMsg, ai: reply },
        { currentStep: `task-${taskNum}`, exerciseCorrectRate: latestSub?.scoreJson?.total ?? 0, idleSeconds: 0 },
      ).catch(e => this.logger.warn(`Observation observeTurn failed: ${e}`));

      // Per-question cluster classification (fire-and-forget — off critical path)
      const stepDefForCluster = manifest
        ? (manifest.readingSteps || []).find((s: any) => s.idx === stepIdx)
        : undefined;
      const clusters = stepDefForCluster?.discuss?.clusters;
      if (clusters?.length) {
        const recentContext = messages
          .slice(-6)
          .map(m => `${m.role}: ${m.text}`)
          .join('\n');
        this.clusterClassifier
          .classify(lastStudentMsg, clusters, recentContext)
          .then(classifyResult => {
            if (classifyResult) {
              this.clusterAggregator.ingest(
                session.id, taskNum, studentId, student.name, classifyResult,
              );
            }
          })
          .catch(e => this.logger.warn(`Cluster classify failed: ${e}`));
      }

      if (goalReached) {
        student.discussMeta = { ...student.discussMeta!, goalReached: true };
      }
      await this.studentRepo.save(student);

      if (goalReached) {
        await this.observationService.addSystemEvent(
          session.id, studentId, student.name, 'discuss_complete',
          { taskNum, completionType: 'goal_reached', method: 'socratic', goalReached: true, roundsUsed: round, timeUsedSeconds },
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

      return { reply, goalReached, llmFailed: false };
    } catch (e) {
      this.logger.warn(`AI discuss call failed: ${e}`);

      // Save AiQuestion on failure (align with ai-ask behavior) so aiRoundsCount stays consistent
      const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } }).catch(() => null);
      const manifest = lesson ? JSON.parse(lesson.manifestJson) : null;
      const taskMap = manifest ? buildTaskMap(manifest) : null;
      const stepIdx = taskMap?.taskToStep[taskNum] ?? taskNum;
      await this.aiQuestionRepo.save(this.aiQuestionRepo.create({
        sessionId: session.id,
        studentId,
        studentName: student.name,
        step: stepIdx,
        question: `[discuss:socratic:r${round}] ${lastStudentMsg}`,
        answer: null,
        category: 'discuss',
      })).catch(saveErr => this.logger.warn(`Failed to save AiQuestion on error: ${saveErr}`));

      return {
        reply: 'Sorry, let me think about that differently. Could you rephrase your answer?',
        goalReached: false,
        llmFailed: true,
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
        method: completionType === 'goal_reached' ? 'socratic' : 'fallback_mc',
        goalReached: completionType === 'goal_reached',
        roundsUsed,
        timeUsedSeconds,
        ...(mcSelectedIndex !== undefined && { mcSelectedIndex, mcCorrect }),
      },
      completionType === 'goal_reached'
        ? `讨论完成: 目标达成 (${roundsUsed} 轮)`
        : `讨论完成: ${completionType === 'fallback_rounds' ? '轮次用完' : '时间到'}, MC ${mcCorrect ? '正确' : '错误'}`,
    );

    await this.studentSubmission.updatePhase(session, studentId, taskNum, 'takeaway');

    return { ok: true, mcCorrect };
  }

  private async persistThread(
    sessionId: string,
    studentId: string,
    threadId: string,
    messages: Array<{ role: 'ai' | 'student'; text: string }>,
    aiReply: string,
  ): Promise<void> {
    await this.chatMessageRepo.manager.transaction(async (em) => {
      const repo = em.getRepository(ChatMessage);
      const existingCount = await repo.count({
        where: { sessionId, studentId, threadId },
      });
      const fullThread = [...messages, { role: 'ai' as const, text: aiReply }];
      const newMsgs = fullThread.slice(existingCount);
      if (!newMsgs.length) return;
      await repo.save(
        newMsgs.map((m, i) => repo.create({
          sessionId, studentId, threadId,
          role: m.role, content: m.text, seq: existingCount + i,
        })),
      );
    });
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
