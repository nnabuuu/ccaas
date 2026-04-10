import type {
  SessionProvider,
  SessionResult,
  TokenUsage,
} from '@kedge-agentic/harness';

const SCORE_PROGRESSION = [60, 68, 75, 82, 88];

export class MockSessionProvider implements SessionProvider {
  private sessions = new Map<
    string,
    { templateId: string; metadata?: Record<string, unknown>; message?: string }
  >();
  private sessionCounter = 0;
  private callbackBaseUrl: string;

  constructor(callbackBaseUrl: string) {
    this.callbackBaseUrl = callbackBaseUrl;
  }

  async createSession(params: {
    templateId: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ sessionId: string }> {
    const sessionId = `mock_session_${++this.sessionCounter}`;
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

    // Simulate processing delay
    await sleep(500 + Math.random() * 500);

    const meta = session.metadata as
      | { runId?: string; iteration?: number; stepId?: string }
      | undefined;
    const iteration = meta?.iteration ?? 1;
    const runId = meta?.runId;
    const stepId = meta?.stepId;

    const templateId = session.templateId;

    if (templateId.includes('evaluator')) {
      // Evaluator role — return score
      const scoreIndex = Math.min(iteration - 1, SCORE_PROGRESSION.length - 1);
      const score = SCORE_PROGRESSION[scoreIndex];
      const result = {
        score,
        totalScore: score,
        dimensions: [
          { name: 'Quality', score: score - 5, weight: 0.4 },
          { name: 'Completeness', score: score + 2, weight: 0.3 },
          { name: 'Clarity', score: score - 1, weight: 0.3 },
        ],
        feedback: `Iteration ${iteration}: Score improved to ${score}. Key improvements in clarity and structure.`,
        topIssue: score < 85 ? 'Needs more specific examples' : 'Minor formatting issues remain',
      };

      // Submit via callback
      if (runId && stepId) {
        this.submitCallback(runId, iteration, stepId, 'eval_report', result).catch(() => {});
      }

      return {
        text: JSON.stringify(result),
        tokensUsed: { inputTokens: 800, outputTokens: 400 },
        finishReason: 'completed',
      };
    }

    // Generator role — return improvement text
    const result = {
      content: `Improved artifact for iteration ${iteration}. Enhanced structure and added examples.`,
      changes: [`Refactored section ${iteration}`, 'Added examples', 'Fixed formatting'],
      artifact: `# Document v${iteration}\n\nThis is the improved document after iteration ${iteration}.`,
    };

    if (runId && stepId) {
      this.submitCallback(runId, iteration, stepId, 'generation', result).catch(() => {});
    }

    return {
      text: JSON.stringify(result),
      tokensUsed: { inputTokens: 1200, outputTokens: 600 },
      finishReason: 'completed',
    };
  }

  async getTokenUsage(sessionId: string): Promise<TokenUsage> {
    return { inputTokens: 1000, outputTokens: 500 };
  }

  private async submitCallback(
    runId: string,
    iteration: number,
    stepId: string,
    outputKey: string,
    data: unknown,
  ): Promise<void> {
    try {
      await fetch(`${this.callbackBaseUrl}/harness/callback/output`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, iteration, stepId, outputKey, data }),
      });
    } catch {
      // Callback failure is non-fatal — output extractor will use fallback
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
