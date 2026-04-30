import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Builds AI prompts and handles GLM API calls.
 * Owns all prompt construction logic (ask + discuss) and response parsing.
 */
@Injectable()
export class AiPromptBuilder {
  private readonly logger = new Logger(AiPromptBuilder.name);

  constructor(private readonly configService: ConfigService) {}

  /** Shared L1-L3 context layers for AI prompts */
  buildBaseContextLayers(manifest: any, stepDef: any): string[] {
    const layers: string[] = [];
    const paragraphs: Array<{ id: string; text: string }> = manifest.article?.paragraphs || [];

    // Layer 1: Role
    layers.push(`你是一位专业的英语阅读教学助教，正在帮助中学生学习阅读理解策略。
你的教学风格是苏格拉底式引导——通过提问帮助学生自己发现答案，而不是直接告诉他们。`);

    // Layer 2: Article full text
    if (paragraphs.length > 0) {
      const articleTitle = manifest.article?.title || '';
      const articleText = paragraphs.map((p: any, i: number) => `¶${i + 1}: ${p.text}`).join('\n\n');
      layers.push(`【课文全文】\n标题：${articleTitle}\n\n${articleText}`);
    }

    // Layer 3: Step context
    if (stepDef) {
      const focusParas = stepDef.focusParagraphs?.join(', ') || '全文';
      layers.push(`【当前步骤】\n步骤：${stepDef.label || ''}\n策略：${stepDef.strategy || 'N/A'}\n描述：${stepDef.description || 'N/A'}\n关注段落：${focusParas}`);
    }

    return layers;
  }

  /** Build system prompt for the /ai/ask endpoint */
  buildAskSystemPrompt(manifest: any, step: number): string {
    const readingSteps = manifest.readingSteps || [];
    const stepDef = readingSteps.find((s: any) => s.idx === step);
    const referenceQA: Array<{ q: string; a: string; category: string }> = manifest.aiReferenceQA || [];

    const layers = this.buildBaseContextLayers(manifest, stepDef);

    // Layer 4: Answer key awareness (task steps only)
    if (stepDef?.answerKey) {
      layers.push(`【答案信息（仅供参考，严禁直接告诉学生）】\n题型：${stepDef.answerKey.type}\n你知道正确答案，但绝对不能直接告诉学生。如果学生问答案，用提示和引导帮助他们自己找到。`);
    }

    // Layer 5: Reference Q&A (few-shot)
    if (referenceQA.length > 0) {
      const examples = referenceQA.map((qa: any) => `Q: ${qa.q}\nA: 【${qa.category}】${qa.a}`).join('\n\n');
      layers.push(`【参考问答示例】\n${examples}`);
    }

    // Layer 6: Classification instruction
    layers.push(`【回答格式要求】
1. 回答开头必须用【分类名】标注问题类型
2. 可用分类：概念理解、阅读策略、课文内容、解题求助
3. 如果问题不属于以上分类，可以创建新的合适分类名
4. 分类后直接给出回答内容

分类回答策略：
- 概念理解 → 直接解释，给出清晰定义和例子
- 阅读策略 → 给步骤指导，用课文中的例子说明
- 课文内容 → 引用原文段落回答
- 解题求助 → 苏格拉底式引导，绝不给出答案

回答规则：
- 用中文回答
- 简洁，2-3句话（30-150字），绝不超过150字
- 鼓励学生自己思考`);

    return layers.join('\n\n');
  }

  /** Fallback prompt when manifest is unavailable */
  buildFallbackPrompt(): string {
    return `你是一位教学助教，正在帮助学生学习阅读理解。

【回答格式要求】
1. 回答开头必须用【分类名】标注问题类型
2. 可用分类：概念理解、阅读策略、课文内容、解题求助

回答规则：
- 用苏格拉底式引导：给提示和思路，不直接给出答案
- 用中文回答
- 简洁，2-3 句话
- 鼓励学生自己思考`;
  }

