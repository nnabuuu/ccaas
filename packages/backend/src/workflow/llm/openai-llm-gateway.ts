/**
 * `OpenAiLlmGateway` — Phase 5 M4 platform-side LLM client. Replaces
 * the per-solution OpenAI gateway that lived in
 * `solutions/business/live-lesson/backend/src/adapters/observer-engine/openai-llm-gateway.ts`
 * (deleted in M6).
 *
 * Why move to platform: M4 LLM handlers (ChatTurnHandler,
 * StatusChangeHandler) run in the platform process; they need an LLM
 * client there. Co-locating one gateway in `workflow/llm/` instead of
 * per-solution adapters means future Workflow consumers (other tenants
 * or platform-internal flows) reuse it without per-tenant duplication.
 *
 * Env config (same names as the legacy gateway for smooth migration):
 *   - `LLM_API_KEY` — required
 *   - `LLM_OBSERVER_MODEL` — defaults `deepseek-v4-flash`
 *   - `LLM_BASE_URL` — defaults `https://api.deepseek.com`
 *
 * Errors surface as thrown `Error`s — handler code is responsible for
 * catching + falling back to a deterministic skip behavior.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  LlmChatMessage,
  LlmCompletionOptions,
  LlmGateway,
} from './llm-gateway';

@Injectable()
export class OpenAiLlmGateway implements LlmGateway {
  private readonly logger = new Logger(OpenAiLlmGateway.name);

  constructor(private readonly configService: ConfigService) {}

  async chat(
    messages: readonly LlmChatMessage[],
    options?: LlmCompletionOptions,
  ): Promise<string> {
    const apiKey = this.configService.get<string>('LLM_API_KEY');
    if (!apiKey) {
      throw new Error('LLM_API_KEY not configured');
    }

    const model =
      this.configService.get<string>('LLM_OBSERVER_MODEL') ?? 'deepseek-v4-flash';
    const baseUrl =
      this.configService.get<string>('LLM_BASE_URL') ?? 'https://api.deepseek.com';

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: options?.maxTokens ?? 256,
      temperature: options?.temperature ?? 0.3,
    };
    if (options?.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Pass-1 review N2: some upstreams echo the Authorization header
      // back in their error body (e.g. on 401). Redact any `Bearer …`
      // before raising so the key cannot flow into downstream logs.
      const safe = redactBearer(text);
      throw new Error(`LLM API error ${res.status}: ${safe}`);
    }

    const data = (await res.json()) as {
      choices?: ReadonlyArray<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? '';
  }
}

function redactBearer(text: string): string {
  return text.replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/g, 'Bearer [REDACTED]');
}
