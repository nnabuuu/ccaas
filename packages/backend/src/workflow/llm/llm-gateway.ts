/**
 * `LlmGateway` — narrow LLM-call contract used by Workflow action
 * handlers. Phase 5 M4 introduces this in the platform backend; the
 * legacy `OpenAiLlmGateway` in live-lesson gets retired in M6.
 *
 * Why an interface (not just a concrete class):
 *   - LLM-driven action handlers (ChatTurnHandler, StatusChangeHandler)
 *     need to test deterministically. A stub `LlmGateway` lets tests
 *     return canned strings without booting OpenAI.
 *   - Future swap (Anthropic / GLM / local model) doesn't ripple
 *     through handler code.
 */

export interface LlmChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface LlmCompletionOptions {
  readonly responseFormat?: 'text' | 'json';
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface LlmGateway {
  chat(
    messages: readonly LlmChatMessage[],
    options?: LlmCompletionOptions,
  ): Promise<string>;
}

/** DI token for the global LlmGateway instance. */
export const LLM_GATEWAY = Symbol('LLM_GATEWAY');
