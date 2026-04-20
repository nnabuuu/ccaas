import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomInt } from 'crypto';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import type { Response } from 'express';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 30 chars, no 0/O/1/I/L
const CODE_LENGTH = 6;

@Injectable()
export class ClassroomService {
  private readonly logger = new Logger(ClassroomService.name);
  private subscribers = new Map<string, Set<Response>>();
  private heartbeatTimers = new Map<Response, NodeJS.Timeout>();
  private currentStepMap = new Map<string, number>();

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Submission)
    private readonly submissionRepo: Repository<Submission>,
    @InjectRepository(ClassroomSession)
    private readonly sessionRepo: Repository<ClassroomSession>,
  ) {}

  // ── Session lifecycle ──

  async createSession(lessonId: string) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.generateCode();
      try {
        const session = this.sessionRepo.create({ code, lessonId, status: 'active' });
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
    };
  }

  async endSession(code: string) {
    const session = await this.resolveSession(code);
    if (session.status === 'ended') {
      return { ok: true, status: 'ended' };
    }
    session.status = 'ended';
    session.endedAt = new Date();
    await this.sessionRepo.save(session);
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

    const existing = await this.submissionRepo.findOne({
      where: { sessionId: session.id, studentId, step },
    });
    if (existing) {
      existing.dataJson = data;
      await this.submissionRepo.save(existing);
    } else {
      const submission = this.submissionRepo.create({
        sessionId: session.id,
        lessonId: session.lessonId,
        studentId,
        step,
        dataJson: data,
      });
      await this.submissionRepo.save(submission);
    }

    this.broadcast(session.id);
    return { ok: true };
  }

  async getState(sessionId: string, currentStep?: number) {
    const students = await this.studentRepo.find({
      where: { sessionId },
      order: { joinedAt: 'ASC' },
    });

    const submissions = await this.submissionRepo.find({
      where: { sessionId },
    });

    const subsByStudent = new Map<string, Record<number, { step: number; data: any; submittedAt: string }>>();
    for (const sub of submissions) {
      if (!subsByStudent.has(sub.studentId)) {
        subsByStudent.set(sub.studentId, {});
      }
      subsByStudent.get(sub.studentId)[sub.step] = {
        step: sub.step,
        data: sub.dataJson,
        submittedAt: sub.submittedAt instanceof Date
          ? sub.submittedAt.toISOString()
          : String(sub.submittedAt),
      };
    }

    const stepToCheck = currentStep ?? 0;
    const total = students.length;
    let submitted = 0;
    for (const s of students) {
      const subs = subsByStudent.get(s.id);
      if (subs && subs[stepToCheck]) {
        submitted++;
      }
    }

    return {
      currentStep: stepToCheck,
      students: students.map(s => ({
        id: s.id,
        name: s.name,
        submissions: subsByStudent.get(s.id) || {},
      })),
      metrics: {
        total,
        submitted,
        inProgress: total - submitted,
      },
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
    this.subscribers.get(sessionId).add(res);

    this.getState(sessionId).then(state => {
      res.write(`data: ${JSON.stringify(state)}\n\n`);
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
    this.currentStepMap.set(sessionId, step);
    const state = await this.getState(sessionId, step);
    this.broadcastNamed(sessionId, 'step_sync', { currentStep: step, ...state });
    return { ok: true, currentStep: step };
  }

  notify(sessionId: string, message: string, type?: string) {
    this.broadcastNamed(sessionId, 'notification', {
      message,
      notifyType: type || 'general',
    });
    return { ok: true };
  }

  aiAsk(step: number, question: string): string {
    const q = question.toLowerCase();
    if (step === 0 || q.includes('predict') || q.includes('schema'))
      return 'Predicting helps activate prior knowledge. Before reading, look at the title and images — what do you already know about this topic? What do you expect to learn?';
    if (step === 1 || q.includes('skim') || q.includes('structure') || q.includes('signal'))
      return 'Skimming means reading only the first sentence of each paragraph to get the overall structure. Look for signal words like "however", "around the world", "over time" — they tell you how the text is organized.';
    if (step === 2 || q.includes('matrix') || q.includes('place') || q.includes('practice') || q.includes('reason'))
      return 'For the matrix, find each place mentioned in the text, then identify what beauty practice is described and why people do it. Use the paragraph numbers to locate the information quickly.';
    if (step === 3 || q.includes('critical') || q.includes('reason') || q.includes('shallow'))
      return 'Look at the Reason column in your matrix. Are these really just about looking good? Think deeper — many practices are about identity, social status, or cultural belonging. That is critical thinking!';
    if (step === 4 || q.includes('recap') || q.includes('strategy'))
      return 'Today we used 4 reading strategies: Predicting (before reading), Skimming (first sentences), Scanning (finding details for the matrix), and Evaluating (critical thinking about reasons).';
    return 'Great question! Think about what clues the text gives you. Look at the key words and try to connect them to what you already know.';
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
}