  /** Build the full discuss system prompt with L1-L8 layers */
  buildDiscussSystemPrompt(
    manifest: any,
    stepDef: any,
    submission: { scoreJson: any; dataJson: any } | null,
    interactionType: 'probeReply' | 'followUpReply',
    priorObservationContext?: string | null,
  ): string {
    // L1-L3: shared base layers
    const layers = this.buildBaseContextLayers(manifest, stepDef);

    // L4: Student performance from submission
    if (submission) {
      const score = submission.scoreJson;
      const data = submission.dataJson;
      const scoreSummary = score
        ? `Score: ${score.total ?? 'N/A'}%${score.byDimension ? `, Details: ${JSON.stringify(score.byDimension)}` : ''}`
        : 'No score available';
      const answerSummary = data
        ? `Student answers: ${JSON.stringify(data).slice(0, 500)}`
        : '';
      layers.push(`【L4: Student Practice Performance】\n${scoreSummary}\n${answerSummary}`);
    }

    // L4.5: Prior observation context (if student has events in this step)
    if (priorObservationContext) {
      layers.push(`【L4.5: Prior Observations for This Student】\n${priorObservationContext}`);
    }

    // L5: Pedagogical intent from manifest discuss field
    const discuss = stepDef?.discuss;
    if (discuss) {
      const parts = [`【L5: Pedagogical Intent for Discuss Phase】`];
      if (discuss.targetInsight) parts.push(`Target insight: ${discuss.targetInsight}`);
      if (discuss.commonMisconceptions?.length) {
        parts.push(`Common misconceptions:\n${discuss.commonMisconceptions.map((m: string) => `- ${m}`).join('\n')}`);
      }
      if (discuss.scaffoldStrategies?.length) {
        parts.push(`Scaffold strategies:\n${discuss.scaffoldStrategies.map((s: string) => `- ${s}`).join('\n')}`);
      }
      layers.push(parts.join('\n'));
    }

    // L6: placeholder for student response (provided as user message)
    layers.push(`【L6: Student Response】\nThe student's response will be provided as the user message.`);

    // L7: Interaction type — JSON output schema
    if (interactionType === 'probeReply') {
      layers.push(`【L7: Interaction Type — probeReply】
You are responding to the student's answer to the probe question.
Respond with a JSON object with exactly these keys:
{"reply": "your reply (60-100 words)", "followUpQuestion": "your follow-up question (1-2 sentences)", "quality": "pass or retry", "depth": "surface or partial or deep"}`);
    } else {
      layers.push(`【L7: Interaction Type — followUpReply】
You are responding to the student's answer to a follow-up question.
Provide a concluding reply that wraps up the discussion. Do NOT ask another question.
Respond with a JSON object with exactly these keys:
{"reply": "your concluding reply (60-100 words)", "quality": "pass or retry", "depth": "surface or partial or deep"}
Do NOT include a followUpQuestion key.`);
    }

    // L8: Output format rules
    layers.push(`【L8: Output Format Rules】
- Write in English
- Keep reply to 60-100 words
- Use ¶N to reference specific paragraphs
- CRITICAL: Do NOT fabricate quotes from the text. When citing ¶N, only quote text that actually exists in the article above.
- Be encouraging but substantive — push thinking forward
- Reference the student's specific words when possible
- "pass" = student showed genuine engagement with the text or question
- "retry" = response is minimal ("I don't know"), off-topic, or shows no engagement
- When in doubt, give "pass" — we want to encourage, not block
- Depth judgment:
  - "surface" = student restates facts from the text without analysis or reasoning
  - "partial" = student shows some analysis but misses the core insight or connection
  - "deep" = student explains WHY/HOW and connects evidence to a broader principle or the target insight
- Output ONLY valid JSON — no markdown, no code fences, no extra text`);

    return layers.join('\n\n');
  }

  buildDiscussFallbackPrompt(interactionType: string): string {
    const base = `You are a Socratic English reading tutor. Respond to the student's answer thoughtfully in 60-100 words.`;
    if (interactionType === 'probeReply') {
      return base + `\n\nRespond with a JSON object: {"reply": "your reply", "followUpQuestion": "your follow-up question", "quality": "pass or retry", "depth": "surface or partial or deep"}`;
    }
    return base + `\n\nRespond with a JSON object: {"reply": "your reply", "quality": "pass or retry", "depth": "surface or partial or deep"}`;
  }

  parseCategoryFromResponse(response: string): { category: string; answer: string } {
    const match = response.match(/^【(.+?)】/);
    if (match) {
      return { category: match[1], answer: response.slice(match[0].length).trim() };
    }
    return { category: '其他', answer: response };
  }

