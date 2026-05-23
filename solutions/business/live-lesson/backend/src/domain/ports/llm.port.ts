/**
 * LLM port — the contract domain code uses to reach a language model.
 *
 * Domain (and the per-type plugins / graders that live in domain) imports
 * only this interface; the concrete implementation lives in the application
 * layer (`AiPromptBuilder`) and is bound to the `LLM_PORT` token in
 * infra wiring. This is the seam that keeps domain free of HTTP/SDK
 * dependencies and free of imports up into the application layer.
 *
 * The surface is intentionally minimal — just the two methods that
 * plugin graders + cluster classifier actually need. The thicker conversation
 * helpers on `AiPromptBuilder` (callLlmConversation / callVisionConversation
 * / parseOrRepairDiscussResponse / buildPersonalTouchPrompt) stay on the
 * concrete class because their callers are application services, which may
 * legitimately depend on each other within the same layer.
 */

export const LLM_PORT = Symbol('LlmPort');

export interface LlmPortCallOptions {
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: 'json_object' };
  model?: string;
}

export type LlmVisionContent = Array<
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
>;

export interface LlmPort {
  /** Text-only LLM call. Returns the assistant's reply string. */
  callLlm(
    systemPrompt: string,
    userMessage: string,
    options?: LlmPortCallOptions,
  ): Promise<string>;

  /** Vision LLM call. `content` mixes text + image_url parts in the user message. */
  callVisionLlm(
    systemPrompt: string,
    content: LlmVisionContent,
    options?: LlmPortCallOptions,
  ): Promise<string>;
}
