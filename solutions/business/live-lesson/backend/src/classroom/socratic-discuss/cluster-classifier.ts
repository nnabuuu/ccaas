import { Injectable, Logger } from '@nestjs/common';
import { AiPromptBuilder } from '../ai-prompt-builder';
import type { DiscussCluster } from '../../schemas/manifest.schema';
import type { ClassifyResult } from '../../schemas/classroom/clustering';

@Injectable()
export class ClusterClassifier {
  private readonly logger = new Logger(ClusterClassifier.name);

  constructor(private readonly aiPromptBuilder: AiPromptBuilder) {}

  async classify(
    studentMessage: string,
    clusters: DiscussCluster[],
    conversationContext?: string,
  ): Promise<ClassifyResult> {
    const validIds = [...clusters.map(c => c.id), 'other'];

    const clusterDefs = clusters
      .map(c => `${c.id}: ${c.label}\n  ${c.description}`)
      .join('\n\n');

    const systemPrompt = `你是教学观察助手。判断学生发言最匹配哪个预设类别。

CATEGORIES:
${clusterDefs}

other: 以上类别都不匹配的发言

RULES:
- cluster_id 必须是 [${validIds.join(', ')}] 之一，不允许其他值
- confidence: "high" = 明确匹配, "medium" = 可能匹配但不确定, "low" = 勉强归类
- evidence_span: 学生原话中支撑判断的片段（原文摘录，不要改写）
- event_type: "new_signal" = 学生首次表现出这种倾向, "reinforcing" = 继续表现已有倾向无新信息, "state_change" = 认知状态变化（从困惑到澄清，或从一种误解转向另一种）

HIGHLIGHT DETECTION:
- is_highlight: true 当学生提出了预设类别之外的、有教学信息价值的新角度或深度思考
  - 例如：跨文化对比中学生自发引入了课文未提及的新案例
  - 例如：学生对观点提出了有逻辑的反驳
  - 例如：学生建立了课文不同部分之间的意外联系
- is_highlight: false 当发言是常规的对错回答、简单重复、或离题
- highlight_gist: 若 is_highlight 为 true，用一句中文说明该亮点的价值

输出格式（纯 JSON）:
{"cluster_id": "...", "confidence": "...", "evidence_span": "...", "event_type": "...", "is_highlight": false}
或
{"cluster_id": "other", "confidence": "low", "evidence_span": "...", "event_type": "new_signal", "is_highlight": true, "highlight_gist": "学生自发引入日本审美案例，扩展了课文的跨文化视角"}

${conversationContext ? `CONVERSATION CONTEXT:\n${conversationContext}` : ''}`;

    const raw = await this.aiPromptBuilder.callLlm(systemPrompt, studentMessage, {
      responseFormat: { type: 'json_object' },
      maxTokens: 200,
      temperature: 0,
    });

    return this.parseResult(raw, validIds);
  }

  private parseResult(raw: string, validIds: string[]): ClassifyResult {
    let parsed: any;
    try {
      parsed = JSON.parse(raw.replace(/^```(?:json)?\s*\n?|\n?```\s*$/g, '').trim());
    } catch {
      this.logger.warn(`Cluster classify JSON parse failed: ${raw.slice(0, 200)}`);
      return { clusterId: 'other', confidence: 'low', evidenceSpan: '', eventType: 'new_signal', isHighlight: false };
    }

    const clusterId = validIds.includes(parsed.cluster_id) ? parsed.cluster_id : 'other';
    const confidence = ['high', 'medium', 'low'].includes(parsed.confidence)
      ? (parsed.confidence as ClassifyResult['confidence'])
      : 'low';
    const evidenceSpan = typeof parsed.evidence_span === 'string' ? parsed.evidence_span : '';
    const eventType = ['new_signal', 'reinforcing', 'state_change'].includes(parsed.event_type)
      ? (parsed.event_type as ClassifyResult['eventType'])
      : 'new_signal';

    const isHighlight = parsed.is_highlight === true;
    const highlightGist = isHighlight && typeof parsed.highlight_gist === 'string'
      ? parsed.highlight_gist
      : undefined;

    return { clusterId, confidence, evidenceSpan, eventType, isHighlight, highlightGist };
  }
}
