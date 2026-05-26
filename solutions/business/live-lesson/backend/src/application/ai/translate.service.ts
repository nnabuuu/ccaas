import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import type { ClassroomSessionRecord } from '../../domain/types/classroom-session';
import { createHash } from 'crypto';
import { STUDENT_REPO_PORT, type StudentRepoPort } from '../../domain/ports/student-repo.port';
import type { StudentRecord } from '../../domain/types/student';
import { LESSON_REPO_PORT, type LessonRepoPort } from '../../domain/ports/lesson-repo.port';
import { CHAT_MESSAGE_REPO_PORT, type ChatMessageRepoPort } from '../../domain/ports/chat-message-repo.port';
import { jsonrepair } from 'jsonrepair';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';
import { ManifestCacheService } from '../classroom/manifest-cache.service';
import { OBSERVER_ENGINE, type ObserverEngine } from '@kedge-agentic/observer-engine';

export interface TranslateResponse {
  definition: string;
  contextAnalysis: string;
  suggestedQuestions: string[];
}

/** Generic LRU cache scoped per session */
class LruCache<T> {
  private map = new Map<string, T>();
  constructor(private readonly maxSize: number) {}

  get(key: string): T | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }

  set(key: string, value: T): void {
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
  /** sessionId → LRU cache of normalized text → TranslateResponse */
  private caches = new Map<string, LruCache<TranslateResponse>>();

  constructor(
    @Inject(STUDENT_REPO_PORT)
    private readonly studentRepo: StudentRepoPort,
    @Inject(LESSON_REPO_PORT)
    private readonly lessonRepo: LessonRepoPort,
    @Inject(CHAT_MESSAGE_REPO_PORT)
    private readonly chatMessageRepo: ChatMessageRepoPort,
    private readonly aiPromptBuilder: AiPromptBuilder,
    private readonly manifestCache: ManifestCacheService,
    @Inject(OBSERVER_ENGINE) private readonly engine: ObserverEngine,
  ) {}

  async translate(
    session: ClassroomSessionRecord,
    studentId: string,
    text: string,
    step: number,
    sourceContext: string,
    phase?: string,
  ): Promise<TranslateResponse> {
    const student = await this.studentRepo.findBySessionAndId(session.id, studentId);
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    text = text.trim();
    const normalized = text.toLowerCase();
    const cache = this.getCache(session.id);
    const cached = cache.get(normalized);
    if (cached) {
      return cached;
    }

    // Load manifest for contextual prompts
        const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);

    let result: TranslateResponse;
    try {
      if (manifest) {
        const readingSteps = manifest.readingSteps || [];
        const stepDef = readingSteps.find((s: any) => s.idx === step);
        const systemPrompt = this.aiPromptBuilder.buildTranslatePrompt(manifest, stepDef);
        const contextLabels: Record<string, string> = {
          'text-panel': '课文正文',
          'instruction': '教学指导',
          'practice': '练习题',
          'discuss': '讨论区',
          'takeaway': '课堂总结',
          'ai-chat': 'AI助手对话',
          'task-panel': '任务面板',
        };
        const label = contextLabels[sourceContext] ?? '未知区域';
        const stepName = stepDef?.label ? `Task ${step}（${stepDef.label}）` : `Task ${step}`;
        const userMessage = `学生在 ${stepName} 的【${label}】中选中了：「${text}」`;

        const raw = await this.aiPromptBuilder.callLlm(systemPrompt, userMessage, {
          maxTokens: 2000,
          temperature: 0.3,
          responseFormat: { type: 'json_object' },
        });

        result = this.parseTranslateResponse(raw);
      } else {
        // Fallback: no manifest available — simpler prompt
        const raw = await this.aiPromptBuilder.callLlm(
          `你是一位英语阅读教学助教。将以下英文翻译为中文并分析。
返回 JSON: { "definition": "中文释义", "contextAnalysis": "分析", "suggestedQuestions": ["追问1", "追问2"] }
输出纯 JSON，不加 markdown 代码块。`,
          text,
          { maxTokens: 2000, temperature: 0.3, responseFormat: { type: 'json_object' } },
        );
        result = this.parseTranslateResponse(raw);
      }
    } catch (e) {
      this.logger.warn(`Translation LLM call failed: ${e}`);
      return {
        definition: '翻译服务暂时不可用，请稍后再试。',
        contextAnalysis: '',
        suggestedQuestions: [],
      };
    }

    cache.set(normalized, result);

    this.engine.dispatch({
      type: 'translate_request',
      sessionId: session.id,
      entityId: studentId,
      solutionId: session.lessonId,
      payload: {
        step,
        sourceContext,
        phase: phase ?? null,
        text,
        definition: result.definition,
        contextAnalysis: result.contextAnalysis,
      },
    }).catch(e => this.logger.warn(`Observer dispatch translate_request failed: ${e}`));

    return result;
  }

  async translateChat(
    session: ClassroomSessionRecord,
    studentId: string,
    step: number,
    originalText: string,
    question: string,
    sourceContext: string,
  ): Promise<{ reply: string }> {
    const student = await this.studentRepo.findBySessionAndId(session.id, studentId);
    if (!student) {
      throw new NotFoundException('Student not found in this session');
    }

    // Thread ID: translate:{step}:{sha256(text).slice(0,8)}
    const textHash = createHash('sha256').update(originalText.trim().toLowerCase()).digest('hex').slice(0, 8);
    const threadId = `translate:${step}:${textHash}`;

    // Load chat history (cap at 20 messages = 10 turns to bound context window)
    const MAX_CHAT_HISTORY = 20;
    const history = await this.chatMessageRepo.findBySessionAndStudent(session.id, studentId, threadId);
    const trimmedHistory = history.slice(-MAX_CHAT_HISTORY);

    // Load manifest + stepDef
        const manifest = await this.manifestCache.getManifest(session.lessonId, this.lessonRepo);

    // Get cached definition for system prompt context
    const normalized = originalText.trim().toLowerCase();
    const cache = this.getCache(session.id);
    const cachedTranslation = cache.get(normalized);
    const definition = cachedTranslation?.definition ?? originalText;

    // Build system prompt
    let systemPrompt: string;
    if (manifest) {
      const readingSteps = manifest.readingSteps || [];
      const stepDef = readingSteps.find((s: any) => s.idx === step);
      systemPrompt = this.aiPromptBuilder.buildTranslateChatPrompt(manifest, stepDef, originalText, definition);
    } else {
      systemPrompt = `你是一位英语阅读教学助教，帮助中学生理解生词和短语。
学生查询的词/短语：「${originalText}」
释义：${definition}
用中文回答，简洁明了，不超过 200 字。`;
    }

    // Build messages array from trimmed history + new question
    // DB stores 'student'/'ai'; LLM expects 'user'/'assistant'
    const messages: Array<{ role: 'assistant' | 'user'; content: string }> = trimmedHistory.map(m => ({
      role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
      content: m.content,
    }));
    messages.push({ role: 'user', content: question });

    let reply: string;
    try {
      reply = await this.aiPromptBuilder.callLlmConversation(systemPrompt, messages, {
        maxTokens: 512,
        temperature: 0.5,
      });
    } catch (e) {
      this.logger.warn(`Translate chat LLM call failed: ${e}`);
      return { reply: 'AI 助教暂时无法回答，请稍后再试。' };
    }

    // Persist student message + AI reply (seq computed inside transaction to avoid races)
    await this.chatMessageRepo.appendTranslateTurn({
      sessionId: session.id, studentId, threadId,
      question, reply,
    });

    this.engine.dispatch({
      type: 'translate_chat_turn',
      sessionId: session.id,
      entityId: studentId,
      solutionId: session.lessonId,
      payload: { step, threadId, sourceContext, questionLength: question.length },
    }).catch(e => this.logger.warn(`Observer dispatch translate_chat_turn failed: ${e}`));

    return { reply };
  }

  clearSession(sessionId: string): void {
    this.caches.delete(sessionId);
  }

  private getCache(sessionId: string): LruCache<TranslateResponse> {
    let cache = this.caches.get(sessionId);
    if (!cache) {
      cache = new LruCache<TranslateResponse>(200);
      this.caches.set(sessionId, cache);
    }
    return cache;
  }

  private parseTranslateResponse(raw: string): TranslateResponse {
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim();
      const repaired = jsonrepair(cleaned);
      const parsed = JSON.parse(repaired);
      return {
        definition: typeof parsed.definition === 'string' ? parsed.definition : raw.trim(),
        contextAnalysis: typeof parsed.contextAnalysis === 'string' ? parsed.contextAnalysis : '',
        suggestedQuestions: Array.isArray(parsed.suggestedQuestions)
          ? parsed.suggestedQuestions.filter((q: unknown) => typeof q === 'string')
          : [],
      };
    } catch {
      return { definition: raw.trim(), contextAnalysis: '', suggestedQuestions: [] };
    }
  }
}
