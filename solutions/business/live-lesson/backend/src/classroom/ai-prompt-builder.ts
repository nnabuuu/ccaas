import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Builds AI prompts and handles LLM API calls.
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
    const isReading = manifest.lessonType === 'reading' || paragraphs.length > 0;

    // Layer 1: Role — adapt to lesson type
    if (isReading) {
      layers.push(`你是一位专业的英语阅读教学助教，正在帮助中学生学习阅读理解策略。
你的教学风格是苏格拉底式引导——通过提问帮助学生自己发现答案，而不是直接告诉他们。`);
    } else {
      const subject = manifest.subject || '学科';
      const grade = manifest.gradeLevel || '中学';
      layers.push(`你是一位${grade}${subject}教学助手。
你的教学风格是苏格拉底式引导——通过提问帮助学生自己发现答案，而不是直接告诉他们。`);
    }

    // Layer 2: Article full text (reading lessons only)
    if (paragraphs.length > 0) {
      const articleTitle = manifest.article?.title || '';
      const articleText = paragraphs.map((p: any, i: number) => `¶${i + 1}: ${p.text}`).join('\n\n');
      layers.push(`【课文全文】\n标题：${articleTitle}\n\n${articleText}\n\n（引用段落时请用 ¶N 格式，如 ¶1、¶3-5。学生端会将其渲染为可点击链接，点击后自动高亮对应段落。）`);
    }

    // Layer 3: Step context
    if (stepDef) {
      if (isReading) {
        const focusParas = stepDef.focusParagraphs?.join(', ') || '全文';
        layers.push(`【当前步骤】\n步骤：${stepDef.label || ''}\n策略：${stepDef.strategy || 'N/A'}\n描述：${stepDef.description || 'N/A'}\n关注段落：${focusParas}`);
      } else {
        layers.push(`【当前步骤】\n步骤：${stepDef.label || ''}\n描述：${stepDef.description || 'N/A'}`);
      }
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
    const paragraphsAsk = manifest.article?.paragraphs || [];
    const isReadingAsk = manifest.lessonType === 'reading' || paragraphsAsk.length > 0;
    if (isReadingAsk) {
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
    } else {
      layers.push(`【回答格式要求】
1. 回答开头必须用【分类名】标注问题类型
2. 可用分类：概念理解、解题方法、公式应用、解题求助
3. 如果问题不属于以上分类，可以创建新的合适分类名
4. 分类后直接给出回答内容

分类回答策略：
- 概念理解 → 直接解释，给出清晰定义和例子
- 解题方法 → 给步骤指导，用具体例子说明
- 公式应用 → 说明适用条件和使用方法
- 解题求助 → 苏格拉底式引导，绝不给出答案

回答规则：
- 用中文回答
- 简洁，2-3句话（30-150字），绝不超过150字
- 鼓励学生自己思考`);
    }

    return layers.join('\n\n');
  }

  /** Build system prompt for Continue Chat (post-discuss, answer revealed) */
  buildContinueChatPrompt(manifest: any, step: number): string {
    const readingSteps = manifest.readingSteps || [];
    const stepDef = readingSteps.find((s: any) => s.idx === step);

    const layers = this.buildBaseContextLayers(manifest, stepDef);

    // Override L1 role for post-discuss context
    const paragraphs = manifest.article?.paragraphs || [];
    const isReadingChat = manifest.lessonType === 'reading' || paragraphs.length > 0;
    if (isReadingChat) {
      layers[0] = `你是英语阅读助教，学生已完成练习并看到了答案，现在在做延伸讨论。
你的目标是帮助学生深入理解，可以自由引用答案和课文来解释。`;
    } else {
      const subject = manifest.subject || '学科';
      layers[0] = `你是${subject}教学助手，学生已完成练习并看到了答案，现在在做延伸讨论。
你的目标是帮助学生深入理解。`;
    }

    // L4: Answer key (freely available)
    if (stepDef?.answerKey) {
      layers.push(`【正确答案】\n${JSON.stringify(stepDef.answerKey, null, 2)}\n\n学生已经看到答案，你可以直接引用答案来帮助解释。`);
    }

    // L5: Discuss explanation & insight
    const discuss = stepDef?.discuss;
    if (discuss) {
      const parts: string[] = [];
      if (discuss.fallbackMC?.explanation) {
        parts.push(`解析：${discuss.fallbackMC.explanation}`);
      }
      if (discuss.insight) {
        parts.push(`核心洞察：${discuss.insight}`);
      }
      if (parts.length > 0) {
        layers.push(`【参考解析】\n${parts.join('\n')}`);
      }
    }

    // L6: Response rules
    layers.push(`【回答规则】
- 直接解释，可以引用答案${isReadingChat ? '和课文' : ''}
- 鼓励学生深入思考、提出更多问题
- 用中文回答
- 简洁明了，不超过 200 字`);

    return layers.join('\n\n');
  }

  /** Fallback prompt when manifest is unavailable */
  buildFallbackPrompt(): string {
    return `你是一位教学助教，正在帮助学生学习。

【回答格式要求】
1. 回答开头必须用【分类名】标注问题类型
2. 可用分类：概念理解、学习策略、课程内容、解题求助

回答规则：
- 用苏格拉底式引导：给提示和思路，不直接给出答案
- 用中文回答
- 简洁，2-3 句话
- 鼓励学生自己思考`;
  }

  /** Build Socratic discuss prompt — uses manifest systemPrompt directly */
  buildSocraticPrompt(
    manifest: any,
    stepDef: any,
    submission: { scoreJson: any; dataJson: any } | null,
    priorObservationContext?: string | null,
  ): string {
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

    // L4.5: Prior observation context
    if (priorObservationContext) {
      layers.push(`【L4.5: Prior Observations for This Student】\n${priorObservationContext}`);
    }

    // L5: Socratic system prompt from manifest (replaces old L5-L8)
    const discuss = stepDef?.discuss;
    if (discuss?.systemPrompt) {
      layers.push(discuss.systemPrompt);
    }

    return layers.join('\n\n');
  }

  /** @deprecated Use buildSocraticPrompt instead */
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

  /**
   * Build system prompt for translate endpoint.
   * Stable per lesson+step — DeepSeek prefix caching shares this across requests.
   * sourceContext goes in the user message (variable per request).
   */
  buildTranslatePrompt(manifest: any, stepDef: any): string {
    const layers: string[] = [];
    const paragraphs = manifest.article?.paragraphs || [];
    const isReading = manifest.lessonType === 'reading' || paragraphs.length > 0;

    // L1: Translate-specific role
    if (isReading) {
      layers.push(`你是一位英语阅读教学助教，帮助中学生理解阅读中遇到的生词和短语。`);
    } else {
      const subject = manifest.subject || '学科';
      layers.push(`你是一位${subject}教学助手，帮助中学生理解学习中遇到的术语和概念。`);
    }

    // L2-L3: Reuse article + step context from base layers
    const base = this.buildBaseContextLayers(manifest, stepDef);
    if (base[1]) layers.push(base[1]); // L2: article full text (if exists)
    if (base[2]) layers.push(base[2]); // L3: step context

    // L4: JSON output schema
    layers.push(`【输出格式】
返回 JSON: { "definition": "...", "contextAnalysis": "...", "suggestedQuestions": ["...", "..."] }
- definition: 中文释义，结合上下文语境（不超过 50 字）
- contextAnalysis: 该词/短语在当前语境中的含义分析（不超过 100 字）
- suggestedQuestions: 2-3 个帮助深入理解的追问（中文）
- 输出纯 JSON，不加 markdown 代码块`);

    return layers.join('\n\n');
  }

  /**
   * Build system prompt for translate chat (follow-up questions).
   * Stable per lesson+step+word — shares DeepSeek cache with translate calls (L1-L3 identical).
   */
  buildTranslateChatPrompt(
    manifest: any,
    stepDef: any,
    originalText: string,
    definition: string,
  ): string {
    const layers: string[] = [];

    // L1-L3: Same as translate (shared prefix cache)
    const paragraphs = manifest.article?.paragraphs || [];
    const isReading = manifest.lessonType === 'reading' || paragraphs.length > 0;
    if (isReading) {
      layers.push(`你是一位英语阅读教学助教，帮助中学生理解阅读中遇到的生词和短语。`);
    } else {
      const subject = manifest.subject || '学科';
      layers.push(`你是一位${subject}教学助手，帮助中学生理解学习中遇到的术语和概念。`);
    }
    const base = this.buildBaseContextLayers(manifest, stepDef);
    if (base[1]) layers.push(base[1]);
    if (base[2]) layers.push(base[2]);

    // L4: Original word + cached definition
    layers.push(`【翻译上下文】\n学生查询的词/短语：「${originalText}」\n释义：${definition}`);

    // L5: Chat rules
    layers.push(`【回答规则】
- 用中文回答
- 简洁明了，不超过 200 字
${isReading ? '- 结合课文语境解释' : '- 结合当前学习内容解释'}
- 帮助学生深入理解该词/短语的用法和含义`);

    return layers.join('\n\n');
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

  /** Build prompt for recap AI summary (综合回顾 + 分模块点评 + 成长建议) */
  buildRecapPrompt(data: {
    strategies: Array<{ task: number; strategy: string; score: number; attempts: number }>;
    highlights: Array<{ taskNum: number; gist: string; evidenceSpan: string }>;
    aiStats: { translateCount: number; askCount: number; discussRounds: number };
    tier: { label: string; labelEn: string; tone: string } | null;
    manifest?: { lessonType?: string; subject?: string; article?: { paragraphs?: unknown[] } };
  }): { system: string; user: string } {
    const isReading = !data.manifest || data.manifest.lessonType === 'reading' || (data.manifest.article?.paragraphs?.length ?? 0) > 0;
    const roleLabel = isReading ? '英语阅读教学助教' : `${data.manifest?.subject || '学科'}教学助手`;
    const system = `你是${roleLabel}，正在为学生写课后个性化回顾总结。

输出格式——用 markdown，分三段，每段带加粗小标题：
1. **综合回顾**：1-2 句，概括这节课的整体表现，语气温暖肯定
2. **课堂亮点**：2-3 句，分别点评练习表现（得分、掌握情况）、讨论发言、AI 工具使用情况
3. **成长方向**：1 句，基于薄弱项给出一条具体可行的建议

规则：
- 用中文
- 总共不超过 200 字
- 不要使用"同学"称呼，直接用"你"
- 如果讨论亮点为空，跳过讨论点评，改为鼓励下次多参与
- 如果 AI 统计全为 0，鼓励下次尝试
- 语气鼓励、真诚，避免套话`;

    const parts: string[] = [];

    // Practice data
    if (data.strategies.length > 0) {
      const lines = data.strategies.map(
        s => `Task ${s.task} - ${s.strategy}: ${s.score}%, ${s.attempts} 次尝试`,
      );
      parts.push(`【练习表现】\n${lines.join('\n')}`);
    } else {
      parts.push(`【练习表现】无数据`);
    }

    if (data.tier) {
      parts.push(`【综合等级】${data.tier.labelEn} (${data.tier.label})`);
    }

    // Discussion highlights
    if (data.highlights.length > 0) {
      const hlLines = data.highlights.map(
        h => `Task ${h.taskNum}: "${h.evidenceSpan}"`,
      );
      parts.push(`【讨论亮点】\n${hlLines.join('\n')}`);
    } else {
      parts.push(`【讨论亮点】无`);
    }

    // AI stats
    parts.push(`【AI 工具使用】翻译 ${data.aiStats.translateCount} 次，提问 ${data.aiStats.askCount} 次，讨论 ${data.aiStats.discussRounds} 轮`);

    const user = `请根据以下数据为这位学生写课后回顾：\n\n${parts.join('\n\n')}`;

    return { system, user };
  }

  /**
   * Parse with LLM repair fallback: sync parse → code-fence strip → LLM repair → raw fallback.
   * When JSON.parse fails, sends the raw text back to the LLM with the target schema
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
      const repaired = await this.callLlm(
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
    manifest?: { lessonType?: string; subject?: string; article?: { paragraphs?: unknown[] } },
  ): { system: string; user: string } {
    const isReading = !manifest || manifest.lessonType === 'reading' || (manifest.article?.paragraphs?.length ?? 0) > 0;
    const roleLabel = isReading ? '英语阅读教学助教' : `${manifest?.subject || '学科'}教学助手`;
    const system = `你是${roleLabel}，正在给学生写课后个性化反馈。
规则：
- 用中文
- 3-5 句话，不超过 150 字
- 先肯定优点（最高分项），再给一条具体建议（最低分项）
- 鼓励语气，温暖真诚
- 不要使用"同学"称呼，直接用"你"`;

    const lines = strategies.map(
      s => `Task ${s.task} - ${s.strategy}: 得分 ${s.score}%, 尝试 ${s.attempts} 次`,
    );
    const taskLabel = isReading ? '阅读策略练习' : '课堂练习';
    const user = `学生在以下 ${strategies.length} 个${taskLabel}中的表现：\n${lines.join('\n')}\n\n请根据以上数据写一段个性化反馈。`;

    return { system, user };
  }

  async callVisionLlm(
    systemPrompt: string,
    content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>,
    options?: {
      maxTokens?: number;
      temperature?: number;
      responseFormat?: { type: 'json_object' };
      model?: string;
    },
  ): Promise<string> {
    const apiKey = this.configService.get<string>('LLM_VISION_API_KEY')
      || this.configService.get<string>('LLM_API_KEY');
    if (!apiKey) {
      throw new Error('LLM_API_KEY not configured');
    }
    const model = options?.model
      || this.configService.get<string>('LLM_VISION_MODEL')
      || 'qwen-vl-plus';
    const baseUrl = this.configService.get<string>('LLM_VISION_BASE_URL')
      || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      max_tokens: options?.maxTokens ?? 256,
      temperature: options?.temperature ?? 0.7,
    };
    if (options?.responseFormat) {
      body.response_format = options.responseFormat;
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Vision LLM API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? 'AI 未返回有效回答。';
  }

  async callLlm(
    systemPrompt: string,
    userMessage: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      responseFormat?: { type: 'json_object' };
      model?: string;
    },
  ): Promise<string> {
    const apiKey = this.configService.get<string>('LLM_API_KEY');
    if (!apiKey) {
      throw new Error('LLM_API_KEY not configured');
    }
    const model = options?.model || this.configService.get<string>('LLM_MODEL') || 'deepseek-v4-flash';
    const baseUrl = this.configService.get<string>('LLM_BASE_URL') || 'https://api.deepseek.com';

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

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`LLM API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? 'AI 未返回有效回答。';
  }

  /** Multi-turn vision conversation — user messages may contain images */
  async callVisionConversation(
    systemPrompt: string,
    messages: Array<{ role: 'assistant' | 'user'; content: string; images?: string[] }>,
    options?: { maxTokens?: number; temperature?: number },
  ): Promise<string> {
    const apiKey = this.configService.get<string>('LLM_VISION_API_KEY')
      || this.configService.get<string>('LLM_API_KEY');
    if (!apiKey) {
      throw new Error('LLM_API_KEY not configured');
    }
    const model = this.configService.get<string>('LLM_VISION_MODEL') || 'qwen-vl-plus';
    const baseUrl = this.configService.get<string>('LLM_VISION_BASE_URL')
      || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

    const apiMessages = messages.map(m => {
      if (m.role === 'user' && m.images?.length) {
        const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
          { type: 'text', text: m.content },
          ...m.images.map(url => ({ type: 'image_url' as const, image_url: { url } })),
        ];
        return { role: 'user' as const, content };
      }
      return { role: m.role, content: m.content };
    });

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...apiMessages,
      ],
      max_tokens: options?.maxTokens ?? 512,
      temperature: options?.temperature ?? 0.75,
    };

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Vision LLM API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? 'AI 未返回有效回答。';
  }

  /** Multi-turn conversation call — accepts pre-built messages array */
  async callLlmConversation(
    systemPrompt: string,
    messages: Array<{ role: 'assistant' | 'user'; content: string }>,
    options?: { maxTokens?: number; temperature?: number; model?: string },
  ): Promise<string> {
    const apiKey = this.configService.get<string>('LLM_API_KEY');
    if (!apiKey) {
      throw new Error('LLM_API_KEY not configured');
    }
    const model = options?.model || this.configService.get<string>('LLM_MODEL') || 'deepseek-v4-flash';
    const baseUrl = this.configService.get<string>('LLM_BASE_URL') || 'https://api.deepseek.com';

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: options?.maxTokens ?? 512,
      temperature: options?.temperature ?? 0.75,
    };

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`LLM API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? 'AI 未返回有效回答。';
  }
}
