import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LlmGateway, LlmChatMessage, LlmCompletionOptions } from '@kedge-agentic/observer-engine';

@Injectable()
export class GlmLlmGateway implements LlmGateway {
  private readonly logger = new Logger(GlmLlmGateway.name);

  constructor(private readonly configService: ConfigService) {}

  async chat(messages: LlmChatMessage[], options?: LlmCompletionOptions): Promise<string> {
    const apiKey = this.configService.get<string>('ZHIPU_API_KEY');
    if (!apiKey) {
      throw new Error('ZHIPU_API_KEY not configured');
    }

    const model = this.configService.get<string>('ZHIPU_OBSERVER_MODEL') || 'glm-4-flash';

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: options?.maxTokens ?? 256,
      temperature: options?.temperature ?? 0.3,
    };
    if (options?.responseFormat === 'json') {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GLM API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}
