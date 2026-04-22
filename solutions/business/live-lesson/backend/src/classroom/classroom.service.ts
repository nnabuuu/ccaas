import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { AiQuestion } from '../entities/ai-question.entity';
import { Lesson } from '../entities/lesson.entity';
import type { Response } from 'express';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 30 chars, no 0/O/1/I/L
const CODE_LENGTH = 6;

// step index (manifest idx) → task number (1-5)
const STEP_TO_TASK: Record<number, number> = { 1: 1, 3: 2, 5: 3, 7: 4, 9: 5 };
// task number → step index
const TASK_TO_STEP: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 9 };

@Injectable()
export class ClassroomService {
  private readonly logger = new Logger(ClassroomService.name);
  private subscribers = new Map<string, Set<Response>>();
  private heartbeatTimers = new Map<Response, NodeJS.Timeout>();
  private activeNotificationsMap = new Map<string, Map<string, { id: string; message: string; notifyType: string; timestamp: string }>>();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(ClassroomSession)
    private readonly sessionRepo: Repository<ClassroomSession>,
    @InjectRepository(AiQuestion)
    private readonly aiQuestionRepo: Repository<AiQuestion>,
  ) {}

  private get lessonRepo(): Repository<Lesson> {
    return this.sessionRepo.manager.getRepository(Lesson);
  }

  // ── Session lifecycle ──

  async createSession(lessonId: string) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.generateCode();
      try {
        const session = this.sessionRepo.create({ code, lessonId, status: 'waiting' });
        const saved = await this.sessionRepo.save(session);
        this.logger.log(`Session created: ${saved.code} for lesson ${lessonId}`);
        return { sessionId: saved.id, code: saved.code, lessonId: saved.lessonId, status: saved.status };
      } catch (err: any) {
        if (err?.message?.includes('UNIQUE') || err?.code === 'SQLITE_CONSTRAINT') continue;
        throw err;
      }
    }
    throw new ConflictException('Failed to generate unique session code');
  }

  async resolveSession(code: string): Promise<ClassroomSession> {
    const session = await this.sessionRepo.findOne({ where: { code } });
    if (!session) {
      throw new NotFoundException(`Session not found: ${code}`);
    }
    return session;
  }

  async resolveActiveSession(code: string): Promise<ClassroomSession> {
    const session = await this.resolveSession(code);
    if (session.status === 'ended') {
      throw new BadRequestException('Session has ended');
    }
    return session;
  }

  async getSessionInfo(code: string) {
    const session = await this.resolveSession(code);
    return {
      sessionId: session.id,
      code: session.code,
      lessonId: session.lessonId,
      status: session.status,
      startedAt: session.startedAt,
      createdAt: session.createdAt,
    };
  }

  async startSession(code: string) {
    const session = await this.resolveSession(code);
    if (session.status === 'ended') {
      throw new BadRequestException('Session has ended');
    }
    if (session.status === 'active') {
      return { ok: true, status: 'active', startedAt: session.startedAt };
    }
    session.status = 'active';
    session.startedAt = new Date();
    await this.sessionRepo.save(session);
    this.broadcast(session.id);
    this.logger.log(`Session started: ${code}`);
    return { ok: true, status: 'active', startedAt: session.startedAt };
  }

  async endSession(code: string) {
    const session = await this.resolveSession(code);
    if (session.status === 'ended') {
      return { ok: true, status: 'ended' };
    }
    session.status = 'ended';
    session.endedAt = new Date();
    await this.sessionRepo.save(session);
    this.activeNotificationsMap.delete(session.id);
    this.logger.log(`Session ended: ${code}`);
    return { ok: true, status: 'ended' };
  }

  // ── Classroom operations (session-scoped) ──

  async join(session: ClassroomSession, name: string) {
    const existing = await this.studentRepo.findOne({
      where: { sessionId: session.id, name },
    });
    if (existing) {
      this.broadcast(session.id);
      return { studentId: existing.id, name: existing.name, lessonId: session.lessonId };
    }

    const student = this.studentRepo.create({
      sessionId: session.id,
      lessonId: session.lessonId,
      name,
    });
    const saved = await this.studentRepo.save(student);
    this.broadcast(session.id);
    return { studentId: saved.id, name: saved.name, lessonId: session.lessonId };
  }

  async submit(session: ClassroomSession, studentId: string, step: number, data: Record<string, any>) {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    // Auto-grade against manifest answer key
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

    // Update student progress
    const taskNum = STEP_TO_TASK[step];
    if (taskNum !== undefined) {
      const nextTask = taskNum + 1;
      if (nextTask <= 5 && (student.currentTask <= taskNum)) {
        student.currentTask = nextTask;
        student.currentPhase = 'listen';
        student.stepStartedAt = new Date().toISOString();
      } else if (student.currentTask <= taskNum) {
        student.currentTask = taskNum;
        student.currentPhase = 'completed';
      }
      await this.studentRepo.save(student);
    }

    this.broadcast(session.id);
    return { ok: true, score };
  }

  async getState(sessionId: string, currentStep?: number) {
    const students = await this.studentRepo.find({
      where: { sessionId },
      order: { joinedAt: 'ASC' },
    });

    const submissions = await this.submissionRepo.find({
      where: { sessionId },
    });

    const subsByStudent = new Map<string, Record<number, { step: number; data: any; score: any; submittedAt: string }>>();
    for (const sub of submissions) {
      if (!subsByStudent.has(sub.studentId)) {
        subsByStudent.set(sub.studentId, {});
      }
      subsByStudent.get(sub.studentId)![sub.step] = {
        step: sub.step,
        data: sub.dataJson,
        score: sub.scoreJson ?? null,
        submittedAt: sub.submittedAt instanceof Date
          ? sub.submittedAt.toISOString()
          : String(sub.submittedAt),
      };
    }

    // Always fetch session for status + currentStep
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    const stepToCheck = currentStep ?? session?.currentStep ?? 0;

    // Load manifest for G1/G4/G5/G7 enrichment
    let manifest: any = null;
    if (session?.lessonId) {
      const lesson = await this.lessonRepo.findOne({ where: { id: session.lessonId } });
      if (lesson) {
        try { manifest = JSON.parse(lesson.manifestJson); } catch {}
      }
    }

    const total = students.length;
    let submitted = 0;
    for (const s of students) {
      const subs = subsByStudent.get(s.id);
      if (subs && subs[stepToCheck]) {
        submitted++;
      }
    }

    // Fetch AI questions (needed for step metrics)
    const questions = await this.aiQuestionRepo.find({
      where: { sessionId },
      order: { askedAt: 'ASC' },
    });

    // G2: per-student per-step durations
    const studentDurations = this.computeStudentDurations(students, subsByStudent);

    // Build enriched stepMetrics with byDimension, timing, AI stats, issues, questionAggregates
    const stepMetrics = this.buildStepMetrics(total, students, subsByStudent, questions, studentDurations, manifest);

    // G3: extract median times for stuck detection
    const medianTimes = this.extractMedianTimes(stepMetrics);

    // Compute student statuses once (G3)
    const studentStatuses = new Map<string, string>();
    for (const s of students) {
      studentStatuses.set(s.id, this.computeStudentStatus(s, subsByStudent.get(s.id), medianTimes));
    }

    // G4: enrich stepMetrics with alertTag (needs studentStatuses computed above)
    for (let taskNum = 1; taskNum <= 5; taskNum++) {
      stepMetrics[taskNum].alertTag = this.computeAlertTag(
        taskNum, stepMetrics[taskNum], students, studentStatuses,
      );
    }

    // G6: health cards
    const healthCards = this.computeHealthCards(students, studentStatuses, questions);

    const questionRecords = questions.map(q => ({
      studentId: q.studentId,
      studentName: q.studentName,
      step: q.step,
      question: q.question,
      answer: q.answer,
      category: q.category,
      timestamp: q.askedAt instanceof Date ? q.askedAt.toISOString() : String(q.askedAt),
    }));

    return {
      sessionStatus: session?.status ?? 'active',
      currentStep: stepToCheck,
      students: students.map(s => {
        const subs = subsByStudent.get(s.id) || {};
        const durations = studentDurations.get(s.id) || {};
        const status = studentStatuses.get(s.id) || 'prog';

        // G2: Enrich submissions with duration and aiRoundsCount
        const enrichedSubs: Record<number, any> = {};
        for (const [stepStr, sub] of Object.entries(subs)) {
          const stepNum = Number(stepStr);
          enrichedSubs[stepNum] = {
            ...sub,
            duration: durations[stepNum] ?? null,
            aiRoundsCount: questions.filter(q => q.studentId === s.id && q.step === stepNum).length,
          };
        }

        return {
          id: s.id,
          name: s.name,
          currentTask: s.currentTask,
          currentPhase: s.currentPhase,
          stepStartedAt: s.stepStartedAt,
          status,
          submissions: enrichedSubs,
        };
      }),
      metrics: {
        total,
        submitted,
        inProgress: total - submitted,
      },
      stepMetrics,
      healthCards,
      questions: questionRecords,
    };
  }

  subscribe(sessionId: string, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId)!.add(res);

    this.getState(sessionId).then(state => {
      const activeNotifications = Array.from(
        (this.activeNotificationsMap.get(sessionId) ?? new Map()).values(),
      );
      res.write(`data: ${JSON.stringify({ ...state, activeNotifications })}\n\n`);
    }).catch(e => {
      this.logger.error(`Failed to send initial SSE state: ${e}`);
    });

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);
    this.heartbeatTimers.set(res, heartbeat);

    res.on('close', () => {
      this.subscribers.get(sessionId)?.delete(res);
      const timer = this.heartbeatTimers.get(res);
      if (timer) {
        clearInterval(timer);
        this.heartbeatTimers.delete(res);
      }
      this.logger.debug(`SSE subscriber disconnected for session ${sessionId}`);
    });

    this.logger.debug(`SSE subscriber connected for session ${sessionId}`);
  }

  async setStep(sessionId: string, step: number) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (session) {
      session.currentStep = step;
      await this.sessionRepo.save(session);
    }
    const state = await this.getState(sessionId, step);
    this.broadcastNamed(sessionId, 'step_sync', { currentStep: step, ...state });
    return { ok: true, currentStep: step };
  }

  notify(sessionId: string, message: string, type?: string) {
    const notifyType = type || 'general';
    const id = `${notifyType}::${message}`;

    if (!this.activeNotificationsMap.has(sessionId)) {
      this.activeNotificationsMap.set(sessionId, new Map());
    }
    const sessionNotifs = this.activeNotificationsMap.get(sessionId)!;

    if (sessionNotifs.has(id)) {
      sessionNotifs.delete(id);
      this.broadcastNamed(sessionId, 'notification_revoke', { id });
      return { ok: true, active: false, id };
    } else {
      const timestamp = new Date().toISOString();
      sessionNotifs.set(id, { id, message, notifyType, timestamp });
      this.broadcastNamed(sessionId, 'notification', { id, message, notifyType, timestamp });
      return { ok: true, active: true, id };
    }
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
      rawAnswer = await this.callGlm(systemPrompt, question);
    } catch (e) {
      this.logger.warn(`AI call failed: ${e}`);
      rawAnswer = '【其他】AI 助教暂时无法回答，请稍后再试。';
    }

    const parsed = this.parseCategoryFromResponse(rawAnswer);

    // Persist to DB
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

    this.broadcast(session.id);
    return { answer: parsed.answer, category: parsed.category };
  }

  private parseCategoryFromResponse(response: string): { category: string; answer: string } {
    const match = response.match(/^【(.+?)】/);
    if (match) {
      return { category: match[1], answer: response.slice(match[0].length).trim() };
    }
    return { category: '其他', answer: response };
  }

  private async buildAiSystemPrompt(lessonId: string, step: number): Promise<string> {
    try {
      const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
      if (!lesson) {
        return this.buildFallbackPrompt();
      }

      const manifest = JSON.parse(lesson.manifestJson);
      const readingSteps = manifest.readingSteps || [];
      const stepDef = readingSteps.find((s: any) => s.idx === step);
      const paragraphs: Array<{ id: string; text: string }> = manifest.article?.paragraphs || [];
      const referenceQA: Array<{ q: string; a: string; category: string }> = manifest.aiReferenceQA || [];

      const layers: string[] = [];

      // Layer 1: Role
      layers.push(`你是一位专业的英语阅读教学助教，正在帮助中学生学习阅读理解策略。
你的教学风格是苏格拉底式引导——通过提问帮助学生自己发现答案，而不是直接告诉他们。`);

      // Layer 2: Article full text
      if (paragraphs.length > 0) {
        const articleTitle = manifest.article?.title || '';
        const articleText = paragraphs.map((p: any, i: number) => `¶${i + 1}: ${p.text}`).join('\n\n');
        layers.push(`【课文全文】\n标题：${articleTitle}\n\n${articleText}`);
      }

      // Layer 3: Step context
      if (stepDef) {
        const focusParas = stepDef.focusParagraphs?.join(', ') || '全文';
        layers.push(`【当前步骤】\n步骤：${stepDef.label || ''}\n策略：${stepDef.strategy || 'N/A'}\n描述：${stepDef.description || 'N/A'}\n关注段落：${focusParas}`);
      }

      // Layer 4: Answer key awareness (task steps only)
      if (stepDef?.answerKey) {
        layers.push(`【答案信息（仅供参考，严禁直接告诉学生）】\n题型：${stepDef.answerKey.type}\n你知道正确答案，但绝对不能直接告诉学生。如果学生问答案，用提示和引导帮助他们自己找到。`);
      }

      // Layer 5: Reference Q&A (few-shot)
      if (referenceQA.length > 0) {
        const examples = referenceQA.map((qa: any) => `Q: ${qa.q}\nA: 【${qa.category}】${qa.a}`).join('\n\n');
        layers.push(`【参考问答示例】\n${examples}`);
      }

      // Layer 6: Classification instruction
      layers.push(`【回答格式要求】
1. 回答开头必须用【分类名】标注问题类型
2. 可用分类：概念理解、阅读策略、课文内容、解题求助
3. 如果问题不属于以上分类，可以创建新的合适分类名
4. 分类后直接给出回答内容

分类回答策略：
- 概念理解 → 直接解释，给出清晰定义和例子
- 阅读策略 → 给步骤指导，用课文中的例子说明
- 课文内容 → 引用原文段落回答
- 解题求助 → 苏格拉底式引导，绝不给出答案

回答规则：
- 用中文回答
- 简洁，2-3句话（30-150字），绝不超过150字
- 鼓励学生自己思考`);

      return layers.join('\n\n');
    } catch {
      return this.buildFallbackPrompt();
    }
  }

  private buildFallbackPrompt(): string {
    return `你是一位教学助教，正在帮助学生学习阅读理解。

【回答格式要求】
1. 回答开头必须用【分类名】标注问题类型
2. 可用分类：概念理解、阅读策略、课文内容、解题求助

回答规则：
- 用苏格拉底式引导：给提示和思路，不直接给出答案
- 用中文回答
- 简洁，2-3 句话
- 鼓励学生自己思考`;
  }

  private async callGlm(systemPrompt: string, userMessage: string): Promise<string> {
    const apiKey = this.configService.get<string>('ZHIPU_API_KEY');
    if (!apiKey) {
      throw new Error('ZHIPU_API_KEY not configured');
    }
    const model = this.configService.get<string>('ZHIPU_MODEL') || 'glm-4-flash';

    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 256,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GLM API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? 'AI 未返回有效回答。';
  }

  // ── Auto-grading ──

  private async gradeSubmission(lessonId: string, step: number, data: Record<string, any>): Promise<Record<string, any> | null> {
    try {
      const lesson = await this.lessonRepo.findOne({ where: { id: lessonId } });
      if (!lesson) return null;

      const manifest = JSON.parse(lesson.manifestJson);
      const readingSteps = manifest.readingSteps || [];

      // Find the step with matching idx
      const stepDef = readingSteps.find((s: any) => s.idx === step);
      if (!stepDef || !stepDef.answerKey) return null;

      const key = stepDef.answerKey;

      switch (key.type) {
        case 'quiz':
          return this.gradeQuiz(key, data);
        case 'match':
          return this.gradeMatch(key, data);
        case 'matrix':
          return this.gradeMatrix(key, data);
        case 'stance':
          return this.gradeStance(key, data);
        case 'order':
          return this.gradeOrder(key, data);
        default:
          return null;
      }
    } catch (e) {
      this.logger.warn(`Grading failed for step ${step}: ${e}`);
      return null;
    }
  }

  private gradeQuiz(key: any, data: Record<string, any>): Record<string, any> {
    const answers = key.answers || [];
    const studentAnswers = data.answers || [];
    const byDimension: Record<string, boolean> = {};
    let correct = 0;

    for (const a of answers) {
      const studentAnswer = studentAnswers[a.questionIdx];
      const isCorrect = studentAnswer === a.correct;
      byDimension[`q${a.questionIdx}`] = isCorrect;
      if (isCorrect) correct++;
    }

    const total = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;
    return { total, byDimension };
  }

  private gradeMatch(key: any, data: Record<string, any>): Record<string, any> {
    const answers = key.answers || [];
    const studentPairs = data.pairs || data.answers || [];
    const byDimension: Record<string, boolean> = {};
    let correct = 0;

    for (const a of answers) {
      const studentPair = studentPairs[a.pairIdx];
      const studentValue = typeof studentPair === 'string' ? studentPair : studentPair?.value;
      const isCorrect = studentValue?.toLowerCase() === a.correct.toLowerCase();
      byDimension[`p${a.pairIdx}`] = isCorrect;
      if (isCorrect) correct++;
    }

    const total = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;
    return { total, byDimension };
  }

  private gradeMatrix(key: any, data: Record<string, any>): Record<string, any> {
    const answers = (key.answers || []).filter((a: any) => !a.isDemo);
    const studentRows = data.rows || [];
    let placeCorrect = 0, practiceCorrect = 0, reasonCorrect = 0;
    const totalRows = answers.length;
    const byDimension: Record<string, number> = {};

    for (const a of answers) {
      const studentRow = studentRows[a.rowIdx] || {};
      const sPlace = (studentRow.place || '').toLowerCase().trim();
      const sPractice = (studentRow.practice || '').toLowerCase().trim();
      const sReason = (studentRow.reason || '').toLowerCase().trim();

      if (sPlace.includes(a.place.toLowerCase())) placeCorrect++;
      if (sPractice.includes(a.practice.toLowerCase()) || a.practice.toLowerCase().includes(sPractice)) practiceCorrect++;
      if (sReason.includes(a.reason.toLowerCase()) || a.reason.toLowerCase().includes(sReason)) reasonCorrect++;
    }

    byDimension.place = totalRows > 0 ? Math.round((placeCorrect / totalRows) * 100) : 0;
    byDimension.practice = totalRows > 0 ? Math.round((practiceCorrect / totalRows) * 100) : 0;
    byDimension.reason = totalRows > 0 ? Math.round((reasonCorrect / totalRows) * 100) : 0;

    const total = Math.round((byDimension.place + byDimension.practice + byDimension.reason) / 3);
    return { total, byDimension };
  }

  private gradeStance(key: any, data: Record<string, any>): Record<string, any> {
    const validPositions = key.validPositions || [];
    const minEvidence = key.minEvidence || 2;
    const position = (data.position || '').toLowerCase();
    const evidence = data.evidence || [];

    const hasValidPosition = validPositions.includes(position);
    const hasEnoughEvidence = Array.isArray(evidence) && evidence.length >= minEvidence;

    const byDimension: Record<string, boolean> = {
      position: hasValidPosition,
      evidence: hasEnoughEvidence,
    };

    const total = hasValidPosition && hasEnoughEvidence ? 100 : (hasValidPosition || hasEnoughEvidence ? 50 : 0);
    return { total, byDimension };
  }

  private gradeOrder(key: any, data: Record<string, any>): Record<string, any> {
    const correctOrder = key.correctOrder || [];
    const studentOrder = data.order || [];

    const isCorrect = correctOrder.length === studentOrder.length &&
      correctOrder.every((item: string, idx: number) => {
        const studentItem = typeof studentOrder[idx] === 'string' ? studentOrder[idx] : studentOrder[idx]?.label;
        return studentItem?.toLowerCase() === item.toLowerCase();
      });

    return { total: isCorrect ? 100 : 0, byDimension: { correct: isCorrect } };
  }

  // ── Private helpers ──

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARS[randomInt(CODE_CHARS.length)];
    }
    return code;
  }

  private async broadcast(sessionId: string) {
    const subs = this.subscribers.get(sessionId);
    if (!subs || subs.size === 0) return;

    const state = await this.getState(sessionId);
    const payload = `data: ${JSON.stringify(state)}\n\n`;

    for (const res of subs) {
      try {
        res.write(payload);
      } catch {
        subs.delete(res);
        const timer = this.heartbeatTimers.get(res);
        if (timer) {
          clearInterval(timer);
          this.heartbeatTimers.delete(res);
        }
      }
    }
  }

  private broadcastNamed(sessionId: string, eventName: string, payload: any) {
    const subs = this.subscribers.get(sessionId);
    if (!subs || subs.size === 0) return;

    const message = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;

    for (const res of subs) {
      try {
        res.write(message);
      } catch {
        subs.delete(res);
        const timer = this.heartbeatTimers.get(res);
        if (timer) {
          clearInterval(timer);
          this.heartbeatTimers.delete(res);
        }
      }
    }
  }

  // ── Teacher dashboard aggregation helpers ──

  /** G2: Compute per-student per-step durations in seconds */
  private computeStudentDurations(
    students: Student[],
    subsByStudent: Map<string, Record<number, { step: number; data: any; score: any; submittedAt: string }>>,
  ): Map<string, Record<number, number>> {
    const result = new Map<string, Record<number, number>>();
    const taskSteps = [1, 3, 5, 7, 9];

    for (const s of students) {
      const subs = subsByStudent.get(s.id);
      if (!subs) continue;

      const durations: Record<number, number> = {};

      for (let i = 0; i < taskSteps.length; i++) {
        const stepIdx = taskSteps[i];
        const sub = subs[stepIdx];
        if (!sub) continue;

        const subTime = new Date(sub.submittedAt).getTime();

        if (i === 0) {
          // First task: submittedAt - joinedAt
          const joinTime = s.joinedAt instanceof Date
            ? s.joinedAt.getTime()
            : new Date(String(s.joinedAt)).getTime();
          const dur = Math.round((subTime - joinTime) / 1000);
          if (dur >= 0) durations[stepIdx] = dur;
        } else {
          // Subsequent tasks: submittedAt[N] - submittedAt[N-1]
          const prevStepIdx = taskSteps[i - 1];
          const prevSub = subs[prevStepIdx];
          if (prevSub) {
            const prevTime = new Date(prevSub.submittedAt).getTime();
            const dur = Math.round((subTime - prevTime) / 1000);
            if (dur >= 0) durations[stepIdx] = dur;
          }
        }
      }

      result.set(s.id, durations);
    }

    return result;
  }

  /** Build enriched stepMetrics with byDimension, timing, AI stats, issues, questionAggregates */
  private buildStepMetrics(
    total: number,
    students: Student[],
    subsByStudent: Map<string, Record<number, { step: number; data: any; score: any; submittedAt: string }>>,
    questions: AiQuestion[],
    studentDurations: Map<string, Record<number, number>>,
    manifest: any,
  ): Record<number, Record<string, any>> {
    const stepMetrics: Record<number, Record<string, any>> = {};
    const readingSteps: any[] = manifest?.readingSteps || [];

    for (let taskNum = 1; taskNum <= 5; taskNum++) {
      const stepIdx = TASK_TO_STEP[taskNum];
      let completedCount = 0;
      let currentCount = 0;
      let totalScore = 0;
      const durations: number[] = [];
      const dimensionAgg: Record<string, { good: number; partial: number; wrong: number; total: number }> = {};

      for (const s of students) {
        const subs = subsByStudent.get(s.id);
        if (subs && subs[stepIdx]) {
          completedCount++;
          const score = subs[stepIdx].score;
          if (score && typeof score.total === 'number') {
            totalScore += score.total;
          }

          // Aggregate byDimension across students
          if (score?.byDimension) {
            for (const [dim, val] of Object.entries(score.byDimension)) {
              if (!dimensionAgg[dim]) {
                dimensionAgg[dim] = { good: 0, partial: 0, wrong: 0, total: 0 };
              }
              dimensionAgg[dim].total++;
              if (typeof val === 'boolean') {
                if (val) dimensionAgg[dim].good++;
                else dimensionAgg[dim].wrong++;
              } else if (typeof val === 'number') {
                if (val === 100) dimensionAgg[dim].good++;
                else if (val > 0) dimensionAgg[dim].partial++;
                else dimensionAgg[dim].wrong++;
              }
            }
          }

          // Collect durations
          const dur = studentDurations.get(s.id)?.[stepIdx];
          if (dur !== undefined && dur >= 0) {
            durations.push(dur);
          }
        } else if (s.currentTask === taskNum) {
          currentCount++;
        }
      }

      // G1: byDimension with human-readable keys
      const stepDef = readingSteps.find((s: any) => s.idx === stepIdx);
      const nameMap = this.getDimensionNameMap(stepDef?.answerKey);
      const byDimension: Record<string, { good: number; partial: number; wrong: number }> = {};
      for (const [dim, agg] of Object.entries(dimensionAgg)) {
        if (agg.total > 0) {
          const readableName = nameMap[dim] || dim;
          byDimension[readableName] = {
            good: Math.round((agg.good / agg.total) * 100),
            partial: Math.round((agg.partial / agg.total) * 100),
            wrong: Math.round((agg.wrong / agg.total) * 100),
          };
        }
      }

      // quality.cols — same data in array format for design prototype
      const qualityCols = Object.entries(byDimension).map(([name, vals]) => ({
        name,
        good: vals.good,
        partial: vals.partial,
        wrong: vals.wrong,
      }));

      // Calculate timing
      durations.sort((a, b) => a - b);
      const avgTime = durations.length > 0
        ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
        : null;
      const medianTime = durations.length > 0
        ? durations[Math.floor(durations.length / 2)]
        : null;

      // AI stats for this step
      const stepQuestions = questions.filter(q => q.step === stepIdx);
      const aiRounds = stepQuestions.length;
      const aiPeople = new Set(stepQuestions.map(q => q.studentId)).size;

      // G7: issues — detect common wrong answers
      const issues = this.detectIssues(stepIdx, subsByStudent, stepDef?.answerKey);

      // G5: questionAggregates with isHigh >= 4
      const questionAggregates: Record<string, { count: number; isHigh: boolean }> = {};
      for (const q of stepQuestions) {
        const cat = q.category || '其他';
        if (!questionAggregates[cat]) questionAggregates[cat] = { count: 0, isHigh: false };
        questionAggregates[cat].count++;
        questionAggregates[cat].isHigh = questionAggregates[cat].count >= 4;
      }

      stepMetrics[taskNum] = {
        currentCount,
        completedCount,
        completionRate: total > 0 ? Math.round((completedCount / total) * 100) : 0,
        avgScore: completedCount > 0 ? Math.round(totalScore / completedCount) : 0,
        byDimension,
        quality: { cols: qualityCols },
        avgTime,
        medianTime,
        aiRounds,
        aiPeople,
        issues,
        questionAggregates,
      };
    }

    return stepMetrics;
  }

  /** Extract median times per task from stepMetrics for stuck detection */
  private extractMedianTimes(stepMetrics: Record<number, any>): Record<number, number | null> {
    const result: Record<number, number | null> = {};
    for (let taskNum = 1; taskNum <= 5; taskNum++) {
      result[taskNum] = stepMetrics[taskNum]?.medianTime ?? null;
    }
    return result;
  }

  /** G3: Compute student status (done/reading/stuck/prog) */
  private computeStudentStatus(
    student: Student,
    subs: Record<number, any> | undefined,
    medianTimes: Record<number, number | null>,
  ): string {
    // done: completed phase or submitted all 5 task steps
    if (student.currentPhase === 'completed') return 'done';
    if (subs) {
      const allDone = [1, 3, 5, 7, 9].every(step => subs[step]);
      if (allDone) return 'done';
    }

    // reading: listen phase
    if (student.currentPhase === 'listen') return 'reading';

    // stuck: on current step > median × 1.5 without submission
    if (student.stepStartedAt) {
      const median = medianTimes[student.currentTask];
      if (median && median > 0) {
        const elapsed = (Date.now() - new Date(student.stepStartedAt).getTime()) / 1000;
        if (elapsed > median * 1.5) return 'stuck';
      }
    }

    return 'prog';
  }

  /** G6: Compute health cards for teacher dashboard */
  private computeHealthCards(
    students: Student[],
    studentStatuses: Map<string, string>,
    questions: AiQuestion[],
  ): {
    furthest: { step: number; count: number };
    median: { step: number };
    stuck: { count: number; location: string };
    aiTotal: { rounds: number; people: number };
  } {
    // Furthest: highest task any student has reached
    const studentTasks: number[] = [];
    for (const s of students) {
      const effectiveTask = s.currentPhase === 'completed' ? 5 : s.currentTask;
      studentTasks.push(effectiveTask);
    }

    let maxTask = 0;
    let maxTaskCount = 0;
    const taskCounts: Record<number, number> = {};
    for (const t of studentTasks) {
      taskCounts[t] = (taskCounts[t] || 0) + 1;
      if (t > maxTask) maxTask = t;
    }
    maxTaskCount = taskCounts[maxTask] || 0;

    // Median: middle value of student tasks
    const sorted = [...studentTasks].sort((a, b) => a - b);
    const medianStep = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

    // Stuck: count + concentration
    let stuckCount = 0;
    const stuckByTask: Record<number, number> = {};
    for (const s of students) {
      if (studentStatuses.get(s.id) === 'stuck') {
        stuckCount++;
        stuckByTask[s.currentTask] = (stuckByTask[s.currentTask] || 0) + 1;
      }
    }

    let stuckLocation = '';
    if (stuckCount > 0) {
      const maxEntry = Object.entries(stuckByTask).reduce(
        (max, [task, count]) => (count > max[1] ? [task, count] : max),
        ['0', 0] as [string, number],
      );
      stuckLocation = `Step ${maxEntry[0]}`;
    }

    // AI totals
    const aiRounds = questions.length;
    const aiPeople = new Set(questions.map(q => q.studentId)).size;

    return {
      furthest: { step: maxTask, count: maxTaskCount },
      median: { step: medianStep },
      stuck: { count: stuckCount, location: stuckLocation },
      aiTotal: { rounds: aiRounds, people: aiPeople },
    };
  }

  /** G1: Map code dimension keys to human-readable names based on answerKey structure */
  private getDimensionNameMap(answerKey: any): Record<string, string> {
    const map: Record<string, string> = {};
    if (!answerKey) return map;

    switch (answerKey.type) {
      case 'quiz':
        for (const a of answerKey.answers || []) {
          map[`q${a.questionIdx}`] = a.label || `Q${a.questionIdx + 1}`;
        }
        break;
      case 'match':
        for (const a of answerKey.answers || []) {
          map[`p${a.pairIdx}`] = a.left ? `${a.left}→${a.correct}` : `P${a.pairIdx + 1}`;
        }
        break;
      case 'matrix':
        map['place'] = 'Where';
        map['practice'] = 'What';
        map['reason'] = 'Why';
        break;
      case 'stance':
        map['position'] = 'Position';
        map['evidence'] = 'Evidence';
        break;
      case 'order':
        map['correct'] = 'Correct';
        break;
    }
    return map;
  }

  /** G7: Detect common wrong answer patterns for a step */
  private detectIssues(
    stepIdx: number,
    subsByStudent: Map<string, Record<number, { step: number; data: any; score: any; submittedAt: string }>>,
    answerKey: any,
  ): string[] {
    if (!answerKey) return [];

    const submissions: { data: any; score: any }[] = [];
    for (const subs of subsByStudent.values()) {
      if (subs[stepIdx]) {
        submissions.push({ data: subs[stepIdx].data, score: subs[stepIdx].score });
      }
    }
    if (submissions.length === 0) return [];

    const wrongCounts = new Map<string, number>();

    switch (answerKey.type) {
      case 'quiz': {
        const answers = answerKey.answers || [];
        for (const sub of submissions) {
          const studentAnswers = sub.data?.answers || [];
          for (const a of answers) {
            const studentAnswer = studentAnswers[a.questionIdx];
            if (studentAnswer != null && studentAnswer !== a.correct) {
              const label = a.label || `Q${a.questionIdx + 1}`;
              const key = `${label} 选了 ${studentAnswer}（应为 ${a.correct}）`;
              wrongCounts.set(key, (wrongCounts.get(key) || 0) + 1);
            }
          }
        }
        break;
      }
      case 'match': {
        const answers = answerKey.answers || [];
        for (const sub of submissions) {
          const pairs = sub.data?.pairs || sub.data?.answers || [];
          for (const a of answers) {
            const raw = pairs[a.pairIdx];
            const studentValue = typeof raw === 'string' ? raw : raw?.value;
            if (studentValue != null && studentValue.toLowerCase() !== a.correct.toLowerCase()) {
              const label = a.left || `P${a.pairIdx + 1}`;
              const key = `${label} 匹配为 ${studentValue}（应为 ${a.correct}）`;
              wrongCounts.set(key, (wrongCounts.get(key) || 0) + 1);
            }
          }
        }
        break;
      }
      case 'matrix': {
        const answers = (answerKey.answers || []).filter((a: any) => !a.isDemo);
        const colNames: Record<string, string> = { place: 'Where', practice: 'What', reason: 'Why' };
        for (const sub of submissions) {
          const studentRows = sub.data?.rows || [];
          for (const a of answers) {
            const studentRow = studentRows[a.rowIdx] || {};
            for (const col of ['place', 'practice', 'reason']) {
              const correct = (a[col] || '').toLowerCase().trim();
              const student = (studentRow[col] || '').toLowerCase().trim();
              if (student && correct && !student.includes(correct) && !correct.includes(student)) {
                const key = `${colNames[col] || col} 写 ${studentRow[col]} 而非 ${a[col]}`;
                wrongCounts.set(key, (wrongCounts.get(key) || 0) + 1);
              }
            }
          }
        }
        break;
      }
      case 'stance': {
        const validPositions: string[] = answerKey.validPositions || [];
        const minEvidence: number = answerKey.minEvidence || 2;
        for (const sub of submissions) {
          const position = (sub.data?.position || '').toLowerCase();
          const evidence = sub.data?.evidence || [];
          if (position && !validPositions.includes(position)) {
            const key = `立场为 ${sub.data.position}（有效立场：${validPositions.join('/')}）`;
            wrongCounts.set(key, (wrongCounts.get(key) || 0) + 1);
          }
          if (Array.isArray(evidence) && evidence.length > 0 && evidence.length < minEvidence) {
            const key = `论据不足（仅 ${evidence.length} 条，需 ${minEvidence} 条）`;
            wrongCounts.set(key, (wrongCounts.get(key) || 0) + 1);
          }
        }
        break;
      }
      case 'order': {
        const correctOrder: string[] = answerKey.correctOrder || [];
        for (const sub of submissions) {
          const studentOrder = sub.data?.order || [];
          if (studentOrder.length === 0) continue;
          for (let i = 0; i < correctOrder.length; i++) {
            const expected = correctOrder[i];
            const got = typeof studentOrder[i] === 'string' ? studentOrder[i] : studentOrder[i]?.label;
            if (got && got.toLowerCase() !== expected.toLowerCase()) {
              const key = `位置 ${i + 1} 放了 ${got}（应为 ${expected}）`;
              wrongCounts.set(key, (wrongCounts.get(key) || 0) + 1);
            }
          }
        }
        break;
      }
    }

    return Array.from(wrongCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([desc, count]) => `${count} 人${desc}`);
  }

  /** G4: Compute alertTag for a step card (priority: stuck > wrong_dimension > issue) */
  private computeAlertTag(
    taskNum: number,
    metrics: Record<string, any>,
    students: Student[],
    studentStatuses: Map<string, string>,
  ): string | null {
    // Priority 1: stuck students at this step >= 5
    const stuckAtStep = students.filter(
      s => s.currentTask === taskNum && studentStatuses.get(s.id) === 'stuck',
    ).length;
    if (stuckAtStep >= 5) return `${stuckAtStep} 人卡住`;

    // Priority 2: any dimension with wrong >= 30%
    const byDim = metrics.byDimension || {};
    for (const [dimName, dim] of Object.entries(byDim) as [string, { wrong: number }][]) {
      if (dim.wrong >= 30) return `${dimName} 错误偏高`;
    }

    // Priority 3: any issue with count >= 5
    const issues: string[] = metrics.issues || [];
    for (const issue of issues) {
      const m = issue.match(/^(\d+) 人/);
      if (m && parseInt(m[1]) >= 5) return issue;
    }

    return null;
  }
}
