import type {
  SessionProvider,
  SessionResult,
  TokenUsage,
} from '@kedge-agentic/harness';
import { v4 as uuidv4 } from 'uuid';

interface SessionState {
  templateId: string;
  metadata?: Record<string, unknown>;
  message?: string;
}

export class CcaasSessionProvider implements SessionProvider {
  private sessions = new Map<string, SessionState>();
  private ccaasBaseUrl: string;
  private tenantId: string;

  private skillMap: Record<string, string> = {
    'article-writer': 'article-writer',
    'article-analyzer': 'article-analyzer',
  };

  constructor(ccaasBaseUrl: string, tenantId: string) {
    this.ccaasBaseUrl = ccaasBaseUrl;
    this.tenantId = tenantId;
  }

  async createSession(params: {
    templateId: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ sessionId: string }> {
    const sessionId = uuidv4();
    this.sessions.set(sessionId, {
      templateId: params.templateId,
      metadata: params.metadata,
    });
    return { sessionId };
  }

  async sendMessage(sessionId: string, content: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.message = content;
    }
  }

  async waitForCompletion(sessionId: string): Promise<SessionResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        text: '{}',
        tokensUsed: { inputTokens: 0, outputTokens: 0 },
        finishReason: 'error',
      };
    }

    const message = session.message || '';
    const templateId = session.templateId;
    const skillSlug = this.skillMap[templateId] || templateId;

    try {
      const response = await fetch(
        `${this.ccaasBaseUrl}/api/v1/sessions/${sessionId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            tenantId: this.tenantId,
            message,
            enabledSkills: [skillSlug],
            autoClose: true,
            templateName: templateId,
            userId: 'system',
          }),
        },
      );

      if (!response.ok) {
        return {
          text: '{}',
          tokensUsed: { inputTokens: 0, outputTokens: 0 },
          finishReason: 'error',
        };
      }

      const body = response.body;
      if (!body) {
        return {
          text: '{}',
          tokensUsed: { inputTokens: 0, outputTokens: 0 },
          finishReason: 'error',
        };
      }

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const event = parsed.event;
            if (!event) continue;

            if (event.type === 'text_delta' && event.delta) {
              fullText += event.delta;
            } else if (event.type === 'token_usage') {
              inputTokens += event.inputTokens || 0;
              outputTokens += event.outputTokens || 0;
            } else if (
              event.type === 'agent_status' &&
              event.status === 'idle'
            ) {
              break;
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }

      this.sessions.delete(sessionId);

      return {
        text: fullText,
        tokensUsed: { inputTokens, outputTokens },
        finishReason: 'completed',
      };
    } catch {
      return {
        text: '{}',
        tokensUsed: { inputTokens: 0, outputTokens: 0 },
        finishReason: 'error',
      };
    }
  }

  async getTokenUsage(sessionId: string): Promise<TokenUsage> {
    try {
      const response = await fetch(
        `${this.ccaasBaseUrl}/api/v1/sessions/${sessionId}/token-usage`,
      );
      if (!response.ok) {
        return { inputTokens: 0, outputTokens: 0 };
      }
      const data = await response.json();
      return {
        inputTokens: data.summary?.totalInputTokens ?? 0,
        outputTokens: data.summary?.totalOutputTokens ?? 0,
      };
    } catch {
      return { inputTokens: 0, outputTokens: 0 };
    }
  }
}
