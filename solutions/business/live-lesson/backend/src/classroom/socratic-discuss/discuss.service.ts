import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { Submission } from '../../entities/submission.entity';
import { AiQuestion } from '../../entities/ai-question.entity';
import { ChatMessage } from '../../entities/chat-message.entity';
import { Lesson } from '../../entities/lesson.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { ObservationQueryService } from '../observation/observation-query.service';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { ManifestCacheService } from '../manifest-cache.service';
import { OBSERVER_ENGINE, type ObserverEngine } from '@kedge-agentic/observer-engine';
import { buildTaskMap } from '../task-map.utils';
import { ClusterClassifier } from './cluster-classifier';
import { ClusterAggregator } from './cluster-aggregator';
import { StudentSubmissionService } from '../student-submission.service';
import { CoachingService } from '../coaching.service';
import { StateCacheService } from '../state-cache.service';

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
    private readonly observationQuery: ObservationQueryService,
    private readonly aiPromptBuilder: AiPromptBuilder,
    private readonly manifestCache: ManifestCacheService,
    private readonly clusterClassifier: ClusterClassifier,
    private readonly clusterAggregator: ClusterAggregator,
    private readonly studentSubmission: StudentSubmissionService,
    private readonly coachingService: CoachingService,
    private readonly stateCache: StateCacheService,
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
  ): Promise<{
    reply: string;
    goalReached: boolean;
    llmFailed: boolean;
    highlight?: { score: number; gist: string };
    nudge?: { hint: string };
  }> {
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

      const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
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

      // Per-question cluster classification — await with 3s timeout for highlight/nudge
      let highlight: { score: number; gist: string } | undefined;
      let nudge: { hint: string } | undefined;

      const stepDefForCluster = manifest
        ? (manifest.readingSteps || []).find((s: any) => s.idx === stepIdx)
        : undefined;
      const clusters = stepDefForCluster?.discuss?.clusters;
      const targetPoints = stepDefForCluster?.discuss?.targetPoints;
      if (clusters?.length || targetPoints?.length) {
        const recentContext = messages
          .slice(-6)
          .map(m => `${m.role}: ${m.text}`)
          .join('\n');
        try {
          const timeout = new Promise<null>(r => setTimeout(() => r(null), 3000));
          const classifyResult = await Promise.race([
            this.clusterClassifier.classify(lastStudentMsg, clusters || [], recentContext, targetPoints),
            timeout,
          ]);
          if (classifyResult) {
            const isNewSignal = classifyResult.eventType === 'new_signal' && classifyResult.confidence === 'high';
            this.clusterAggregator.ingest(
              session.id, taskNum, studentId, student.name, classifyResult,
            );
            this.clusterAggregator.recordHit(session.id, taskNum, studentId, isNewSignal);
            if (classifyResult.isHighlight && classifyResult.highlightGist) {
              const effectiveClusterId = classifyResult.confidence === 'high' ? classifyResult.clusterId : 'other';
              highlight = { score: 1, gist: classifyResult.highlightGist };
              this.coachingService.addHighlight(session.id, {
                studentId, studentName: student.name, taskNum,
                clusterId: effectiveClusterId,
                message: lastStudentMsg,
                gist: classifyResult.highlightGist,
                evidenceSpan: classifyResult.evidenceSpan,
              });
            }
            // Nudge: consecutive misses >= 2 → suggest an unhit cluster
            const misses = this.clusterAggregator.getConsecutiveMisses(session.id, taskNum, studentId);
            if (misses >= 2) {
              const unhit = this.clusterAggregator.getUnhitClusterIds(
                session.id, taskNum, studentId, clusters || [],
              );
              if (unhit.length > 0) {
                const pick = unhit[Math.floor(Math.random() * unhit.length)];
                nudge = { hint: `试着从「${pick.label}」的角度想想？` };
              }
            }
          } else {
            // Timeout — record as miss, no highlight
            this.clusterAggregator.recordHit(session.id, taskNum, studentId, false);
          }
        } catch (e) {
          this.logger.warn(`Cluster classify failed: ${e}`);
          this.clusterAggregator.recordHit(session.id, taskNum, studentId, false);
        }
      }

      if (goalReached) {
        student.discussMeta = { ...student.discussMeta!, goalReached: true, completionType: 'goal_reached' as const };
      }
      await this.studentRepo.save(student);

      if (goalReached) {
        this.engine.dispatch({
          type: 'discuss_complete',
          sessionId: session.id,
          entityId: studentId,
          tenantId: session.lessonId,
          payload: { taskNum, completionType: 'goal_reached', method: 'socratic', goalReached: true, roundsUsed: round, timeUsedSeconds },
        }).catch(err => this.logger.error(`Observer dispatch discuss_complete failed: ${err}`));
      }

      this.engine.dispatch({
        type: 'chat_turn',
        sessionId: session.id,
        entityId: studentId,
        tenantId: session.lessonId,
        payload: { student: lastStudentMsg, ai: reply, taskNum, round },
      }).catch(err => this.logger.error(`Observer dispatch chat_turn failed: ${err}`));

      this.stateCache.markDirty(session.id);
      return { reply, goalReached, llmFailed: false, highlight, nudge };
    } catch (e) {
      this.logger.warn(`AI discuss call failed: ${e}`);

      // Save AiQuestion on failure (align with ai-ask behavior) so aiRoundsCount stays consistent
      const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo).catch(() => null);
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
      this.stateCache.markDirty(session.id);

      return {
        reply: 'Sorry, let me think about that differently. Could you rephrase your answer?',
        goalReached: false,
        llmFailed: true,
      };
    }
  }

  async getDiscussProgress(
    session: { id: string; lessonId: string },
    studentId: string,
    taskNum: number,
  ): Promise<{
    clusters: Array<{ id: string; label: string; hit: boolean }>;
    targetPoints: Array<{ id: string; label: string; hit: boolean }>;
  }> {
    const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
    if (!manifest) return { clusters: [], targetPoints: [] };
    const taskMap = buildTaskMap(manifest);
    const stepIdx = taskMap.taskToStep[taskNum] ?? taskNum;
    const stepDef = (manifest.readingSteps || []).find((s: any) => s.idx === stepIdx);
    const clusters = stepDef?.discuss?.clusters;
    const tpDefs = stepDef?.discuss?.targetPoints;

    return {
      clusters: clusters?.length
        ? this.clusterAggregator.getStudentClusters(session.id, taskNum, studentId, clusters)
        : [],
      targetPoints: tpDefs?.length
        ? this.clusterAggregator.getStudentTargetPoints(session.id, taskNum, studentId, tpDefs)
        : [],
    };
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
      const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
      if (manifest) {
        const taskMap = buildTaskMap(manifest);
        const stepIdx = taskMap.taskToStep[taskNum];
        const stepDef = (manifest.readingSteps || []).find((s: any) => s.idx === stepIdx);
        const correctIndex = stepDef?.discuss?.fallbackMC?.correctIndex;
        if (correctIndex !== undefined) {
          mcCorrect = mcSelectedIndex === correctIndex;
        }
      }
    }

    this.engine.dispatch({
      type: 'discuss_complete',
      sessionId: session.id,
      entityId: studentId,
      tenantId: session.lessonId,
      payload: {
        taskNum,
        completionType,
        method: completionType === 'goal_reached' ? 'socratic' : 'fallback_mc',
        goalReached: completionType === 'goal_reached',
        roundsUsed,
        timeUsedSeconds,
        ...(mcSelectedIndex !== undefined && { mcSelectedIndex, mcCorrect }),
      },
    }).catch(err => this.logger.error(`Observer dispatch discuss_complete failed: ${err}`));

    student.discussMeta = {
      ...student.discussMeta!,
      completionType,
    };
    await this.studentRepo.save(student);

    await this.studentSubmission.updatePhase(session, studentId, taskNum, 'takeaway');
    this.stateCache.markDirty(session.id);

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
    const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);
    if (!manifest) return this.aiPromptBuilder.buildDiscussFallbackPrompt('probeReply');

    const readingSteps = manifest.readingSteps || [];
    const taskMap = buildTaskMap(manifest);
    const stepIdx = taskMap.taskToStep[taskNum] ?? taskNum;
    const stepDef = readingSteps.find((s: any) => s.idx === stepIdx);

    const submission = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step: stepIdx, phase: 'exercise' },
    });

    const allLogs = await this.observationQuery.getStudentLogs(session.id);
    const studentLog = allLogs.find(l => l.studentId === studentId) ?? null;
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