  parseDiscussResponse(
    raw: string,
    interactionType: string,
  ): { reply: string; followUpQuestion?: string; quality: 'pass' | 'retry'; depth?: 'surface' | 'partial' | 'deep' } {
    const extract = (parsed: any): { reply: string; followUpQuestion?: string; quality: 'pass' | 'retry'; depth?: 'surface' | 'partial' | 'deep' } => {
      const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : raw.trim();
      const quality: 'pass' | 'retry' = parsed.quality === 'retry' ? 'retry' : 'pass';
      const depth: 'surface' | 'partial' | 'deep' | undefined =
        parsed.depth === 'surface' || parsed.depth === 'partial' || parsed.depth === 'deep'
          ? parsed.depth : undefined;
      if (interactionType === 'followUpReply') {
        return { reply, quality, depth };
      }
      const followUpQuestion = typeof parsed.followUpQuestion === 'string'
        ? parsed.followUpQuestion.trim() || undefined
        : undefined;
      return { reply, followUpQuestion, quality, depth };
    };

    try {
      return extract(JSON.parse(raw));
    } catch {
      // Strip markdown code fences and retry
      const cleaned = raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim();
      try {
        return extract(JSON.parse(cleaned));
      } catch {
        // Truly unparseable — raw text is the reply, default pass
        return { reply: raw.trim(), quality: 'pass' as const };
      }
    }
  }

  /**
   * Parse with LLM repair fallback: sync parse → code-fence strip → LLM repair → raw fallback.
   * When JSON.parse fails, sends the raw text back to GLM with the target schema
   * and json_object mode so the LLM can fix its own output.
   */
  async parseOrRepairDiscussResponse(
    raw: string,
    interactionType: string,
  ): Promise<{ reply: string; followUpQuestion?: string; quality: 'pass' | 'retry'; depth?: 'surface' | 'partial' | 'deep' }> {
    // Fast path: sync parse succeeds
    const cleaned = raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim();
    let jsonOk = false;
    try { JSON.parse(raw); jsonOk = true; } catch {}
    if (!jsonOk) try { JSON.parse(cleaned); jsonOk = true; } catch {}

    if (jsonOk) {
      return this.parseDiscussResponse(raw, interactionType);
    }

    // JSON broken — ask LLM to repair
    this.logger.warn(`Discuss JSON parse failed, attempting LLM repair (${raw.length} chars)`);
    const schema = interactionType === 'probeReply'
      ? '{"reply": "string", "followUpQuestion": "string", "quality": "pass or retry", "depth": "surface or partial or deep"}'
      : '{"reply": "string", "quality": "pass or retry", "depth": "surface or partial or deep"}';
    try {
      const repaired = await this.callGlm(
        `Convert the following text into valid JSON matching this exact schema:\n${schema}\nExtract the reply, follow-up question (if any), and quality judgment from the text.\nOutput ONLY the JSON object.`,
        raw,
        { maxTokens: 512, temperature: 0, responseFormat: { type: 'json_object' } },
      );
      return this.parseDiscussResponse(repaired, interactionType);
    } catch (e) {
      this.logger.warn(`LLM repair also failed: ${e}`);
      return { reply: raw.trim(), quality: 'pass' as const };
    }
  }

  /** Build prompt for personal-touch AI comment */
  buildPersonalTouchPrompt(
    strategies: Array<{ task: number; strategy: string; score: number; attempts: number }>,
  ): { system: string; user: string } {
    const system = `你是英语阅读教学助教，正在给学生写课后个性化反馈。
规则：
- 用中文
- 3-5 句话，不超过 150 字
- 先肯定优点（最高分策略），再给一条具体建议（最低分策略）
- 鼓励语气，温暖真诚
- 不要使用"同学"称呼，直接用"你"`;

    const lines = strategies.map(
      s => `Task ${s.task} - ${s.strategy}: 得分 ${s.score}%, 尝试 ${s.attempts} 次`,
    );
    const user = `学生在以下 4 个阅读策略练习中的表现：\n${lines.join('\n')}\n\n请根据以上数据写一段个性化反馈。`;

    return { system, user };
  }

  async callGlm(
    systemPrompt: string,
    userMessage: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      responseFormat?: { type: 'json_object' };
      model?: string;
    },
  ): Promise<string> {
    const apiKey = this.configService.get<string>('ZHIPU_API_KEY');
    if (!apiKey) {
      throw new Error('ZHIPU_API_KEY not configured');
    }
    const model = options?.model || this.configService.get<string>('ZHIPU_MODEL') || 'glm-4-flash';

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: options?.maxTokens ?? 256,
      temperature: options?.temperature ?? 0.7,
    };
    if (options?.responseFormat) {
      body.response_format = options.responseFormat;
    }

    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GLM API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? 'AI 未返回有效回答。';
  }
}
