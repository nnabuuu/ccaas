import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PROMPTS } from '../content/prompts';
import { SENTS } from '../content/reading-text';

export interface T1Evaluation {
  topicSentence: { found: boolean; feedback: string };
  paragraphStructure: {
    point: { identified: boolean; feedback: string };
    evidence: { identified: boolean; feedback: string };
    elaboration: { identified: boolean; feedback: string };
  };
  overallTip: string;
}

export interface T2Evaluation {
  found: string[];
  missed: string[];
  feedback: string;
  encouragement: string;
}

export interface WritingEvaluation {
  hasTopicSentence: { score: number; comment: string };
  hasSpecificExample: { score: number; comment: string };
  usesTransitions: { score: number; comment: string };
  overallSuggestion: string;
  wordCount: number;
  improvementNote: string | null;
}

export interface HelpMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface WritingContext {
  text: string;
  versionNumber: number;
  evaluation?: WritingEvaluation;
}

@Injectable()
export class EvaluatorService {
  private readonly logger = new Logger(EvaluatorService.name);
  private readonly ccaasUrl: string;
  private readonly tenantId: string;
  private readonly mode: string; // 'ccaas' | 'direct'

  constructor(private configService: ConfigService) {
    this.ccaasUrl = this.configService.get('CCAAS_URL', 'http://localhost:3001');
    this.tenantId = this.configService.get('TENANT_ID', 'ideal-beauty');
    this.mode = this.configService.get('EVALUATOR_MODE', 'ccaas');
  }

  async evaluateT1(
    studentSessionId: string,
    highlights: Record<string, string>,
  ): Promise<T1Evaluation> {
    // Build human-readable input from highlights
    const hlMap: Record<string, string[]> = {};
    for (const [sentId, type] of Object.entries(highlights)) {
      if (!hlMap[type]) hlMap[type] = [];
      const sent = SENTS.find((s) => s.id === sentId);
      if (sent) hlMap[type].push(sent.text);
    }

    const input = [
      `Topic sentence: ${(hlMap['topic'] || []).join(' ') || '(none)'}`,
      `Point: ${(hlMap['point'] || []).join(' ') || '(none)'}`,
      `Evidence: ${(hlMap['evidence'] || []).join(' ') || '(none)'}`,
      `Elaboration: ${(hlMap['elaboration'] || []).join(' ') || '(none)'}`,
    ].join('\n');

    const sessionId = `eval_${studentSessionId}_t1`;
    return this.callCcaas<T1Evaluation>(sessionId, 'evaluation', input);
  }

  async evaluateT2(
    studentSessionId: string,
    transitions: string[],
  ): Promise<T2Evaluation> {
    const input = `Found: ${transitions.join(', ')}`;
    const sessionId = `eval_${studentSessionId}_t2`;
    return this.callCcaas<T2Evaluation>(sessionId, 'evaluation', input);
  }

  async evaluateWriting(
    studentSessionId: string,
    text: string,
    prevVersion?: WritingContext,
  ): Promise<WritingEvaluation> {
    let input = `Paragraph:\n${text}`;
    if (prevVersion) {
      input += `\nPrevious: ${prevVersion.text}`;
      if (prevVersion.evaluation) {
        const ev = prevVersion.evaluation;
        input += `\nPrev score: TS:${ev.hasTopicSentence?.score}, Ex:${ev.hasSpecificExample?.score}, Tr:${ev.usesTransitions?.score}`;
        input += `\nPrev suggestion: ${ev.overallSuggestion}`;
      }
      input += `\nRevision #${prevVersion.versionNumber + 1}.`;
    }

    const sessionId = `eval_${studentSessionId}_writing`;
    return this.callCcaas<WritingEvaluation>(sessionId, 'evaluation', input);
  }

