import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from '../../entities/student.entity';
import { ClassroomSession } from '../../entities/classroom-session.entity';
import { ObservationService } from '../observation/observation.service';
import { AiPromptBuilder } from '../ai-prompt-builder';

/** Simple LRU cache scoped per session */
class LruCache {
  private map = new Map<string, string>();
  constructor(private readonly maxSize: number) {}

  get(key: string): string | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      // Move to end (most recently used)
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }

  set(key: string, value: string): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxSize) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
  }
}

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  /** sessionId → LRU cache of normalized text → translation */
  private caches = new Map<string, LruCache>();

  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    private readonly observationService: ObservationService,
    private readonly aiPromptBuilder: AiPromptBuilder,
  ) {}

  async translate(
    session: ClassroomSession,
    studentId: string,
    text: string,
    step: number,
    sourceContext: string,
    phase?: string,
  ): Promise<{ translation: string }> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId, sessionId: session.id },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    const normalized = text.trim().toLowerCase();
    const cache = this.getCache(session.id);
    const cached = cache.get(normalized);
    if (cached) {
      return { translation: cached };
    }

    let translation: string;
    try {
      translation = await this.aiPromptBuilder.callLlm(
        'You are a translation assistant. Translate the following English text to Simplified Chinese (简体中文). Output ONLY the translation, nothing else.',
        text,
        { maxTokens: 512, temperature: 0.3 },
      );
    } catch (e) {
      this.logger.warn(`Translation LLM call failed: ${e}`);
      return { translation: '翻译服务暂时不可用，请稍后再试。' };
    }

    cache.set(normalized, translation);

    this.observationService.addSystemEvent(
      session.id, studentId, student.name, 'translate_request',
      { step, sourceContext, phase: phase ?? null, textLength: text.length },
      `翻译请求: "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}"`,
    ).catch(e => this.logger.warn(`Observation translate_request failed: ${e}`));

    return { translation };
  }

  clearSession(sessionId: string): void {
    this.caches.delete(sessionId);
  }

  private getCache(sessionId: string): LruCache {
    let cache = this.caches.get(sessionId);
    if (!cache) {
      cache = new LruCache(200);
      this.caches.set(sessionId, cache);
    }
    return cache;
  }
}