  async helpChat(
    studentSessionId: string,
    message: string,
    sceneId: string,
    history: HelpMessage[],
  ): Promise<string> {
    // For help chat, include context about current scene
    const contextPrefix = `[Student is at scene ${sceneId}]\n`;
    const fullMessage = contextPrefix + message;

    const sessionId = `help_${studentSessionId}`;

    if (this.mode === 'direct') {
      return this.callDirectChat(fullMessage, history);
    }

    // CCAAS mode: use help-chat template
    return this.callCcaasChat(sessionId, 'help-chat', fullMessage);
  }

  // ─── CCAAS call methods ───

  private async callCcaas<T>(
    sessionId: string,
    templateName: string,
    message: string,
  ): Promise<T> {
    if (this.mode === 'direct') {
      return this.callDirect<T>(message, templateName);
    }

    const url = `${this.ccaasUrl}/api/v1/sessions/${sessionId}/messages`;
    this.logger.debug(`CCAAS call: ${url} template=${templateName}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          tenantId: this.tenantId,
          templateName,
        }),
      });

      if (!response.ok) {
        throw new Error(`CCAAS responded ${response.status}`);
      }

      // Consume SSE response: accumulate text_delta events until agent_status: complete
      const text = await this.consumeSseResponse(response);
      return this.parseJsonResponse<T>(text);
    } catch (error) {
      this.logger.warn(`CCAAS call failed, falling back to direct: ${error.message}`);
      return this.callDirect<T>(message, templateName);
    }
  }

  private async callCcaasChat(
    sessionId: string,
    templateName: string,
    message: string,
  ): Promise<string> {
    const url = `${this.ccaasUrl}/api/v1/sessions/${sessionId}/messages`;
    this.logger.debug(`CCAAS chat call: ${url} template=${templateName}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          tenantId: this.tenantId,
          templateName,
        }),
      });

      if (!response.ok) {
        throw new Error(`CCAAS responded ${response.status}`);
      }

      return this.consumeSseResponse(response);
    } catch (error) {
      this.logger.warn(`CCAAS chat failed: ${error.message}`);
      return 'Sorry, I had trouble connecting. Please try again. 抱歉，请重试。';
    }
  }

  private async consumeSseResponse(response: globalThis.Response): Promise<string> {
    const body = await response.text();
    let accumulated = '';

    // Parse SSE events from response body
    const lines = body.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'text_delta' && data.text) {
            accumulated += data.text;
          } else if (data.type === 'content_block_delta' && data.delta?.text) {
            accumulated += data.delta.text;
          }
        } catch {
          // Some data lines may not be JSON; accumulate raw text
          const raw = line.slice(6).trim();
          if (raw && raw !== '[DONE]') {
            accumulated += raw;
          }
        }
      }
    }

    return accumulated || body;
  }

  // ─── Direct Anthropic API fallback ───

  private async callDirect<T>(
    message: string,
    templateName: string,
  ): Promise<T> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('No ANTHROPIC_API_KEY configured for direct mode');
    }

    const systemPrompt =
      templateName === 'evaluation'
        ? this.getEvalSystemPrompt(message)
        : PROMPTS.helpChat;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await response.json();
    const text = (data.content || []).map((b: any) => b.text || '').join('');
    return this.parseJsonResponse<T>(text);
  }

  private async callDirectChat(
    message: string,
    history: HelpMessage[],
  ): Promise<string> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return 'AI tutor is currently unavailable. Please try again later.';
    }

    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: PROMPTS.helpChat,
        messages,
      }),
    });

    const data = await response.json();
    return (data.content || []).map((b: any) => b.text || '').join('');
  }

  private getEvalSystemPrompt(message: string): string {
    // Detect which eval type based on message content patterns
    if (message.includes('Topic sentence:') && message.includes('Point:')) {
      return PROMPTS.t1;
    }
    if (message.startsWith('Found:')) {
      return PROMPTS.t2;
    }
    return PROMPTS.t3;
  }

  private parseJsonResponse<T>(text: string): T {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned) as T;
  }
}
